import path from "node:path";
import { defineConfig } from "vitest/config";

/** Trigger checks against local Postgres. Not part of `npm test`. */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/db/**/*.integration.test.ts"],
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
