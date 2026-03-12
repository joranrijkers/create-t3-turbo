/**
 * Tier 1: Local ingredient dictionary.
 * Maps normalized (lowercase, trimmed) strings in any supported language to canonical English + category.
 * Handles 60–80% of inputs with zero API cost.
 */
import type { CategorySlug } from "@prikkr/db/constants";
import { parseQuantityAndUnit } from "../lib/parseQuantityAndUnit";

export type DictionaryEntry = {
  canonicalName: string;
  categorySlug: CategorySlug;
};

/** Normalize for lookup: trim, lowercase, collapse spaces */
export function normalizeForLookup(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Map from normalized ingredient string (any language) to canonical data.
 * Built from common en/nl terms; extend from OFF/Wikidata later.
 */
const DICTIONARY: Record<string, DictionaryEntry> = {
  // en
  milk: { canonicalName: "milk", categorySlug: "dairy_eggs" },
  flour: { canonicalName: "flour", categorySlug: "grains_cereals" },
  butter: { canonicalName: "butter", categorySlug: "dairy_eggs" },
  eggs: { canonicalName: "eggs", categorySlug: "dairy_eggs" },
  sugar: { canonicalName: "sugar", categorySlug: "sweeteners" },
  salt: { canonicalName: "salt", categorySlug: "herbs_spices" },
  "olive oil": { canonicalName: "olive oil", categorySlug: "oils_fats" },
  onion: { canonicalName: "onion", categorySlug: "produce" },
  garlic: { canonicalName: "garlic", categorySlug: "produce" },
  tomato: { canonicalName: "tomato", categorySlug: "produce" },
  potato: { canonicalName: "potato", categorySlug: "produce" },
  carrot: { canonicalName: "carrot", categorySlug: "produce" },
  cheese: { canonicalName: "cheese", categorySlug: "dairy_eggs" },
  chicken: { canonicalName: "chicken", categorySlug: "meat_seafood" },
  rice: { canonicalName: "rice", categorySlug: "grains_cereals" },
  pasta: { canonicalName: "pasta", categorySlug: "grains_cereals" },
  bread: { canonicalName: "bread", categorySlug: "bakery" },
  water: { canonicalName: "water", categorySlug: "beverages" },
  cream: { canonicalName: "cream", categorySlug: "dairy_eggs" },
  pepper: { canonicalName: "pepper", categorySlug: "herbs_spices" },
  lemon: { canonicalName: "lemon", categorySlug: "produce" },
  lemons: { canonicalName: "lemon", categorySlug: "produce" },
  honey: { canonicalName: "honey", categorySlug: "sweeteners" },
  "soy sauce": { canonicalName: "soy sauce", categorySlug: "condiments_sauces" },
  "vegetable oil": { canonicalName: "vegetable oil", categorySlug: "oils_fats" },
  "canned tomatoes": { canonicalName: "canned tomatoes", categorySlug: "canned_preserved" },
  // nl
  melk: { canonicalName: "milk", categorySlug: "dairy_eggs" },
  bloem: { canonicalName: "flour", categorySlug: "grains_cereals" },
  boter: { canonicalName: "butter", categorySlug: "dairy_eggs" },
  eieren: { canonicalName: "eggs", categorySlug: "dairy_eggs" },
  suiker: { canonicalName: "sugar", categorySlug: "sweeteners" },
  zout: { canonicalName: "salt", categorySlug: "herbs_spices" },
  olijfolie: { canonicalName: "olive oil", categorySlug: "oils_fats" },
  ui: { canonicalName: "onion", categorySlug: "produce" },
  uien: { canonicalName: "onion", categorySlug: "produce" },
  knoflook: { canonicalName: "garlic", categorySlug: "produce" },
  tomaat: { canonicalName: "tomato", categorySlug: "produce" },
  tomaten: { canonicalName: "tomato", categorySlug: "produce" },
  aardappel: { canonicalName: "potato", categorySlug: "produce" },
  aardappelen: { canonicalName: "potato", categorySlug: "produce" },
  wortel: { canonicalName: "carrot", categorySlug: "produce" },
  wortelen: { canonicalName: "carrot", categorySlug: "produce" },
  kaas: { canonicalName: "cheese", categorySlug: "dairy_eggs" },
  kip: { canonicalName: "chicken", categorySlug: "meat_seafood" },
  rijst: { canonicalName: "rice", categorySlug: "grains_cereals" },
  brood: { canonicalName: "bread", categorySlug: "bakery" },
  room: { canonicalName: "cream", categorySlug: "dairy_eggs" },
  peper: { canonicalName: "pepper", categorySlug: "herbs_spices" },
  citroen: { canonicalName: "lemon", categorySlug: "produce" },
  citroenen: { canonicalName: "lemon", categorySlug: "produce" },
  honing: { canonicalName: "honey", categorySlug: "sweeteners" },
  sojasaus: { canonicalName: "soy sauce", categorySlug: "condiments_sauces" },
  "plantaardige olie": { canonicalName: "vegetable oil", categorySlug: "oils_fats" },
  "tomaten in blik": { canonicalName: "canned tomatoes", categorySlug: "canned_preserved" },
};

export function lookupIngredientDictionary(normalizedInput: string): DictionaryEntry | null {
  const key = normalizeForLookup(normalizedInput);
  return DICTIONARY[key] ?? null;
}

/**
 * Extract ingredient name for dictionary lookup using the same quantity/unit stripping as parseQuantityAndUnit.
 * e.g. "200g bloem" -> "bloem", "2 flessen cola" -> "cola". Ensures dictionary and parser never diverge.
 */
export function extractNameForDictionaryLookup(input: string): string {
  const trimmed = input.trim();
  const { namePart } = parseQuantityAndUnit(trimmed);
  return namePart || trimmed;
}
