import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { eq } from "@prikkr/db";
import { user as userTable } from "@prikkr/db/schema";
import { z } from "zod/v4";

import { protectedProcedure, publicProcedure } from "../trpc";

const PROFILE_IMAGES_BUCKET = "profile-images";

export const authRouter = {
  getSession: publicProcedure.query(({ ctx }) => {
    return ctx.session;
  }),
  getSecretMessage: protectedProcedure.query(() => {
    return "you can see this secret message!";
  }),

  getProfileImageUploadUrl: protectedProcedure.mutation(async ({ ctx }) => {
    if (!ctx.supabase) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Storage is not configured",
      });
    }
    const path = `${ctx.session.user.id}/${crypto.randomUUID()}.jpg`;
    const {
      data: signedData,
      error: signError,
    } = await ctx.supabase.storage
      .from(PROFILE_IMAGES_BUCKET)
      .createSignedUploadUrl(path);

    if (signError || !signedData) {
      const msg = signError?.message ?? "Failed to create upload URL";
      const isMissingBucket =
        msg.includes("does not exist") ||
        msg.includes("not found") ||
        msg.toLowerCase().includes("resource");
      throw new TRPCError({
        code: isMissingBucket ? "PRECONDITION_FAILED" : "INTERNAL_SERVER_ERROR",
        message: isMissingBucket
          ? `Storage bucket "${PROFILE_IMAGES_BUCKET}" does not exist. Create it in Supabase Dashboard → Storage → New bucket (name: ${PROFILE_IMAGES_BUCKET}, public: yes for read).`
          : msg,
      });
    }

    const { data: publicUrlData } = ctx.supabase.storage
      .from(PROFILE_IMAGES_BUCKET)
      .getPublicUrl(signedData.path);

    return {
      uploadUrl: signedData.signedUrl,
      publicUrl: publicUrlData.publicUrl,
    };
  }),

  setProfileImage: protectedProcedure
    .input(z.object({ imageUrl: z.string().url() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(userTable)
        .set({ image: input.imageUrl })
        .where(eq(userTable.id, ctx.session.user.id));
      return { ok: true };
    }),

  updateProfile: protectedProcedure
    .input(z.object({ name: z.string().min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(userTable)
        .set({ name: input.name, updatedAt: new Date() })
        .where(eq(userTable.id, ctx.session.user.id));
      return { ok: true };
    }),
} satisfies TRPCRouterRecord;
