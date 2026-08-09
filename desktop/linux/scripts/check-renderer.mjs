#!/usr/bin/env node
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { bundleDesktopRenderer } from "./renderer-bundle.mjs";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

try {
  const metafile = await bundleDesktopRenderer({ appRoot, write: false, logLevel: "silent" });
  console.log(
    `desktop renderer check OK — browser graph resolved ${String(Object.keys(metafile.inputs).length)} inputs through one presentation owner`,
  );
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`desktop renderer check FAILED — ${message}`);
  process.exit(1);
}
