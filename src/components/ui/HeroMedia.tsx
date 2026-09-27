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
 */
export function HeroMedia({ src }: { src: string }) {
  return (
    <div aria-hidden="true" className="absolute inset-0">
      <Image
        src={src}
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover"
      />
      <div className="hero-scrim absolute inset-0" />
    </div>
  );
}
