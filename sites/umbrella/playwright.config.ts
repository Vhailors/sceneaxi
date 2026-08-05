import { existsSync } from "node:fs";
import { defineConfig } from "@playwright/test";

const configuredChrome = process.env.SCENEAXI_CHROME_PATH;
const executablePath =
  configuredChrome ?? (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined);

/**
 * The Chromium sandbox stays on unless the environment cannot provide it — a CI
 * container, or a developer who says so by name. A local run never silently drops it.
 */
const sandboxUnavailable =
  process.env.CI !== undefined || process.env.SCENEAXI_CHROME_NO_SANDBOX === "1";

export default defineConfig({
  testDir: "./test",
  testMatch: "**/*.visual.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "line",
  use: {
    baseURL: "http://127.0.0.1:4173",
    browserName: "chromium",
    deviceScaleFactor: 1,
    headless: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: {
      ...(executablePath === undefined ? {} : { executablePath }),
      args: sandboxUnavailable ? ["--no-sandbox"] : [],
    },
  },
  webServer: {
    command: "pnpm dev --hostname 127.0.0.1 --port 4173",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
});
