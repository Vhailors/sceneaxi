import { createHash } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";
import { Script } from "node:vm";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

interface LaunchFaults { receiptWrite: boolean; afterTemporaryDirectory?: () => void; beforeSpawn?: () => void; spawns: number; temporaryDirectories: string[] }

const fault: LaunchFaults = { receiptWrite: false, spawns: 0, temporaryDirectories: [] };

const launchHost: LocalBuildHost = {
  spawn: (...args: Parameters<typeof spawn>) => {
    fault.spawns++;
    fault.beforeSpawn?.();

    return spawn(...args);
  },
  mkdtempSync: (...args: Parameters<typeof mkdtempSync>) => {
    const directory = mkdtempSync(...args);

    if (isTemporaryDirectory(directory) && directory.includes("sceneaxi-local-launch-")) {
      fault.temporaryDirectories.push(directory);
      fault.afterTemporaryDirectory?.();
    }

    return directory;
  },
  writeFileSync: (...args: Parameters<typeof writeFileSync>) => {
    if (fault.receiptWrite && String(args[0]).endsWith("local-project-build.json")) throw new Error("injected disk write failure");

    return writeFileSync(...args);
  },
};

import { computeDeliveryArtifactSetDigest, createDocument, serializeDocument } from "@sceneaxi/schemas";
import { buildLocalProject as buildWithHost, verifyLocalProjectBuild, launchLocalProjectBuild as launchWithHost } from "@sceneaxi/authoring-core";

const roots: string[] = [];

afterEach(() => { fault.receiptWrite = false; delete fault.afterTemporaryDirectory; delete fault.beforeSpawn; fault.spawns = 0;

 for (const p of fault.temporaryDirectories.splice(0)) expect(existsSync(p)).toBe(false);

 for (const p of roots.splice(0)) rmSync(p, { recursive: true, force: true }); });

function fixture() {
 const root = mkdtempSync(join(tmpdir(), "sceneaxi-local-build-")); roots.push(root);
 const scene = serializeDocument(createDocument({ id: "local-project", data: { objects: [] } }));
 writeFileSync(join(root, "scene.json"), scene);
 const artifacts: Record<string, { role: "application" | "metadata"; contentType: string; digest: string }> = {};
 const files = { "index.html": "<!doctype html><title>User project</title>", "source/scene.json": scene };

 for (const [path, bytes] of Object.entries(files)) {
  mkdirSync(join(root, "exports/web/fixture", path, ".."), { recursive: true });
  writeFileSync(join(root, "exports/web/fixture", path), bytes);
  artifacts[path] = { role: path === "index.html" ? "application" : "metadata", contentType: path.endsWith("html") ? "text/html" : "application/json", digest: `sha256:${createHash("sha256").update(bytes).digest("hex")}` };
 }

 writeFileSync(join(root, "exports/web/fixture/delivery-handoff.json"), JSON.stringify({ schemaVersion: 1, kind: "sceneaxi.delivery-handoff", product: { id: "local-project", displayName: "User project", version: "0.0.0" }, target: "web", artifacts, artifactSetDigest: computeDeliveryArtifactSetDigest(artifacts), provenance: { createdAt: "2026-10-02T00:00:00Z" } }));

 return { root, scene, input: { projectRoot: root, exportPath: "exports/web/fixture", name: "fixture", profile: "game", purpose: "local-unsigned", target: "linux" } };
}

describe("contained local unsigned build", () => {
 it("materializes the user document and standalone runtime with a verifiable receipt", () => {
  const f = fixture(); const result = buildLocalProject(f.input); expect(result.ok).toBe(true);

  if (!result.ok) throw new Error(result.reason);
  expect(result.receipt).toMatchObject({ purpose: "local-unsigned", signed: false, releaseReady: false, documentId: "local-project" });
  expect(readFileSync(join(result.directory, "project/source/scene.json"), "utf8")).toBe(f.scene);
  const runtime = readFileSync(join(result.directory, "runtime.cjs"), "utf8");
  expect(runtime).toContain("BrowserWindow");
  expect(() => new Script(runtime)).not.toThrow();
  expect(verifyLocalProjectBuild({ projectRoot: f.root, name: "fixture" })).toEqual(result);
  expect(buildLocalProject(f.input)).toMatchObject({ ok: false, reason: "LOCAL_PROJECT_BUILD_DESTINATION_EXISTS" });
 });
 it.each(["../escape", "/tmp/escape", "a/b", "a\\b", "", "."])("refuses unsafe build name %s", name => {
  expect(buildLocalProject({ ...fixture().input, name })).toMatchObject({ ok: false, reason: "LOCAL_PROJECT_BUILD_UNSAFE_PATH" });
 });
 it("denies Kids before reading any files", () => {
  expect(buildLocalProject({ ...fixture().input, projectRoot: "/absent", profile: "kids" })).toMatchObject({ ok: false, reason: "PROJECT_BUILD_KIDS_DENIED" });
 });
 it("refuses altered source/export digest and removes failed destination", () => {
  const f = fixture(); writeFileSync(join(f.root, "exports/web/fixture/index.html"), "tampered");
  expect(buildLocalProject(f.input)).toMatchObject({ ok: false, reason: "LOCAL_PROJECT_BUILD_EXPORT_INVALID" });
  expect(existsSync(join(f.root, "exports/local-linux/fixture"))).toBe(false);
 });
 it("refuses a valid export belonging to an older document", () => {
  const f = fixture(); writeFileSync(join(f.root, "scene.json"), serializeDocument(createDocument({ id: "local-project", data: { changed: true } })));
  expect(buildLocalProject(f.input)).toMatchObject({ ok: false, reason: "LOCAL_PROJECT_BUILD_PROJECT_CHANGED" });
 });
 it("does not follow source, export, destination or root symlinks", () => {
  for (const target of ["scene.json", "exports/web/fixture/index.html", "exports/local-linux"]) {
   const f = fixture(); const p = join(f.root, target);

 if (existsSync(p)) rmSync(p, { recursive: true }); symlinkSync(f.root, p);
   expect(buildLocalProject(f.input)).toMatchObject({ ok: false, reason: "LOCAL_PROJECT_BUILD_UNSAFE_PATH" });
  }

  const f = fixture(); symlinkSync(f.root, join(f.root, "alias"));
  expect(buildLocalProject({ ...f.input, projectRoot: join(f.root, "alias") })).toMatchObject({ ok: false, reason: "LOCAL_PROJECT_BUILD_UNSAFE_PATH" });
 });
 it("verification refuses changed artifacts and forged/extra manifest fields", () => {
  const f = fixture(); const r = buildLocalProject(f.input);

 if (!r.ok) throw new Error(r.reason);
  writeFileSync(join(r.directory, "project/index.html"), "changed");
  expect(verifyLocalProjectBuild({ projectRoot: f.root, name: "fixture" })).toMatchObject({ ok: false, reason: "LOCAL_PROJECT_BUILD_RECEIPT_INVALID" });
 });
 it("enforces a finite byte budget without output", () => {
  const f = fixture(); writeFileSync(join(f.root, "exports/web/fixture/index.html"), Buffer.alloc(128 * 1024 * 1024 + 1));
  expect(buildLocalProject(f.input)).toMatchObject({ ok: false, reason: "LOCAL_PROJECT_BUILD_BUDGET_EXCEEDED" });
  expect(existsSync(join(f.root, "exports/local-linux/fixture"))).toBe(false);
 });
 it("does not call a zero-exit process pixel/document proof", async () => {
  const f = fixture(); expect(buildLocalProject(f.input).ok).toBe(true);
  const executable = join(f.root, "no-proof"); writeFileSync(executable, "#!/bin/sh\nexit 0\n"); chmodSync(executable, 0o700);
  expect(await launchLocalProjectBuild({ projectRoot: f.root, name: "fixture", executable })).toMatchObject({ ok: false, reason: "LOCAL_PROJECT_BUILD_LAUNCH_UNVERIFIED" });
 });
 it("bounds hanging and flooding processes and preserves staged bytes", async () => {
  const f = fixture(); expect(buildLocalProject(f.input).ok).toBe(true);
  const executable = join(f.root, "hanging"); writeFileSync(executable, "#!/bin/sh\nwhile :; do :; done\n"); chmodSync(executable, 0o700);
  expect(await launchLocalProjectBuild({ projectRoot: f.root, name: "fixture", executable, timeoutMs: 40 })).toMatchObject({ ok: false, reason: "LOCAL_PROJECT_BUILD_LAUNCH_TIMEOUT" });
  writeFileSync(executable, "#!/bin/sh\nwhile :; do printf '0123456789'; done\n");
  expect(await launchLocalProjectBuild({ projectRoot: f.root, name: "fixture", executable })).toMatchObject({ ok: false, reason: "LOCAL_PROJECT_BUILD_LAUNCH_OUTPUT_EXCEEDED" });
  expect(verifyLocalProjectBuild({ projectRoot: f.root, name: "fixture" }).ok).toBe(true);
  expect(readdirSync(join(f.root, "exports/local-linux"))).toEqual(["fixture"]);
 });
 it("rolls back an actual final-receipt write failure and permits a clean retry", () => {
  const f = fixture(); fault.receiptWrite = true;
  expect(buildLocalProject(f.input)).toMatchObject({ ok: false, reason: "LOCAL_PROJECT_BUILD_WRITE_FAILED" });
  expect(existsSync(join(f.root, "exports/local-linux/fixture"))).toBe(false);
  expect(readFileSync(join(f.root, "scene.json"), "utf8")).toBe(f.scene);
  fault.receiptWrite = false; expect(buildLocalProject(f.input).ok).toBe(true);
 });
 it("rejects duplicate receipt members, extra files and missing artifact set coverage", () => {
  for (const variant of ["duplicate", "extra", "coverage"]) {
   const f = fixture(); const r = buildLocalProject(f.input);

 if (!r.ok) throw new Error(r.reason);
   const path = join(r.directory, "local-project-build.json"); const text = readFileSync(path, "utf8");

   if (variant === "duplicate") writeFileSync(path, text.replace('{', '{"schemaVersion":1,'));

   if (variant === "extra") writeFileSync(join(r.directory, "unexpected.txt"), "unreceipted");

   if (variant === "coverage") { const receipt = JSON.parse(text); delete receipt.files["project/index.html"]; writeFileSync(path, JSON.stringify(receipt) + "\n"); }

   expect(verifyLocalProjectBuild({ projectRoot: f.root, name: "fixture" })).toMatchObject({ ok: false, reason: "LOCAL_PROJECT_BUILD_RECEIPT_INVALID" });
  }
 });
 it("rejects symlink executables and malformed timeout without spawning", async () => {
  const f = fixture(); expect(buildLocalProject(f.input).ok).toBe(true);
  symlinkSync("/bin/true", join(f.root, "linked"));
  expect(await launchLocalProjectBuild({ projectRoot: f.root, name: "fixture", executable: join(f.root, "linked") })).toMatchObject({ ok: false, reason: "LOCAL_PROJECT_BUILD_UNSAFE_PATH" });
  expect(await launchLocalProjectBuild({ projectRoot: f.root, name: "fixture", executable: "echo bad", timeoutMs: Infinity })).toMatchObject({ ok: false, reason: "LOCAL_PROJECT_BUILD_LAUNCH_FAILED" });
 });

 it.each(["runtime-symlink", "runtime-rewrite", "directory-symlink"])("refuses %s substituted after verification before any spawn", async variant => {
  const f = fixture(); const build = buildLocalProject(f.input);

 if (!build.ok) throw new Error(build.reason);
  const marker = join(f.root, "replacement-executed");
  const replacement = join(f.root, "replacement.cjs");
  writeFileSync(replacement, `require("node:fs").writeFileSync(${JSON.stringify(marker)}, "unsafe runtime executed");\n`);
  fault.afterTemporaryDirectory = () => {
   if (variant === "directory-symlink") {
    rmSync(build.directory, { recursive: true }); symlinkSync(f.root, build.directory);
   } else if (variant === "runtime-symlink") {
    rmSync(join(build.directory, "runtime.cjs")); symlinkSync(replacement, join(build.directory, "runtime.cjs"));
   } else writeFileSync(join(build.directory, "runtime.cjs"), readFileSync(replacement));
  };

  const result = await launchLocalProjectBuild({ projectRoot: f.root, name: "fixture", executable: process.execPath });
  expect(existsSync(marker)).toBe(false);
  expect(fault.spawns).toBe(0);
  expect(result).toMatchObject({ ok: false, reason: variant === "runtime-rewrite" ? "LOCAL_PROJECT_BUILD_RECEIPT_INVALID" : "LOCAL_PROJECT_BUILD_UNSAFE_PATH" });
 });
 it.each(["runtime-rewrite", "runtime-symlink", "directory-symlink", "project-symlink"])("executes only owned bytes after late %s at the spawn boundary", async variant => {
  const f = fixture(); const build = buildLocalProject(f.input);

 if (!build.ok) throw new Error(build.reason);
  const marker = join(f.root, "replacement-executed");
  const trustedRuntime = readFileSync(join(build.directory, "runtime.cjs"));
  const replacement = join(f.root, "replacement.cjs");
  writeFileSync(replacement, `require("node:fs").writeFileSync(${JSON.stringify(marker)}, "unsafe runtime executed");\n`);
  let snapshotRuntime: Buffer | undefined, snapshotDocument: string | undefined, snapshotMode: number | undefined, projectMode: number | undefined, runtimeMode: number | undefined;
  fault.beforeSpawn = () => {
   const owned = fault.temporaryDirectories.at(-1);

 if (!owned) throw new Error("missing launch namespace");
   snapshotRuntime = readFileSync(join(owned, "artifact/runtime.cjs"));
   snapshotDocument = readFileSync(join(owned, "artifact/project/source/scene.json"), "utf8");
   snapshotMode = statSync(join(owned, "artifact")).mode & 0o777;
   projectMode = statSync(join(owned, "artifact/project")).mode & 0o777;
   runtimeMode = statSync(join(owned, "artifact/runtime.cjs")).mode & 0o777;

   if (variant === "runtime-rewrite") writeFileSync(join(build.directory, "runtime.cjs"), readFileSync(replacement));
   else if (variant === "runtime-symlink") {
    rmSync(join(build.directory, "runtime.cjs")); symlinkSync(replacement, join(build.directory, "runtime.cjs"));
   } else {
    const original = variant === "directory-symlink" ? build.directory : join(build.directory, "project");
    rmSync(original, { recursive: true }); symlinkSync(f.root, original);
   }
  };

  const result = await launchLocalProjectBuild({ projectRoot: f.root, name: "fixture", executable: process.execPath });
  expect(existsSync(marker)).toBe(false);
  expect(fault.spawns).toBe(1);
  expect(snapshotRuntime).toEqual(trustedRuntime);
  expect(snapshotDocument).toBe(f.scene);
  expect(snapshotMode).toBe(0o500); expect(projectMode).toBe(0o500); expect(runtimeMode).toBe(0o400);
  // Stock Node cannot load Electron: this is a real-child security negative, not a pixel proof.
  expect(result).toMatchObject({ ok: false, reason: "LOCAL_PROJECT_BUILD_LAUNCH_FAILED" });
 });
 it.each(["artifact-runtime-symlink", "bootstrap-symlink"])("does not execute %s substituted in the owned namespace at spawn", async variant => {
  const f = fixture(); const build = buildLocalProject(f.input);

 if (!build.ok) throw new Error(build.reason);
  const marker = join(f.root, "owned-replacement-executed");
  const replacement = join(f.root, "owned-replacement.cjs");
  writeFileSync(replacement, `require("node:fs").writeFileSync(${JSON.stringify(marker)}, "unsafe runtime executed");\n`);
  fault.beforeSpawn = () => {
   const owned = fault.temporaryDirectories.at(-1);

 if (!owned) throw new Error("missing launch namespace");
   expect(readFileSync(join(owned, "bootstrap.cjs"))).toEqual(readFileSync(join(build.directory, "runtime.cjs")));
   expect(statSync(join(owned, "bootstrap.cjs")).mode & 0o777).toBe(0o400);
   chmodSync(join(owned, "artifact"), 0o700);
   const target = variant === "artifact-runtime-symlink" ? join(owned, "artifact/runtime.cjs") : join(owned, "bootstrap.cjs");
   rmSync(target);
   symlinkSync(replacement, target);
  };

  const result = await launchLocalProjectBuild({ projectRoot: f.root, name: "fixture", executable: process.execPath });
  expect(existsSync(marker)).toBe(false);
  expect(fault.spawns).toBe(1);
  expect(result).toMatchObject({ ok: false, reason: "LOCAL_PROJECT_BUILD_LAUNCH_FAILED" });
  expect(verifyLocalProjectBuild({ projectRoot: f.root, name: "fixture" })).toEqual(build);
 });
 it("refuses an attacker runtime even when its forged receipt digest and byte length match", async () => {
  const f = fixture(); const build = buildLocalProject(f.input);

 if (!build.ok) throw new Error(build.reason);
  const runtime = "throw new Error('not the allowed runtime');\n";
  writeFileSync(join(build.directory, "runtime.cjs"), runtime);
  const receiptPath = join(build.directory, "local-project-build.json");
  const approved = build.receipt.files["runtime.cjs"];

 if (!approved) throw new Error("missing runtime receipt");
  const forged = { digest: `sha256:${createHash("sha256").update(runtime).digest("hex")}`, byteLength: Buffer.byteLength(runtime) };
  writeFileSync(receiptPath, readFileSync(receiptPath, "utf8").replace(JSON.stringify(approved), JSON.stringify(forged)));
  expect(await launchLocalProjectBuild({ projectRoot: f.root, name: "fixture", executable: process.execPath })).toMatchObject({ ok: false, reason: "LOCAL_PROJECT_BUILD_RECEIPT_INVALID" });
  expect(fault.spawns).toBe(0);
 });

 it("cleans a failed snapshot write before spawn without changing the user artifact", async () => {
  const f = fixture(); const build = buildLocalProject(f.input);

 if (!build.ok) throw new Error(build.reason);
  fault.receiptWrite = true;
  expect(await launchLocalProjectBuild({ projectRoot: f.root, name: "fixture", executable: process.execPath })).toMatchObject({ ok: false, reason: "LOCAL_PROJECT_BUILD_LAUNCH_FAILED" });
  expect(fault.spawns).toBe(0);
  expect(verifyLocalProjectBuild({ projectRoot: f.root, name: "fixture" })).toEqual(build);
 });
 it("cleans the sealed snapshot after a synchronous spawn failure", async () => {
  const f = fixture(); const build = buildLocalProject(f.input);

 if (!build.ok) throw new Error(build.reason);
  fault.beforeSpawn = () => { throw new Error("injected spawn failure"); };

  expect(await launchLocalProjectBuild({ projectRoot: f.root, name: "fixture", executable: process.execPath })).toMatchObject({ ok: false, reason: "LOCAL_PROJECT_BUILD_LAUNCH_FAILED" });
  expect(verifyLocalProjectBuild({ projectRoot: f.root, name: "fixture" })).toEqual(build);
 });

});

function isTemporaryDirectory(value: unknown): value is string {
  return typeof value === "string";
}

type LocalBuildHost = NonNullable<Parameters<typeof buildWithHost>[1]>;

const buildLocalProject = (input: Parameters<typeof buildWithHost>[0]) => buildWithHost(input, launchHost);

const launchLocalProjectBuild = (input: Parameters<typeof launchWithHost>[0]) => launchWithHost(input, launchHost);
