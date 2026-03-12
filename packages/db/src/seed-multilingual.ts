/**
 * Seed script for multilingual taxonomy: Category and initial CanonicalIngredient set.
 * Run from repo root: pnpm with-env exec -C packages/db npx tsx src/seed-multilingual.ts
 * Or from packages/db: pnpm with-env npx tsx src/seed-multilingual.ts
 */
import { db } from "./client";
import { CATEGORY_SLUGS, type CategorySlug } from "./constants";
import { Category, CanonicalIngredient } from "./schema";

const CATEGORY_ICONS: Partial<Record<CategorySlug, string>> = {
  dairy_eggs: "🥛",
  produce: "🥬",
  meat_seafood: "🥩",
  bakery: "🍞",
  grains_cereals: "🌾",
  herbs_spices: "🌿",
  oils_fats: "🫒",
  canned_preserved: "🥫",
  frozen: "🧊",
  beverages: "🥤",
  snacks: "🍿",
  condiments_sauces: "🫙",
  baking: "🧁",
  nuts_seeds: "🥜",
  legumes: "🫘",
  sweeteners: "🍯",
  household: "🧻",
  other: "📦",
};

/** Initial set of canonical ingredients (en/nl) for Tier 1 dictionary and knowledge base */
const INITIAL_CANONICAL_INGREDIENTS: Array<{
  canonicalName: string;
  categorySlug: CategorySlug;
  translations: Record<string, string>;
  defaultUnit?: string;
}> = [
  { canonicalName: "milk", categorySlug: "dairy_eggs", translations: { en: "milk", nl: "melk" }, defaultUnit: "ml" },
  { canonicalName: "flour", categorySlug: "grains_cereals", translations: { en: "flour", nl: "bloem" }, defaultUnit: "g" },
  { canonicalName: "butter", categorySlug: "dairy_eggs", translations: { en: "butter", nl: "boter" }, defaultUnit: "g" },
  { canonicalName: "eggs", categorySlug: "dairy_eggs", translations: { en: "eggs", nl: "eieren" }, defaultUnit: "piece" },
  { canonicalName: "sugar", categorySlug: "sweeteners", translations: { en: "sugar", nl: "suiker" }, defaultUnit: "g" },
  { canonicalName: "salt", categorySlug: "herbs_spices", translations: { en: "salt", nl: "zout" }, defaultUnit: "g" },
  { canonicalName: "olive oil", categorySlug: "oils_fats", translations: { en: "olive oil", nl: "olijfolie" }, defaultUnit: "ml" },
  { canonicalName: "onion", categorySlug: "produce", translations: { en: "onion", nl: "ui" }, defaultUnit: "piece" },
  { canonicalName: "garlic", categorySlug: "produce", translations: { en: "garlic", nl: "knoflook" }, defaultUnit: "clove" },
  { canonicalName: "tomato", categorySlug: "produce", translations: { en: "tomato", nl: "tomaat" }, defaultUnit: "piece" },
  { canonicalName: "potato", categorySlug: "produce", translations: { en: "potato", nl: "aardappel" }, defaultUnit: "piece" },
  { canonicalName: "carrot", categorySlug: "produce", translations: { en: "carrot", nl: "wortel" }, defaultUnit: "piece" },
  { canonicalName: "cheese", categorySlug: "dairy_eggs", translations: { en: "cheese", nl: "kaas" }, defaultUnit: "g" },
  { canonicalName: "chicken", categorySlug: "meat_seafood", translations: { en: "chicken", nl: "kip" }, defaultUnit: "g" },
  { canonicalName: "rice", categorySlug: "grains_cereals", translations: { en: "rice", nl: "rijst" }, defaultUnit: "g" },
  { canonicalName: "pasta", categorySlug: "grains_cereals", translations: { en: "pasta", nl: "pasta" }, defaultUnit: "g" },
  { canonicalName: "bread", categorySlug: "bakery", translations: { en: "bread", nl: "brood" }, defaultUnit: "slice" },
  { canonicalName: "water", categorySlug: "beverages", translations: { en: "water", nl: "water" }, defaultUnit: "ml" },
  { canonicalName: "cream", categorySlug: "dairy_eggs", translations: { en: "cream", nl: "room" }, defaultUnit: "ml" },
  { canonicalName: "pepper", categorySlug: "herbs_spices", translations: { en: "pepper", nl: "peper" }, defaultUnit: "pinch" },
  { canonicalName: "lemon", categorySlug: "produce", translations: { en: "lemon", nl: "citroen" }, defaultUnit: "piece" },
  { canonicalName: "honey", categorySlug: "sweeteners", translations: { en: "honey", nl: "honing" }, defaultUnit: "g" },
  { canonicalName: "soy sauce", categorySlug: "condiments_sauces", translations: { en: "soy sauce", nl: "sojasaus" }, defaultUnit: "ml" },
  { canonicalName: "vegetable oil", categorySlug: "oils_fats", translations: { en: "vegetable oil", nl: "plantaardige olie" }, defaultUnit: "ml" },
  { canonicalName: "canned tomatoes", categorySlug: "canned_preserved", translations: { en: "canned tomatoes", nl: "tomaten in blik" }, defaultUnit: "can" },
];

async function seed() {
  console.log("Seeding categories...");
  for (let i = 0; i < CATEGORY_SLUGS.length; i++) {
    const slug = CATEGORY_SLUGS[i]!;
    await db
      .insert(Category)
      .values({
        slug,
        icon: CATEGORY_ICONS[slug] ?? null,
        sortOrder: i,
      })
      .onConflictDoNothing({ target: Category.slug });
  }
  console.log("Seeding canonical ingredients...");
  for (const ing of INITIAL_CANONICAL_INGREDIENTS) {
    await db
      .insert(CanonicalIngredient)
      .values({
        canonicalName: ing.canonicalName,
        categorySlug: ing.categorySlug,
        translations: ing.translations,
        defaultUnit: ing.defaultUnit ?? null,
        isSystem: true,
      })
      .onConflictDoNothing({ target: CanonicalIngredient.canonicalName });
  }
  console.log("Seed done.");
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
