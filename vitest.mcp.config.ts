import path from "node:path";
import { defineConfig } from "vitest/config";

/** MCP integration suite; needs the local dev server and seeded MCP test world. */
export default defineConfig({
  test: { environment: "node", include: ["src/**/*.mcp.test.ts", "src/lib/mcp/confirmations.integration.test.ts"], fileParallelism: false },
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
});
