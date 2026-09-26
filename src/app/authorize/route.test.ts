import { afterEach, describe, expect, it } from "vitest";
import { GET } from "./route";

describe("GET /authorize", () => {
  const previousAuthUrl = process.env.BETTER_AUTH_URL;

  afterEach(() => {
    process.env.BETTER_AUTH_URL = previousAuthUrl;
  });

  it("forwards the complete OAuth request to Better Auth's advertised endpoint", () => {
    process.env.BETTER_AUTH_URL = "https://worldcraft.example.com";
    const response = GET(
      new Request(
        "http://0.0.0.0:80/authorize?client_id=claude&state=opaque&code_challenge=pkce",
      ),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://worldcraft.example.com/api/auth/oauth2/authorize?client_id=claude&state=opaque&code_challenge=pkce",
    );
  });
});
