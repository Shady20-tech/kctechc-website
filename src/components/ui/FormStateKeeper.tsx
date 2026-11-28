"use client";

import { useEffect } from "react";

/**
 * Keeps in-progress form values alive across navigation and validation errors.
 *
 * Two separate problems are solved here, both caused by React 19's form-action
 * lifecycle rather than by any one form:
 *
 *  * a form action resets uncontrolled fields when it finishes, so a validation
 *    error wiped every correct field the moment the server answered;
 *  * a client navigation unmounts the form, so returning to it lost everything
 *    the person had typed.
 *
 * The values are written to `sessionStorage`, which is tab-local and disappears
 * with the tab. Passwords, file inputs and hidden action plumbing are never
 * stored. Forms marked `data-form-draft="off"` and GET forms (filters, search)
 * are left alone: a stale filter is a worse experience than an empty one.
 *
 * The form's identity is the route and its position in `document.forms`. The
 * reverse-engineered action key is NOT usable: Next renders a `$ACTION_KEY`
 * hidden input in the server HTML and drops it after the form hydrates, so a key
 * built from it differs between the first load and a client navigation and the
 * draft is never found.
 */

const STORAGE_PREFIX = "kc:form-draft:v1";
const MAX_AGE_MS = 8 * 60 * 60 * 1000;

type Values = Record<string, string[]>;

type Pending = { values: Values; key: string };

const pending = new WeakMap<HTMLFormElement, Pending>();

function isEditable(
  field: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
): boolean {
  if (!field.name || field.name.startsWith("$")) return false;
  if (field.disabled) return false;
  if (field instanceof HTMLInputElement) {
    const type = field.type;
    if (
      type === "password" ||
      type === "file" ||
      type === "hidden" ||
      type === "submit" ||
      type === "button" ||
      type === "reset" ||
      type === "image"
    ) {
      return false;
    }
  }
  return true;
}

function persistable(form: HTMLFormElement): boolean {
  if (form.dataset.formDraft === "off") return false;
  if ((form.getAttribute("method") ?? "").toLowerCase() === "get") return false;
  return Array.from(
    form.querySelectorAll<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >("input, select, textarea"),
  ).some(isEditable);
}

function storageKey(form: HTMLFormElement): string {
  const index = Array.from(form.ownerDocument.forms).indexOf(form);
  return `${STORAGE_PREFIX}:${window.location.pathname}:${index}`;
}

function readValues(form: HTMLFormElement): Values {
  const values: Values = {};
  for (const field of Array.from(
    form.querySelectorAll<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >("input, select, textarea"),
  )) {
    if (!isEditable(field)) continue;
    if (
      field instanceof HTMLInputElement &&
      (field.type === "checkbox" || field.type === "radio")
    ) {
      values[field.name] ??= [];
      if (field.checked) values[field.name]!.push(field.value);
      continue;
    }
    if (field instanceof HTMLSelectElement && field.multiple) {
      values[field.name] = Array.from(field.selectedOptions).map(
        (option) => option.value,
      );
      continue;
    }
    values[field.name] = [field.value];
  }
  return values;
}

function setValue(
  field: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
  values: string[],
): void {
  if (
    field instanceof HTMLInputElement &&
    (field.type === "checkbox" || field.type === "radio")
  ) {
    field.checked = values.includes(field.value);
    field.dispatchEvent(new Event("change", { bubbles: true }));
    return;
  }
  if (field instanceof HTMLSelectElement && field.multiple) {
    for (const option of Array.from(field.options)) {
      option.selected = values.includes(option.value);
    }
    field.dispatchEvent(new Event("change", { bubbles: true }));
    return;
  }
  const value = values[0] ?? "";
  const prototype =
    field instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : field instanceof HTMLSelectElement
        ? HTMLSelectElement.prototype
        : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  if (setter) setter.call(field, value);
  else field.value = value;
  field.dispatchEvent(new Event("input", { bubbles: true }));
  field.dispatchEvent(new Event("change", { bubbles: true }));
}

function restoreValues(form: HTMLFormElement, values: Values): void {
  for (const field of Array.from(
    form.querySelectorAll<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >("input, select, textarea"),
  )) {
    if (!isEditable(field)) continue;
    const stored = values[field.name];
    if (!stored) continue;
    setValue(field, stored);
  }
}

function save(form: HTMLFormElement): void {
  if (!persistable(form)) return;
  const values = readValues(form);
  const key = storageKey(form);
  if (Object.keys(values).length === 0) {
    sessionStorage.removeItem(key);
    return;
  }
  try {
    sessionStorage.setItem(
      key,
      JSON.stringify({ savedAt: Date.now(), values }),
    );
  } catch {
    // Storage can be unavailable (private mode, quota, disabled cookies). The
    // form still works; it simply cannot restore a draft.
  }
}

function restore(form: HTMLFormElement): void {
  if (!persistable(form)) return;
  const key = storageKey(form);
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return;
    const parsed = JSON.parse(raw) as { savedAt?: unknown; values?: unknown };
    if (
      typeof parsed.savedAt !== "number" ||
      Date.now() - parsed.savedAt > MAX_AGE_MS ||
      !parsed.values ||
      typeof parsed.values !== "object"
    ) {
      sessionStorage.removeItem(key);
      return;
    }
    restoreValues(form, parsed.values as Values);
  } catch {
    sessionStorage.removeItem(key);
  }
}

function surroundingScope(form: HTMLFormElement): Element {
  return form.closest("section, article, dialog") ?? form.parentElement ?? form;
}

function hasVisibleError(form: HTMLFormElement): boolean {
  const selector = '[role="alert"], [aria-invalid="true"]';
  return Boolean(
    form.querySelector(selector) ||
    surroundingScope(form).querySelector(selector),
  );
}

function hasVisibleSuccess(form: HTMLFormElement): boolean {
  const selector = '[data-alert-tone="success"]';
  return Boolean(
    form.querySelector(selector) ||
    surroundingScope(form).querySelector(selector),
  );
}

function hasVisibleInfo(form: HTMLFormElement): boolean {
  const selector = '[data-alert-tone="info"]';
  return Boolean(
    form.querySelector(selector) ||
    surroundingScope(form).querySelector(selector),
  );
}

/**
 * Headless mount point. Rendered once from the root layout.
 */
export function FormStateKeeper() {
  useEffect(() => {
    // A client navigation keeps this root-layout component mounted while the
    // page's form is replaced. Restoring only on mount/pageshow therefore misses
    // the form that appears after a back/forward transition, so each form is
    // restored once when it enters the DOM.
    const restored = new WeakSet<HTMLFormElement>();
    const restoreAll = () => {
      for (const form of Array.from(document.forms)) {
        if (restored.has(form) || !persistable(form)) continue;
        restored.add(form);
        // A routed form is committed and then hydrated; restoring in the same
        // task can be overwritten by the hydration's default values.
        window.setTimeout(() => {
          if (form.isConnected) restore(form);
        }, 100);
      }
    };
    restoreAll();

    const onInput = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const form = target.closest("form");
      if (form) save(form);
    };

    const onSubmit = (event: Event) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement) || !persistable(form)) return;
      const values = readValues(form);
      pending.set(form, { values, key: storageKey(form) });
      save(form);
    };

    const onReset = (event: Event) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement) || !persistable(form)) return;
      const snapshot = pending.get(form);
      if (!snapshot) return;

      // React resets the form when an action completes. The result is not
      // necessarily painted in the same frame, so wait for it rather than
      // assuming the first tick means success. A validation error restores the
      // snapshot; success clears the draft and lets the reset happen.
      event.preventDefault();
      let attempts = 0;
      const settle = () => {
        if (!pending.has(form)) return;
        if (!form.isConnected) {
          pending.delete(form);
          return;
        }
        if (hasVisibleError(form)) {
          restoreValues(form, snapshot.values);
          pending.delete(form);
          return;
        }
        if (hasVisibleSuccess(form)) {
          try {
            sessionStorage.removeItem(snapshot.key);
          } catch {
            // No storage; nothing to clear.
          }
          pending.delete(form);
          form.reset();
          return;
        }
        if (hasVisibleInfo(form)) {
          // An informational notice is not a validation failure, but it is also
          // not a success that should wipe the draft. Stop waiting and leave the
          // values alone.
          pending.delete(form);
          return;
        }
        if (attempts >= 40) {
          try {
            sessionStorage.removeItem(snapshot.key);
          } catch {
            // No storage; nothing to clear.
          }
          pending.delete(form);
          form.reset();
          return;
        }
        attempts += 1;
        window.setTimeout(settle, 50);
      };
      window.setTimeout(settle, 0);
    };

    const onShow = () => restoreAll();

    // Some action errors render without React dispatching a `reset` event. An
    // alert appearing after a submit is still an unambiguous failure, so restore
    // from the snapshot then as well. The snapshot is cleared once restored, so
    // this cannot fire repeatedly.
    const observer = new MutationObserver(() => {
      restoreAll();
      for (const form of Array.from(document.forms)) {
        const snapshot = pending.get(form);
        if (snapshot && hasVisibleError(form)) {
          restoreValues(form, snapshot.values);
          pending.delete(form);
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    document.addEventListener("input", onInput, true);
    document.addEventListener("change", onInput, true);
    document.addEventListener("submit", onSubmit, true);
    document.addEventListener("reset", onReset, true);
    window.addEventListener("pageshow", onShow);
    window.addEventListener("popstate", onShow);

    return () => {
      observer.disconnect();
      document.removeEventListener("input", onInput, true);
      document.removeEventListener("change", onInput, true);
      document.removeEventListener("submit", onSubmit, true);
      document.removeEventListener("reset", onReset, true);
      window.removeEventListener("pageshow", onShow);
      window.removeEventListener("popstate", onShow);
    };
  }, []);

  return null;
}
