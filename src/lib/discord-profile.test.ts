import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DISCORD_EMAIL_REQUIRED_MESSAGE,
  mapDiscordProfileToUser,
} from "./discord-profile.ts";

describe("mapDiscordProfileToUser", () => {
  it("maps name, email, avatar and discord id", () => {
    const mapped = mapDiscordProfileToUser({
      id: "123",
      email: "player@example.com",
      username: "handle",
      global_name: "Anzeige",
      image_url: "https://cdn.discordapp.com/avatars/123/abc.png",
    });
    assert.deepEqual(mapped, {
      name: "Anzeige",
      email: "player@example.com",
      image: "https://cdn.discordapp.com/avatars/123/abc.png",
      discordId: "123",
    });
  });

  it("rejects a missing Discord email without inventing a placeholder", () => {
    assert.throws(
      () =>
        mapDiscordProfileToUser({
          id: "123",
          email: null,
          username: "handle",
        }),
      (error: unknown) =>
        error instanceof Error &&
        error.message === DISCORD_EMAIL_REQUIRED_MESSAGE,
    );
  });
});
