import { APIError, createAuthEndpoint } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { isTestLoginEnabled } from "@/lib/env";
import { TEST_USERS, findTestUser } from "@/lib/test-users";

type AdapterUser = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image?: string | null;
  discordId?: string;
  createdAt: Date;
  updatedAt: Date;
};

export function testLoginPlugin() {
  return {
    id: "test-login",
    endpoints: {
      testLogin: createAuthEndpoint(
        "/test-login",
        { method: "POST" },
        async (ctx) => {
          if (!isTestLoginEnabled()) {
            throw new APIError("NOT_FOUND", { message: "Not Found" });
          }

          const body =
            ctx.body && typeof ctx.body === "object"
              ? (ctx.body as { discordId?: unknown; user?: unknown })
              : {};
          const discordId =
            typeof body.discordId === "string"
              ? body.discordId
              : typeof body.user === "string"
                ? body.user
                : "";

          const seed = findTestUser(discordId);
          if (!seed) {
            throw new APIError("BAD_REQUEST", {
              message: "Unbekannter Testbenutzer.",
              allowed: TEST_USERS.map((user) => user.discordId),
            });
          }

          const existing = await ctx.context.adapter.findOne<AdapterUser>({
            model: "user",
            where: [{ field: "discordId", value: seed.discordId }],
          });

          const user =
            existing ??
            ((await ctx.context.internalAdapter.createUser(
              {
                name: seed.name,
                email: seed.email,
                emailVerified: true,
                discordId: seed.discordId,
              },
              { method: "admin" },
            )) as AdapterUser);

          const session = await ctx.context.internalAdapter.createSession(
            user.id,
          );
          if (!session) {
            throw new APIError("INTERNAL_SERVER_ERROR", {
              message: "Sitzung konnte nicht erzeugt werden.",
            });
          }

          await setSessionCookie(ctx, { session, user });

          return ctx.json({
            user: {
              id: user.id,
              name: user.name,
              email: user.email,
              discordId: seed.discordId,
              image: user.image ?? null,
            },
          });
        },
      ),
    },
  };
}
