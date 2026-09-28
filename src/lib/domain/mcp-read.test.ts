import { randomFillSync } from "node:crypto";
import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/db/client", () => ({ db: {} }));

import { McpToolError } from "@/lib/mcp/context";
import { encodeMcpImage } from "./mcp-read";

describe("encodeMcpImage", () => {
  it("CR-006: never returns more than one megabyte for a hard-to-compress image", async () => {
    const pixels = randomFillSync(Buffer.alloc(4_000 * 4_000 * 3));
    const input = await sharp(pixels, {
      raw: { width: 4_000, height: 4_000, channels: 3 },
    }).png().toBuffer();

    try {
      const image = await encodeMcpImage(input);
      expect(image.mimeType).toBe("image/webp");
      expect(Buffer.from(image.data, "base64").byteLength).toBeLessThanOrEqual(1024 * 1024);
    } catch (error) {
      expect(error).toBeInstanceOf(McpToolError);
      expect((error as Error).message).toBe("Bild zu groß für die Ausgabe.");
    }
  }, 30_000);
});
