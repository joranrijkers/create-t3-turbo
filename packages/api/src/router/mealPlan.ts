import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { and, eq, gte, inArray, lte } from "@prikkr/db";
import {
  Attendance,
  HouseholdMember,
  Ingredient,
  MealPlan,
  Recipe,
  UserPreferences,
  user as userTable,
} from "@prikkr/db/schema";
import { z } from "zod/v4";

import { protectedProcedure } from "../trpc";

const mealTypeSchema = z.enum(["breakfast", "lunch", "dinner"]);
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

export const mealPlanRouter = {
  forWeek: protectedProcedure
    .input(
      z.object({
        householdId: z.string().uuid(),
        weekStartDate: dateSchema,
      })
    )
    .query(async ({ ctx, input }) => {
      await assertHouseholdMember(
        ctx.db,
        input.householdId,
        ctx.session.user.id
      );
      const { start, end } = getWeekBounds(input.weekStartDate);

      const plans = await ctx.db
        .select({
          id: MealPlan.id,
          date: MealPlan.date,
          mealType: MealPlan.mealType,
          recipeId: MealPlan.recipeId,
          cookUserId: MealPlan.cookUserId,
          notes: MealPlan.notes,
          recipeTitle: Recipe.title,
          recipeImageUrl: Recipe.imageUrl,
          cookName: userTable.name,
          cookImage: userTable.image,
        })
        .from(MealPlan)
        .leftJoin(Recipe, eq(MealPlan.recipeId, Recipe.id))
        .leftJoin(userTable, eq(MealPlan.cookUserId, userTable.id))
        .where(
          and(
            eq(MealPlan.householdId, input.householdId),
            gte(MealPlan.date, start),
            lte(MealPlan.date, end)
          )
        )
        .orderBy(MealPlan.date);

      const planIds = plans.map((p) => p.id);
      const attendancesForPlans =
        planIds.length > 0
          ? await ctx.db
              .select({
                mealPlanId: Attendance.mealPlanId,
                userId: Attendance.userId,
                status: Attendance.status,
                guestCount: Attendance.guestCount,
                userName: userTable.name,
                userImage: userTable.image,
              })
              .from(Attendance)
              .innerJoin(userTable, eq(Attendance.userId, userTable.id))
              .where(inArray(Attendance.mealPlanId, planIds))
          : [];

      const attendanceByPlan = new Map<
        string,
        {
          userId: string;
          status: "yes" | "no" | "maybe";
          guestCount: number;
          userName: string | null;
          userImage: string | null;
        }[]
      >();
      for (const a of attendancesForPlans) {
        const list = attendanceByPlan.get(a.mealPlanId) ?? [];
        list.push({
          userId: a.userId,
          status: a.status,
          guestCount: a.guestCount,
          userName: a.userName,
          userImage: a.userImage,
        });
        attendanceByPlan.set(a.mealPlanId, list);
      }

      const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      type AttendanceItem = {
        userId: string;
        status: "yes" | "no" | "maybe";
        guestCount: number;
        userName: string | null;
        userImage: string | null;
      };
      type DayRow = {
        date: string;
        dayLabel: string;
        meals: Array<(typeof plans)[number] & { attendances: AttendanceItem[] }>;
      };
      const days: DayRow[] = [];
      const startParts = start.split("-").map(Number);
      const yStart = startParts[0] ?? 0;
      const mStart = startParts[1] ?? 1;
      const dStart = startParts[2] ?? 1;
      for (let i = 0; i < 7; i++) {
        const dateObj = new Date(Date.UTC(yStart, mStart - 1, dStart + i));
        const dateStr = dateObj.toISOString().slice(0, 10);
        const dayLabel = dayLabels[dateObj.getUTCDay()] ?? "";
        const dayPlans = plans
          .filter((p) => p.date === dateStr)
          .map((p) => ({
            ...p,
            attendances: attendanceByPlan.get(p.id) ?? [],
          }));
        days.push({ date: dateStr, dayLabel, meals: dayPlans });
      }

      return { days };
    }),

  byId: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .select({
          id: MealPlan.id,
          householdId: MealPlan.householdId,
          recipeId: MealPlan.recipeId,
          date: MealPlan.date,
          mealType: MealPlan.mealType,
          cookUserId: MealPlan.cookUserId,
          notes: MealPlan.notes,
          recipeTitle: Recipe.title,
          recipeImageUrl: Recipe.imageUrl,
          cookName: userTable.name,
          cookImage: userTable.image,
        })
        .from(MealPlan)
        .leftJoin(Recipe, eq(MealPlan.recipeId, Recipe.id))
        .leftJoin(userTable, eq(MealPlan.cookUserId, userTable.id))
        .where(eq(MealPlan.id, input.id))
        .limit(1);
      if (!row) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      const member = await ctx.db
        .select()
        .from(HouseholdMember)
        .where(
          and(
            eq(HouseholdMember.householdId, row.householdId),
            eq(HouseholdMember.userId, ctx.session.user.id)
          )
        )
        .limit(1)
        .then((r) => r[0] ?? null);
      if (!member) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      return row;
    }),

  create: protectedProcedure
    .input(
      z.object({
        householdId: z.string().uuid(),
        date: dateSchema,
        mealType: mealTypeSchema.default("dinner"),
        recipeId: z.string().uuid().optional(),
        cookUserId: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertHouseholdMember(
        ctx.db,
        input.householdId,
        ctx.session.user.id
      );
      const [plan] = await ctx.db
        .insert(MealPlan)
        .values({
          householdId: input.householdId,
          date: input.date,
          mealType: input.mealType,
          recipeId: input.recipeId ?? null,
          cookUserId: input.cookUserId ?? null,
          notes: input.notes ?? null,
        })
        .returning();
      if (!plan) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      }

      // Cook automatically eats — upsert attendance "yes" for the cook
      if (plan.cookUserId) {
        const existingAtt = await ctx.db
          .select()
          .from(Attendance)
          .where(
            and(
              eq(Attendance.mealPlanId, plan.id),
              eq(Attendance.userId, plan.cookUserId)
            )
          )
          .limit(1)
          .then((r) => r[0] ?? null);
        if (existingAtt) {
          await ctx.db
            .update(Attendance)
            .set({ status: "yes" })
            .where(eq(Attendance.id, existingAtt.id));
        } else {
          await ctx.db.insert(Attendance).values({
            mealPlanId: plan.id,
            userId: plan.cookUserId,
            status: "yes",
            guestCount: 0,
          });
        }
      }

      const dateStr = String(plan.date).slice(0, 10);
      return {
        ...plan,
        date: dateStr,
      };
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        date: dateSchema.optional(),
        mealType: mealTypeSchema.optional(),
        recipeId: z.string().uuid().nullable().optional(),
        cookUserId: z.string().nullable().optional(),
        notes: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;
      const [existing] = await ctx.db
        .select({ householdId: MealPlan.householdId })
        .from(MealPlan)
        .where(eq(MealPlan.id, id))
        .limit(1);
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      await assertHouseholdMember(
        ctx.db,
        existing.householdId,
        ctx.session.user.id
      );
      const [plan] = await ctx.db
        .update(MealPlan)
        .set({
          ...(updates.date !== undefined && { date: updates.date }),
          ...(updates.mealType !== undefined && { mealType: updates.mealType }),
          ...(updates.recipeId !== undefined && { recipeId: updates.recipeId }),
          ...(updates.cookUserId !== undefined && {
            cookUserId: updates.cookUserId,
          }),
          ...(updates.notes !== undefined && { notes: updates.notes }),
        })
        .where(eq(MealPlan.id, id))
        .returning();
      if (!plan) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      }

      // Cook automatically eats — upsert attendance "yes" for the (new) cook
      if (updates.cookUserId) {
        const existingAtt = await ctx.db
          .select()
          .from(Attendance)
          .where(
            and(
              eq(Attendance.mealPlanId, plan.id),
              eq(Attendance.userId, updates.cookUserId)
            )
          )
          .limit(1)
          .then((r) => r[0] ?? null);
        if (existingAtt) {
          await ctx.db
            .update(Attendance)
            .set({ status: "yes" })
            .where(eq(Attendance.id, existingAtt.id));
        } else {
          await ctx.db.insert(Attendance).values({
            mealPlanId: plan.id,
            userId: updates.cookUserId,
            status: "yes",
            guestCount: 0,
          });
        }
      }

      const dateStr = String(plan.date).slice(0, 10);
      return {
        ...plan,
        date: dateStr,
      };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db
        .select({ householdId: MealPlan.householdId })
        .from(MealPlan)
        .where(eq(MealPlan.id, input.id))
        .limit(1);
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      await assertHouseholdMember(
        ctx.db,
        existing.householdId,
        ctx.session.user.id
      );
      await ctx.db.delete(MealPlan).where(eq(MealPlan.id, input.id));
      return { ok: true };
    }),

  previewRecipeConflicts: protectedProcedure
    .input(
      z.object({
        householdId: z.string().uuid(),
        recipeId: z.string().uuid(),
        mealPlanId: z.string().uuid().optional(),
        includeMaybe: z.boolean().optional().default(true),
      })
    )
    .query(async ({ ctx, input }) => {
      await assertHouseholdMember(
        ctx.db,
        input.householdId,
        ctx.session.user.id
      );

      const [recipeRow] = await ctx.db
        .select({
          id: Recipe.id,
          title: Recipe.title,
          tags: Recipe.tags,
        })
        .from(Recipe)
        .where(eq(Recipe.id, input.recipeId))
        .limit(1);
      if (!recipeRow) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Recipe not found" });
      }
      const recipeHouseholdId = await ctx.db
        .select({ householdId: Recipe.householdId })
        .from(Recipe)
        .where(eq(Recipe.id, input.recipeId))
        .limit(1)
        .then((r) => r[0]?.householdId);
      if (recipeHouseholdId !== input.householdId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const ingredients = await ctx.db
        .select({
          id: Ingredient.id,
          name: Ingredient.name,
          normalizedName: Ingredient.normalizedName,
          category: Ingredient.category,
        })
        .from(Ingredient)
        .where(eq(Ingredient.recipeId, input.recipeId))
        .orderBy(Ingredient.sortOrder, Ingredient.id);

      const analyzedIngredients = ingredients.map((i) => ({
        id: i.id,
        name: i.name,
        normalizedName: i.normalizedName,
        category: i.category,
      }));

      const members = await ctx.db
        .select({
          userId: HouseholdMember.userId,
          name: userTable.name,
        })
        .from(HouseholdMember)
        .innerJoin(userTable, eq(HouseholdMember.userId, userTable.id))
        .where(eq(HouseholdMember.householdId, input.householdId))
        .orderBy(HouseholdMember.joinedAt);

      const prefs = await ctx.db
        .select({
          userId: UserPreferences.userId,
          allergies: UserPreferences.allergies,
          dietaryRestrictions: UserPreferences.dietaryRestrictions,
        })
        .from(UserPreferences)
        .where(eq(UserPreferences.householdId, input.householdId));

      const prefsByUser = new Map(
        prefs.map((p) => [
          p.userId,
          {
            allergies: p.allergies ?? [],
            dietaryRestrictions: p.dietaryRestrictions ?? [],
          },
        ])
      );

      let participantUserIds: Set<string> = new Set(members.map((m) => m.userId));
      const attendanceByUser = new Map<string, "yes" | "no" | "maybe">();
      if (input.mealPlanId) {
        const attendances = await ctx.db
          .select({
            userId: Attendance.userId,
            status: Attendance.status,
          })
          .from(Attendance)
          .where(eq(Attendance.mealPlanId, input.mealPlanId));
        for (const a of attendances) {
          attendanceByUser.set(a.userId, a.status as "yes" | "no" | "maybe");
        }
        participantUserIds = new Set(
          attendances
            .filter(
              (a) =>
                a.status === "yes" ||
                (input.includeMaybe && a.status === "maybe")
            )
            .map((a) => a.userId)
        );
        if (participantUserIds.size === 0) {
          participantUserIds = new Set(members.map((m) => m.userId));
        }
      }

      const textToMatch = [
        ...analyzedIngredients.flatMap((i) => [
          i.name.toLowerCase(),
          (i.normalizedName ?? "").toLowerCase(),
        ]),
        ...(recipeRow.tags ?? []).map((t) => t.toLowerCase()),
      ].filter(Boolean);

      type ConflictItem = {
        userId: string;
        severity: "high" | "medium";
        kind: "allergy" | "dietary";
        matchedPreference: string;
        matchedOn: "ingredient" | "tag";
        evidence: string[];
      };

      const conflicts: ConflictItem[] = [];

      for (const member of members) {
        if (!participantUserIds.has(member.userId)) continue;
        const prefsForUser = prefsByUser.get(member.userId);
        const allergies = prefsForUser?.allergies ?? [];
        const dietaryRestrictions = prefsForUser?.dietaryRestrictions ?? [];

        const attendanceStatus = attendanceByUser.get(member.userId) ?? "unknown";

        for (const allergy of allergies) {
          const a = allergy.toLowerCase().trim();
          if (!a) continue;
          const evidence: string[] = [];
          analyzedIngredients.forEach((i) => {
            const n = (i.normalizedName ?? i.name).toLowerCase();
            if (n.includes(a)) evidence.push(i.name);
          });
          (recipeRow.tags ?? []).forEach((t) => {
            if (t.toLowerCase().includes(a)) evidence.push(t);
          });
          if (evidence.length > 0) {
            conflicts.push({
              userId: member.userId,
              severity: "high",
              kind: "allergy",
              matchedPreference: allergy,
              matchedOn: evidence.some((e) =>
                analyzedIngredients.some((i) => i.name === e)
              )
                ? "ingredient"
                : "tag",
              evidence: [...new Set(evidence)].slice(0, 5),
            });
          }
        }

        for (const dietary of dietaryRestrictions) {
          const d = dietary.toLowerCase().trim();
          if (!d) continue;
          const hasMatch =
            textToMatch.some((t) => t.includes(d)) ||
            analyzedIngredients.some((i) =>
              (i.normalizedName ?? i.name).toLowerCase().includes(d)
            ) ||
            (recipeRow.tags ?? []).some((t) => t.toLowerCase().includes(d));
          if (hasMatch) {
            const evidence: string[] = [];
            analyzedIngredients.forEach((i) => {
              const n = (i.normalizedName ?? i.name).toLowerCase();
              if (n.includes(d)) evidence.push(i.name);
            });
            (recipeRow.tags ?? []).forEach((t) => {
              if (t.toLowerCase().includes(d)) evidence.push(t);
            });
            conflicts.push({
              userId: member.userId,
              severity: "medium",
              kind: "dietary",
              matchedPreference: dietary,
              matchedOn: analyzedIngredients.some((i) =>
                (i.normalizedName ?? i.name).toLowerCase().includes(d)
              )
                ? "ingredient"
                : "tag",
              evidence: [...new Set(evidence)].slice(0, 5),
            });
          }
        }
      }

      const participants = members.map((m) => {
        const prefsForUser = prefsByUser.get(m.userId);
        return {
          userId: m.userId,
          name: m.name ?? null,
          attendanceStatus: (attendanceByUser.get(m.userId) ?? "unknown") as
            | "yes"
            | "maybe"
            | "no"
            | "unknown",
          dietaryRestrictions: prefsForUser?.dietaryRestrictions ?? [],
          allergies: prefsForUser?.allergies ?? [],
        };
      });

      const highCount = conflicts.filter((c) => c.severity === "high").length;
      const mediumCount = conflicts.filter((c) => c.severity === "medium").length;
      const affectedUsers = new Set(conflicts.map((c) => c.userId)).size;

      return {
        recipe: {
          id: recipeRow.id,
          title: recipeRow.title,
          tags: recipeRow.tags ?? [],
        },
        analyzedIngredients,
        participants,
        conflicts,
        summary: {
          hasConflicts: conflicts.length > 0,
          highSeverityCount: highCount,
          mediumSeverityCount: mediumCount,
          affectedUsers,
        },
      };
    }),
} satisfies TRPCRouterRecord;
