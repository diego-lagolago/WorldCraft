import { describe, expect, it } from "vitest";
import { z } from "zod";
import { parseJsonBody, parseUuid } from "./http";

describe("parseUuid", () => {
  it("accepts a uuid and rejects everything else", () => {
    expect(parseUuid("550e8400-e29b-41d4-a716-446655440000")).toBe(
      "550e8400-e29b-41d4-a716-446655440000",
    );
    expect(parseUuid("not-a-uuid")).toBeNull();
    expect(parseUuid(null)).toBeNull();
  });
});

describe("parseJsonBody", () => {
  it("returns 400 for broken JSON and for a schema miss", async () => {
    const broken = new Request("http://localhost/x", {
      method: "POST",
      body: "{",
      headers: { "content-type": "application/json" },
    });
    const invalid = new Request("http://localhost/x", {
      method: "POST",
      body: JSON.stringify({ name: "" }),
      headers: { "content-type": "application/json" },
    });
    const valid = new Request("http://localhost/x", {
      method: "POST",
      body: JSON.stringify({ name: "Welt" }),
      headers: { "content-type": "application/json" },
    });
    const schema = z.object({ name: z.string().min(1) });

    expect(await parseJsonBody(broken, schema)).toMatchObject({ ok: false, status: 400 });
    expect(await parseJsonBody(invalid, schema)).toMatchObject({ ok: false, status: 400 });
    expect(await parseJsonBody(valid, schema)).toEqual({ ok: true, data: { name: "Welt" } });
  });
});
