import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/mcp-oauth", () => ({ MCP_RESOURCE: "https://worldcraft.example.com/mcp" }));

const { GET } = await import("./route");
const { GET: getForMcpPath } = await import("./mcp/route");

describe("GET /.well-known/oauth-protected-resource", () => {
  const previousMcpEnabled = process.env.MCP_ENABLED;

  afterEach(() => {
    process.env.MCP_ENABLED = previousMcpEnabled;
  });

  it("serves the same document at the RFC 9728 path advertised in WWW-Authenticate", async () => {
    process.env.MCP_ENABLED = "true";
    const origin = await GET();
    const pathSuffixed = await getForMcpPath();

    expect(pathSuffixed.status).toBe(200);
    expect(await pathSuffixed.json()).toEqual(await origin.json());
  });
});
