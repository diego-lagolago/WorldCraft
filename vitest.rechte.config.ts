import path from "node:path";
import { defineConfig } from "vitest/config";

/** Integration scripts and product API tests: need a running dev server. Not part of `npm test`. */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.api.test.ts"],
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
