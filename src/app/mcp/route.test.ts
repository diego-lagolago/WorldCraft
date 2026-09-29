import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  handlerFetch: vi.fn(async () => new Response(null, { status: 200 })),
}));

vi.mock("@modelcontextprotocol/server", () => ({
  McpServer: class {},
  createMcpHandler: () => ({ fetch: mocks.handlerFetch }),
}));
vi.mock("@better-auth/mcp", () => ({
  requireMcpAuth: (_auth: unknown, handler: (request: Request, claims: unknown) => Promise<Response>) => (
    (request: Request) => handler(request, { sub: "test-user", client_id: "test-client", scope: "worlds:read" })
  ),
}));
vi.mock("@/lib/auth", () => ({ auth: {} }));
vi.mock("@/db/client", () => ({
  db: {
    select: () => ({
      from: () => ({ where: () => ({ limit: async () => [{ name: "Test User", discordId: "test-user" }] }) }),
    }),
  },
}));
vi.mock("@/db/schema", () => ({ users: { id: "id", name: "name", discordId: "discord_id" } }));
vi.mock("@/lib/domain/connected-applications", () => ({ hasActiveMcpConsent: async () => true }));
vi.mock("@/lib/env", () => ({
  isDiscordIdAllowed: () => true,
  isMcpEnabled: () => true,
  isProductionAppEnv: () => true,
}));
vi.mock("@/lib/mcp-oauth", () => ({ MCP_RESOURCE: "http://localhost:3000/mcp" }));
vi.mock("@/lib/mcp/tools", () => ({ registerMcpTools: vi.fn() }));
vi.mock("@/lib/mcp/audit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/mcp/audit")>()),
  writeMcpAuditLog: async () => {},
}));

import { resetMcpRateLimitForTests } from "@/lib/mcp/audit";
import { POST } from "./route";

afterEach(() => {
  mocks.handlerFetch.mockClear();
  resetMcpRateLimitForTests();
});

describe("MCP route", () => {
  it("T-009(1): returns HTTP 429 and Retry-After on the 61st tool call", async () => {
    const request = () => new Request("http://localhost:3000/mcp", {
      method: "POST",
      headers: { "content-type": "application/json", "mcp-method": "tools/call", "mcp-name": "welten_auflisten" },
      body: JSON.stringify({ method: "tools/call" }),
    });
    for (let index = 0; index < 60; index += 1) {
      expect((await POST(request())).status).toBe(200);
    }
    const limited = await POST(request());
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get("Retry-After"))).toBeGreaterThan(0);
  });

  it("011 Review 2 CR-005: counts a JSON batch containing tools/call", async () => {
    const request = () => new Request("http://localhost:3000/mcp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify([{ method: "tools/call" }]),
    });
    for (let index = 0; index < 60; index += 1) {
      expect((await POST(request())).status).toBe(200);
    }
    expect((await POST(request())).status).toBe(429);
  });
});
