import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("GET /authorize", () => {
  it("forwards the complete OAuth request to Better Auth's advertised endpoint", () => {
    const response = GET(
      new Request(
        "https://worldcraft.example.com/authorize?client_id=claude&state=opaque&code_challenge=pkce",
      ),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://worldcraft.example.com/api/auth/oauth2/authorize?client_id=claude&state=opaque&code_challenge=pkce",
    );
  });
});
