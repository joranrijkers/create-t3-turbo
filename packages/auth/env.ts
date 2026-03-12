import { createEnv } from "@t3-oss/env-core";
import { z } from "zod/v4";

export function authEnv() {
  return createEnv({
    server: {
      AUTH_DISCORD_ID: z.string().optional().default(""),
      AUTH_DISCORD_SECRET: z.string().optional().default(""),
      AUTH_GOOGLE_ID: z.string().optional().default(""),
      AUTH_GOOGLE_SECRET: z.string().optional().default(""),
      AUTH_APPLE_CLIENT_ID: z.string().optional().default(""),
      AUTH_APPLE_CLIENT_SECRET: z.string().optional().default(""),
      AUTH_APPLE_BUNDLE_ID: z.string().optional().default(""),
      AUTH_SECRET:
        process.env.NODE_ENV === "production"
          ? z.string().min(1)
          : z.string().min(1).optional(),
      NODE_ENV: z.enum(["development", "production"]).optional(),
    },
    runtimeEnv: process.env,
    skipValidation:
      !!process.env.CI || process.env.npm_lifecycle_event === "lint",
  });
}
