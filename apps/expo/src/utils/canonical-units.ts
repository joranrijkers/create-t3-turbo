/**
 * Canonical unit slugs used for storage and API. Must match packages/db/src/constants.ts UNIT_SLUGS.
 * UI shows localized labels via i18n (units.*).
 */
export const CANONICAL_UNIT_SLUGS = [
  "g",
  "kg",
  "ml",
  "l",
  "tsp",
  "tbsp",
  "cup",
  "piece",
  "slice",
  "clove",
  "bunch",
  "pinch",
  "can",
  "package",
  "bottle",
  "crate",
  "other",
] as const;

export type CanonicalUnitSlug = (typeof CANONICAL_UNIT_SLUGS)[number];

/** Map legacy/database values to canonical slug for display and save. */
export function toCanonicalUnit(value: string | null | undefined): string {
  if (!value || !value.trim()) return "";
  const v = value.trim().toLowerCase();
  const map: Record<string, string> = {
    el: "tbsp",
    eetl: "tbsp",
    tl: "tsp",
    theel: "tsp",
    st: "piece",
    stuk: "piece",
    stuks: "piece",
    blik: "can",
    pak: "package",
    fles: "bottle",
    flessen: "bottle",
    krat: "crate",
    kratten: "crate",
    plak: "slice",
    teen: "clove",
    teentjes: "clove",
    bosje: "bunch",
    zakje: "other",
    snufje: "pinch",
    "naar smaak": "other",
    mg: "other",
    dl: "other",
  };
  return map[v] ?? (CANONICAL_UNIT_SLUGS.includes(v as CanonicalUnitSlug) ? v : "other");
}
