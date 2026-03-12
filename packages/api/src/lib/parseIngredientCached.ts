import { createHash } from "node:crypto";
import { eq } from "@prikkr/db";
import { CanonicalIngredient, IngredientAlias } from "@prikkr/db/schema";

import {
  extractNameForDictionaryLookup,
  lookupIngredientDictionary,
  normalizeForLookup,
} from "../data/ingredient-dictionary";
import type { DrizzleDB } from "../trpc";
import { normalizeUnitToCanonical } from "../lib/normalizeUnit";
import { parseIngredient, type ParsedIngredient } from "./parseIngredient";
import { parseQuantityAndUnit } from "./parseQuantityAndUnit";

function normalizeInput(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function hashInput(normalized: string): string {
  return createHash("sha256").update(normalized).digest("hex");
}

export async function parseIngredientCached(
  db: DrizzleDB,
  inputText: string
): Promise<ParsedIngredient> {
  const normalized = normalizeInput(inputText);
  if (!normalized) {
    return {
      canonicalName: "",
      displayName: "",
      categorySlug: null,
      quantity: null,
      unit: null,
      detectedLanguage: null,
    };
  }
  const inputHash = hashInput(normalized);

  // Tier 1: Local dictionary
  const nameForLookup = extractNameForDictionaryLookup(inputText);
  const dictEntry = lookupIngredientDictionary(nameForLookup);
  if (dictEntry) {
    const { quantity, unit, namePart } = parseQuantityAndUnit(inputText);
    const displayName = namePart || nameForLookup;
    let canonicalIngredientIdT1: string | null = null;
    const [row] = await db
      .select({ id: CanonicalIngredient.id })
      .from(CanonicalIngredient)
      .where(eq(CanonicalIngredient.canonicalName, dictEntry.canonicalName))
      .limit(1);
    if (row) canonicalIngredientIdT1 = row.id;
    return {
      canonicalName: dictEntry.canonicalName,
      displayName: displayName || dictEntry.canonicalName,
      categorySlug: dictEntry.categorySlug,
      quantity,
      unit,
      detectedLanguage: null,
      canonicalIngredientId: canonicalIngredientIdT1,
    };
  }

  // Tier 2: Input-string cache
  const cached = await db
    .select()
    .from(IngredientAlias)
    .where(eq(IngredientAlias.inputHash, inputHash))
    .limit(1)
    .then((r) => r[0] ?? null);

  if (cached?.canonicalName != null) {
    const isLikelyWrongPiece =
      cached.unit === "piece" &&
      /(fles|flessen|krat|kratten|bottle|bottles|crate|crates)/i.test(normalized);
    if (!isLikelyWrongPiece) {
      const unit = normalizeUnitToCanonical(cached.unit) ?? cached.unit;
      return {
        canonicalName: cached.canonicalName,
        displayName: cached.displayName ?? cached.inputText ?? inputText,
        categorySlug: cached.categorySlug,
        quantity:
          cached.quantity != null ? Number(cached.quantity) : null,
        unit,
        detectedLanguage: cached.inputLanguage,
        canonicalIngredientId: cached.canonicalIngredientId,
      };
    }
  }

  // Tier 3: OpenAI
  const parsed = await parseIngredient(inputText);

  const canonicalName = parsed.canonicalName || normalizeForLookup(inputText);
  let canonicalIngredientId: string | null = null;
  const [canonicalRow] = await db
    .select({ id: CanonicalIngredient.id })
    .from(CanonicalIngredient)
    .where(eq(CanonicalIngredient.canonicalName, canonicalName))
    .limit(1);
  if (canonicalRow) {
    canonicalIngredientId = canonicalRow.id;
  }

  await db
    .insert(IngredientAlias)
    .values({
      inputHash,
      inputText: inputText.trim(),
      inputLanguage: parsed.detectedLanguage,
      displayName: parsed.displayName?.trim() || null,
      canonicalName,
      categorySlug: parsed.categorySlug,
      quantity: parsed.quantity != null ? String(parsed.quantity) : null,
      unit: parsed.unit,
      canonicalIngredientId,
    })
    .onConflictDoUpdate({
      target: IngredientAlias.inputHash,
      set: {
        inputText: inputText.trim(),
        inputLanguage: parsed.detectedLanguage,
        displayName: parsed.displayName?.trim() || null,
        canonicalName,
        categorySlug: parsed.categorySlug,
        quantity: parsed.quantity != null ? String(parsed.quantity) : null,
        unit: parsed.unit,
        canonicalIngredientId,
      },
    });

  return { ...parsed, canonicalIngredientId };
}

/** Legacy: return shape with normalizedName, brand, category for backward compatibility */
export async function parseIngredientCachedLegacy(
  db: DrizzleDB,
  name: string
): Promise<{ displayName: string; normalizedName: string; brand: string | null; category: string | null }> {
  const p = await parseIngredientCached(db, name);
  return {
    displayName: p.displayName,
    normalizedName: p.canonicalName,
    brand: null,
    category: p.categorySlug,
  };
}
