/**
 * Helpers for product API tests (`*.api.test.ts`). They run against a dev
 * server with ENABLE_TEST_LOGIN=true: `npm run dev`, then `npm run test:rechte`.
 */

import postgres from "postgres";

export const BASE = (process.env.RECHTE_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");

export type TestSession = {
  cookie: string;
  user: { id: string; name: string; discordId: string };
};

export type ApiResponse<T = Record<string, unknown>> = { status: number; data: T };

export async function login(discordId: string): Promise<TestSession> {
  const res = await fetch(`${BASE}/api/test-login`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: BASE },
    body: JSON.stringify({ discordId }),
  });
  const data = (await res.json().catch(() => ({}))) as { user?: TestSession["user"] };
  if (!res.ok || !data.user?.id) {
    throw new Error(
      `Test-Login ${discordId} fehlgeschlagen (${res.status}). Läuft der Dev-Server mit ENABLE_TEST_LOGIN=true?`,
    );
  }
  const cookie = res.headers
    .getSetCookie()
    .map((entry) => entry.split(";")[0])
    .join("; ");
  return { cookie, user: data.user };
}

export async function api<T = Record<string, unknown>>(
  session: TestSession | null,
  method: string,
  path: string,
  body?: unknown,
): Promise<ApiResponse<T>> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      origin: BASE,
      ...(session ? { cookie: session.cookie } : {}),
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    redirect: "manual",
  });
  const data = (await res.json().catch(() => ({}))) as T;
  return { status: res.status, data };
}

/** Direct DB access for seeding and cleanup only; assertions go through the API. */
export function testSql() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL fehlt (npm run test:rechte lädt .env).");
  return postgres(process.env.DATABASE_URL, { max: 1 });
}
