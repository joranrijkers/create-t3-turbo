import type { BetterAuthOptions, BetterAuthPlugin } from "better-auth";
import { expo } from "@better-auth/expo";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink } from "better-auth/plugins";
import { oAuthProxy } from "better-auth/plugins";

import { db } from "@prikkr/db/client";

export function initAuth<
  TExtraPlugins extends BetterAuthPlugin[] = [],
>(options: {
  baseUrl: string;
  productionUrl: string;
  secret: string | undefined;
  discordClientId?: string;
  discordClientSecret?: string;
  googleClientId?: string;
  googleClientSecret?: string;
  appleClientId?: string;
  appleClientSecret?: string;
  appleAppBundleIdentifier?: string;
  sendMagicLink?: (params: {
    email: string;
    url: string;
    token: string;
  }) => Promise<void>;
  extraPlugins?: TExtraPlugins;
}) {
  const plugins: NonNullable<BetterAuthOptions["plugins"]> = [
    oAuthProxy({
      productionURL: options.productionUrl,
    }),
    expo(),
    ...(options.sendMagicLink
      ? [
          magicLink({
            sendMagicLink: async ({ email, url, token }) => {
              await options.sendMagicLink!({ email, url, token });
            },
          }),
        ]
      : []),
    ...(options.extraPlugins ?? []),
  ];

  const hasDiscord =
    options.discordClientId &&
    options.discordClientSecret &&
    options.discordClientId.length > 0 &&
    options.discordClientSecret.length > 0;

  const hasGoogle =
    options.googleClientId &&
    options.googleClientSecret &&
    options.googleClientId.length > 0 &&
    options.googleClientSecret.length > 0;

  const hasApple =
    options.appleClientId &&
    options.appleClientSecret &&
    options.appleClientId.length > 0 &&
    options.appleClientSecret.length > 0;

  const socialProviders: BetterAuthOptions["socialProviders"] = {
    ...(hasDiscord && {
      discord: {
        clientId: options.discordClientId!,
        clientSecret: options.discordClientSecret!,
        redirectURI: `${options.productionUrl}/api/auth/callback/discord`,
      },
    }),
    ...(hasGoogle && {
      google: {
        clientId: options.googleClientId!,
        clientSecret: options.googleClientSecret!,
      },
    }),
    ...(hasApple && {
      apple: {
        clientId: options.appleClientId!,
        clientSecret: options.appleClientSecret!,
        ...(options.appleAppBundleIdentifier && {
          appBundleIdentifier: options.appleAppBundleIdentifier,
        }),
      },
    }),
  };

  const config = {
    database: drizzleAdapter(db, {
      provider: "pg",
    }),
    baseURL: options.baseUrl,
    secret: options.secret,
    emailAndPassword: { enabled: true },
    plugins,
    ...(Object.keys(socialProviders).length > 0 && { socialProviders }),
    trustedOrigins: [
      "expo://",
      ...(hasApple ? ["https://appleid.apple.com"] : []),
    ],
    onAPIError: {
      onError(error, ctx) {
        const message = error instanceof Error ? error.message : String(error);
        const stack = error instanceof Error ? error.stack : undefined;
        console.error("[Better Auth] API error:", message);
        if (stack) console.error(stack);
        console.error("[Better Auth] context:", JSON.stringify(ctx, null, 2));
      },
    },
  } satisfies BetterAuthOptions;

  return betterAuth(config);
}

export type Auth = ReturnType<typeof initAuth>;
export type Session = Auth["$Infer"]["Session"];
