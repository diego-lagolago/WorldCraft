import { afterEach, describe, expect, it, vi } from "vitest";

const authPost = vi.fn<(request: Request) => Promise<Response>>();
vi.mock("@/app/api/auth/[...all]/route", () => ({ POST: (request: Request) => authPost(request) }));

const { POST } = await import("./route");

describe("POST /token", () => {
  const previousAuthUrl = process.env.BETTER_AUTH_URL;

  afterEach(() => {
    process.env.BETTER_AUTH_URL = previousAuthUrl;
    authPost.mockReset();
  });

  it("hands the unchanged token request to Better Auth's advertised endpoint", async () => {
    process.env.BETTER_AUTH_URL = "https://worldcraft.example.com";
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    authPost.mockResolvedValue(Response.json({ access_token: "token" }));
    try {
      const body = "grant_type=authorization_code&code=abc&code_verifier=pkce";
      const response = await POST(
        new Request("http://0.0.0.0:80/token", {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body,
        }),
      );

      expect(response.status).toBe(200);
      const forwarded = authPost.mock.calls[0][0];
      expect(forwarded.url).toBe("https://worldcraft.example.com/api/auth/oauth2/token");
      expect(forwarded.headers.get("content-type")).toBe("application/x-www-form-urlencoded");
      expect(await forwarded.text()).toBe(body);
      expect(info).toHaveBeenCalledWith(JSON.stringify({ event: "mcp_oauth_compat_token" }));
    } finally {
      info.mockRestore();
    }
  });
});
