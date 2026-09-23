import { describe, expect, it } from "vitest";
import {
  DISCORD_EMAIL_REQUIRED_MESSAGE,
  mapDiscordProfileToUser,
  staticDiscordAvatar,
} from "./discord-profile";

describe("staticDiscordAvatar", () => {
  it("rewrites animated discord gif to png", () => {
    expect(
      staticDiscordAvatar("https://cdn.discordapp.com/avatars/123/a_abc.gif"),
    ).toBe("https://cdn.discordapp.com/avatars/123/a_abc.png");
  });

  it("keeps query string when rewriting gif", () => {
    expect(
      staticDiscordAvatar(
        "https://cdn.discordapp.com/avatars/123/a_abc.gif?size=128",
      ),
    ).toBe("https://cdn.discordapp.com/avatars/123/a_abc.png?size=128");
  });

  it("leaves png avatars unchanged", () => {
    expect(
      staticDiscordAvatar("https://cdn.discordapp.com/avatars/123/abc.png"),
    ).toBe("https://cdn.discordapp.com/avatars/123/abc.png");
  });

  it("leaves foreign hosts unchanged even with .gif", () => {
    expect(
      staticDiscordAvatar("https://example.com/avatars/a_abc.gif"),
    ).toBe("https://example.com/avatars/a_abc.gif");
  });

  it("returns undefined for empty input", () => {
    expect(staticDiscordAvatar(undefined)).toBeUndefined();
    expect(staticDiscordAvatar(null)).toBeUndefined();
  });
});

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

  it("staticizes animated avatar on map", () => {
    const mapped = mapDiscordProfileToUser({
      id: "123",
      email: "player@example.com",
      username: "handle",
      image_url: "https://cdn.discordapp.com/avatars/123/a_abc.gif?size=256",
    });
    expect(mapped.image).toBe(
      "https://cdn.discordapp.com/avatars/123/a_abc.png?size=256",
    );
  });

  it("rejects a missing Discord email without inventing a placeholder", () => {
    expect(() =>
      mapDiscordProfileToUser({
        id: "123",
        email: null,
        username: "handle",
      }),
    ).toThrow(DISCORD_EMAIL_REQUIRED_MESSAGE);
  });
});
