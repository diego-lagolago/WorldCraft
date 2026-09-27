import { describe, expect, it } from "vitest";
import { TEST_USERS, findTestUser } from "./test-users";

describe("TEST_USERS", () => {
  it("seeds the four T-008 accounts and the isolated MCP rate-limit account", () => {
    expect(TEST_USERS.map((user) => user.discordId)).toEqual(["test-gm", "test-master", "test-player-a", "test-player-b", "test-rate-limit"]);
    for (const user of TEST_USERS) {
      expect(user.email).toBe(`${user.discordId}@localhost`);
      expect(user.discordId.startsWith("test-")).toBeTruthy();
    }
  });

  it("ignores unknown ids", () => {
    expect(findTestUser("someone-else")).toBe(undefined);
  });
});
