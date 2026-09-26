/** Runtime environment helpers. No secrets are logged or returned. */

import { z } from "zod";

export function isTestLoginEnabled(): boolean {
  return process.env.ENABLE_TEST_LOGIN === "true";
}

/** MCP stays completely unavailable unless explicitly enabled (D2). */
export function isMcpEnabled(): boolean {
  return process.env.MCP_ENABLED === "true";
}

export function isProductionAppEnv(): boolean {
  return process.env.APP_ENV === "production";
}

export function isDiscordConfigured(): boolean {
  return Boolean(
    process.env.DISCORD_CLIENT_ID?.trim() &&
      process.env.DISCORD_CLIENT_SECRET?.trim(),
  );
}

export function getAuthUrl(): string {
  return (process.env.BETTER_AUTH_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );
}

const LOCAL_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000"];

/** Production trusts only BETTER_AUTH_URL; localhost only outside production (CR-017). */
export function getTrustedOrigins(): string[] {
  const origins = [getAuthUrl(), ...(isProductionAppEnv() ? [] : LOCAL_ORIGINS)];
  return origins.filter((value, index, all) => all.indexOf(value) === index);
}

export const BETTER_AUTH_SECRET_MIN_LENGTH = 32;

const httpUrl = z
  .string()
  .trim()
  .refine((value) => {
    try {
      const url = new URL(value);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  });

const postgresUrl = z
  .string()
  .trim()
  .regex(/^postgres(ql)?:\/\/\S+$/);

type EnvIssue = { name: string; message: string };

/**
 * Checks the process environment at start (CR-017). Returns German messages
 * naming the variable, never its value.
 */
export function findEnvIssues(env: NodeJS.ProcessEnv = process.env): EnvIssue[] {
  const production = env.APP_ENV === "production";
  const issues: EnvIssue[] = [];
  const present = (name: string) => Boolean(env[name]?.trim());

  if (!present("DATABASE_URL")) {
    issues.push({ name: "DATABASE_URL", message: "fehlt" });
  } else if (!postgresUrl.safeParse(env.DATABASE_URL).success) {
    issues.push({ name: "DATABASE_URL", message: "ist keine postgres://-Adresse" });
  }

  if (!present("BETTER_AUTH_SECRET")) {
    if (production) issues.push({ name: "BETTER_AUTH_SECRET", message: "fehlt" });
  } else if ((env.BETTER_AUTH_SECRET ?? "").trim().length < BETTER_AUTH_SECRET_MIN_LENGTH) {
    issues.push({
      name: "BETTER_AUTH_SECRET",
      message: `ist kürzer als ${BETTER_AUTH_SECRET_MIN_LENGTH} Zeichen`,
    });
  }

  if (!present("BETTER_AUTH_URL")) {
    if (production) issues.push({ name: "BETTER_AUTH_URL", message: "fehlt" });
  } else if (!httpUrl.safeParse(env.BETTER_AUTH_URL).success) {
    issues.push({ name: "BETTER_AUTH_URL", message: "ist keine gültige http(s)-Adresse" });
  }

  return issues;
}

export const ENV_INVALID_MESSAGE_PREFIX = "Die Umgebung ist unvollständig, die Anwendung startet nicht:";

export function assertServerEnv(env: NodeJS.ProcessEnv = process.env): void {
  const issues = findEnvIssues(env);
  if (issues.length === 0) return;
  const lines = issues.map((issue) => `- ${issue.name} ${issue.message}`);
  throw new Error([ENV_INVALID_MESSAGE_PREFIX, ...lines].join("\n"));
}

export const TEST_LOGIN_IN_PRODUCTION_MESSAGE =
  "ENABLE_TEST_LOGIN=true ist in der Produktivumgebung (APP_ENV=production) nicht erlaubt. Die Anwendung startet nicht.";

export const ALLOWED_DISCORD_IDS_REQUIRED_MESSAGE =
  "ALLOWED_DISCORD_IDS fehlt oder ist leer. In der Produktivumgebung startet die Anwendung nur mit einer Discord-Allowlist.";

export const DISCORD_NOT_ALLOWED_MESSAGE =
  "Dieses Discord-Konto ist für WorldCraft nicht freigegeben.";

/** Comma-separated Discord user ids. Empty entries are dropped. */
export function parseAllowedDiscordIds(raw: string | undefined): Set<string> {
  if (!raw?.trim()) return new Set();
  return new Set(
    raw
      .split(",")
      .map((id) => id.trim())
      .filter((id) => id.length > 0),
  );
}

/**
 * Production refuses to boot without at least one allowed Discord id.
 * Local development may leave the variable unset.
 */
export function assertDiscordAllowlistConfigured(): void {
  if (!isProductionAppEnv()) return;
  if (parseAllowedDiscordIds(process.env.ALLOWED_DISCORD_IDS).size === 0) {
    throw new Error(ALLOWED_DISCORD_IDS_REQUIRED_MESSAGE);
  }
}

/**
 * Discord logins must be on the allowlist. Test-login ids (`test-*`) are exempt.
 * An empty list outside production allows every Discord account so local login
 * works before the variable is set. In production the process never reaches
 * this with an empty list (`assertDiscordAllowlistConfigured`).
 */
export function isDiscordIdAllowed(discordId: string | undefined): boolean {
  if (!discordId) return false;
  if (discordId.startsWith("test-")) return true;
  const allowed = parseAllowedDiscordIds(process.env.ALLOWED_DISCORD_IDS);
  if (allowed.size === 0 && !isProductionAppEnv()) return true;
  return allowed.has(discordId);
}

/**
 * Production must never run with the test-login backdoor.
 * Call at process start (instrumentation, auth module, Docker entrypoint).
 */
export function assertTestLoginNotInProduction(): void {
  if (isTestLoginEnabled() && isProductionAppEnv()) {
    throw new Error(TEST_LOGIN_IN_PRODUCTION_MESSAGE);
  }
}
