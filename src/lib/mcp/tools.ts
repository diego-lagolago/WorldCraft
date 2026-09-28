import { McpServer } from "@modelcontextprotocol/server";
import { registerContentReadTool } from "./tools/content-read";
import { registerContentsListTool } from "./tools/contents-list";
import { registerImageReadTool } from "./tools/image-read";
import { registerQuestsListTool } from "./tools/quests-list";
import { registerRelationsReadTool } from "./tools/relations-read";
import { registerSearchTool } from "./tools/search";
import { type ToolContext } from "./tools/shared";
import { registerUniversesListTool } from "./tools/universes-list";
import { registerWorldsListTool } from "./tools/worlds-list";

/** Registers the read-only MCP tool set. Each tool stays isolated in its own module. */
export function registerMcpReadTools(server: McpServer, ctx: ToolContext) {
  registerWorldsListTool(server, ctx);
  registerSearchTool(server, ctx);
  registerContentsListTool(server, ctx);
  registerContentReadTool(server, ctx);
  registerRelationsReadTool(server, ctx);
  registerQuestsListTool(server, ctx);
  registerUniversesListTool(server, ctx);
  registerImageReadTool(server, ctx);
}
