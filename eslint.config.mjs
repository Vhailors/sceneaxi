import { defineConfig, globalIgnores } from "eslint/config";
import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig(
  globalIgnores([
    "**/dist/",
    "**/node_modules/",
    "coverage/",
    // Framework build output and generated ambient declarations in the sites/ tier.
    // Authored site sources are still linted; only generated files are skipped.
    "sites/*/.next/",
    "sites/*/next-env.d.ts",
    "sites/*/public/",
  ]),
  js.configs.recommended,
  tseslint.configs.strict,
  {
    // Node-run tooling: gate scripts and the workspace binaries under bin/.
    files: [
      "scripts/**/*.mjs",
      "packages/*/bin/**/*.mjs",
      "apps/*/bin/**/*.mjs",
      "eslint.config.mjs",
    ],
    languageOptions: { globals: globals.node },
  },
  {
    // Sites are React server components: browser globals plus the JSX pragma-free
    // transform. They are type-checked by `next build`, not by this config.
    files: ["sites/**/*.{ts,tsx}"],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },
);
