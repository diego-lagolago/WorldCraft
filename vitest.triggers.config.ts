import path from "node:path";
import { defineConfig } from "vitest/config";

/** Trigger and domain integration checks against local Postgres. Not part of `npm test`. */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.integration.test.ts"],
    fileParallelism: false,
    env: { DATABASE_POOL_MAX: "12" },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
