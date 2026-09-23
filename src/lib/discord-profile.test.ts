import { describe, expect, it } from "vitest";
import {
  DISCORD_EMAIL_REQUIRED_MESSAGE,
  mapDiscordProfileToUser,
} from "./discord-profile";

describe("mapDiscordProfileToUser", () => {
  it("maps name, email, avatar and discord id", () => {
    const mapped = mapDiscordProfileToUser({
      id: "123",
      email: "player@example.com",
      username: "handle",
      global_name: "Anzeige",
      image_url: "https://cdn.discordapp.com/avatars/123/abc.png",
    });
    expect(mapped).toEqual({
      name: "Anzeige",
      email: "player@example.com",
      image: "https://cdn.discordapp.com/avatars/123/abc.png",
      discordId: "123",
    });
  });

  it("rejects a missing Discord email without inventing a placeholder", () => {
    expect(() =>
        mapDiscordProfileToUser({
          id: "123",
          email: null,
          username: "handle",
        })).toThrow(DISCORD_EMAIL_REQUIRED_MESSAGE);
  });
});
