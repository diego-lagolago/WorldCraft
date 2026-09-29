import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  consume: vi.fn(),
  attachImage: vi.fn(),
  ticket: {
    id: "ticket-row",
    userId: "user-1",
    clientId: "client-1",
    worldId: "world-1",
    targetKind: "welt",
    targetId: "world-1",
    imageKind: "world_title",
    expectedStand: "2026-09-29T10:00:00.000Z",
    expiresAt: new Date("2026-09-29T10:15:00.000Z"),
  },
}));

vi.mock("@/db/client", () => ({
  db: {
    select: () => ({
      from: () => ({ where: () => ({ limit: async () => [{ discordId: "test-user", name: "Testwelt" }] }) }),
    }),
  },
}));
vi.mock("@/db/schema", () => ({
  articles: { id: "id", updatedAt: "updated_at" },
  monsters: { id: "id", updatedAt: "updated_at" },
  users: { id: "id", discordId: "discord_id" },
  worlds: { id: "id", name: "name" },
}));
vi.mock("@/lib/domain/articles", () => ({ getArticle: vi.fn() }));
vi.mock("@/lib/domain/monsters", () => ({ getMonster: vi.fn() }));
vi.mock("@/lib/domain/connected-applications", () => ({ hasActiveMcpConsent: async () => true }));
vi.mock("@/lib/env", () => ({ isDiscordIdAllowed: () => true, isMcpEnabled: () => true }));
vi.mock("@/lib/files/attach", () => ({ attachImage: mocks.attachImage }));
vi.mock("@/lib/mcp/context", () => ({
  listMcpWorldMemberships: async () => [{
    id: "world-1",
    mcpEnabled: true,
    updatedAt: new Date("2026-09-29T10:00:00.000Z"),
  }],
}));
vi.mock("@/lib/mcp/write-rich", () => ({
  standOf: (value: Date) => value.toISOString(),
}));
vi.mock("@/lib/mcp/upload-tickets", () => ({
  peekMcpUploadTicket: async () => mocks.ticket,
  consumeMcpUploadTicket: mocks.consume,
}));
vi.mock("@/lib/mcp/audit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/mcp/audit")>()),
  writeMcpAuditLog: async () => {},
}));

import { resetMcpRateLimitForTests } from "@/lib/mcp/audit";
import { OTHER_IMAGE_MAX_BYTES } from "@/lib/files/inspect";
import { POST } from "./route";

const params = { params: Promise.resolve({ ticket: "secret-ticket" }) };

function uploadRequest(contentLength: string | null) {
  const headers = new Headers({ "content-type": "multipart/form-data; boundary=x" });
  if (contentLength !== null) headers.set("content-length", contentLength);
  const request = new Request("http://localhost:3000/upload/secret-ticket", {
    method: "POST",
    headers,
    body: "--x--",
  });
  const formData = vi.spyOn(request, "formData");
  return { request, formData };
}

afterEach(() => {
  mocks.consume.mockReset();
  mocks.attachImage.mockReset();
  resetMcpRateLimitForTests();
});

describe("upload route", () => {
  it("CR-021: rejects a Content-Length above the limit with 413 before reading the form", async () => {
    const { request, formData } = uploadRequest(String(OTHER_IMAGE_MAX_BYTES + 64 * 1024 + 1));
    const response = await POST(request, params);
    expect(response.status).toBe(413);
    expect(formData).not.toHaveBeenCalled();
    expect(mocks.consume).not.toHaveBeenCalled();
    expect(mocks.attachImage).not.toHaveBeenCalled();
  });

  it("CR-021: rejects a missing Content-Length with 413 before reading the form", async () => {
    const { request, formData } = uploadRequest(null);
    const response = await POST(request, params);
    expect(response.status).toBe(413);
    expect(formData).not.toHaveBeenCalled();
    expect(mocks.consume).not.toHaveBeenCalled();
  });
});
