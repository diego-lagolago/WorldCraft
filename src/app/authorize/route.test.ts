import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

describe("GET /authorize", () => {
  const previousAuthUrl = process.env.BETTER_AUTH_URL;
  const previousMcpEnabled = process.env.MCP_ENABLED;

  afterEach(() => {
    process.env.BETTER_AUTH_URL = previousAuthUrl;
    process.env.MCP_ENABLED = previousMcpEnabled;
  });

  it("forwards the complete OAuth request to Better Auth's advertised endpoint", () => {
    process.env.BETTER_AUTH_URL = "https://worldcraft.example.com";
    process.env.MCP_ENABLED = "true";
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    try {
      const response = GET(
        new Request(
          "http://0.0.0.0:80/authorize?client_id=claude&state=opaque&code_challenge=pkce",
        ),
      );

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe(
        "https://worldcraft.example.com/api/auth/oauth2/authorize?client_id=claude&state=opaque&code_challenge=pkce",
      );
    } finally {
      info.mockRestore();
    }
  });

  it("returns 404 while MCP is disabled (T-012/D2)", () => {
    process.env.MCP_ENABLED = "";
    expect(GET(new Request("http://worldcraft.example.com/authorize")).status).toBe(404);
  });
});
