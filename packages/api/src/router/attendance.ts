import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { and, eq } from "@prikkr/db";
import {
  Attendance,
  HouseholdMember,
  MealPlan,
  user as userTable,
} from "@prikkr/db/schema";
import { z } from "zod/v4";

import { protectedProcedure } from "../trpc";

const attendanceStatusSchema = z.enum(["yes", "no", "maybe"]);

export const attendanceRouter = {
  respond: protectedProcedure
    .input(
      z.object({
        mealPlanId: z.string().uuid(),
        status: attendanceStatusSchema,
        guestCount: z.number().int().min(0).default(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [meal] = await ctx.db
        .select({ householdId: MealPlan.householdId })
        .from(MealPlan)
        .where(eq(MealPlan.id, input.mealPlanId))
        .limit(1);
      if (!meal) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      const member = await ctx.db
        .select()
        .from(HouseholdMember)
        .where(
          and(
            eq(HouseholdMember.householdId, meal.householdId),
            eq(HouseholdMember.userId, ctx.session.user.id)
          )
        )
        .limit(1)
        .then((r) => r[0] ?? null);
      if (!member) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const existing = await ctx.db
        .select()
        .from(Attendance)
        .where(
          and(
            eq(Attendance.mealPlanId, input.mealPlanId),
            eq(Attendance.userId, ctx.session.user.id)
          )
        )
        .limit(1)
        .then((r) => r[0] ?? null);

      if (existing) {
        const [updated] = await ctx.db
          .update(Attendance)
          .set({
            status: input.status,
            guestCount: input.guestCount,
          })
          .where(eq(Attendance.id, existing.id))
          .returning();
        return updated!;
      }

      const [created] = await ctx.db
        .insert(Attendance)
        .values({
          mealPlanId: input.mealPlanId,
          userId: ctx.session.user.id,
          status: input.status,
          guestCount: input.guestCount,
        })
        .returning();
      if (!created) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      }
      return created;
    }),

  forMealPlan: protectedProcedure
    .input(z.object({ mealPlanId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [meal] = await ctx.db
        .select({ householdId: MealPlan.householdId })
        .from(MealPlan)
        .where(eq(MealPlan.id, input.mealPlanId))
        .limit(1);
      if (!meal) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      const member = await ctx.db
        .select()
        .from(HouseholdMember)
        .where(
          and(
            eq(HouseholdMember.householdId, meal.householdId),
            eq(HouseholdMember.userId, ctx.session.user.id)
          )
        )
        .limit(1)
        .then((r) => r[0] ?? null);
      if (!member) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      return await ctx.db
        .select({
          id: Attendance.id,
          userId: Attendance.userId,
          status: Attendance.status,
          guestCount: Attendance.guestCount,
          respondedAt: Attendance.respondedAt,
          userName: userTable.name,
          userImage: userTable.image,
        })
        .from(Attendance)
        .innerJoin(userTable, eq(Attendance.userId, userTable.id))
        .where(eq(Attendance.mealPlanId, input.mealPlanId))
        .orderBy(Attendance.respondedAt);
    }),
} satisfies TRPCRouterRecord;
