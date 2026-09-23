import { beforeEach, describe, expect, it, vi } from "vitest";

const requireProductSession = vi.fn();
const attachImage = vi.fn();

vi.mock("@/lib/session", () => ({
  requireProductSession: () => requireProductSession(),
}));

vi.mock("@/lib/files/attach", () => ({
  attachImage: (...args: unknown[]) => attachImage(...args),
}));

describe("POST /api/files (CR-009)", () => {
  beforeEach(() => {
    requireProductSession.mockResolvedValue({
      session: { user: { id: "user-1" } },
      response: null,
    });
    attachImage.mockReset();
  });

  it("rejects an 11 MB article_title upload with 400 without reading the body", async () => {
    const { POST } = await import("./route");
    const file = new File([new Uint8Array(11 * 1024 * 1024)], "big.png", { type: "image/png" });
    const arrayBuffer = vi.spyOn(File.prototype, "arrayBuffer");
    const form = new FormData();
    form.set("kind", "article_title");
    form.set("worldId", "00000000-0000-4000-8000-000000000001");
    form.set("targetId", "00000000-0000-4000-8000-000000000002");
    form.set("image", file);

    const response = await POST(new Request("http://localhost/api/files", { method: "POST", body: form }));
    const body = (await response.json()) as { error?: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe("Das Bild darf höchstens 10 MB groß sein.");
    expect(arrayBuffer).not.toHaveBeenCalled();
    expect(attachImage).not.toHaveBeenCalled();
    arrayBuffer.mockRestore();
  });
});
