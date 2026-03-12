/**
 * Backfill script: normalize existing unit values to canonical slugs in
 * shopping_item, ingredient, and optionally fix/invalidate ingredient_alias cache.
 *
 * Run from repo root: pnpm with-env exec -C packages/db npx tsx src/backfill-units.ts
 * Or from packages/db: pnpm with-env npx tsx src/backfill-units.ts
 */
import { db } from "./client";
import { UNIT_SLUGS } from "./constants";
import type { UnitSlug } from "./constants";
import { Ingredient, IngredientAlias, ShoppingItem } from "./schema";
import { eq } from "drizzle-orm";

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

function normalizeUnit(value: string | null | undefined): UnitSlug | null {
  if (value == null || value === "") return null;
  const v = value.trim().toLowerCase();
  const mapped = LEGACY_TO_CANONICAL[v];
  if (mapped) return mapped;
  return CANONICAL_SET.has(v) ? (v as UnitSlug) : "other";
}

async function main() {
  console.log("Backfill: normalizing units to canonical slugs...\n");

  // 1) shopping_item.unit
  const items = await db.select({ id: ShoppingItem.id, unit: ShoppingItem.unit }).from(ShoppingItem);
  let updatedItems = 0;
  for (const row of items) {
    if (row.unit == null) continue;
    const canonical = normalizeUnit(row.unit);
    if (canonical && canonical !== row.unit) {
      await db.update(ShoppingItem).set({ unit: canonical }).where(eq(ShoppingItem.id, row.id));
      updatedItems++;
    }
  }
  console.log(`shopping_item: ${updatedItems} rows updated`);

  // 2) ingredient.unit
  const ingredients = await db.select({ id: Ingredient.id, unit: Ingredient.unit }).from(Ingredient);
  let updatedIngredients = 0;
  for (const row of ingredients) {
    if (row.unit == null) continue;
    const canonical = normalizeUnit(row.unit);
    if (canonical && canonical !== row.unit) {
      await db.update(Ingredient).set({ unit: canonical }).where(eq(Ingredient.id, row.id));
      updatedIngredients++;
    }
  }
  console.log(`ingredient: ${updatedIngredients} rows updated`);

  // 3) ingredient_alias: fix wrong "piece" where input suggests bottle/crate
  const aliasRows = await db
    .select({ id: IngredientAlias.id, unit: IngredientAlias.unit, inputText: IngredientAlias.inputText })
    .from(IngredientAlias);
  const bottleCratePattern = /(fles|flessen|krat|kratten|bottle|bottles|crate|crates)/i;
  let updatedAliases = 0;
  for (const row of aliasRows) {
    if (row.unit !== "piece") continue;
    const input = (row.inputText ?? "").trim().toLowerCase();
    if (!bottleCratePattern.test(input)) continue;
    const canonical = input.includes("fles") || input.includes("bottle") ? "bottle" : "crate";
    await db.update(IngredientAlias).set({ unit: canonical }).where(eq(IngredientAlias.id, row.id));
    updatedAliases++;
  }
  console.log(`ingredient_alias: ${updatedAliases} ambiguous piece→bottle/crate rows updated`);

  // 4) ingredient_alias: normalize any other legacy unit values
  let normalizedAliases = 0;
  for (const row of aliasRows) {
    if (row.unit == null) continue;
    const canonical = normalizeUnit(row.unit);
    if (canonical && canonical !== row.unit) {
      await db.update(IngredientAlias).set({ unit: canonical }).where(eq(IngredientAlias.id, row.id));
      normalizedAliases++;
    }
  }
  console.log(`ingredient_alias: ${normalizedAliases} legacy unit rows normalized`);

  console.log("\nBackfill done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
