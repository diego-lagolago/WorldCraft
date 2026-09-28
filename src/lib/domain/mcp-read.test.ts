import { randomFillSync } from "node:crypto";
import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/db/client", () => ({ db: {} }));

import { encodeMcpImage } from "./mcp-read";

describe("encodeMcpImage", () => {
  it("CR-001: reports and logs a corrupt image as unreadable", async () => {
    const corruptPng = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL1xQAAAABJRU5ErkJggg==",
      "base64",
    );
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(encodeMcpImage(corruptPng)).rejects.toMatchObject({
      message: "Bild kann nicht gelesen werden.",
    });
    expect(error).toHaveBeenCalledOnce();
    expect(error).toHaveBeenCalledWith(expect.stringContaining('"event":"mcp_image_decode_error"'));
    error.mockRestore();
  });

  it("CR-001: keeps the pixel-limit error distinct from decode errors", async () => {
    const input = await sharp({
      create: { width: 5_001, height: 5_000, channels: 3, background: "black" },
    }).png().toBuffer();

    await expect(encodeMcpImage(input)).rejects.toMatchObject({
      message: "Bild zu groß für die Ausgabe.",
    });
  });

  it("CR-006: compresses an upload-sized hard-to-compress image within five seconds", async () => {
    const pixels = randomFillSync(Buffer.alloc(1_850 * 1_850 * 3));
    const input = await sharp(pixels, {
      raw: { width: 1_850, height: 1_850, channels: 3 },
    }).png().toBuffer();
    expect(input.byteLength).toBeGreaterThan(8 * 1024 * 1024);
    expect(input.byteLength).toBeLessThan(10 * 1024 * 1024);

    const start = performance.now();
    const image = await encodeMcpImage(input);
    expect(performance.now() - start).toBeLessThan(5_000);
    expect(image.mimeType).toBe("image/webp");
    const metadata = await sharp(Buffer.from(image.data, "base64")).metadata();
    expect(Math.max(metadata.width ?? 0, metadata.height ?? 0)).toBeLessThanOrEqual(1_568);
    expect(Buffer.from(image.data, "base64").byteLength).toBeLessThanOrEqual(1024 * 1024);
  });
});
