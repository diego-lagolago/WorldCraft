import path from "node:path";
import { defineConfig } from "vitest/config";

/** Integration script: needs a running dev server. Not part of `npm test`. */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/spike/rechte/run-rechte-tests.ts"],
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
