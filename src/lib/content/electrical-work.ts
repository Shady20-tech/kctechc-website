/**
 * Electrical Services completed-work photography.
 *
 * The eight photographs were supplied by the client as evidence of work the
 * department has completed, and are stored under `public/work/`.
 *
 * IMPORTANT — the alt text is deliberately generic and shared. The photographs
 * arrived without captions or EXIF descriptions, and nothing identifies the
 * site, the client, the equipment installed, the capacity or the date. Writing a
 * specific description ("3 kW rooftop array in Buea, commissioned 2025") would
 * invent a project record that does not exist, which the brief forbids. Every
 * image therefore carries the same honest, non-committal description, and the
 * captions are left for the client to supply.
 *
 * When real captions arrive, give each entry its own `altKey` (and a
 * `captionKey`) with matching message keys in both locales. Do not guess a
 * description from the picture.
 */
export type ElectricalWork = {
  /** Stable id, also the image basename. */
  id: string;
  /** Photograph under `public/work/`. */
  image: string;
};

const PREFIX = "electricalProducts.work";

/** Shared description for the whole set, for the same reason as above. */
export const ELECTRICAL_WORK_ALT_KEY = `${PREFIX}.alt`;

function entry(index: number): ElectricalWork {
  const id = `work-${String(index).padStart(2, "0")}`;
  return { id, image: `/work/${id}.jpg` };
}

export const ELECTRICAL_WORK: readonly ElectricalWork[] = [
  entry(1),
  entry(2),
  entry(3),
  entry(4),
  entry(5),
  entry(6),
  entry(7),
  entry(8),
] as const;

/** Image paths for the whole set, for the asset test. */
export function electricalWorkImages(): string[] {
  return ELECTRICAL_WORK.map((work) => work.image);
}
