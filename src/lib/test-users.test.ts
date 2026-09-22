import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { TEST_USERS, findTestUser } from "./test-users.ts";

describe("TEST_USERS", () => {
  it("seeds the four T-008 accounts with test- discord ids", () => {
    assert.deepEqual(
      TEST_USERS.map((user) => user.discordId),
      ["test-gm", "test-master", "test-player-a", "test-player-b"],
    );
    for (const user of TEST_USERS) {
      assert.equal(user.email, `${user.discordId}@localhost`);
      assert.ok(user.discordId.startsWith("test-"));
    }
  });

  it("ignores unknown ids", () => {
    assert.equal(findTestUser("someone-else"), undefined);
  });
});
