/**
 * Category and unit slugs for canonical key pattern.
 * Used by parser (OpenAI enum), seed, and i18n keys.
 */
export const CATEGORY_SLUGS = [
  "dairy_eggs",
  "produce",
  "meat_seafood",
  "bakery",
  "grains_cereals",
  "herbs_spices",
  "oils_fats",
  "canned_preserved",
  "frozen",
  "beverages",
  "snacks",
  "condiments_sauces",
  "baking",
  "nuts_seeds",
  "legumes",
  "sweeteners",
  "household",
  "other",
] as const;

export type CategorySlug = (typeof CATEGORY_SLUGS)[number];

export const UNIT_SLUGS = [
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

export type UnitSlug = (typeof UNIT_SLUGS)[number];
