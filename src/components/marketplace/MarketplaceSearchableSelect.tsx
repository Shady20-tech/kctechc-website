"use client";

import { Check, ChevronDown, Search } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";

/**
 * A searchable single-select.
 *
 * A native `<select>` cannot be typed into, and the geography hierarchy has 58
 * divisions and 360 subdivisions — a list long enough that scrolling to find one
 * is the actual interaction cost. This is a combobox: a text input that filters
 * the options as the visitor types, with a listbox below.
 *
 * It is a controlled component whose value comes from the URL, not from local
 * state: the parent re-renders it from the parsed filter state, so the control
 * and the address bar cannot disagree. Choosing an option calls `onSelect` and
 * the parent navigates — the same "the filters ARE the URL" rule the rest of the
 * filter panel follows.
 *
 * Keyboard behaviour follows the ARIA combobox pattern: Down/Up move the active
 * option, Enter chooses it, Escape closes without choosing, and the active option
 * is announced through `aria-activedescendant` rather than by moving focus.
 */
export type MarketplaceSearchableOption = {
  value: string;
  label: string;
  /** A trailing count, shown only when greater than zero. */
  count?: number;
};

export function MarketplaceSearchableSelect({
  id,
  label,
  hint,
  options,
  value,
  placeholder,
  emptyLabel,
  disabled,
  disabledHint,
  onSelect,
  countLabel,
}: {
  id: string;
  label: string;
  hint?: string;
  options: readonly MarketplaceSearchableOption[];
  value: string;
  placeholder: string;
  /** The label of the "no selection" option, offered first. */
  emptyLabel: string;
  disabled?: boolean;
  disabledHint?: string;
  onSelect: (value: string) => void;
  /** Formats an option's count, when the option carries one. */
  countLabel?: (name: string, count: number) => string;
}) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = options.find((option) => option.value === value);

  // The "all" option plus the options matching the typed text. Matching is
  // case-insensitive and diacritic-insensitive, so typing "limbe" finds "Limbé".
  const filtered = useMemo(() => {
    const normalized = normalize(query);
    const matches =
      normalized.length === 0
        ? options
        : options.filter((option) =>
            normalize(option.label).includes(normalized),
          );
    return [
      { value: "", label: emptyLabel } as MarketplaceSearchableOption,
      ...matches,
    ];
  }, [options, query, emptyLabel]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const hintId = hint ? `${id}-hint` : undefined;
  const disabledHintId =
    disabled && disabledHint ? `${id}-disabled` : undefined;
  const describedBy =
    [hintId, disabledHintId].filter(Boolean).join(" ") || undefined;

  function choose(option: MarketplaceSearchableOption) {
    onSelect(option.value);
    setQuery("");
    setOpen(false);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (disabled) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) setOpen(true);
      else setActiveIndex((index) => Math.min(index + 1, filtered.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter") {
      if (open && filtered[activeIndex]) {
        event.preventDefault();
        choose(filtered[activeIndex]);
      }
    } else if (event.key === "Escape") {
      setOpen(false);
    } else if (event.key === "Home") {
      setActiveIndex(0);
    } else if (event.key === "End") {
      setActiveIndex(filtered.length - 1);
    }
  }

  const displayValue = open ? query : (selected?.label ?? "");

  return (
    <div ref={rootRef} className="relative">
      <label htmlFor={id} className="block text-sm font-medium text-ink-900">
        {label}
      </label>
      {hint ? (
        <p id={hintId} className="mt-1 text-xs text-muted">
          {hint}
        </p>
      ) : null}
      <div className="relative mt-1.5">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
        />
        <input
          id={id}
          type="text"
          role="combobox"
          autoComplete="off"
          aria-expanded={open}
          aria-controls={listId}
          aria-describedby={describedBy}
          aria-autocomplete="list"
          aria-activedescendant={
            open && filtered[activeIndex]
              ? `${listId}-option-${activeIndex}`
              : undefined
          }
          disabled={disabled}
          placeholder={placeholder}
          value={displayValue}
          onChange={(event) => {
            setQuery(event.currentTarget.value);
            setActiveIndex(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className="w-full rounded-field border border-border-strong bg-surface py-2.5 pl-9 pr-9 text-sm text-ink-900 transition-soft placeholder:text-muted hover:border-ink-500 focus:outline-none focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:bg-surface-sunken disabled:text-muted"
        />
        <button
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          disabled={disabled}
          onClick={() => setOpen((value) => !value)}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-control p-1 text-muted hover:text-ink-900"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>

      {disabled && disabledHint ? (
        <p id={disabledHintId} className="mt-1 text-xs text-muted">
          {disabledHint}
        </p>
      ) : null}

      {open && !disabled ? (
        <ul
          id={listId}
          role="listbox"
          aria-label={label}
          className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-card border border-border bg-surface py-1 shadow-card"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted">{placeholder}</li>
          ) : (
            filtered.map((option, index) => {
              const isSelected = option.value === value;
              return (
                <li
                  key={option.value || "__all"}
                  id={`${listId}-option-${index}`}
                  role="option"
                  aria-selected={isSelected}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    choose(option);
                  }}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={`flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm ${
                    index === activeIndex ? "bg-surface-alt" : ""
                  } ${isSelected ? "font-semibold text-dept-accent" : "text-body"}`}
                >
                  <span className="flex items-center gap-2">
                    {isSelected ? (
                      <Check aria-hidden="true" className="h-3.5 w-3.5" />
                    ) : null}
                    {option.label}
                  </span>
                  {option.count !== undefined && option.count > 0 ? (
                    <span className="text-xs text-muted">
                      {countLabel
                        ? countLabel(option.label, option.count)
                        : option.count}
                    </span>
                  ) : null}
                </li>
              );
            })
          )}
        </ul>
      ) : null}
    </div>
  );
}

/** Lower-case and strip diacritics so typing without accents still matches. */
function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}
