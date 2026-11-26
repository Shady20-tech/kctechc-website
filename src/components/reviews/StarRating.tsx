import { Star } from "lucide-react";

/**
 * A five-star rating display.
 *
 * Server-renderable: no state, no effects, so a review list stays a Server
 * Component and the rating is in the HTML a crawler reads. The fractional part is
 * rendered by clipping an overlay to the percentage rather than by rounding, so a
 * 4.5 does not display as a 4 or a 5.
 *
 * The accessible name states the rating as text, because five icons announce
 * nothing useful to a screen reader. The icons are `aria-hidden`; the label
 * carries the meaning.
 */
export function StarRating({
  rating,
  size = 16,
  className = "",
}: {
  rating: number;
  size?: number;
  className?: string;
}) {
  const clamped = Math.min(Math.max(rating, 0), 5);
  const percent = (clamped / 5) * 100;

  return (
    <span
      className={`relative inline-flex align-middle ${className}`}
      role="img"
      aria-label={`${clamped.toFixed(1)} out of 5`}
    >
      <span className="inline-flex gap-0.5 text-border" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((index) => (
          <Star key={index} size={size} strokeWidth={1.5} />
        ))}
      </span>
      <span
        className="pointer-events-none absolute inset-0 inline-flex gap-0.5 overflow-hidden text-amber-500"
        style={{ width: `${percent}%` }}
        aria-hidden="true"
      >
        {[0, 1, 2, 3, 4].map((index) => (
          <Star
            key={index}
            size={size}
            strokeWidth={1.5}
            className="shrink-0 fill-current"
          />
        ))}
      </span>
    </span>
  );
}

/**
 * An interactive star input.
 *
 * A radio group rather than five buttons: the rating is one value out of five, and
 * radios give keyboard arrow-key navigation and a real form value for free. The
 * input is visually hidden but focusable, and the focus ring is drawn on the label
 * via `focus-within`.
 *
 * Server-renderable (no state): the browser's own radio behaviour selects a star,
 * so this needs no JavaScript and works before hydration. The row is reversed so
 * the fifth star sits on the right; the selected star fills, and hovering any star
 * previews it. Only the chosen star fills rather than the whole run up to it,
 * because a CSS "previous sibling" fill needs the inputs and labels to be siblings,
 * which would break the label-wraps-input focus behaviour.
 */
export function StarRatingInput({
  name,
  label,
  defaultValue,
}: {
  name: string;
  label: string;
  defaultValue?: number;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-medium text-ink-900">{label}</legend>
      <div className="mt-2 inline-flex flex-row-reverse gap-1">
        {[5, 4, 3, 2, 1].map((value) => (
          <label
            key={value}
            className="group cursor-pointer rounded-sm p-0.5 focus-within:ring-2 focus-within:ring-teal-700"
          >
            <input
              type="radio"
              name={name}
              value={value}
              defaultChecked={defaultValue === value}
              className="peer sr-only"
              required
            />
            <span className="sr-only">
              {value} {value === 1 ? "star" : "stars"}
            </span>
            <Star
              size={28}
              strokeWidth={1.5}
              aria-hidden="true"
              className="text-border transition-colors group-hover:fill-amber-500 group-hover:text-amber-500 peer-checked:fill-amber-500 peer-checked:text-amber-500"
            />
          </label>
        ))}
      </div>
    </fieldset>
  );
}
