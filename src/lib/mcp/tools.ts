import { McpServer } from "@modelcontextprotocol/server";
import { registerContentReadTool } from "./tools/content-read";
import { registerContentCreateTool } from "./tools/content-create";
import { registerContentUpdateTool } from "./tools/content-update";
import { registerChangeConfirmTool } from "./tools/change-confirm";
import { registerContentsListTool } from "./tools/contents-list";
import { registerImageReadTool } from "./tools/image-read";
import { registerImageUploadTool } from "./tools/image-upload";
import { registerQuestsListTool } from "./tools/quests-list";
import { registerRelationCreateTool } from "./tools/relation-create";
import { registerRelationsReadTool } from "./tools/relations-read";
import { registerSearchTool } from "./tools/search";
import { type ToolContext } from "./tools/shared";
import { registerUniversesListTool } from "./tools/universes-list";
import { registerVisibilitySetTool } from "./tools/visibility-set";
import { registerWorldsListTool } from "./tools/worlds-list";

/** Registers the MCP tool set (read + write). Each tool stays isolated in its own module. */
export function registerMcpReadTools(server: McpServer, ctx: ToolContext) {
  registerWorldsListTool(server, ctx);
  registerSearchTool(server, ctx);
  registerContentsListTool(server, ctx);
  registerContentReadTool(server, ctx);
  registerRelationsReadTool(server, ctx);
  registerQuestsListTool(server, ctx);
  registerUniversesListTool(server, ctx);
  registerImageReadTool(server, ctx);
  registerChangeConfirmTool(server, ctx);
  registerContentCreateTool(server, ctx);
  registerContentUpdateTool(server, ctx);
  registerRelationCreateTool(server, ctx);
  registerVisibilitySetTool(server, ctx);
  registerImageUploadTool(server, ctx);
}
