#!/usr/bin/env node
/** Unsigned runtime-only proof. This script never stages a release candidate. */
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

assert.equal(process.platform, "win32", "WINDOWS_RELEASE_HOST_REQUIRED");

assert.equal(process.argv.length, 2, "WINDOWS_SMOKE_ARGUMENT_INVALID");

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const output = join(root, "dist-build");

mkdirSync(output, { recursive: true });

const capture = join(output, "smoke-native-runtime.png");

const electron = createRequire(import.meta.url)("electron");

const result = spawnSync(electron, [join(root, "dist/main.cjs"), "--smoke", "--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"], {
  cwd: root, encoding: "utf8", timeout: 120_000, maxBuffer: 1024 * 1024,
  env: { ...process.env, SCENEAXI_LOCAL_CRASH_DUMPS: "0", SCENEAXI_SMOKE_CAPTURE_PATH: capture },
});

assert.equal(result.status, 0, "WINDOWS_NATIVE_RUNTIME_FAILED");

const line = (result.stdout ?? "").split("\n").filter(value => value.startsWith("{")).at(-1);

assert.ok(line, "WINDOWS_NATIVE_PROOF_MISSING");

const proof = JSON.parse(line);

assert.equal(proof.ok, true);

for (const key of ["newProject", "openProject", "recentProject", "assetImport", "documentReload", "save", "undo", "redo", "localAsk", "localBuild", "approvedApply", "cancel", "timeout", "lateWorkRetired", "hierarchySelection", "play", "exportWeb", "bridgeRebind"]) assert.equal(proof.nativeGui?.[key], true, key);

assert.equal(proof.security?.foreignSenderChannelsDenied, 6);

assert.equal(proof.security?.rawDumpConsent, false);

assert.equal(proof.security?.cspEnforced, true);

assert.equal(proof.security?.permissionDenied, true);

assert.equal(proof.performance?.samples?.length, 12);

assert.equal(proof.performance?.canvases, 1);

assert.ok(proof.performance.latencyMs.every(ms => Number.isFinite(ms) && ms <= 4000));

assert.ok(readFileSync(capture).subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])));

writeFileSync(join(output, "smoke-native-runtime-proof.json"), JSON.stringify({ evidenceKind: "unsigned-native-runtime-not-release-certification", ...proof }, null, 2));

console.log("Windows unsigned native runtime smoke passed; no signing or publication.");
