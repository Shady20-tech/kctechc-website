/**
 * Electrical Services brand partners.
 *
 * The two manufacturers the department supplies, taken from the brief: SAKO
 * POWER for solar components and HIKVISION for CCTV components. Each entry
 * carries message keys rather than inline strings, so the copy is localized
 * through the same static dictionary as the rest of the UI and English and
 * French stay in step (the parity test enforces the key set).
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
};

const PREFIX = "electricalProducts.brands";

export const ELECTRICAL_BRANDS: readonly ElectricalBrand[] = [
  {
    id: "sakoPower",
    name: "SAKO POWER",
    categoryKey: `${PREFIX}.sakoPower.category`,
  },
  {
    id: "hikvision",
    name: "HIKVISION",
    categoryKey: `${PREFIX}.hikvision.category`,
  },
] as const;
