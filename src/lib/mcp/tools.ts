import { McpServer } from "@modelcontextprotocol/server";
import { registerBildLesenTool } from "./tools/bild-lesen";
import { registerInhaltLesenTool } from "./tools/inhalt-lesen";
import { registerInhalteAuflistenTool } from "./tools/inhalte-auflisten";
import { registerQuestsAuflistenTool } from "./tools/quests-auflisten";
import { registerRelationenAbrufenTool } from "./tools/relationen-abrufen";
import { registerSuchenTool } from "./tools/suchen";
import { type ToolContext } from "./tools/shared";
import { registerUniversenAuflistenTool } from "./tools/universen-auflisten";
import { registerWeltenAuflistenTool } from "./tools/welten-auflisten";

export { asError, text, type ToolContext, withAudit } from "./tools/shared";

/** Registers the complete, read-only MCP surface from focused tool modules. */
export function registerMcpReadTools(server: McpServer, ctx: ToolContext) {
  registerWeltenAuflistenTool(server, ctx);
  registerSuchenTool(server, ctx);
  registerInhalteAuflistenTool(server, ctx);
  registerInhaltLesenTool(server, ctx);
  registerRelationenAbrufenTool(server, ctx);
  registerQuestsAuflistenTool(server, ctx);
  registerUniversenAuflistenTool(server, ctx);
  registerBildLesenTool(server, ctx);
}
