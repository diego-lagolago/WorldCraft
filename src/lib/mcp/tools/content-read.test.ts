import { describe, expect, it, vi } from "vitest";

vi.mock("@/db/client", () => ({ db: {} }));

import { boundedRichText } from "./content-read";

describe("content read rich text bounds", () => {
  it("Review 012 CR-003: keeps guidance before a long trailing text and states omitted characters", () => {
    const value = boundedRichText("A".repeat(30_000));
    expect(value).toContain("gekürzt; 14000 Zeichen nicht dargestellt");
    expect(value.length).toBeLessThan(20_000);
  });
});
