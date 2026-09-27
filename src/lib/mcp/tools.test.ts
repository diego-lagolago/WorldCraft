import { describe, expect, it, vi } from "vitest";

const writeMcpAuditLog = vi.fn().mockResolvedValue(undefined);
vi.mock("./audit", () => ({ writeMcpAuditLog }));
vi.mock("@/lib/authz", () => ({ CONTENT_VISIBILITY_LABEL: {} }));
vi.mock("@/lib/domain/articles", () => ({}));
vi.mock("@/lib/domain/characters", () => ({}));
vi.mock("@/lib/domain/members", () => ({}));
vi.mock("@/lib/domain/monsters", () => ({}));
vi.mock("@/lib/domain/quests", () => ({}));
vi.mock("@/lib/domain/quest-notes", () => ({}));
vi.mock("@/lib/domain/relations", () => ({}));
vi.mock("@/lib/domain/search", () => ({}));
vi.mock("@/lib/domain/universes", () => ({}));
vi.mock("@/lib/domain/worlds", () => ({}));
vi.mock("@/lib/domain/mcp-read", () => ({}));
vi.mock("@/lib/editor/tiptap-mcp-markdown", () => ({}));
vi.mock("@/lib/characters/sheet", () => ({ SKILL_LEVEL_LABEL: {} }));
vi.mock("@/lib/monsters/labels", () => ({
  MONSTER_KINDS: [],
  MONSTER_RARITIES: [],
  MONSTER_DANGER_LABEL: {},
  MONSTER_KIND_LABEL: {},
  MONSTER_RARITY_LABEL: {},
  MONSTER_SIZE_LABEL: {},
}));
vi.mock("@/lib/map/pin-types", () => ({}));
vi.mock("@/lib/templates/registry", () => ({ TEMPLATE_TYPES: ["none", "person", "place", "organization", "item", "race"] }));
vi.mock("./context", () => ({
  McpToolError: class McpToolError extends Error {},
}));

const { registerMcpReadTools, withAudit } = await import("./tools");

describe("withAudit", () => {
  it("CR-003: hides unexpected failures from the MCP client and logs the tool name", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = await withAudit(
      { userId: "user-1", clientId: "client-1" },
      "relationen_abrufen",
      async () => { throw new Error('relation "articles" does not exist'); },
    );

    expect(response).toMatchObject({
      isError: true,
      content: [{ type: "text", text: "Die Anfrage konnte nicht verarbeitet werden." }],
    });
    expect(JSON.stringify(response)).not.toContain("articles");
    expect(error).toHaveBeenCalledWith(expect.stringContaining('"tool":"relationen_abrufen"'));
    expect(writeMcpAuditLog).toHaveBeenCalledWith(expect.objectContaining({ result: "error" }));
    error.mockRestore();
  });
});

describe("registerMcpReadTools", () => {
  it("CR-028/CR-029: declares OAuth and challenges every productive read tool for worlds:read", () => {
    const registerTool = vi.fn();

    registerMcpReadTools(
      { registerTool } as never,
      { userId: "user-1", clientId: "client-1" },
    );

    expect(registerTool).toHaveBeenCalledTimes(8);
    for (const [, definition] of registerTool.mock.calls) {
      expect(definition.scopeChallenge()).toEqual({ scopes: ["worlds:read"] });
      expect(definition._meta).toEqual({ securitySchemes: [{ type: "oauth2", scopes: ["worlds:read"] }] });
    }
  });
});
