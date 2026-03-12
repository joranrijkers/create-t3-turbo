import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { and, eq, gte, inArray, isNull, lte, or, sql } from "@prikkr/db";
import { CATEGORY_SLUGS } from "@prikkr/db/constants";
import {
  CanonicalIngredient,
  HouseholdMember,
  Ingredient,
  MealPlan,
  Recipe,
  ShoppingItem,
  ShoppingList,
  UserPreferences,
  user as userTable,
} from "@prikkr/db/schema";
import { parseIngredientCached } from "../lib/parseIngredientCached";
import { normalizeUnitToCanonical } from "../lib/normalizeUnit";
import { z } from "zod/v4";

import { protectedProcedure } from "../trpc";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

function getWeekBounds(weekStartDate: string) {
  const start = weekStartDate;
  const parts = start.split("-").map(Number);
  const y = parts[0] ?? 0;
  const m = parts[1] ?? 1;
  const d = parts[2] ?? 1;
  const endDate = new Date(Date.UTC(y, m - 1, d + 6));
  const end = endDate.toISOString().slice(0, 10);
  return { start, end };
}

async function assertHouseholdMember(
  db: Parameters<Parameters<typeof protectedProcedure.query>[0]>[0]["ctx"]["db"],
  householdId: string,
  userId: string
) {
  const member = await db
    .select()
    .from(HouseholdMember)
    .where(
      and(
        eq(HouseholdMember.householdId, householdId),
        eq(HouseholdMember.userId, userId)
      )
    )
    .limit(1)
    .then((r) => r[0] ?? null);
  if (!member) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
}

/** Merge key: prefer canonical id for cross-language dedup, else normalizedName|unit (unit canonicalized) */
function mergeKey(
  canonicalIngredientId: string | null,
  normalizedName: string | null,
  name: string,
  unit: string | null,
  normalizedUnit: string | null
) {
  const u = normalizedUnit ?? unit ?? "";
  if (canonicalIngredientId) return `id:${canonicalIngredientId}|${u}`;
  return `${(normalizedName ?? name).trim().toLowerCase()}|${u}`;
}

export const shoppingListRouter = {
  generate: protectedProcedure
    .input(
      z.object({
        householdId: z.string().uuid(),
        weekStartDate: dateSchema.optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertHouseholdMember(
        ctx.db,
        input.householdId,
        ctx.session.user.id
      );

      const weekStart =
        input.weekStartDate ??
        (() => {
          const now = new Date();
          const day = now.getUTCDay();
          const diff = day === 0 ? -6 : 1 - day;
          const monday = new Date(now);
          monday.setUTCDate(now.getUTCDate() + diff);
          return monday.toISOString().slice(0, 10);
        })();
      const { start, end } = getWeekBounds(weekStart);

      const plans = await ctx.db
        .select({
          id: MealPlan.id,
          recipeId: MealPlan.recipeId,
          date: MealPlan.date,
        })
        .from(MealPlan)
        .where(
          and(
            eq(MealPlan.householdId, input.householdId),
            gte(MealPlan.date, start),
            lte(MealPlan.date, end)
          )
        );

      const plansWithRecipe = plans.filter((p) => p.recipeId != null);
      const recipeIds = [...new Set(plansWithRecipe.map((p) => p.recipeId).filter(Boolean))] as string[];
      const ingredientsByRecipe =
        recipeIds.length > 0
          ? await ctx.db
              .select({
                recipeId: Ingredient.recipeId,
                name: Ingredient.name,
                amount: Ingredient.amount,
                unit: Ingredient.unit,
                category: Ingredient.category,
                normalizedName: Ingredient.normalizedName,
                canonicalIngredientId: Ingredient.canonicalIngredientId,
                sortOrder: Ingredient.sortOrder,
              })
              .from(Ingredient)
              .where(inArray(Ingredient.recipeId, recipeIds))
          : [];

      const recipeTitles = new Map<string, string>();
      if (recipeIds.length > 0) {
        const recipes = await ctx.db
          .select({ id: Recipe.id, title: Recipe.title })
          .from(Recipe)
          .where(inArray(Recipe.id, recipeIds));
        for (const r of recipes) {
          recipeTitles.set(r.id, r.title);
        }
      }

      const merged = new Map<
        string,
        {
          name: string;
          normalizedName: string | null;
          amount: string | null;
          unit: string | null;
          category: string | null;
          canonicalIngredientId: string | null;
          recipeId: string | null;
          recipeTitle: string | null;
          sortOrder: number;
        }
      >();

      for (const ing of ingredientsByRecipe) {
        const normalizedUnit = normalizeUnitToCanonical(ing.unit) ?? ing.unit;
        const key = mergeKey(
          ing.canonicalIngredientId,
          ing.normalizedName,
          ing.name,
          ing.unit,
          normalizedUnit
        );
        const existing = merged.get(key);
        const amountStr = ing.amount != null ? String(ing.amount) : null;
        const numAmount =
          amountStr != null && amountStr !== ""
            ? Number.parseFloat(amountStr)
            : NaN;
        if (existing) {
          if (!Number.isNaN(numAmount) && existing.amount !== null) {
            const existingNum = Number.parseFloat(existing.amount);
            if (!Number.isNaN(existingNum)) {
              const sum = existingNum + numAmount;
              merged.set(key, {
                ...existing,
                amount: String(sum),
              });
            }
          }
        } else {
          merged.set(key, {
            name: ing.name,
            normalizedName: ing.normalizedName,
            amount: amountStr,
            unit: normalizedUnit,
            category: ing.category,
            canonicalIngredientId: ing.canonicalIngredientId,
            recipeId: ing.recipeId,
            recipeTitle: recipeTitles.get(ing.recipeId) ?? null,
            sortOrder: ing.sortOrder,
          });
        }
      }

      let list = await ctx.db
        .select()
        .from(ShoppingList)
        .where(eq(ShoppingList.householdId, input.householdId))
        .limit(1)
        .then((r) => r[0] ?? null);

      if (!list) {
        const [inserted] = await ctx.db
          .insert(ShoppingList)
          .values({
            householdId: input.householdId,
            weekStartDate: weekStart,
            generatedAt: new Date(),
          })
          .returning();
        if (!inserted) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        list = inserted;
      } else {
        await ctx.db
          .update(ShoppingList)
          .set({
            weekStartDate: weekStart,
            generatedAt: new Date(),
          })
          .where(eq(ShoppingList.id, list.id));
      }

      await ctx.db
        .delete(ShoppingItem)
        .where(eq(ShoppingItem.shoppingListId, list.id));

      let sortOrder = 0;
      const categoryOrder = [...CATEGORY_SLUGS] as string[];
      const sortedEntries = [...merged.entries()].sort((a, b) => {
        const catA = a[1].category ?? "other";
        const catB = b[1].category ?? "other";
        const iA = categoryOrder.indexOf(catA);
        const iB = categoryOrder.indexOf(catB);
        if (iA !== iB) return (iA === -1 ? 999 : iA) - (iB === -1 ? 999 : iB);
        return a[1].sortOrder - b[1].sortOrder;
      });

      for (const [, v] of sortedEntries) {
        await ctx.db.insert(ShoppingItem).values({
          shoppingListId: list.id,
          name: v.name,
          normalizedName: v.normalizedName,
          amount: v.amount,
          unit: v.unit,
          category: v.category,
          canonicalIngredientId: v.canonicalIngredientId,
          recipeId: v.recipeId,
          sortOrder: sortOrder++,
        });
      }

      return { listId: list.id, itemCount: merged.size };
    }),

  current: protectedProcedure
    .input(
      z.object({
        householdId: z.string().uuid(),
        locale: z.string().max(5).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      await assertHouseholdMember(
        ctx.db,
        input.householdId,
        ctx.session.user.id
      );

      const list = await ctx.db
        .select()
        .from(ShoppingList)
        .where(eq(ShoppingList.householdId, input.householdId))
        .limit(1)
        .then((r) => r[0] ?? null);

      if (!list) {
        return {
          listId: null,
          weekStartDate: null,
          generatedAt: null,
          checkedCount: 0,
          totalCount: 0,
          categories: [],
          items: [],
        };
      }

      let userLocale: string = input.locale ?? "nl";
      if (!input.locale) {
        try {
          const [prefs] = await ctx.db
            .select({ preferredLocale: UserPreferences.preferredLocale })
            .from(UserPreferences)
            .where(
              and(
                eq(UserPreferences.userId, ctx.session.user.id),
                eq(UserPreferences.householdId, input.householdId)
              )
            )
            .limit(1);
          if (prefs?.preferredLocale) userLocale = prefs.preferredLocale;
        } catch {
          // preferred_locale column may not exist yet if DB wasn't migrated; use default
          userLocale = "nl";
        }
      }

      const items = await ctx.db
        .select({
          id: ShoppingItem.id,
          name: ShoppingItem.name,
          amount: ShoppingItem.amount,
          unit: ShoppingItem.unit,
          category: ShoppingItem.category,
          isChecked: ShoppingItem.isChecked,
          note: ShoppingItem.note,
          recipeId: ShoppingItem.recipeId,
          canonicalIngredientId: ShoppingItem.canonicalIngredientId,
          recipeTitle: Recipe.title,
          addedByUserId: ShoppingItem.addedByUserId,
          addedByName: userTable.name,
          addedByImage: userTable.image,
          translations: CanonicalIngredient.translations,
        })
        .from(ShoppingItem)
        .leftJoin(Recipe, eq(ShoppingItem.recipeId, Recipe.id))
        .leftJoin(userTable, eq(ShoppingItem.addedByUserId, userTable.id))
        .leftJoin(
          CanonicalIngredient,
          eq(ShoppingItem.canonicalIngredientId, CanonicalIngredient.id)
        )
        .where(eq(ShoppingItem.shoppingListId, list.id))
        .orderBy(ShoppingItem.sortOrder, ShoppingItem.id);

      const totalCount = items.length;
      const checkedCount = items.filter((i) => i.isChecked).length;

      type ItemRow = (typeof items)[number];
      const byCategory = new Map<string, ItemRow[]>();
      for (const item of items) {
        const cat = item.category ?? "other";
        const arr = byCategory.get(cat) ?? [];
        arr.push(item);
        byCategory.set(cat, arr);
      }

      const categoryOrder = [...CATEGORY_SLUGS];
      const categories = categoryOrder.filter((c) => byCategory.has(c));
      const other = byCategory.get("other");
      if (other?.length) {
        if (!categories.includes("other")) categories.push("other");
      }
      const fallbackCats = categories.length ? categories : [...byCategory.keys()];

      function displayName(item: ItemRow): string {
        const t = item.translations as Record<string, string> | null;
        return (t?.[userLocale] ?? t?.en ?? item.name) || item.name;
      }

      return {
        listId: list.id,
        weekStartDate: list.weekStartDate,
        generatedAt: list.generatedAt,
        checkedCount,
        totalCount,
        categories: fallbackCats,
        items: items.map((i) => ({
          id: i.id,
          name: displayName(i),
          amount: i.amount != null ? String(i.amount) : null,
          unit: normalizeUnitToCanonical(i.unit) ?? i.unit,
          category: i.category,
          isChecked: i.isChecked,
          note: i.note,
          recipeId: i.recipeId,
          recipeTitle: i.recipeTitle,
          addedByUserId: i.addedByUserId,
          addedByName: i.addedByName,
          addedByImage: i.addedByImage,
        })),
      };
    }),

  checkItem: protectedProcedure
    .input(z.object({ itemId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [item] = await ctx.db
        .select({ shoppingListId: ShoppingItem.shoppingListId })
        .from(ShoppingItem)
        .where(eq(ShoppingItem.id, input.itemId))
        .limit(1);
      if (!item) throw new TRPCError({ code: "NOT_FOUND" });

      const [list] = await ctx.db
        .select({ householdId: ShoppingList.householdId })
        .from(ShoppingList)
        .where(eq(ShoppingList.id, item.shoppingListId))
        .limit(1);
      if (!list) throw new TRPCError({ code: "NOT_FOUND" });
      await assertHouseholdMember(
        ctx.db,
        list.householdId,
        ctx.session.user.id
      );

      await ctx.db
        .update(ShoppingItem)
        .set({
          isChecked: true,
          checkedByUserId: ctx.session.user.id,
        })
        .where(eq(ShoppingItem.id, input.itemId));
      return { ok: true };
    }),

  uncheckItem: protectedProcedure
    .input(z.object({ itemId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [item] = await ctx.db
        .select({ shoppingListId: ShoppingItem.shoppingListId })
        .from(ShoppingItem)
        .where(eq(ShoppingItem.id, input.itemId))
        .limit(1);
      if (!item) throw new TRPCError({ code: "NOT_FOUND" });

      const [list] = await ctx.db
        .select({ householdId: ShoppingList.householdId })
        .from(ShoppingList)
        .where(eq(ShoppingList.id, item.shoppingListId))
        .limit(1);
      if (!list) throw new TRPCError({ code: "NOT_FOUND" });
      await assertHouseholdMember(
        ctx.db,
        list.householdId,
        ctx.session.user.id
      );

      await ctx.db
        .update(ShoppingItem)
        .set({
          isChecked: false,
          checkedByUserId: null,
        })
        .where(eq(ShoppingItem.id, input.itemId));
      return { ok: true };
    }),

  addManual: protectedProcedure
    .input(
      z.object({
        householdId: z.string().uuid(),
        name: z.string().min(1).max(100),
        amount: z.union([z.number(), z.string()]).optional(),
        unit: z.string().max(30).optional(),
        category: z.string().max(50).optional(),
        note: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertHouseholdMember(
        ctx.db,
        input.householdId,
        ctx.session.user.id
      );

      let list = await ctx.db
        .select()
        .from(ShoppingList)
        .where(eq(ShoppingList.householdId, input.householdId))
        .limit(1)
        .then((r) => r[0] ?? null);

      if (!list) {
        const [inserted] = await ctx.db
          .insert(ShoppingList)
          .values({ householdId: input.householdId })
          .returning();
        if (!inserted) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        list = inserted;
      }

      const amountStr =
        input.amount !== undefined && input.amount !== ""
          ? String(input.amount)
          : null;
      const unitStr = input.unit ?? null;

      let parsedItem: {
        canonicalName: string | null;
        displayName: string | null;
        categorySlug: string | null;
        canonicalIngredientId: string | null;
        quantity: number | null;
        unit: string | null;
      } = {
        canonicalName: null,
        displayName: null,
        categorySlug: null,
        canonicalIngredientId: null,
        quantity: null,
        unit: null,
      };
      try {
        const parsed = await parseIngredientCached(ctx.db, input.name);
        parsedItem = {
          canonicalName: parsed.canonicalName,
          displayName: parsed.displayName?.trim() || null,
          categorySlug: parsed.categorySlug,
          canonicalIngredientId: parsed.canonicalIngredientId ?? null,
          quantity: parsed.quantity,
          unit: parsed.unit,
        };
      } catch {
        console.error("[parseIngredientCached] failed in addManual, skipping");
      }

      const resolvedAmount = parsedItem.quantity != null ? String(parsedItem.quantity) : amountStr;
      const resolvedUnitRaw = parsedItem.unit ?? unitStr;
      const resolvedUnit = normalizeUnitToCanonical(resolvedUnitRaw) ?? resolvedUnitRaw;
      const resolvedCategory = parsedItem.categorySlug ?? input.category ?? null;

      const displayNameForItem =
        parsedItem.displayName && parsedItem.displayName.length > 0
          ? parsedItem.displayName.charAt(0).toUpperCase() +
            parsedItem.displayName.slice(1).toLowerCase()
          : null;

      const unitMatch =
        resolvedUnit != null
          ? eq(ShoppingItem.unit, resolvedUnit)
          : isNull(ShoppingItem.unit);

      const existing = await ctx.db
        .select()
        .from(ShoppingItem)
        .where(
          and(
            eq(ShoppingItem.shoppingListId, list.id),
            eq(ShoppingItem.isChecked, false),
            or(
              parsedItem.canonicalIngredientId != null
                ? and(
                    eq(ShoppingItem.canonicalIngredientId, parsedItem.canonicalIngredientId),
                    unitMatch,
                  )
                : sql`1=0`,
              parsedItem.canonicalName
                ? and(
                    eq(ShoppingItem.normalizedName, parsedItem.canonicalName),
                    unitMatch,
                  )
                : sql`1=0`,
              and(
                sql`lower(${ShoppingItem.name}) = lower(${input.name.trim()})`,
                unitMatch,
              ),
            )
          )
        )
        .limit(1)
        .then((r) => r[0] ?? null);

      if (existing) {
        // Merge: add amounts if both are numeric, otherwise keep existing
        let newAmount = existing.amount;
        if (resolvedAmount !== null && existing.amount !== null) {
          const a = parseFloat(existing.amount);
          const b = parseFloat(resolvedAmount);
          if (!isNaN(a) && !isNaN(b)) {
            newAmount = String(a + b);
          }
        } else if (resolvedAmount !== null && existing.amount === null) {
          newAmount = resolvedAmount;
        }
        const [updated] = await ctx.db
          .update(ShoppingItem)
          .set({ amount: newAmount })
          .where(eq(ShoppingItem.id, existing.id))
          .returning();
        if (!updated) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        return updated;
      }

      const [maxRow] = await ctx.db
        .select({ sortOrder: ShoppingItem.sortOrder })
        .from(ShoppingItem)
        .where(eq(ShoppingItem.shoppingListId, list.id))
        .orderBy(ShoppingItem.sortOrder)
        .limit(1)
        .then((rows) => rows.slice(-1));

      const sortOrder = maxRow ? maxRow.sortOrder + 1 : 0;

      const [item] = await ctx.db
        .insert(ShoppingItem)
        .values({
          shoppingListId: list.id,
          name:
            displayNameForItem ?? input.name.trim(),
          normalizedName: parsedItem.canonicalName,
          amount: resolvedAmount,
          unit: resolvedUnit,
          category: resolvedCategory,
          canonicalIngredientId: parsedItem.canonicalIngredientId,
          note: input.note ?? null,
          addedByUserId: ctx.session.user.id,
          sortOrder,
        })
        .returning();

      if (!item) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return item;
    }),

  removeItem: protectedProcedure
    .input(z.object({ itemId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .select({ shoppingListId: ShoppingItem.shoppingListId })
        .from(ShoppingItem)
        .where(eq(ShoppingItem.id, input.itemId))
        .limit(1);
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });

      const [list] = await ctx.db
        .select({ householdId: ShoppingList.householdId })
        .from(ShoppingList)
        .where(eq(ShoppingList.id, row.shoppingListId))
        .limit(1);
      if (!list) throw new TRPCError({ code: "NOT_FOUND" });
      await assertHouseholdMember(
        ctx.db,
        list.householdId,
        ctx.session.user.id
      );

      await ctx.db.delete(ShoppingItem).where(eq(ShoppingItem.id, input.itemId));
      return { ok: true };
    }),

  clearChecked: protectedProcedure
    .input(z.object({ householdId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await assertHouseholdMember(
        ctx.db,
        input.householdId,
        ctx.session.user.id
      );

      const list = await ctx.db
        .select()
        .from(ShoppingList)
        .where(eq(ShoppingList.householdId, input.householdId))
        .limit(1)
        .then((r) => r[0] ?? null);
      if (!list) return { ok: true, removed: 0 };

      const result = await ctx.db
        .delete(ShoppingItem)
        .where(
          and(
            eq(ShoppingItem.shoppingListId, list.id),
            eq(ShoppingItem.isChecked, true)
          )
        )
        .returning({ id: ShoppingItem.id });
      return { ok: true, removed: result.length };
    }),
} satisfies TRPCRouterRecord;
