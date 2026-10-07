/**
 * Electrical Services solar packages.
 *
 * The nine packages and four categories are taken directly from the supplied
 * `KC_Electrical_Solar_Brochure.pdf`. Every price, percentage, panel count and
 * included item is the one printed in that brochure — nothing here is invented,
 * and no specification is claimed that the source did not state.
 *
 * Two things this module deliberately does NOT do:
 *
 *   * It does not carry marketing prose beyond the brochure's own short summary
 *     lines. All display copy (names, summaries, category blurbs, labels) lives
 *     in the static message dictionary as message keys, so English and French
 *     stay in step and the parity test enforces the key set — the convention set
 *     by `electrical-products.ts`.
 *   * It is not the database. The packages are ALSO seeded as real
 *     `products` rows under the Electrical Services department by
 *     `20260101000045_electrical_solar_packages.sql`, which is what lets the
 *     existing (database-backed) cart and order pipeline carry a package. The
 *     stable join between the two is `sku`: the seed uses exactly the `sku`
 *     values below, so `packageBySku()` can resolve a bundled package to its
 *     product row at add-to-cart time.
 *
 * The brochure's own caveat is reproduced verbatim as the page's pricing note:
 * materials cost is based on genuine SAKO Power price lists, accessories and
 * installation are 7–10% of materials, and prices exclude local VAT and
 * transport. A price shown here is therefore an indicative package figure to be
 * confirmed, never a final invoice — which is exactly why checkout ends with a
 * human contact.
 */

export type SolarPackageCategoryId =
  | "ess-starter"
  | "medium-home"
  | "large-home-business"
  | "ultra-large-premium";

export type SolarPackageCategory = {
  id: SolarPackageCategoryId;
  /** URL-safe slug, used as the compare/section anchor and the seed slug. */
  slug: string;
  /** Representative image under `public/products/electrical/`. */
  image: string;
};

export type SolarPackageLine = {
  /** Message key for the included item, under `solarPackages.items.<id>`. */
  key: string;
  /** Units of the item included in the package. */
  quantity: number;
};

export type SolarPackage = {
  /** Stable id, also the message-key segment, image anchor and seed slug. */
  id: string;
  /** Stable product SKU, shared with the seed migration. */
  sku: string;
  categoryId: SolarPackageCategoryId;
  /** Image under `public/products/electrical/`. */
  image: string;

  /** Total package price, in XAF (the currency has no minor unit). */
  priceMinor: number;
  /** Materials component of the total. */
  materialsMinor: number;
  /** Accessories component of the total. */
  accessoriesMinor: number;
  accessoriesPercent: number;
  /** Installation component of the total. */
  installationMinor: number;
  installationPercent: number;

  /** Number of SK-600WD solar panels included, for the comparison table. */
  panelCount: number;
  /** True for the packages the brochure marks as a highlight (e.g. best value). */
  highlighted: boolean;

  /** The bill of materials printed under the package in the brochure. */
  lines: readonly SolarPackageLine[];
};

const IMG = "/products/electrical";

/**
 * Category order is the brochure's own order (starter → premium), and the
 * browse page renders sections in this order.
 */
export const SOLAR_PACKAGE_CATEGORIES: readonly SolarPackageCategory[] = [
  { id: "ess-starter", slug: "ess-starter", image: `${IMG}/sako-energy-storage-range.jpg` },
  { id: "medium-home", slug: "medium-home", image: `${IMG}/sako-solar-system.jpg` },
  {
    id: "large-home-business",
    slug: "large-home-business",
    image: `${IMG}/sako-battery-install.jpg`,
  },
  {
    id: "ultra-large-premium",
    slug: "ultra-large-premium",
    image: `${IMG}/sako-sunpolo-inverter.jpg`,
  },
] as const;

function line(id: string, index: number, quantity: number): SolarPackageLine {
  return { key: `solarPackages.items.${id}.line${index}`, quantity };
}

export const SOLAR_PACKAGES: readonly SolarPackage[] = [
  {
    id: "starter-500",
    sku: "KC-SOLAR-STARTER-500",
    categoryId: "ess-starter",
    image: `${IMG}/sako-energy-storage-range.jpg`,
    priceMinor: 350_000,
    materialsMinor: 280_000,
    accessoriesMinor: 42_000,
    accessoriesPercent: 15,
    installationMinor: 28_000,
    installationPercent: 10,
    panelCount: 1,
    highlighted: false,
    lines: [
      line("starter-500", 0, 1),
      line("starter-500", 1, 1),
      line("starter-500", 2, 1),
    ],
  },
  {
    id: "starter-1000",
    sku: "KC-SOLAR-STARTER-1000",
    categoryId: "ess-starter",
    image: `${IMG}/sako-energy-storage-range.jpg`,
    priceMinor: 564_000,
    materialsMinor: 470_000,
    accessoriesMinor: 47_000,
    accessoriesPercent: 10,
    installationMinor: 47_000,
    installationPercent: 10,
    panelCount: 2,
    highlighted: true,
    lines: [
      line("starter-1000", 0, 1),
      line("starter-1000", 1, 2),
      line("starter-1000", 2, 1),
    ],
  },
  {
    id: "home-3kva",
    sku: "KC-SOLAR-HOME-3KVA",
    categoryId: "medium-home",
    image: `${IMG}/sako-solar-system.jpg`,
    priceMinor: 732_000,
    materialsMinor: 610_000,
    accessoriesMinor: 61_000,
    accessoriesPercent: 10,
    installationMinor: 61_000,
    installationPercent: 10,
    panelCount: 2,
    highlighted: false,
    lines: [
      line("home-3kva", 0, 1),
      line("home-3kva", 1, 2),
      line("home-3kva", 2, 2),
      line("home-3kva", 3, 1),
    ],
  },
  {
    id: "home-6-2kva",
    sku: "KC-SOLAR-HOME-6-2KVA",
    categoryId: "medium-home",
    image: `${IMG}/sako-lithium-battery.jpg`,
    priceMinor: 1_320_000,
    materialsMinor: 1_100_000,
    accessoriesMinor: 110_000,
    accessoriesPercent: 10,
    installationMinor: 110_000,
    installationPercent: 10,
    panelCount: 3,
    highlighted: true,
    lines: [
      line("home-6-2kva", 0, 1),
      line("home-6-2kva", 1, 1),
      line("home-6-2kva", 2, 3),
      line("home-6-2kva", 3, 1),
    ],
  },
  {
    id: "home-3kva-standard",
    sku: "KC-SOLAR-HOME-3KVA-STANDARD",
    categoryId: "medium-home",
    image: `${IMG}/sako-lithium-battery.jpg`,
    priceMinor: 1_464_000,
    materialsMinor: 1_220_000,
    accessoriesMinor: 122_000,
    accessoriesPercent: 10,
    installationMinor: 122_000,
    installationPercent: 10,
    panelCount: 4,
    highlighted: false,
    lines: [
      line("home-3kva-standard", 0, 1),
      line("home-3kva-standard", 1, 4),
      line("home-3kva-standard", 2, 1),
    ],
  },
  {
    id: "business-10-2kva",
    sku: "KC-SOLAR-BUSINESS-10-2KVA",
    categoryId: "large-home-business",
    image: `${IMG}/sako-battery-install.jpg`,
    priceMinor: 2_538_900,
    materialsMinor: 2_170_000,
    accessoriesMinor: 151_900,
    accessoriesPercent: 7,
    installationMinor: 217_000,
    installationPercent: 10,
    panelCount: 6,
    highlighted: false,
    lines: [
      line("business-10-2kva", 0, 1),
      line("business-10-2kva", 1, 1),
      line("business-10-2kva", 2, 6),
      line("business-10-2kva", 3, 1),
    ],
  },
  {
    id: "business-11kva",
    sku: "KC-SOLAR-BUSINESS-11KVA",
    categoryId: "large-home-business",
    image: `${IMG}/sako-battery-install.jpg`,
    priceMinor: 4_329_000,
    materialsMinor: 3_700_000,
    accessoriesMinor: 259_000,
    accessoriesPercent: 7,
    installationMinor: 370_000,
    installationPercent: 10,
    panelCount: 10,
    highlighted: false,
    lines: [
      line("business-11kva", 0, 1),
      line("business-11kva", 1, 1),
      line("business-11kva", 2, 10),
      line("business-11kva", 3, 1),
    ],
  },
  {
    id: "premium-6kw",
    sku: "KC-SOLAR-PREMIUM-6KW",
    categoryId: "ultra-large-premium",
    image: `${IMG}/sako-sunpolo-inverter.jpg`,
    priceMinor: 3_120_000,
    materialsMinor: 2_600_000,
    accessoriesMinor: 182_000,
    accessoriesPercent: 7,
    installationMinor: 260_000,
    installationPercent: 10,
    panelCount: 10,
    highlighted: false,
    lines: [
      line("premium-6kw", 0, 1),
      line("premium-6kw", 1, 10),
      line("premium-6kw", 2, 1),
    ],
  },
  {
    id: "premium-12kw",
    sku: "KC-SOLAR-PREMIUM-12KW",
    categoryId: "ultra-large-premium",
    image: `${IMG}/sako-sunpolo-inverter.jpg`,
    priceMinor: 9_126_100,
    materialsMinor: 7_830_000,
    accessoriesMinor: 548_100,
    accessoriesPercent: 7,
    installationMinor: 748_000,
    installationPercent: 10,
    panelCount: 16,
    highlighted: false,
    lines: [
      line("premium-12kw", 0, 1),
      line("premium-12kw", 1, 2),
      line("premium-12kw", 2, 16),
      line("premium-12kw", 3, 1),
    ],
  },
] as const;

export function solarPackagesInCategory(
  categoryId: SolarPackageCategoryId,
): readonly SolarPackage[] {
  return SOLAR_PACKAGES.filter((entry) => entry.categoryId === categoryId);
}

export function findSolarPackage(id: string): SolarPackage | undefined {
  return SOLAR_PACKAGES.find((entry) => entry.id === id);
}

export function findSolarPackageCategory(
  id: string,
): SolarPackageCategory | undefined {
  return SOLAR_PACKAGE_CATEGORIES.find((entry) => entry.id === id);
}

/** Resolve a bundled package by its product SKU, for the cart path. */
export function packageBySku(sku: string): SolarPackage | undefined {
  return SOLAR_PACKAGES.find((entry) => entry.sku === sku);
}

/** Every package image, for the asset test. */
export function solarPackageImages(): string[] {
  return [
    ...new Set([
      ...SOLAR_PACKAGE_CATEGORIES.map((category) => category.image),
      ...SOLAR_PACKAGES.map((entry) => entry.image),
    ]),
  ];
}
