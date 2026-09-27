import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "spikes/**",
    ".ai/**",
  ]),
  {
    files: ["src/lib/mcp/**/*.ts"],
    rules: {
      "max-len": ["error", { code: 160, ignoreStrings: true, ignoreTemplateLiterals: true, ignoreUrls: true, ignoreComments: true }],
    },
  },
]);

export default eslintConfig;
