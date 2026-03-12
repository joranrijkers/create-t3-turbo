/**
 * Parse quantity and unit from start of ingredient string.
 * e.g. "200g bloem" -> { quantity: 200, unit: "g", namePart: "bloem" }
 * Exported for unit tests. Keep UNIT_MAP in sync with backend normalizeUnit.ts for canonical slugs.
 */
export const UNIT_MAP: Record<string, string> = {
  // spoons
  el: "tbsp",
  eetl: "tbsp",
  tl: "tsp",
  theel: "tsp",
  // pieces / items
  st: "piece",
  stuk: "piece",
  stuks: "piece",
  // container
  blik: "can",
  pak: "package",
  fles: "bottle",
  flessen: "bottle",
  bottle: "bottle",
  bottles: "bottle",
  krat: "crate",
  kratten: "crate",
  crate: "crate",
  crates: "crate",
  // produce / small units
  teentje: "clove",
  teentjes: "clove",
  teen: "clove",
  bos: "bunch",
  bosje: "bunch",
  plak: "slice",
  plakken: "slice",
  zakje: "other",
  snufje: "pinch",
};

/** Regex: longer unit forms first so "flessen" matches before "fles". Order matches UNIT_MAP priority. */
const UNIT_REGEX =
  /^\s*([\d.,]+)\s*(g|kg|ml|l|tsp|tbsp|cup|piece|slice|clove|bunch|pinch|can|package|flessen|kratten|bottles|crates|teentjes|stuks|plakken|el|eetl|tl|theel|stuk|teentje|bos|bosje|blik|pak|fles|krat|bottle|crate|st|teen|plak|zakje|snufje)?\s*(.*)$/i;

export function parseQuantityAndUnit(
  input: string
): { quantity: number | null; unit: string | null; namePart: string } {
  const trimmed = input.trim();
  const match = trimmed.match(UNIT_REGEX);
  if (!match) {
    return { quantity: null, unit: null, namePart: trimmed };
  }
  const numStr = (match[1] ?? "").replace(",", ".");
  const quantity = Number.parseFloat(numStr);
  const unitRaw = match[2]?.toLowerCase();
  const rest = (match[3] ?? "").trim();
  const unit = unitRaw ? (UNIT_MAP[unitRaw] ?? unitRaw) : null;
  return {
    quantity: Number.isNaN(quantity) ? null : quantity,
    unit,
    namePart: rest || trimmed,
  };
}
