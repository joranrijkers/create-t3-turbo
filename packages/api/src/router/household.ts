import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, sql } from "@prikkr/db";
import {
  CreateHouseholdSchema,
  Household,
  HouseholdMember,
  user as userTable,
} from "@prikkr/db/schema";
import { z } from "zod/v4";

import { protectedProcedure, publicProcedure } from "../trpc";

function normalizeInviteCode(code: string): string {
  return code.replace(/-/g, "").toUpperCase().slice(0, 8);
}

export const householdRouter = {
  all: publicProcedure.query(({ ctx }) => {
    return ctx.db
      .select()
      .from(Household)
      .orderBy(desc(Household.createdAt))
      .limit(10);
  }),

  byId: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const member = await ctx.db
        .select()
        .from(HouseholdMember)
        .where(
          and(
            eq(HouseholdMember.householdId, input.id),
            eq(HouseholdMember.userId, ctx.session.user.id),
          ),
        )
        .limit(1)
        .then((r) => r[0] ?? null);
      if (!member) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      return ctx.db
        .select()
        .from(Household)
        .where(eq(Household.id, input.id))
        .limit(1)
        .then((r) => r[0] ?? null);
    }),

  create: protectedProcedure
    .input(CreateHouseholdSchema)
    .mutation(async ({ ctx, input }) => {
      const inviteCode = Math.random()
        .toString(36)
        .substring(2, 10)
        .toUpperCase();
      const [household] = await ctx.db
        .insert(Household)
        .values({ ...input, inviteCode })
        .returning();
      if (!household) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      }
      await ctx.db.insert(HouseholdMember).values({
        householdId: household.id,
        userId: ctx.session.user.id,
        role: "admin",
      });
      return household;
    }),

  joinByCode: protectedProcedure
    .input(z.object({ code: z.string().min(1).max(12) }))
    .mutation(async ({ ctx, input }) => {
      const code = normalizeInviteCode(input.code);
      if (code.length !== 8) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invite code must be 8 characters",
        });
      }
      const [household] = await ctx.db
        .select()
        .from(Household)
        .where(eq(Household.inviteCode, code))
        .limit(1);
      if (!household) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invalid invite code" });
      }
      const existing = await ctx.db
        .select()
        .from(HouseholdMember)
        .where(
          and(
            eq(HouseholdMember.householdId, household.id),
            eq(HouseholdMember.userId, ctx.session.user.id),
          ),
        )
        .limit(1)
        .then((r) => r[0] ?? null);
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Already a member of this household",
        });
      }
      await ctx.db.insert(HouseholdMember).values({
        householdId: household.id,
        userId: ctx.session.user.id,
        role: "member",
      });
      return household;
    }),

  myHouseholds: protectedProcedure.query(({ ctx }) => {
    return ctx.db
      .select({
        id: Household.id,
        name: Household.name,
        inviteCode: Household.inviteCode,
        createdAt: Household.createdAt,
        updatedAt: Household.updatedAt,
        role: HouseholdMember.role,
        memberCount: sql<number>`(
          SELECT COUNT(*)::int FROM household_member m
          WHERE m.household_id = ${Household.id}
        )`.as("member_count"),
      })
      .from(HouseholdMember)
      .innerJoin(Household, eq(HouseholdMember.householdId, Household.id))
      .where(eq(HouseholdMember.userId, ctx.session.user.id))
      .orderBy(desc(HouseholdMember.joinedAt));
  }),

  members: protectedProcedure
    .input(z.object({ householdId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const myMembership = await ctx.db
        .select()
        .from(HouseholdMember)
        .where(
          and(
            eq(HouseholdMember.householdId, input.householdId),
            eq(HouseholdMember.userId, ctx.session.user.id),
          ),
        )
        .limit(1)
        .then((r) => r[0] ?? null);
      if (!myMembership) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const rows = await ctx.db
        .select({
          id: HouseholdMember.id,
          userId: HouseholdMember.userId,
          role: HouseholdMember.role,
          joinedAt: HouseholdMember.joinedAt,
          name: userTable.name,
          image: userTable.image,
          email: userTable.email,
        })
        .from(HouseholdMember)
        .innerJoin(userTable, eq(HouseholdMember.userId, userTable.id))
        .where(eq(HouseholdMember.householdId, input.householdId))
        .orderBy(HouseholdMember.joinedAt);
      return rows;
    }),

  update: protectedProcedure
    .input(
      z.object({
        householdId: z.string().uuid(),
        name: z.string().min(1).max(100),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const member = await ctx.db
        .select({ role: HouseholdMember.role })
        .from(HouseholdMember)
        .where(
          and(
            eq(HouseholdMember.householdId, input.householdId),
            eq(HouseholdMember.userId, ctx.session.user.id),
          ),
        )
        .limit(1)
        .then((r) => r[0] ?? null);
      if (!member || member.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only admin can update household" });
      }
      const [updated] = await ctx.db
        .update(Household)
        .set({ name: input.name, updatedAt: new Date() })
        .where(eq(Household.id, input.householdId))
        .returning();
      if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
      return updated;
    }),

  updateMemberRole: protectedProcedure
    .input(
      z.object({
        householdId: z.string().uuid(),
        userId: z.string(),
        role: z.enum(["admin", "member"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const myMember = await ctx.db
        .select()
        .from(HouseholdMember)
        .where(
          and(
            eq(HouseholdMember.householdId, input.householdId),
            eq(HouseholdMember.userId, ctx.session.user.id),
          ),
        )
        .limit(1)
        .then((r) => r[0] ?? null);
      if (!myMember || myMember.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only admin can change roles" });
      }
      if (input.userId === ctx.session.user.id && input.role === "member") {
        const adminCount = await ctx.db
          .select()
          .from(HouseholdMember)
          .where(
            and(
              eq(HouseholdMember.householdId, input.householdId),
              eq(HouseholdMember.role, "admin"),
            ),
          )
          .then((rows) => rows.length);
        if (adminCount <= 1) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Cannot demote the last admin",
          });
        }
      }
      const [updated] = await ctx.db
        .update(HouseholdMember)
        .set({ role: input.role })
        .where(
          and(
            eq(HouseholdMember.householdId, input.householdId),
            eq(HouseholdMember.userId, input.userId),
          ),
        )
        .returning();
      if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
      return updated;
    }),

  removeMember: protectedProcedure
    .input(
      z.object({
        householdId: z.string().uuid(),
        userId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.userId === ctx.session.user.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Use leaveHousehold to leave",
        });
      }
      const myMember = await ctx.db
        .select()
        .from(HouseholdMember)
        .where(
          and(
            eq(HouseholdMember.householdId, input.householdId),
            eq(HouseholdMember.userId, ctx.session.user.id),
          ),
        )
        .limit(1)
        .then((r) => r[0] ?? null);
      if (!myMember || myMember.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only admin can remove members" });
      }
      const deleted = await ctx.db
        .delete(HouseholdMember)
        .where(
          and(
            eq(HouseholdMember.householdId, input.householdId),
            eq(HouseholdMember.userId, input.userId),
          ),
        )
        .returning({ id: HouseholdMember.id });
      if (deleted.length === 0) throw new TRPCError({ code: "NOT_FOUND" });
      return { ok: true };
    }),

  regenerateInviteCode: protectedProcedure
    .input(z.object({ householdId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const member = await ctx.db
        .select()
        .from(HouseholdMember)
        .where(
          and(
            eq(HouseholdMember.householdId, input.householdId),
            eq(HouseholdMember.userId, ctx.session.user.id),
          ),
        )
        .limit(1)
        .then((r) => r[0] ?? null);
      if (!member || member.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only admin can regenerate invite code" });
      }
      let inviteCode: string;
      for (let i = 0; i < 10; i++) {
        inviteCode = Math.random().toString(36).substring(2, 10).toUpperCase();
        const existing = await ctx.db
          .select({ id: Household.id })
          .from(Household)
          .where(eq(Household.inviteCode, inviteCode))
          .limit(1)
          .then((r) => r[0] ?? null);
        if (!existing) break;
        if (i === 9) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Could not generate unique code" });
      }
      const [updated] = await ctx.db
        .update(Household)
        .set({ inviteCode: inviteCode!, updatedAt: new Date() })
        .where(eq(Household.id, input.householdId))
        .returning();
      if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
      return updated;
    }),

  leaveHousehold: protectedProcedure
    .input(
      z.object({
        householdId: z.string().uuid(),
        nextAdminUserId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const myMember = await ctx.db
        .select({ id: HouseholdMember.id, role: HouseholdMember.role })
        .from(HouseholdMember)
        .where(
          and(
            eq(HouseholdMember.householdId, input.householdId),
            eq(HouseholdMember.userId, ctx.session.user.id),
          ),
        )
        .limit(1)
        .then((r) => r[0] ?? null);

      if (!myMember) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Not a member of this household" });
      }

      const members = await ctx.db
        .select({ userId: HouseholdMember.userId, role: HouseholdMember.role })
        .from(HouseholdMember)
        .where(eq(HouseholdMember.householdId, input.householdId));
      const memberCount = members.length;
      const adminCount = members.filter((m) => m.role === "admin").length;

      return await ctx.db.transaction(async (tx) => {
        if (memberCount === 1) {
          await tx.delete(Household).where(eq(Household.id, input.householdId));
          return { ok: true, householdDeleted: true };
        }

        if (myMember.role === "admin" && adminCount <= 1) {
          if (!input.nextAdminUserId || input.nextAdminUserId === ctx.session.user.id) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Transfer admin role to another member before leaving",
            });
          }
          const nextAdminMember = members.find((m) => m.userId === input.nextAdminUserId);
          if (!nextAdminMember) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Selected user is not a member of this household",
            });
          }
          await tx
            .update(HouseholdMember)
            .set({ role: "admin" })
            .where(
              and(
                eq(HouseholdMember.householdId, input.householdId),
                eq(HouseholdMember.userId, input.nextAdminUserId),
              ),
            );
        }

        const deleted = await tx
          .delete(HouseholdMember)
          .where(
            and(
              eq(HouseholdMember.householdId, input.householdId),
              eq(HouseholdMember.userId, ctx.session.user.id),
            ),
          )
          .returning({ id: HouseholdMember.id });
        if (deleted.length === 0) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }
        return { ok: true, householdDeleted: false };
      });
    }),

  delete: protectedProcedure
    .input(z.object({ householdId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const member = await ctx.db
        .select({ role: HouseholdMember.role })
        .from(HouseholdMember)
        .where(
          and(
            eq(HouseholdMember.householdId, input.householdId),
            eq(HouseholdMember.userId, ctx.session.user.id),
          ),
        )
        .limit(1)
        .then((r) => r[0] ?? null);
      if (!member || member.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only admin can delete household" });
      }
      await ctx.db.delete(Household).where(eq(Household.id, input.householdId));
      return { ok: true };
    }),
} satisfies TRPCRouterRecord;
