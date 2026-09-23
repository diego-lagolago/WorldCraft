import { afterEach, describe, expect, it } from "vitest";
import {
  ALLOWED_DISCORD_IDS_REQUIRED_MESSAGE,
  TEST_LOGIN_IN_PRODUCTION_MESSAGE,
  assertDiscordAllowlistConfigured,
  assertTestLoginNotInProduction,
  isDiscordIdAllowed,
  isProductionAppEnv,
  isTestLoginEnabled,
} from "./env";

const original = {
  ENABLE_TEST_LOGIN: process.env.ENABLE_TEST_LOGIN,
  APP_ENV: process.env.APP_ENV,
  ALLOWED_DISCORD_IDS: process.env.ALLOWED_DISCORD_IDS,
};

afterEach(() => {
  if (original.ENABLE_TEST_LOGIN === undefined) {
    delete process.env.ENABLE_TEST_LOGIN;
  } else {
    process.env.ENABLE_TEST_LOGIN = original.ENABLE_TEST_LOGIN;
  }
  if (original.APP_ENV === undefined) {
    delete process.env.APP_ENV;
  } else {
    process.env.APP_ENV = original.APP_ENV;
  }
  if (original.ALLOWED_DISCORD_IDS === undefined) {
    delete process.env.ALLOWED_DISCORD_IDS;
  } else {
    process.env.ALLOWED_DISCORD_IDS = original.ALLOWED_DISCORD_IDS;
  }
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
