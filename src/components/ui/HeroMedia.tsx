import Image from "next/image";

/**
 * Hero backdrop photo with a legibility scrim.
 *
 * Rendered as the first child of a `relative overflow-hidden` hero section, so it
 * sits behind the decorative grid/glow layers and behind the copy. The photo is
 * decorative: the hero heading already names the subject, so repeating it in alt
 * text would only add noise for screen-reader users.
 *
 * The scrim is weighted toward the inline-start edge, which is where hero copy
 * sits, so the heading keeps a high contrast ratio over any photo. Without it a
 * light image would wash the heading out — which is the whole reason a plain
 * `bg-ink-950` band was safe to put text on and a photo is not.
 *
 * Loading is eager with an explicit high fetch priority. Next.js 16 deprecated
 * the `priority` prop in favour of these two, and the distinction is not
 * cosmetic: `priority` emitted the `<link rel="preload">` but no
 * `fetchpriority` attribute on the `<img>`, so the image still queued behind the
 * stylesheet and the scripts. This is the LCP element on every page that renders
 * it, and on a throttled mobile run that queueing was most of the LCP. Do not
 * add `preload` here — the docs are explicit that it must not be combined with
 * `fetchPriority`, and `fetchPriority` is the one that fixes the queue order.
 */
export function HeroMedia({ src }: { src: string }) {
  return (
    <div aria-hidden="true" className="absolute inset-0">
      <Image
        src={src}
        alt=""
        fill
        loading="eager"
        fetchPriority="high"
        sizes="100vw"
        className="object-cover"
      />
      <div className="hero-scrim absolute inset-0" />
    </div>
  );
}
