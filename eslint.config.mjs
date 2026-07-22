import { defineConfig, globalIgnores } from "eslint/config";
import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig(
  globalIgnores(["**/dist/", "**/node_modules/", "coverage/"]),
  js.configs.recommended,
  tseslint.configs.strict,
  {
    files: ["scripts/**/*.mjs", "eslint.config.mjs"],
    languageOptions: { globals: globals.node },
  },
);
