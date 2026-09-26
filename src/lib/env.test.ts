import { afterEach, describe, expect, it } from "vitest";
import {
  ALLOWED_DISCORD_IDS_REQUIRED_MESSAGE,
  ENV_INVALID_MESSAGE_PREFIX,
  TEST_LOGIN_IN_PRODUCTION_MESSAGE,
  assertDiscordAllowlistConfigured,
  assertServerEnv,
  assertTestLoginNotInProduction,
  findEnvIssues,
  getTrustedOrigins,
  isDiscordIdAllowed,
  isMcpEnabled,
  isProductionAppEnv,
  isTestLoginEnabled,
} from "./env";

const KEYS = ["ENABLE_TEST_LOGIN", "APP_ENV", "ALLOWED_DISCORD_IDS", "BETTER_AUTH_URL", "MCP_ENABLED"] as const;
const original = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));

afterEach(() => {
  for (const key of KEYS) {
    if (original[key] === undefined) delete process.env[key];
    else process.env[key] = original[key];
  }
});

const SECRET = "s".repeat(32);
const validProduction = {
  APP_ENV: "production",
  DATABASE_URL: "postgresql://user:pw@db:5432/worldcraft",
  BETTER_AUTH_SECRET: SECRET,
  BETTER_AUTH_URL: "https://worldcraft.example.com",
} as NodeJS.ProcessEnv;

describe("assertServerEnv (CR-017)", () => {
  it("accepts a complete production environment", () => {
    expect(findEnvIssues(validProduction)).toEqual([]);
    expect(() => assertServerEnv(validProduction)).not.toThrow();
  });

  it("refuses production without BETTER_AUTH_SECRET, with a German message naming the variable", () => {
    const env = { ...validProduction, BETTER_AUTH_SECRET: undefined };
    expect(() => assertServerEnv(env)).toThrow(ENV_INVALID_MESSAGE_PREFIX);
    expect(() => assertServerEnv(env)).toThrow("BETTER_AUTH_SECRET fehlt");
  });

  it("refuses production without BETTER_AUTH_URL and short secrets or bad URLs anywhere", () => {
    expect(findEnvIssues({ ...validProduction, BETTER_AUTH_URL: "" }).map((i) => i.name)).toEqual([
      "BETTER_AUTH_URL",
    ]);
    const dev = { APP_ENV: "development", DATABASE_URL: validProduction.DATABASE_URL } as NodeJS.ProcessEnv;
    expect(findEnvIssues({ ...dev, BETTER_AUTH_SECRET: "kurz" }).map((i) => i.name)).toEqual([
      "BETTER_AUTH_SECRET",
    ]);
    expect(findEnvIssues({ ...dev, BETTER_AUTH_URL: "worldcraft" }).map((i) => i.name)).toEqual([
      "BETTER_AUTH_URL",
    ]);
    expect(findEnvIssues({ ...dev, DATABASE_URL: "mysql://x" }).map((i) => i.name)).toEqual(["DATABASE_URL"]);
  });

  it("allows missing auth variables locally but never a missing DATABASE_URL", () => {
    expect(findEnvIssues({ APP_ENV: "development", DATABASE_URL: validProduction.DATABASE_URL } as NodeJS.ProcessEnv)).toEqual([]);
    expect(findEnvIssues({ APP_ENV: "development" } as NodeJS.ProcessEnv).map((i) => i.name)).toEqual([
      "DATABASE_URL",
    ]);
  });

  it("never puts secret values into the message", () => {
    const env = { ...validProduction, BETTER_AUTH_SECRET: "geheim-zu-kurz" };
    expect(() => assertServerEnv(env)).toThrow(/BETTER_AUTH_SECRET ist kürzer/);
    try {
      assertServerEnv(env);
    } catch (error) {
      expect(String(error)).not.toContain("geheim-zu-kurz");
    }
  });
});

describe("getTrustedOrigins (CR-017)", () => {
  it("trusts only BETTER_AUTH_URL in production", () => {
    process.env.APP_ENV = "production";
    process.env.BETTER_AUTH_URL = "https://worldcraft.example.com/";
    expect(getTrustedOrigins()).toEqual(["https://worldcraft.example.com"]);
  });

  it("adds localhost outside production", () => {
    process.env.APP_ENV = "development";
    process.env.BETTER_AUTH_URL = "http://localhost:3000";
    expect(getTrustedOrigins()).toEqual(["http://localhost:3000", "http://127.0.0.1:3000"]);
  });
});

describe("isTestLoginEnabled", () => {
  it("is true only for the string true", () => {
    process.env.ENABLE_TEST_LOGIN = "true";
    expect(isTestLoginEnabled()).toBe(true);
    process.env.ENABLE_TEST_LOGIN = "1";
    expect(isTestLoginEnabled()).toBe(false);
    delete process.env.ENABLE_TEST_LOGIN;
    expect(isTestLoginEnabled()).toBe(false);
  });
});

describe("isMcpEnabled", () => {
  it("is true only for the explicit string true", () => {
    process.env.MCP_ENABLED = "true";
    expect(isMcpEnabled()).toBe(true);
    process.env.MCP_ENABLED = "1";
    expect(isMcpEnabled()).toBe(false);
    delete process.env.MCP_ENABLED;
    expect(isMcpEnabled()).toBe(false);
  });
});

describe("assertTestLoginNotInProduction", () => {
  it("allows test-login outside production", () => {
    process.env.ENABLE_TEST_LOGIN = "true";
    process.env.APP_ENV = "development";
    expect(isProductionAppEnv()).toBe(false);
    expect(() => assertTestLoginNotInProduction()).not.toThrow();
  });

  it("refuses ENABLE_TEST_LOGIN in production", () => {
    process.env.ENABLE_TEST_LOGIN = "true";
    process.env.APP_ENV = "production";
    expect(() => assertTestLoginNotInProduction()).toThrow(TEST_LOGIN_IN_PRODUCTION_MESSAGE);
  });
});

describe("Discord allowlist", () => {
  it("refuses to start in production without ALLOWED_DISCORD_IDS", () => {
    process.env.APP_ENV = "production";
    delete process.env.ALLOWED_DISCORD_IDS;
    expect(() => assertDiscordAllowlistConfigured()).toThrow(
      ALLOWED_DISCORD_IDS_REQUIRED_MESSAGE,
    );
    process.env.ALLOWED_DISCORD_IDS = "  ,  ";
    expect(() => assertDiscordAllowlistConfigured()).toThrow(
      ALLOWED_DISCORD_IDS_REQUIRED_MESSAGE,
    );
  });

  it("starts in production when at least one Discord id is listed", () => {
    process.env.APP_ENV = "production";
    process.env.ALLOWED_DISCORD_IDS = "111, 222";
    expect(() => assertDiscordAllowlistConfigured()).not.toThrow();
  });

  it("allows listed Discord ids and rejects everyone else", () => {
    process.env.APP_ENV = "development";
    process.env.ALLOWED_DISCORD_IDS = "111, 222";
    expect(isDiscordIdAllowed("111")).toBe(true);
    expect(isDiscordIdAllowed("999")).toBe(false);
    expect(isDiscordIdAllowed("test-gm")).toBe(true);
    expect(isDiscordIdAllowed("")).toBe(false);
  });

  it("allows any Discord id locally when the list is unset", () => {
    process.env.APP_ENV = "development";
    delete process.env.ALLOWED_DISCORD_IDS;
    expect(() => assertDiscordAllowlistConfigured()).not.toThrow();
    expect(isDiscordIdAllowed("999")).toBe(true);
  });
});
