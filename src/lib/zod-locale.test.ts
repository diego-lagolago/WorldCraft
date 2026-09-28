import { z } from "zod";
import { describe, expect, it } from "vitest";
import { configureZodLocale } from "./zod-locale";

describe("configureZodLocale", () => {
  it("CR-005: configures German schema errors", () => {
    configureZodLocale();

    const result = z.number().max(50).safeParse(500);

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.message).toContain("Zu groß");
  });
});
