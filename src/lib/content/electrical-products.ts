/**
 * Electrical Services product showcase.
 *
 * The six entries are the product families the department supplies, taken from
 * the manufacturer's own product imagery supplied for the site. Names and
 * ratings are the ones printed on that material — no specification, price,
 * availability or warranty is claimed here that the source did not state, and
 * nothing links to a purchase flow that does not exist yet.
 *
 * Each entry carries three message keys rather than inline strings so the copy
 * is localized through the same static dictionary as the rest of the UI, and so
 * English and French stay in step (the parity test enforces the key set).
 */
export type ElectricalProduct = {
  /** Stable id, also the message-key segment and the image basename. */
  id: string;
  /** Square product image under `public/products/electrical/`. */
  image: string;
  /** Product family name, e.g. "SUNPOLO hybrid solar inverter". */
  nameKey: string;
  /** The rating or form factor printed on the product material. */
  specKey: string;
  /** Image description for assistive technology and crawlers. */
  altKey: string;
};

const PREFIX = "electricalProducts";

function entry(id: string, image: string): ElectricalProduct {
  return {
    id,
    image: `/products/electrical/${image}`,
    nameKey: `${PREFIX}.items.${id}.name`,
    specKey: `${PREFIX}.items.${id}.spec`,
    altKey: `${PREFIX}.items.${id}.alt`,
  };
}

/**
 * Display order is deliberate: generation and storage first, then the complete
 * systems and the portable end of the range, so the strip reads as a product
 * family rather than a random assortment.
 */
export const ELECTRICAL_PRODUCTS: readonly ElectricalProduct[] = [
  entry("sunpoloInverter", "sako-sunpolo-inverter.jpg"),
  entry("lithiumBattery", "sako-lithium-battery.jpg"),
  entry("solarSystem", "sako-solar-system.jpg"),
  entry("powerSolution", "sako-portable-power.jpg"),
  entry("batteryStorage", "sako-battery-install.jpg"),
  entry("energyStorage", "sako-energy-storage-range.jpg"),
] as const;

/** Image paths for the whole set, for the asset test and any future manifest. */
export function electricalProductImages(): string[] {
  return ELECTRICAL_PRODUCTS.map((product) => product.image);
}
