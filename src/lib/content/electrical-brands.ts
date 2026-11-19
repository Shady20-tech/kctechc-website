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
   */
  logo: string;
};

const PREFIX = "electricalProducts.brands";

export const ELECTRICAL_BRANDS: readonly ElectricalBrand[] = [
  {
    id: "sakoPower",
    name: "SAKO POWER",
    categoryKey: `${PREFIX}.sakoPower.category`,
    logo: "/brand/partners/sako-power.png",
  },
  {
    id: "deye",
    name: "DEYE",
    categoryKey: `${PREFIX}.deye.category`,
    logo: "/brand/partners/deye.png",
  },
  {
    id: "hikvision",
    name: "HIKVISION",
    categoryKey: `${PREFIX}.hikvision.category`,
    logo: "/brand/partners/hikvision.png",
  },
] as const;

/** Logo paths for the whole set, for the asset test. */
export function electricalBrandLogos(): string[] {
  return ELECTRICAL_BRANDS.map((brand) => brand.logo);
}
