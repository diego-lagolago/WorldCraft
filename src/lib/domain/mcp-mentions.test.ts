import { describe, expect, it, vi } from "vitest";

const { searchMentionTargets } = vi.hoisted(() => ({ searchMentionTargets: vi.fn() }));
vi.mock("./mention-search", () => ({ searchMentionTargets }));

import { mcpMarkdownToTiptap } from "@/lib/editor/mcp-markdown";
import { McpMentionError, resolveMcpMarkdownMentions } from "./mcp-mentions";

const ID = "11111111-1111-4111-8111-111111111111";
const input = (markdown: string, role: "game_master" | "master" | "player" = "game_master") => resolveMcpMarkdownMentions({
  parsed: mcpMarkdownToTiptap(markdown, { mentions: true }), worldId: "world", viewerId: "user", role,
});

describe("resolveMcpMarkdownMentions", () => {
  it("resolves an explicitly identified visible target", async () => {
    searchMentionTargets.mockResolvedValueOnce([{ kind: "article", id: ID, title: "Burg" }]);
    const result = await input(`@[Burg](artikel:${ID})`);
    expect(result.stubs).toEqual([]);
    expect(JSON.stringify(result.doc)).toContain('"mention"');
  });

  it("returns stubs only for staff and rejects an unknown player mention", async () => {
    searchMentionTargets.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    await expect(input("@[Neu]", "game_master")).resolves.toMatchObject({ stubs: ["Neu"] });
    await expect(input("@[Neu]", "player")).rejects.toBeInstanceOf(McpMentionError);
  });

  it("does not create a plausible accidental stub and reports duplicate exact matches", async () => {
    searchMentionTargets.mockResolvedValueOnce([{ kind: "article", id: ID, title: "Gegenstand Y" }]);
    await expect(input("@[Gegenstand Y und noch viele andere seltene Gegenstände]")).rejects.toThrow("Gegenstand Y");
    searchMentionTargets.mockResolvedValueOnce([{ kind: "article", id: ID, title: "Burg" }, { kind: "quest", id: "22222222-2222-4222-8222-222222222222", title: "Burg" }]);
    await expect(input("@[Burg]")).rejects.toThrow("mehrdeutig");
  });
});
