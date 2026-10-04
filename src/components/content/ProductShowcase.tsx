import Image from "next/image";
import { ELECTRICAL_PRODUCTS } from "@/lib/content/electrical-products";
import type { Translator } from "@/lib/i18n/translator";
import { ScrollReveal } from "@/components/ui/ScrollReveal";

/**
 * Electrical Services product showcase.
 *
 * Two motion treatments share one data source and one markup shape, so the
 * homepage and the department landing page feel like the same family without
 * repeating the same animation:
 *
 *   - `marquee` — a continuous horizontal drift, used on the homepage. The track
 *     holds the set twice; the second copy is `aria-hidden` and its images carry
 *     an empty `alt`, so assistive technology and crawlers see the six products
 *     exactly once. The drift pauses on hover and on keyboard focus.
 *   - `grid` — a staggered, scroll-triggered rise with a slow accent pulse, used
 *     on the department landing page.
 *
 * Both are pure CSS on top of server-rendered markup: the products, their names,
 * their ratings and their image descriptions are all in the HTML before any
 * JavaScript runs. A crawler, a no-JavaScript visitor and a `prefers-reduced-motion`
 * visitor all get the full, readable content — the animation only changes how it
 * arrives. The reduced-motion block turns the marquee into a plain scrollable row
 * rather than leaving it stuck at the end of its travel.
 */
export function ProductShowcase({
  t,
  variant,
  eyebrow,
  heading,
  intro,
  note,
  headingId,
}: {
  t: Translator["t"];
  variant: "marquee" | "grid";
  eyebrow: string;
  heading: string;
  intro: string;
  note: string;
  /** id for the section heading, so the region can be labelled by it. */
  headingId: string;
}) {
  const products = ELECTRICAL_PRODUCTS;

  const header = (
    <div className="max-w-2xl">
      <p className="mono-label text-dept-accent">{eyebrow}</p>
      <h2
        id={headingId}
        className="display-tight mt-3 font-display text-3xl font-bold text-ink-900 sm:text-4xl"
      >
        {heading}
      </h2>
      <span aria-hidden="true" className="heading-rule" />
      <p className="mt-4 text-base text-body">{intro}</p>
    </div>
  );

  const figure = (product: (typeof products)[number], decorative: boolean) => (
    <figure className="product-tile group">
      <div className="product-tile-media">
        <Image
          src={product.image}
          alt={decorative ? "" : t(product.altKey)}
          fill
          sizes="(min-width: 1024px) 22rem, (min-width: 640px) 18rem, 80vw"
          className="object-cover"
        />
      </div>
      <figcaption className="product-tile-caption">
        <span className="text-sm font-semibold text-ink-900">
          {t(product.nameKey)}
        </span>
        <span className="mono-label mt-1 block text-muted">
          {t(product.specKey)}
        </span>
      </figcaption>
    </figure>
  );

  return (
    <section
      aria-labelledby={headingId}
      className="border-b border-border bg-canvas"
    >
      <div className="container-page section">
        {header}
        <p className="mt-4 max-w-2xl text-sm text-muted">{note}</p>
      </div>

      {variant === "marquee" ? (
        <div
          className="product-marquee pb-14"
          role="group"
          aria-label={heading}
        >
          <div className="product-marquee-track">
            <ul className="product-set">
              {products.map((product) => (
                <li key={product.id}>{figure(product, false)}</li>
              ))}
            </ul>
            <ul className="product-set" aria-hidden="true">
              {products.map((product) => (
                <li key={`${product.id}-repeat`}>{figure(product, true)}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <ul className="product-grid container-page grid gap-6 pb-16 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product, index) => (
            <ScrollReveal
              as="li"
              key={product.id}
              stagger={{ index, columns: [1, 2, 3] }}
            >
              {figure(product, false)}
            </ScrollReveal>
          ))}
        </ul>
      )}
    </section>
  );
}
