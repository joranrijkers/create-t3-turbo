/**
 * Maps legacy or raw unit values to canonical UNIT_SLUGS.
 * Use when reading/writing ShoppingItem.unit or Ingredient.unit so DB stays consistent.
 */
import { UNIT_SLUGS } from "@prikkr/db/constants";
import type { UnitSlug } from "@prikkr/db/constants";

const LEGACY_TO_CANONICAL: Record<string, UnitSlug> = {
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
};

const CANONICAL_SET = new Set<string>(UNIT_SLUGS);

export function normalizeUnitToCanonical(value: string | null | undefined): UnitSlug | null {
  if (value == null || value === "") return null;
  const v = value.trim().toLowerCase();
  const mapped = LEGACY_TO_CANONICAL[v];
  if (mapped) return mapped;
  return CANONICAL_SET.has(v) ? (v as UnitSlug) : "other";
}
