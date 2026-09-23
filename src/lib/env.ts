/** Runtime environment helpers. No secrets are logged or returned. */

export function isTestLoginEnabled(): boolean {
  return process.env.ENABLE_TEST_LOGIN === "true";
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
