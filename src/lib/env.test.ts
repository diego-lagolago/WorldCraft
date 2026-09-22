import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  TEST_LOGIN_IN_PRODUCTION_MESSAGE,
  assertTestLoginNotInProduction,
  isProductionAppEnv,
  isTestLoginEnabled,
} from "./env.ts";

const original = {
  ENABLE_TEST_LOGIN: process.env.ENABLE_TEST_LOGIN,
  APP_ENV: process.env.APP_ENV,
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
});

describe("isTestLoginEnabled", () => {
  it("is true only for the string true", () => {
    process.env.ENABLE_TEST_LOGIN = "true";
    assert.equal(isTestLoginEnabled(), true);
    process.env.ENABLE_TEST_LOGIN = "1";
    assert.equal(isTestLoginEnabled(), false);
    delete process.env.ENABLE_TEST_LOGIN;
    assert.equal(isTestLoginEnabled(), false);
  });
});

describe("assertTestLoginNotInProduction", () => {
  it("allows test-login outside production", () => {
    process.env.ENABLE_TEST_LOGIN = "true";
    process.env.APP_ENV = "development";
    assert.equal(isProductionAppEnv(), false);
    assert.doesNotThrow(() => assertTestLoginNotInProduction());
  });

  it("refuses ENABLE_TEST_LOGIN in production", () => {
    process.env.ENABLE_TEST_LOGIN = "true";
    process.env.APP_ENV = "production";
    assert.throws(
      () => assertTestLoginNotInProduction(),
      (error: unknown) =>
        error instanceof Error &&
        error.message === TEST_LOGIN_IN_PRODUCTION_MESSAGE,
    );
  });
});
