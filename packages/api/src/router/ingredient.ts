import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "@prikkr/db";
import {
  CreateIngredientSchema,
  HouseholdMember,
  Ingredient,
  Recipe,
  UpdateIngredientSchema,
} from "@prikkr/db/schema";
import { z } from "zod/v4";

import { protectedProcedure } from "../trpc";
import { parseIngredientCached } from "../lib/parseIngredientCached";

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

async function getRecipeHouseholdId(
  db: Parameters<Parameters<typeof protectedProcedure.query>[0]>[0]["ctx"]["db"],
  recipeId: string
): Promise<string> {
  const [row] = await db
    .select({ householdId: Recipe.householdId })
    .from(Recipe)
    .where(eq(Recipe.id, recipeId))
    .limit(1);
  if (!row) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Recipe not found" });
  }
  return row.householdId;
}

export const ingredientRouter = {
  listByRecipe: protectedProcedure
    .input(z.object({ recipeId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const householdId = await getRecipeHouseholdId(ctx.db, input.recipeId);
      await assertHouseholdMember(ctx.db, householdId, ctx.session.user.id);

      return ctx.db
        .select()
        .from(Ingredient)
        .where(eq(Ingredient.recipeId, input.recipeId))
        .orderBy(Ingredient.sortOrder, Ingredient.id);
    }),

  create: protectedProcedure
    .input(
      CreateIngredientSchema.omit({ sortOrder: true }).and(
        z.object({ recipeId: z.string().uuid() })
      )
    )
    .mutation(async ({ ctx, input }) => {
      const householdId = await getRecipeHouseholdId(ctx.db, input.recipeId);
      await assertHouseholdMember(ctx.db, householdId, ctx.session.user.id);

      const [maxRow] = await ctx.db
        .select({ sortOrder: Ingredient.sortOrder })
        .from(Ingredient)
        .where(eq(Ingredient.recipeId, input.recipeId))
        .orderBy(desc(Ingredient.sortOrder))
        .limit(1);

      const sortOrder = maxRow ? maxRow.sortOrder + 1 : 0;

      const amountStr =
        input.amount !== undefined && input.amount !== null && input.amount !== ""
          ? String(input.amount)
          : null;

      let normalizedName: string | null = null;
      let resolvedCategory: string | null = input.category ?? null;
      let resolvedUnit = input.unit ?? null;
      let resolvedAmount = amountStr;
      let canonicalIngredientId: string | null = null;

      try {
        const parsed = await parseIngredientCached(ctx.db, input.name);
        normalizedName = parsed.canonicalName;
        if (!resolvedCategory) resolvedCategory = parsed.categorySlug;
        if (parsed.quantity != null) resolvedAmount = String(parsed.quantity);
        if (parsed.unit) resolvedUnit = parsed.unit;
        if (parsed.canonicalIngredientId) canonicalIngredientId = parsed.canonicalIngredientId;
      } catch {
        console.error("[parseIngredientCached] failed, skipping normalization");
      }

      const [ingredient] = await ctx.db
        .insert(Ingredient)
        .values({
          recipeId: input.recipeId,
          name: input.name,
          amount: resolvedAmount,
          unit: resolvedUnit,
          category: resolvedCategory,
          normalizedName,
          brand: null,
          sortOrder,
          canonicalIngredientId,
        })
        .returning();

      if (!ingredient) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      }

      return ingredient;
    }),

  update: protectedProcedure
    .input(
      z.object({ id: z.string().uuid() }).and(UpdateIngredientSchema)
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;

      const [existing] = await ctx.db
        .select({ recipeId: Ingredient.recipeId })
        .from(Ingredient)
        .where(eq(Ingredient.id, id))
        .limit(1);

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const householdId = await getRecipeHouseholdId(ctx.db, existing.recipeId);
      await assertHouseholdMember(ctx.db, householdId, ctx.session.user.id);

      const amountStr =
        updates.amount !== undefined && updates.amount !== null && updates.amount !== ""
          ? String(updates.amount)
          : undefined;

      const [ingredient] = await ctx.db
        .update(Ingredient)
        .set({
          ...(updates.name !== undefined && { name: updates.name }),
          ...(amountStr !== undefined && { amount: amountStr }),
          ...(updates.unit !== undefined && { unit: updates.unit }),
          ...(updates.category !== undefined && { category: updates.category }),
          ...(updates.sortOrder !== undefined && { sortOrder: updates.sortOrder }),
        })
        .where(eq(Ingredient.id, id))
        .returning();

      if (!ingredient) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      }

      return ingredient;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db
        .select({ recipeId: Ingredient.recipeId })
        .from(Ingredient)
        .where(eq(Ingredient.id, input.id))
        .limit(1);

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const householdId = await getRecipeHouseholdId(ctx.db, existing.recipeId);
      await assertHouseholdMember(ctx.db, householdId, ctx.session.user.id);

      await ctx.db.delete(Ingredient).where(eq(Ingredient.id, input.id));
      return { ok: true };
    }),
} satisfies TRPCRouterRecord;
