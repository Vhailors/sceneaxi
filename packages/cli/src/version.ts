import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** Envelope contract major version — bump only on breaking envelope shape changes. */
export const PROTOCOL_SCHEMA_VERSION = 1 as const;

function readCliVersion(): string {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const manifest = JSON.parse(
      readFileSync(join(here, "..", "package.json"), "utf8"),
    ) as { version?: string };
    return manifest.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

/** Package version stamped into every envelope (`cliVersion`). */
export const CLI_VERSION: string = readCliVersion();
