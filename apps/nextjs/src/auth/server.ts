import "server-only";

import { cache } from "react";
import { headers } from "next/headers";
import { Resend } from "resend";
import { nextCookies } from "better-auth/next-js";

import { initAuth } from "@prikkr/auth";

import { env } from "~/env";

const baseUrl =
  env.VERCEL_ENV === "production"
    ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`
    : env.VERCEL_ENV === "preview"
      ? `https://${env.VERCEL_URL}`
      : (env.AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");

if (process.env.NODE_ENV === "development") {
  console.log("[Prikkr auth] baseUrl:", baseUrl, "(magic link & callbacks use this; set AUTH_URL to your LAN IP when testing on a real device)");
}

const resend = new Resend(env.RESEND_KEY);
const fromEmail = env.RESEND_FROM_EMAIL ?? "Prikkr <onboarding@resend.dev>";

export const auth = initAuth({
  baseUrl,
  productionUrl: `https://${env.VERCEL_PROJECT_PRODUCTION_URL ?? "turbo.t3.gg"}`,
  secret: env.AUTH_SECRET,
  discordClientId: env.AUTH_DISCORD_ID || undefined,
  discordClientSecret: env.AUTH_DISCORD_SECRET || undefined,
  googleClientId: env.AUTH_GOOGLE_ID || undefined,
  googleClientSecret: env.AUTH_GOOGLE_SECRET || undefined,
  appleClientId: env.AUTH_APPLE_CLIENT_ID || undefined,
  appleClientSecret: env.AUTH_APPLE_CLIENT_SECRET || undefined,
  appleAppBundleIdentifier: env.AUTH_APPLE_BUNDLE_ID || undefined,
  sendMagicLink: async ({ email, url }) => {
    await resend.emails.send({
      from: fromEmail,
      to: email,
      subject: "Inloggen bij Prikkr",
      html: `Klik op de link om in te loggen: <a href="${url}">Inloggen</a>`,
    });
  },
  extraPlugins: [nextCookies()],
});

export const getSession = cache(async () =>
  auth.api.getSession({ headers: await headers() }),
);
