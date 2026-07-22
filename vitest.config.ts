import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: [
      "packages/*/test/**/*.test.ts",
      "apps/*/test/**/*.test.ts",
      "tests/**/*.test.ts",
    ],
    // Fail-closed: an empty test surface is a gate failure, never a pass.
    passWithNoTests: false,
  },
});
