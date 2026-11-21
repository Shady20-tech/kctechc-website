/**
 * Electrical Services brand partners.
 *
 * The manufacturers the department supplies: SAKO POWER for solar components,
 * DEYE for inverters and energy storage, and HIKVISION for CCTV components.
 * Each entry carries message keys rather than inline strings, so the copy is
 * localized through the same static dictionary as the rest of the UI and
 * English and French stay in step (the parity test enforces the key set).
 *
 * Nothing beyond the brand and its category is claimed here — no model, price,
 * stock or warranty — because the brief supplied only the pairing.
 */
export type ElectricalBrand = {
  /** Stable id, also the message-key segment. */
  id: string;
  /** Brand name. A proper noun, so it is not translated. */
  name: string;
  /** What the brand supplies, e.g. "Solar components". */
  categoryKey: string;
  /**
   * Wordmark under `public/brand/partners/`, supplied by the client.
   *
   * The mark is decorative next to the printed name, so `BrandStrip` renders it
   * with an empty `alt` and lets the name carry the accessible text — a logo
   * whose alt repeats the adjacent heading is noise for a screen reader.
   *
   * The filenames carry a `-v2` suffix because these two files were once swapped
   * in place. Correcting the bytes under the old names was not enough: the URL
   * stayed identical, and both the image optimizer and the browser hold a
   * `max-age=14400` copy keyed by that URL, so visitors kept seeing the swapped
   * pair for hours after the deploy. A new path is the only reliable way to
   * invalidate it. Bump the suffix rather than editing an image in place.
   */
  logo: string;
};

const PREFIX = "electricalProducts.brands";

export const ELECTRICAL_BRANDS: readonly ElectricalBrand[] = [
  {
    id: "sakoPower",
    name: "SAKO POWER",
    categoryKey: `${PREFIX}.sakoPower.category`,
    logo: "/brand/partners/sako-power-v2.png",
  },
  {
    id: "deye",
    name: "DEYE",
    categoryKey: `${PREFIX}.deye.category`,
    logo: "/brand/partners/deye-v2.png",
  },
  {
    id: "hikvision",
    name: "HIKVISION",
    categoryKey: `${PREFIX}.hikvision.category`,
    logo: "/brand/partners/hikvision-v2.png",
  },
] as const;

/** Logo paths for the whole set, for the asset test. */
export function electricalBrandLogos(): string[] {
  return ELECTRICAL_BRANDS.map((brand) => brand.logo);
}
