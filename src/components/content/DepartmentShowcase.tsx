"use client";

import { ArrowRight, Check } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { ShowcasePanel } from "@/lib/content/department-showcase";
import { departmentScopeProps } from "@/lib/theme/department-scope";

/**
 * Department services showcase.
 *
 * One tab per department, each revealing the real catalogue for that department.
 * The point of the tabs is not novelty: three full catalogues stacked vertically
 * is a very long page, and a visitor arriving at the gateway has already chosen a
 * department by the time they want detail. Tabs keep the section to one screen
 * while still exposing every department's range.
 *
 * Progressive enhancement is the constraint that shapes the markup. All panels
 * are rendered on the server and every one of them stays in the DOM — the
 * inactive ones are hidden with `hidden`, which is a presentation state, not an
 * unmount. That means:
 *
 *   - a crawler reads all three catalogues without running any script;
 *   - a no-JavaScript visitor gets the first panel and can still follow every
 *     department link inside it;
 *   - the panel switch is a class change, so nothing is fetched and nothing
 *     re-lays-out beyond the panel itself.
 *
 * `hidden` rather than `display:none` via a class, because the attribute is what
 * assistive technology honours; a CSS-only hide leaves the inactive panel in the
 * accessibility tree, which is how a tab set ends up reading three departments'
 * contents as one.
 *
 * The tab list is a real `role="tablist"` with roving arrow-key support: the
 * arrow keys are what a keyboard user expects from a tab set, and without them
 * the control is three buttons that happen to be adjacent. Home/End jump to the
 * ends, matching the WAI-ARIA authoring practice.
 *
 * Each panel sets its own `data-department`, so the accents inside it follow the
 * department being shown rather than the page it is embedded in. Forgetting that
 * is the documented silent fallback: the panel would render in corporate teal
 * and nothing would error.
 */
export function DepartmentShowcase({
  panels,
  eyebrow,
  heading,
  headingId,
  intro,
  tabsLabel,
}: {
  panels: readonly ShowcasePanel[];
  eyebrow: string;
  heading: string;
  /** Id for the `h2`, so the enclosing band can be labelled by it. */
  headingId: string;
  intro: string;
  tabsLabel: string;
}) {
  const [active, setActive] = useState(0);
  if (panels.length === 0) return null;

  const activeIndex = Math.min(active, panels.length - 1);

  const focusTab = (index: number) => {
    const next = (index + panels.length) % panels.length;
    setActive(next);
    document.getElementById(`showcase-tab-${panels[next]?.department}`)?.focus();
  };

  return (
    <div>
      <div className="max-w-2xl">
        <p className="mono-label text-dept-accent">{eyebrow}</p>
        <h2
          id={headingId}
          className="display-tight mt-3 font-display text-3xl font-bold text-ink-900 sm:text-4xl"
        >
          {heading}
        </h2>
        <p className="mt-4 text-base text-body">{intro}</p>
      </div>

      <div
        role="tablist"
        aria-label={tabsLabel}
        className="mt-8 flex flex-wrap gap-2"
      >
        {panels.map((panel, index) => {
          const selected = index === activeIndex;
          return (
            <button
              key={panel.department}
              type="button"
              role="tab"
              id={`showcase-tab-${panel.department}`}
              aria-selected={selected}
              aria-controls={`showcase-panel-${panel.department}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(index)}
              onKeyDown={(event) => {
                if (event.key === "ArrowRight") {
                  event.preventDefault();
                  focusTab(index + 1);
                } else if (event.key === "ArrowLeft") {
                  event.preventDefault();
                  focusTab(index - 1);
                } else if (event.key === "Home") {
                  event.preventDefault();
                  focusTab(0);
                } else if (event.key === "End") {
                  event.preventDefault();
                  focusTab(panels.length - 1);
                }
              }}
              className={`showcase-tab inline-flex items-center gap-2 rounded-pill border px-4 py-2 text-sm font-semibold transition-soft ${
                selected
                  ? "border-transparent bg-ink-950 text-white"
                  : "border-border-strong bg-surface text-ink-900 hover:border-dept-accent-secondary hover:text-dept-accent-secondary"
              }`}
            >
              {selected ? (
                <Check aria-hidden="true" className="h-4 w-4" />
              ) : null}
              {panel.label}
            </button>
          );
        })}
      </div>

      {panels.map((panel, index) => (
        <div
          key={panel.department}
          role="tabpanel"
          id={`showcase-panel-${panel.department}`}
          aria-labelledby={`showcase-tab-${panel.department}`}
          hidden={index !== activeIndex}
          tabIndex={0}
          className="mt-8 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus"
          {...departmentScopeProps(panel.department)}
        >
          <p className="max-w-2xl text-sm leading-relaxed text-muted">
            {panel.intro}
          </p>

          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {panel.items.map((item, itemIndex) => (
              <li key={item.key}>
                <Link
                  href={item.href}
                  className="showcase-tile card-lift group flex h-full flex-col rounded-card border border-border bg-surface p-5 shadow-card transition-soft hover:border-dept-accent-secondary"
                  style={{ animationDelay: `${itemIndex * 60}ms` }}
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="mono-label text-dept-accent-secondary">
                      {String(itemIndex + 1).padStart(2, "0")}
                    </span>
                    <ArrowRight
                      aria-hidden="true"
                      className="h-4 w-4 shrink-0 text-ink-300 transition-soft group-hover:translate-x-0.5 group-hover:text-dept-accent-secondary"
                    />
                  </span>
                  <span className="mt-3 block font-display text-base font-bold leading-snug text-ink-900">
                    {item.title}
                  </span>
                  <span className="mt-2 block text-sm leading-relaxed text-body">
                    {item.summary}
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          <p className="mt-6">
            <Link
              href={panel.href}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-dept-accent-secondary underline-offset-4 hover:underline"
            >
              {panel.actionLabel}
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Link>
          </p>
        </div>
      ))}
    </div>
  );
}
