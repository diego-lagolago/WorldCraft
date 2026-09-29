import { z } from "zod";
import { McpToolError } from "../context";
import { writeMcpAuditLog } from "../audit";
import { issuesMessage, mcpEnum } from "../validation";

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

export const contentKind = mcpEnum([
  "artikel",
  "quest",
  "charakter",
  "pin",
  "monster",
  "universum",
], "art");

export const templateTypes = mcpEnum([
  "person",
  "ort",
  "organisation",
  "gegenstand",
  "rasse",
  "ohne",
], "vorlagentyp");

export const questStatus = mcpEnum(["offen", "aktiv", "abgeschlossen", "gescheitert"], "status");

export function text(value: string, isError = false) {
  const bounded = value.length > 20_000 ? `${value.slice(0, 19_950)}\n\n_(gekürzt)_` : value;
  return { isError, content: [{ type: "text" as const, text: bounded }] };
}

/** Validation failures are tool errors with field path and allowed values; only real failures stay generic. */
export function isValidationError(error: unknown): error is McpToolError | z.ZodError {
  return error instanceof McpToolError || error instanceof z.ZodError;
}

export function asError(error: unknown) {
  if (error instanceof McpToolError) return text(error.message, true);
  if (error instanceof z.ZodError) return text(issuesMessage(error.issues, { base: "" }), true);
  return text("Die Anfrage konnte nicht verarbeitet werden.", true);
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
    result = isValidationError(error) ? "tool_error" : "error";
    if (!isValidationError(error)) {
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
