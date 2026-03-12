import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, isNull, sql } from "@prikkr/db";
import {
  CreateRecipeSchema,
  HouseholdMember,
  Ingredient,
  Recipe,
  RecipeTranslation,
  UpdateRecipeSchema,
  user as userTable,
} from "@prikkr/db/schema";
import { z } from "zod/v4";

import { protectedProcedure } from "../trpc";

const RECIPE_IMAGES_BUCKET = "recipe-images";

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

export const recipeRouter = {
  list: protectedProcedure
    .input(
      z.object({
        householdId: z.string().uuid(),
        search: z.string().optional(),
        tags: z.array(z.string()).optional(),
        limit: z.number().int().min(1).max(100).optional().default(50),
        offset: z.number().int().min(0).optional().default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      await assertHouseholdMember(
        ctx.db,
        input.householdId,
        ctx.session.user.id
      );

      const conditions = [
        eq(Recipe.householdId, input.householdId),
        isNull(Recipe.deletedAt),
      ];

      if (input.search?.trim()) {
        const term = `%${input.search.trim()}%`;
        conditions.push(
          sql`(${Recipe.title} ilike ${term} or ${Recipe.description} ilike ${term})`
        );
      }

      if (input.tags?.length) {
        conditions.push(
          sql`${Recipe.tags} && ARRAY[${sql.join(
            input.tags.map((tag) => sql`${tag}`),
            sql`, `
          )}]::text[]`
        );
      }

      const recipes = await ctx.db
        .select({
          id: Recipe.id,
          title: Recipe.title,
          description: Recipe.description,
          imageUrl: Recipe.imageUrl,
          prepTimeMinutes: Recipe.prepTimeMinutes,
          cookTimeMinutes: Recipe.cookTimeMinutes,
          servings: Recipe.servings,
          tags: Recipe.tags,
          createdAt: Recipe.createdAt,
          updatedAt: Recipe.updatedAt,
        })
        .from(Recipe)
        .where(and(...conditions))
        .orderBy(desc(Recipe.updatedAt))
        .limit(input.limit)
        .offset(input.offset);

      return recipes;
    }),

  byId: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        locale: z.string().max(5).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const [recipeRow] = await ctx.db
        .select({
          id: Recipe.id,
          householdId: Recipe.householdId,
          createdByUserId: Recipe.createdByUserId,
          title: Recipe.title,
          description: Recipe.description,
          imageUrl: Recipe.imageUrl,
          prepTimeMinutes: Recipe.prepTimeMinutes,
          cookTimeMinutes: Recipe.cookTimeMinutes,
          servings: Recipe.servings,
          instructions: Recipe.instructions,
          tags: Recipe.tags,
          sourceLanguage: Recipe.sourceLanguage,
          createdAt: Recipe.createdAt,
          updatedAt: Recipe.updatedAt,
          createdByName: userTable.name,
          createdByImage: userTable.image,
        })
        .from(Recipe)
        .leftJoin(userTable, eq(Recipe.createdByUserId, userTable.id))
        .where(eq(Recipe.id, input.id))
        .limit(1);

      if (!recipeRow) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      await assertHouseholdMember(
        ctx.db,
        recipeRow.householdId,
        ctx.session.user.id
      );

      const ingredients = await ctx.db
        .select()
        .from(Ingredient)
        .where(eq(Ingredient.recipeId, input.id))
        .orderBy(Ingredient.sortOrder, Ingredient.id);

      const requestedLocale = input.locale ?? recipeRow.sourceLanguage;
      let title = recipeRow.title;
      let instructions = recipeRow.instructions;

      if (requestedLocale !== recipeRow.sourceLanguage) {
        const [translation] = await ctx.db
          .select()
          .from(RecipeTranslation)
          .where(
            and(
              eq(RecipeTranslation.recipeId, input.id),
              eq(RecipeTranslation.locale, requestedLocale)
            )
          )
          .limit(1);
        if (translation) {
          title = translation.title;
          instructions = translation.instructions ?? recipeRow.instructions;
        }
      }

      const {
        householdId: _h,
        createdByUserId: _u,
        createdByName,
        createdByImage,
        ...recipe
      } = recipeRow;

      return {
        recipe: {
          ...recipe,
          title,
          instructions,
          createdByName: createdByName ?? null,
          createdByImage: createdByImage ?? null,
        },
        ingredients,
      };
    }),

  create: protectedProcedure
    .input(
      CreateRecipeSchema.and(
        z.object({ householdId: z.string().uuid() })
      )
    )
    .mutation(async ({ ctx, input }) => {
      const { householdId, ...data } = input;
      await assertHouseholdMember(ctx.db, householdId, ctx.session.user.id);

      const [recipe] = await ctx.db
        .insert(Recipe)
        .values({
          householdId,
          createdByUserId: ctx.session.user.id,
          title: data.title,
          description: data.description ?? null,
          imageUrl: data.imageUrl && data.imageUrl !== "" ? data.imageUrl : null,
          prepTimeMinutes: data.prepTimeMinutes ?? null,
          cookTimeMinutes: data.cookTimeMinutes ?? null,
          servings: data.servings ?? 4,
          instructions: data.instructions ?? [],
          tags: data.tags ?? [],
          sourceLanguage: data.sourceLanguage ?? "nl",
        })
        .returning();

      if (!recipe) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      }

      return recipe;
    }),

  update: protectedProcedure
    .input(
      z
        .object({ id: z.string().uuid() })
        .and(UpdateRecipeSchema)
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;

      const [existing] = await ctx.db
        .select({ householdId: Recipe.householdId })
        .from(Recipe)
        .where(eq(Recipe.id, id))
        .limit(1);

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      await assertHouseholdMember(
        ctx.db,
        existing.householdId,
        ctx.session.user.id
      );

      const [recipe] = await ctx.db
        .update(Recipe)
        .set({
          ...(updates.title !== undefined && { title: updates.title }),
          ...(updates.description !== undefined && {
            description: updates.description,
          }),
          ...(updates.imageUrl !== undefined && {
            imageUrl:
              updates.imageUrl && updates.imageUrl !== ""
                ? updates.imageUrl
                : null,
          }),
          ...(updates.prepTimeMinutes !== undefined && {
            prepTimeMinutes: updates.prepTimeMinutes,
          }),
          ...(updates.cookTimeMinutes !== undefined && {
            cookTimeMinutes: updates.cookTimeMinutes,
          }),
          ...(updates.servings !== undefined && { servings: updates.servings }),
          ...(updates.instructions !== undefined && {
            instructions: updates.instructions,
          }),
          ...(updates.tags !== undefined && { tags: updates.tags }),
          ...(updates.sourceLanguage !== undefined && {
            sourceLanguage: updates.sourceLanguage,
          }),
          updatedAt: new Date(),
        })
        .where(eq(Recipe.id, id))
        .returning();

      if (!recipe) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      }

      // Normalize timestamp fields: pg may return strings, Drizzle/serialization expects Date
      return {
        ...recipe,
        createdAt:
          recipe.createdAt instanceof Date
            ? recipe.createdAt
            : new Date(recipe.createdAt as unknown as string),
        updatedAt:
          recipe.updatedAt instanceof Date
            ? recipe.updatedAt
            : new Date(recipe.updatedAt as unknown as string),
      };
    }),

  softDelete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db
        .select({ householdId: Recipe.householdId })
        .from(Recipe)
        .where(eq(Recipe.id, input.id))
        .limit(1);

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      await assertHouseholdMember(
        ctx.db,
        existing.householdId,
        ctx.session.user.id
      );

      await ctx.db
        .update(Recipe)
        .set({ deletedAt: new Date() })
        .where(eq(Recipe.id, input.id));

      return { ok: true };
    }),

  getRecipeImageUploadUrl: protectedProcedure
    .input(
      z.object({
        householdId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertHouseholdMember(
        ctx.db,
        input.householdId,
        ctx.session.user.id
      );
      if (!ctx.supabase) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Storage is not configured",
        });
      }
      const path = `${input.householdId}/${crypto.randomUUID()}.jpg`;
      const {
        data: signedData,
        error: signError,
      } = await ctx.supabase.storage
        .from(RECIPE_IMAGES_BUCKET)
        .createSignedUploadUrl(path);

      if (signError || !signedData) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: signError?.message ?? "Failed to create upload URL",
        });
      }

      const { data: publicUrlData } = ctx.supabase.storage
        .from(RECIPE_IMAGES_BUCKET)
        .getPublicUrl(signedData.path);

      return {
        uploadUrl: signedData.signedUrl,
        publicUrl: publicUrlData.publicUrl,
      };
    }),
} satisfies TRPCRouterRecord;
