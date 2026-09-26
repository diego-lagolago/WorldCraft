import { describe, expect, it, vi } from "vitest";
import { logMcpOAuthMilestone, logMcpOAuthResponse } from "./oauth-observability";

describe("MCP OAuth observability", () => {
  it("logs token failures without sensitive OAuth values", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    try {
      const request = new Request("https://worldcraft.example.com/api/auth/oauth2/token", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: "grant_type=authorization_code&client_id=claude&code=secret-code&code_verifier=secret-verifier",
      });
      const response = Response.json({ error: "invalid_grant", error_description: "Code invalid" }, { status: 400 });

      await logMcpOAuthResponse(request, response);

      const entry = String(info.mock.calls[0]?.[0]);
      expect(entry).toContain('"event":"mcp_oauth"');
      expect(entry).toContain('"grant_type":"authorization_code"');
      expect(entry).toContain('"oauth_error":"invalid_grant"');
      expect(entry).not.toContain("secret-code");
      expect(entry).not.toContain("secret-verifier");
      expect(entry).not.toContain('"client":"claude"');
    } finally {
      info.mockRestore();
    }
  });

  it("logs a consent-page milestone without the raw client id", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    try {
      logMcpOAuthMilestone("mcp_oauth_consent_page", { clientId: "claude", accessAllowed: true });

      const entry = String(info.mock.calls[0]?.[0]);
      expect(entry).toContain('"event":"mcp_oauth_consent_page"');
      expect(entry).toContain('"access_allowed":true');
      expect(entry).not.toContain("claude");
    } finally {
      info.mockRestore();
    }
  });
});
