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

/**
 * Production must never run with the test-login backdoor.
 * Call at process start (instrumentation, auth module, Docker entrypoint).
 */
export function assertTestLoginNotInProduction(): void {
  if (isTestLoginEnabled() && isProductionAppEnv()) {
    throw new Error(TEST_LOGIN_IN_PRODUCTION_MESSAGE);
  }
}
