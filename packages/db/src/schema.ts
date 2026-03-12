import { sql } from "drizzle-orm";
import { pgEnum, pgTable, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const householdRoleEnum = pgEnum("household_role", ["admin", "member"]);
export const attendanceStatusEnum = pgEnum("attendance_status", [
  "yes",
  "no",
  "maybe",
]);
export const mealTypeEnum = pgEnum("meal_type", [
  "breakfast",
  "lunch",
  "dinner",
]);

// ─── Households ───────────────────────────────────────────────────────────────

export const Household = pgTable("household", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  name: t.varchar({ length: 100 }).notNull(),
  inviteCode: t.varchar({ length: 8 }).notNull().unique(),
  createdAt: t.timestamp().defaultNow().notNull(),
  updatedAt: t
    .timestamp({ mode: "date", withTimezone: true })
    .$onUpdateFn(() => new Date()),
}));

export const HouseholdMember = pgTable("household_member", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  householdId: t
    .uuid()
    .notNull()
    .references(() => Household.id, { onDelete: "cascade" }),
  userId: t.text().notNull(), // Better Auth user id
  role: householdRoleEnum().notNull().default("member"),
  joinedAt: t.timestamp().defaultNow().notNull(),
}));

// ─── User preferences ─────────────────────────────────────────────────────────

export const UserPreferences = pgTable(
  "user_preferences",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    userId: t.text().notNull(),
    householdId: t
      .uuid()
      .notNull()
      .references(() => Household.id, { onDelete: "cascade" }),
    dietaryRestrictions: t.text().array().default([]).notNull(),
    allergies: t.text().array().default([]).notNull(),
    notes: t.text(),
    preferredLocale: t.varchar({ length: 5 }).default("nl"),
    notifPush: t.boolean().default(true),
    notifAttendance: t.boolean().default(true),
    notifShopping: t.boolean().default(false),
    updatedAt: t
      .timestamp({ mode: "date", withTimezone: true })
      .$onUpdateFn(() => new Date()),
  }),
  (table) => [
    uniqueIndex("user_preferences_user_household_unique").on(
      table.userId,
      table.householdId,
    ),
  ],
);

// ─── Categories (Canonical Key; translations in i18n) ────────────────────────

export const Category = pgTable("categories", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  slug: t.varchar({ length: 50 }).notNull().unique(),
  icon: t.varchar({ length: 10 }),
  sortOrder: t.integer().notNull().default(0),
}));

// ─── Recipes ──────────────────────────────────────────────────────────────────

export const Recipe = pgTable("recipe", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  householdId: t
    .uuid()
    .notNull()
    .references(() => Household.id, { onDelete: "cascade" }),
  createdByUserId: t.text().notNull(),
  title: t.varchar({ length: 200 }).notNull(),
  description: t.text(),
  imageUrl: t.text(),
  prepTimeMinutes: t.integer(),
  cookTimeMinutes: t.integer(),
  servings: t.integer().notNull().default(4),
  instructions: t.jsonb().$type<{ step: number; text: string }[]>().default([]),
  tags: t.text().array().default([]).notNull(),
  sourceLanguage: t.varchar({ length: 5 }).notNull().default("nl"),
  deletedAt: t.timestamp(),
  createdAt: t.timestamp().defaultNow().notNull(),
  updatedAt: t
    .timestamp({ mode: "date", withTimezone: true })
    .$onUpdateFn(() => new Date()),
}));

// ─── Recipe translations (Translate on Read) ──────────────────────────────────

export const RecipeTranslation = pgTable(
  "recipe_translations",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    recipeId: t
      .uuid()
      .notNull()
      .references(() => Recipe.id, { onDelete: "cascade" }),
    locale: t.varchar({ length: 5 }).notNull(),
    title: t.varchar({ length: 200 }).notNull(),
    instructions: t
      .jsonb()
      .$type<{ step: number; text: string }[]>()
      .default([]),
    sourceHash: t.varchar({ length: 64 }).notNull(),
    createdAt: t.timestamp().defaultNow().notNull(),
  }),
  (table) => [uniqueIndex("recipe_translations_recipe_locale_unique").on(table.recipeId, table.locale)],
);

// ─── Canonical ingredients (knowledge base; JSONB translations) ───────────────

export const CanonicalIngredient = pgTable("canonical_ingredients", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  canonicalName: t.varchar({ length: 255 }).notNull().unique(),
  categorySlug: t
    .varchar({ length: 50 })
    .notNull()
    .references(() => Category.slug),
  translations: t.jsonb().$type<Record<string, string>>().default({}),
  defaultUnit: t.varchar({ length: 20 }),
  wikidataQid: t.varchar({ length: 20 }),
  isSystem: t.boolean().notNull().default(true),
}));

export const Ingredient = pgTable("ingredient", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  recipeId: t
    .uuid()
    .notNull()
    .references(() => Recipe.id, { onDelete: "cascade" }),
  name: t.varchar({ length: 100 }).notNull(),
  amount: t.numeric({ precision: 8, scale: 2 }),
  unit: t.varchar({ length: 30 }),
  category: t.varchar({ length: 50 }),
  normalizedName: t.varchar({ length: 100 }),
  brand: t.varchar({ length: 100 }),
  sortOrder: t.integer().notNull().default(0),
  canonicalIngredientId: t
    .uuid()
    .references(() => CanonicalIngredient.id, { onDelete: "set null" }),
}));

// ─── Meal planning ────────────────────────────────────────────────────────────

export const MealPlan = pgTable("meal_plan", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  householdId: t
    .uuid()
    .notNull()
    .references(() => Household.id, { onDelete: "cascade" }),
  recipeId: t.uuid().references(() => Recipe.id, { onDelete: "set null" }),
  date: t.date().notNull(),
  mealType: mealTypeEnum().notNull().default("dinner"),
  cookUserId: t.text(),
  notes: t.text(),
  createdAt: t.timestamp().defaultNow().notNull(),
  updatedAt: t
    .timestamp({ mode: "date", withTimezone: true })
    .$onUpdateFn(() => new Date()),
}));

export const Attendance = pgTable("attendance", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  mealPlanId: t
    .uuid()
    .notNull()
    .references(() => MealPlan.id, { onDelete: "cascade" }),
  userId: t.text().notNull(),
  status: attendanceStatusEnum().notNull(),
  guestCount: t.integer().notNull().default(0),
  respondedAt: t.timestamp().defaultNow().notNull(),
}));

// ─── Push tokens (for attendance reminders) ─────────────────────────────────────

export const PushToken = pgTable("push_token", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  userId: t.text().notNull(),
  expoPushToken: t.text().notNull(),
  deviceId: t.varchar({ length: 100 }),
  createdAt: t.timestamp().defaultNow().notNull(),
  updatedAt: t
    .timestamp({ mode: "date", withTimezone: true })
    .$onUpdateFn(() => new Date()),
}));

// ─── Shopping list ────────────────────────────────────────────────────────────

export const ShoppingList = pgTable("shopping_list", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  householdId: t
    .uuid()
    .notNull()
    .references(() => Household.id, { onDelete: "cascade" })
    .unique(),
  weekStartDate: t.date(),
  generatedAt: t.timestamp(),
  updatedAt: t
    .timestamp({ mode: "date", withTimezone: true })
    .$onUpdateFn(() => new Date()),
}));

export const ShoppingItem = pgTable("shopping_item", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  shoppingListId: t
    .uuid()
    .notNull()
    .references(() => ShoppingList.id, { onDelete: "cascade" }),
  ingredientId: t
    .uuid()
    .references(() => Ingredient.id, { onDelete: "set null" }),
  canonicalIngredientId: t
    .uuid()
    .references(() => CanonicalIngredient.id, { onDelete: "set null" }),
  recipeId: t.uuid().references(() => Recipe.id, { onDelete: "set null" }),
  name: t.varchar({ length: 100 }).notNull(),
  amount: t.numeric({ precision: 8, scale: 2 }),
  unit: t.varchar({ length: 30 }),
  category: t.varchar({ length: 50 }),
  normalizedName: t.varchar({ length: 100 }),
  isChecked: t.boolean().notNull().default(false),
  checkedByUserId: t.text(),
  addedByUserId: t.text(),
  note: t.text(),
  sortOrder: t.integer().notNull().default(0),
}));

// ─── Ingredient alias cache (canonical key; input_hash lookup) ──────────────────

export const IngredientAlias = pgTable(
  "ingredient_alias",
  (t) => ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    rawText: t.text().unique(),
    normalizedName: t.varchar({ length: 100 }),
    brand: t.varchar({ length: 100 }),
    category: t.varchar({ length: 50 }),
    inputHash: t.varchar({ length: 64 }).unique(),
    inputText: t.text(),
    inputLanguage: t.varchar({ length: 5 }),
    displayName: t.text(), // ingredient name only (e.g. "Kipfilet"), for display in lists
    canonicalName: t.varchar({ length: 255 }),
    categorySlug: t.varchar({ length: 50 }),
    quantity: t.numeric({ precision: 12, scale: 4 }),
    unit: t.varchar({ length: 20 }),
    canonicalIngredientId: t
      .uuid()
      .references(() => CanonicalIngredient.id, { onDelete: "set null" }),
    createdAt: t.timestamp().defaultNow().notNull(),
  }),
);

// ─── Zod schemas ──────────────────────────────────────────────────────────────

export const CreateRecipeSchema = createInsertSchema(Recipe, {
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  imageUrl: z.string().url().optional().or(z.literal("")),
  servings: z.number().int().min(1).max(100),
  prepTimeMinutes: z.number().int().min(0).optional(),
  cookTimeMinutes: z.number().int().min(0).optional(),
  instructions: z
    .array(z.object({ step: z.number().int().min(1), text: z.string().min(1) }))
    .optional(),
  tags: z.array(z.string()),
  sourceLanguage: z.string().max(5).optional(),
}).omit({
  id: true,
  householdId: true,
  createdByUserId: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
});

export const UpdateRecipeSchema = CreateRecipeSchema.partial();

export const SelectRecipeSchema = createSelectSchema(Recipe);

export const CreateIngredientSchema = createInsertSchema(Ingredient, {
  name: z.string().min(1).max(100),
  amount: z.union([z.number(), z.string()]).optional(),
  unit: z.string().max(30).optional(),
  category: z.string().max(50).optional(),
}).omit({ id: true, canonicalIngredientId: true });

export const UpdateIngredientSchema = createInsertSchema(Ingredient, {
  name: z.string().min(1).max(100).optional(),
  amount: z.union([z.number(), z.string()]).optional(),
  unit: z.string().max(30).optional(),
  category: z.string().max(50).optional(),
  sortOrder: z.number().int().min(0).optional(),
})
  .partial()
  .omit({ id: true, recipeId: true, canonicalIngredientId: true });

export const CreateHouseholdSchema = createInsertSchema(Household, {
  name: z.string().min(1).max(100),
}).omit({ id: true, createdAt: true, updatedAt: true, inviteCode: true });

export const SelectHouseholdSchema = createSelectSchema(Household);

// Re-export auth schema (Better Auth generated tables)
export * from "./auth-schema";
