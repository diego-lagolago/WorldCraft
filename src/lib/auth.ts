import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { jwt } from "better-auth/plugins";
import { APIError } from "better-auth/api";
import { cimd } from "@better-auth/cimd";
import { fetchClientMetadataResource } from "@better-auth/cimd/node";
import { mcp } from "@better-auth/mcp";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import * as schema from "@/db/schema";
import {
  DISCORD_EMAIL_REQUIRED_MESSAGE,
  mapDiscordProfileToUser,
} from "@/lib/discord-profile";
import {
  DISCORD_NOT_ALLOWED_MESSAGE,
  assertDiscordAllowlistConfigured,
  assertTestLoginNotInProduction,
  getAuthUrl,
  getTrustedOrigins,
  isDiscordConfigured,
  isDiscordIdAllowed,
  isTestLoginEnabled,
} from "@/lib/env";
import { testLoginPlugin } from "@/lib/test-login-plugin";

assertTestLoginNotInProduction();
assertDiscordAllowlistConfigured();

const APP_URL = getAuthUrl();
const MCP_RESOURCE = `${APP_URL}/mcp`;

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
      jwks: schema.jwks,
      oauthClient: schema.oauthClients,
      oauthResource: schema.oauthResources,
      oauthClientResource: schema.oauthClientResources,
      oauthRefreshToken: schema.oauthRefreshTokens,
      oauthAccessToken: schema.oauthAccessTokens,
      oauthConsent: schema.oauthConsents,
      oauthClientAssertion: schema.oauthClientAssertions,
    },
  }),
  trustedOrigins: getTrustedOrigins(),
  emailAndPassword: {
    enabled: false,
  },
  user: {
    additionalFields: {
      discordId: {
        type: "string",
        required: true,
        input: false,
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
      const discordId =
        "discordId" in user && typeof user.discordId === "string"
          ? user.discordId
          : "";
      if (!isDiscordIdAllowed(discordId)) {
        return {
          error: "discord_not_allowed",
          errorDescription: DISCORD_NOT_ALLOWED_MESSAGE,
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
    user: {
      create: {
        before: async (user) => {
          const discordId =
            typeof user.discordId === "string" ? user.discordId : "";
          if (!isDiscordIdAllowed(discordId)) {
            throw new APIError("FORBIDDEN", {
              message: DISCORD_NOT_ALLOWED_MESSAGE,
            });
          }
        },
      },
    },
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
    jwt(),
    mcp({
      resource: MCP_RESOURCE,
      loginPage: "/",
      consentPage: "/oauth/consent",
      scopes: ["worlds:read", "offline_access"],
      grantTypes: ["authorization_code", "refresh_token"],
      accessTokenExpiresIn: 60 * 60,
      refreshTokenExpiresIn: 60 * 60 * 24 * 30,
      refreshTokenReuseInterval: 0,
      allowDynamicClientRegistration: true,
      allowUnauthenticatedClientRegistration: true,
      clientRegistrationRequirePKCE: true,
      clientRegistrationDefaultScopes: ["worlds:read", "offline_access"],
    }),
    cimd({
      fetchClientMetadataResource,
      metadataProfile: "mcp-2026-07-28",
    }),
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;
