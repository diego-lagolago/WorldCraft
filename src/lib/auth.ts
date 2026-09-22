import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { APIError } from "better-auth/api";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import * as schema from "@/db/schema";
import {
  DISCORD_EMAIL_REQUIRED_MESSAGE,
  mapDiscordProfileToUser,
} from "@/lib/discord-profile";
import {
  assertTestLoginNotInProduction,
  getAuthUrl,
  isDiscordConfigured,
  isTestLoginEnabled,
} from "@/lib/env";
import { testLoginPlugin } from "@/lib/test-login-plugin";

assertTestLoginNotInProduction();

const APP_URL = getAuthUrl();

export const auth = betterAuth({
  baseURL: APP_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications,
    },
  }),
  trustedOrigins: [
    APP_URL,
    "http://localhost:3000",
    "http://127.0.0.1:3000",
  ].filter((value, index, all) => all.indexOf(value) === index),
  emailAndPassword: {
    enabled: false,
  },
  user: {
    additionalFields: {
      discordId: {
        type: "string",
        required: true,
        input: true,
      },
      lastLoginAt: {
        type: "date",
        required: false,
        input: false,
      },
      dicePostToChat: {
        type: "boolean",
        required: false,
        defaultValue: true,
        input: false,
      },
    },
    validateUserInfo: ({ user, source }) => {
      if (source.oauth?.providerId !== "discord") return;
      if (!user.email?.trim()) {
        return {
          error: "email_required",
          errorDescription: DISCORD_EMAIL_REQUIRED_MESSAGE,
        };
      }
    },
  },
  socialProviders: {
    ...(isDiscordConfigured()
      ? {
          discord: {
            clientId: process.env.DISCORD_CLIENT_ID as string,
            clientSecret: process.env.DISCORD_CLIENT_SECRET as string,
            overrideUserInfoOnSignIn: true,
            mapProfileToUser: (profile) => {
              if (!profile.email?.trim()) {
                throw new APIError("BAD_REQUEST", {
                  message: DISCORD_EMAIL_REQUIRED_MESSAGE,
                });
              }
              return mapDiscordProfileToUser(profile);
            },
          },
        }
      : {}),
  },
  databaseHooks: {
    session: {
      create: {
        after: async (session) => {
          await db
            .update(schema.users)
            .set({ lastLoginAt: new Date(), updatedAt: new Date() })
            .where(eq(schema.users.id, session.userId));
        },
      },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
  plugins: [
    ...(isTestLoginEnabled() ? [testLoginPlugin()] : []),
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;
