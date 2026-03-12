import type { TRPCRouterRecord } from "@trpc/server";
import { and, eq } from "@prikkr/db";
import { PushToken } from "@prikkr/db/schema";
import { z } from "zod/v4";

import { protectedProcedure } from "../trpc";

export const notificationsRouter = {
  registerPushToken: protectedProcedure
    .input(
      z.object({
        expoPushToken: z.string().min(1),
        deviceId: z.string().max(100).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const existing = await ctx.db
        .select()
        .from(PushToken)
        .where(
          and(
            eq(PushToken.userId, userId),
            eq(PushToken.expoPushToken, input.expoPushToken)
          )
        )
        .limit(1)
        .then((r) => r[0] ?? null);

      if (existing) {
        return { ok: true };
      }

      await ctx.db.insert(PushToken).values({
        userId,
        expoPushToken: input.expoPushToken,
        deviceId: input.deviceId ?? null,
      });

      return { ok: true };
    }),
} satisfies TRPCRouterRecord;
