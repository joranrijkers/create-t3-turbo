import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { and, eq } from "@prikkr/db";
import {
  HouseholdMember,
  UserPreferences,
  user as userTable,
} from "@prikkr/db/schema";
import { z } from "zod/v4";

import { protectedProcedure } from "../trpc";

async function assertHouseholdMember(
  db: Parameters<Parameters<typeof protectedProcedure.query>[0]>[0]["ctx"]["db"],
  householdId: string,
  userId: string,
) {
  const member = await db
    .select()
    .from(HouseholdMember)
    .where(
      and(
        eq(HouseholdMember.householdId, householdId),
        eq(HouseholdMember.userId, userId),
      ),
    )
    .limit(1)
    .then((r) => r[0] ?? null);
  if (!member) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
}

const upsertInputSchema = z.object({
  householdId: z.string().uuid(),
  dietaryRestrictions: z.array(z.string()).optional(),
  allergies: z.array(z.string()).optional(),
  notes: z.string().nullable().optional(),
  preferredLocale: z.string().max(5).optional(),
  notifPush: z.boolean().optional(),
  notifAttendance: z.boolean().optional(),
  notifShopping: z.boolean().optional(),
});

export const userPreferencesRouter = {
  get: protectedProcedure
    .input(z.object({ householdId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await assertHouseholdMember(
        ctx.db,
        input.householdId,
        ctx.session.user.id,
      );

      const row = await ctx.db
        .select()
        .from(UserPreferences)
        .where(
          and(
            eq(UserPreferences.userId, ctx.session.user.id),
            eq(UserPreferences.householdId, input.householdId),
          ),
        )
        .limit(1)
        .then((r) => r[0] ?? null);

      if (!row) {
        return {
          dietaryRestrictions: [] as string[],
          allergies: [] as string[],
          notes: null as string | null,
          preferredLocale: "nl" as string,
          notifPush: true,
          notifAttendance: true,
          notifShopping: false,
        };
      }

      return {
        dietaryRestrictions: row.dietaryRestrictions ?? [],
        allergies: row.allergies ?? [],
        notes: row.notes,
        preferredLocale: row.preferredLocale ?? "nl",
        notifPush: row.notifPush ?? true,
        notifAttendance: row.notifAttendance ?? true,
        notifShopping: row.notifShopping ?? false,
      };
    }),

  upsert: protectedProcedure
    .input(upsertInputSchema)
    .mutation(async ({ ctx, input }) => {
      await assertHouseholdMember(
        ctx.db,
        input.householdId,
        ctx.session.user.id,
      );

      const existing = await ctx.db
        .select()
        .from(UserPreferences)
        .where(
          and(
            eq(UserPreferences.userId, ctx.session.user.id),
            eq(UserPreferences.householdId, input.householdId),
          ),
        )
        .limit(1)
        .then((r) => r[0] ?? null);

      const dietaryRestrictions = input.dietaryRestrictions ?? existing?.dietaryRestrictions ?? [];
      const allergies = input.allergies ?? existing?.allergies ?? [];
      const notes = input.notes !== undefined ? input.notes : existing?.notes ?? null;
      const preferredLocale = input.preferredLocale !== undefined ? input.preferredLocale : existing?.preferredLocale ?? "nl";
      const notifPush = input.notifPush !== undefined ? input.notifPush : existing?.notifPush ?? true;
      const notifAttendance = input.notifAttendance !== undefined ? input.notifAttendance : existing?.notifAttendance ?? true;
      const notifShopping = input.notifShopping !== undefined ? input.notifShopping : existing?.notifShopping ?? false;

      if (existing) {
        const [updated] = await ctx.db
          .update(UserPreferences)
          .set({
            dietaryRestrictions,
            allergies,
            notes,
            preferredLocale,
            notifPush,
            notifAttendance,
            notifShopping,
            updatedAt: new Date(),
          })
          .where(eq(UserPreferences.id, existing.id))
          .returning();
        return updated!;
      }

      const [inserted] = await ctx.db
        .insert(UserPreferences)
        .values({
          userId: ctx.session.user.id,
          householdId: input.householdId,
          dietaryRestrictions,
          allergies,
          notes,
          preferredLocale: input.preferredLocale ?? "nl",
          notifPush,
          notifAttendance,
          notifShopping,
        })
        .returning();
      if (!inserted) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      }
      return inserted;
    }),

  getForHousehold: protectedProcedure
    .input(z.object({ householdId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await assertHouseholdMember(
        ctx.db,
        input.householdId,
        ctx.session.user.id,
      );

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
        prefs.map((p) => [p.userId, { allergies: p.allergies ?? [], dietaryRestrictions: p.dietaryRestrictions ?? [] }]),
      );

      return members.map((m) => ({
        userId: m.userId,
        name: m.name ?? null,
        allergies: prefsByUser.get(m.userId)?.allergies ?? [],
        dietaryRestrictions: prefsByUser.get(m.userId)?.dietaryRestrictions ?? [],
      }));
    }),
} satisfies TRPCRouterRecord;
