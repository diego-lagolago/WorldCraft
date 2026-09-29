import { z } from "zod";
import { McpToolError } from "../context";
import { writeMcpAuditLog } from "../audit";

export type ToolContext = {
  userId: string;
  clientId: string;
  scopes: readonly string[];
};

export function requireMcpWriteScope(ctx: ToolContext) {
  if (!ctx.scopes.includes("worlds:write")) throw new McpToolError("Für dieses Werkzeug wird die Berechtigung worlds:write benötigt.");
}

export type ToolImage = {
  data: string;
  mimeType: "image/jpeg" | "image/webp";
};

export type ToolResponse = {
  value: string;
  worldId?: string | null;
  image?: ToolImage;
  audit?: {
    targetKind?: string | null;
    targetId?: string | null;
    confirmed?: boolean | null;
  };
};

export const worldSchema = z.string().trim().min(1).max(120)
  .optional()
  .describe("ID oder Name der Welt. Bei mehreren Welten bitte zuerst welten_auflisten nutzen.");

export const contentKind = z.enum([
  "artikel",
  "quest",
  "charakter",
  "pin",
  "monster",
  "universum",
]);

export const templateTypes = z.enum([
  "person",
  "ort",
  "organisation",
  "gegenstand",
  "rasse",
  "ohne",
]);

export const questStatus = z.enum(["offen", "aktiv", "abgeschlossen", "gescheitert"]);

export function text(value: string, isError = false) {
  const bounded = value.length > 20_000 ? `${value.slice(0, 19_950)}\n\n_(gekürzt)_` : value;
  return { isError, content: [{ type: "text" as const, text: bounded }] };
}

export function asError(error: unknown) {
  return text(error instanceof McpToolError ? error.message : "Die Anfrage konnte nicht verarbeitet werden.", true);
}

export async function withAudit(
  ctx: ToolContext,
  toolName: string,
  action: () => Promise<ToolResponse>,
) {
  const start = performance.now();
  let worldId: string | null = null;
  let audit: ToolResponse["audit"];
  let result = "ok";
  try {
    const response = await action();
    worldId = response.worldId ?? null;
    audit = response.audit;
    return response.image
      ? {
          content: [
            { type: "text" as const, text: response.value },
            { type: "image" as const, data: response.image.data, mimeType: response.image.mimeType },
          ],
        }
      : text(response.value);
  } catch (error) {
    result = error instanceof McpToolError ? "tool_error" : "error";
    if (!(error instanceof McpToolError)) {
      console.error(JSON.stringify({
        event: "mcp_tool_error",
        tool: toolName,
        error: error instanceof Error ? error.name : "unknown",
      }));
    }
    return asError(error);
  } finally {
    await writeMcpAuditLog({
      userId: ctx.userId,
      clientId: ctx.clientId,
      toolName,
      worldId,
      targetKind: audit?.targetKind,
      targetId: audit?.targetId,
      confirmed: audit?.confirmed,
      origin: "mcp",
      durationMs: performance.now() - start,
      result,
    }).catch((auditError: unknown) => console.error(JSON.stringify({
      event: "mcp_audit_error",
      tool: toolName,
      error: auditError instanceof Error ? auditError.name : "unknown",
    })));
  }
}
