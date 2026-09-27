import { performance } from "node:perf_hooks";
import { requireScopes } from "@modelcontextprotocol/server";
import { z } from "zod";
import { writeMcpAuditLog } from "../audit";
import { McpToolError } from "../context";
import { MCP_MONSTER_KIND_LABELS } from "../enums";

export type ToolContext = { userId: string; clientId: string };
export type ToolResponse = {
  value: string;
  worldId?: string | null;
  image?: { data: string; mimeType: "image/jpeg" | "image/webp" };
};

export const worldSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .optional()
  .describe("ID oder Name der Welt. Bei mehreren Welten bitte zuerst welten_auflisten nutzen.");
export const contentKind = z.enum(["artikel", "quest", "charakter", "pin", "monster", "universum"]);
export const templateTypes = z.enum(["person", "ort", "organisation", "gegenstand", "rasse", "ohne"]);
export const status = z.enum(["offen", "aktiv", "abgeschlossen", "gescheitert"]);
export const monsterKindLabel = z.enum(MCP_MONSTER_KIND_LABELS);

export const readToolAuth = {
  scopeChallenge: requireScopes("worlds:read"),
  _meta: { securitySchemes: [{ type: "oauth2", scopes: ["worlds:read"] }] as const },
};

export function text(value: string, isError = false) {
  return {
    isError,
    content: [{ type: "text" as const, text: value.length > 20_000 ? `${value.slice(0, 19_950)}\n\n_(gekürzt)_` : value }],
  };
}

export function asError(error: unknown) {
  return text(error instanceof McpToolError ? error.message : "Die Anfrage konnte nicht verarbeitet werden.", true);
}

export async function withAudit(ctx: ToolContext, toolName: string, action: () => Promise<ToolResponse>) {
  const start = performance.now();
  let worldId: string | null = null;
  let result = "ok";
  try {
    const response = await action();
    worldId = response.worldId ?? null;
    return response.image
      ? { content: [{ type: "text" as const, text: response.value }, { type: "image" as const, data: response.image.data, mimeType: response.image.mimeType }] }
      : text(response.value);
  } catch (error) {
    result = error instanceof McpToolError ? "tool_error" : "error";
    if (!(error instanceof McpToolError)) {
      console.error(JSON.stringify({ event: "mcp_tool_error", tool: toolName, error: error instanceof Error ? error.name : "unknown" }));
    }
    return asError(error);
  } finally {
    await writeMcpAuditLog({ userId: ctx.userId, clientId: ctx.clientId, toolName, worldId, durationMs: performance.now() - start, result })
      .catch((auditError: unknown) => console.error(JSON.stringify({ event: "mcp_audit_error", tool: toolName, error: auditError instanceof Error ? auditError.name : "unknown" })));
  }
}
