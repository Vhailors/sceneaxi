/** Linux-only, unsigned user-project artifact. No editor packaging or release authority. */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { closeSync, constants, fchmodSync, fstatSync, lstatSync, mkdirSync, mkdtempSync, openSync, readSync, readdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { tmpdir } from "node:os";
import { evaluateLocalProjectBuild, parseDeliveryHandoffText, parseDocumentText } from "@sceneaxi/schemas";

export const LOCAL_PROJECT_BUILD_LIMITS = Object.freeze({ files: 256, bytes: 128 * 1024 * 1024, receiptBytes: 128 * 1024, launchOutputBytes: 16 * 1024, launchTimeoutMs: 15_000 });
export const LOCAL_PROJECT_BUILD_REFUSALS = Object.freeze({
  unsafePath: "LOCAL_PROJECT_BUILD_UNSAFE_PATH",
  destinationExists: "LOCAL_PROJECT_BUILD_DESTINATION_EXISTS",
  exportInvalid: "LOCAL_PROJECT_BUILD_EXPORT_INVALID",
  projectChanged: "LOCAL_PROJECT_BUILD_PROJECT_CHANGED",
  budgetExceeded: "LOCAL_PROJECT_BUILD_BUDGET_EXCEEDED",
  writeFailed: "LOCAL_PROJECT_BUILD_WRITE_FAILED",
  receiptInvalid: "LOCAL_PROJECT_BUILD_RECEIPT_INVALID",
  launchFailed: "LOCAL_PROJECT_BUILD_LAUNCH_FAILED",
  launchTimeout: "LOCAL_PROJECT_BUILD_LAUNCH_TIMEOUT",
  launchOutputExceeded: "LOCAL_PROJECT_BUILD_LAUNCH_OUTPUT_EXCEEDED",
  launchUnverified: "LOCAL_PROJECT_BUILD_LAUNCH_UNVERIFIED",
  cleanupFailed: "LOCAL_PROJECT_BUILD_CLEANUP_FAILED",
} as const);
export type LocalProjectBuildRefusal = Readonly<{ ok: false; reason: string; releaseReady: false }>;
export type LocalProjectBuildReceipt = Readonly<{
  schemaVersion: 1;
  kind: "sceneaxi.local-project-build";
  purpose: "local-unsigned";
  target: "linux";
  profile: "game" | "web";
  signed: false;
  releaseReady: false;
  documentId: string;
  documentHash: string;
  exportDigest: string;
  files: Readonly<Record<string, Readonly<{ digest: string; byteLength: number }>>>;
}>;
export type LocalProjectBuildSuccess = Readonly<{ ok: true; directory: string; receipt: LocalProjectBuildReceipt; receiptHash: string }>;
export type LocalProjectBuildResult = LocalProjectBuildSuccess | LocalProjectBuildRefusal;
export type LocalProjectBuildInput = Readonly<{ projectRoot: string; exportPath: string; name: string; profile: unknown; purpose: unknown; target: unknown }>;
const refuse = (reason: string): LocalProjectBuildRefusal => Object.freeze({ ok: false, reason, releaseReady: false });
const digest = (bytes: string | Uint8Array) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
const fdPath = (fd: number) => `/proc/self/fd/${String(fd)}`;
const safeName = (name: string) => typeof name === "string" && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(name);
function parts(path: string): string[] {
  const values = path.split("/");
  if (values.length > 16 || values.some(v => !v || v === "." || v === ".." || v.includes("\\") || Array.from(v).some(c => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127))) throw new Error(LOCAL_PROJECT_BUILD_REFUSALS.unsafePath);
  return values;
}
function directory(parent: number, name: string, create = false): number {
  if (create) { try { mkdirSync(join(fdPath(parent), name), { mode: 0o700 }); } catch (e) { if (!(e instanceof Error && "code" in e && e.code === "EEXIST")) throw e; } }
  return openSync(`${fdPath(parent)}/${name}`, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
}
function rootDirectory(path: string): number {
  if (!isAbsolute(path)) throw new Error(LOCAL_PROJECT_BUILD_REFUSALS.unsafePath);
  let fd = openSync("/", constants.O_RDONLY | constants.O_DIRECTORY);
  try { for (const name of parts(path.slice(1))) { const next = directory(fd, name); closeSync(fd); fd = next; } return fd; }
  catch (e) { closeSync(fd); throw e; }
}
function walkDirectory(root: number, path: string, create = false): number {
  let fd = directory(root, ".");
  try { for (const name of parts(path)) { const next = directory(fd, name, create); closeSync(fd); fd = next; } return fd; }
  catch (e) { closeSync(fd); throw e; }
}
function read(root: number, path: string, max = LOCAL_PROJECT_BUILD_LIMITS.bytes): Buffer {
  const names = parts(path); const name = names.pop(); if (!name) throw new Error(LOCAL_PROJECT_BUILD_REFUSALS.unsafePath);
  const parent = names.length ? walkDirectory(root, names.join("/")) : directory(root, ".");
  let fd: number | undefined;
  try {
    fd = openSync(join(fdPath(parent), name), constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    const stat = fstatSync(fd);
    if (!stat.isFile()) throw new Error(LOCAL_PROJECT_BUILD_REFUSALS.unsafePath);
    if (stat.size > max) throw new Error(LOCAL_PROJECT_BUILD_REFUSALS.budgetExceeded);
    const bytes = Buffer.alloc(stat.size);
    let offset = 0;
    while (offset < bytes.length) {
      const count = readSync(fd, bytes, offset, bytes.length - offset, null);
      if (count === 0) throw new Error(LOCAL_PROJECT_BUILD_REFUSALS.projectChanged);
      offset += count;
    }
    if (readSync(fd, Buffer.alloc(1), 0, 1, null) !== 0) throw new Error(LOCAL_PROJECT_BUILD_REFUSALS.projectChanged);
    const after = fstatSync(fd);
    if (bytes.length > max) throw new Error(LOCAL_PROJECT_BUILD_REFUSALS.budgetExceeded);
    if (stat.size !== bytes.length || stat.size !== after.size || stat.mtimeMs !== after.mtimeMs || stat.ctimeMs !== after.ctimeMs) throw new Error(LOCAL_PROJECT_BUILD_REFUSALS.projectChanged);
    return bytes;
  } finally { if (fd !== undefined) closeSync(fd); closeSync(parent); }
}
function write(root: number, path: string, bytes: string | Uint8Array): void {
  const names = parts(path); const name = names.pop(); if (!name) throw new Error(LOCAL_PROJECT_BUILD_REFUSALS.unsafePath);
  const parent = names.length ? walkDirectory(root, names.join("/"), true) : directory(root, ".");
  try { writeFileSync(join(fdPath(parent), name), bytes, { flag: "wx", mode: 0o600 }); } finally { closeSync(parent); }
}
function failure(error: unknown, fallback: string): LocalProjectBuildRefusal {
  if (error instanceof Error && Object.values(LOCAL_PROJECT_BUILD_REFUSALS).some(v => v === error.message)) return refuse(error.message);
  if (error instanceof Error && "code" in error && (error.code === "ELOOP" || error.code === "ENOTDIR")) return refuse(LOCAL_PROJECT_BUILD_REFUSALS.unsafePath);
  return refuse(fallback);
}

/** Standalone runtime opens only the exported user project; smoke success requires real pixels. */
const RUNTIME = `"use strict";
const { app, BrowserWindow, session } = require("electron");
const fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto");
const hash = bytes => "sha256:" + crypto.createHash("sha256").update(bytes).digest("hex");
const root = process.argv[process.argv.indexOf("--sceneaxi-local-root") + 1];
const expected = process.argv[process.argv.indexOf("--sceneaxi-local-receipt") + 1];
let timer;
const finish = code => { clearTimeout(timer); app.exit(code); };
timer = setTimeout(() => finish(72), 12000);
app.whenReady().then(async () => {
  const bytes = fs.readFileSync(path.join(root, "local-project-build.json"));
  if (hash(bytes) !== expected) return finish(73);
  const manifest = JSON.parse(bytes);
  for (const [name, file] of Object.entries(manifest.files)) {
    const value = fs.readFileSync(path.join(root, name));
    if (value.length !== file.byteLength || hash(value) !== file.digest) return finish(73);
  }
  session.defaultSession.webRequest.onBeforeRequest((request, done) => {
    const url = new URL(request.url);
    done({ cancel: url.protocol !== "file:" || !decodeURIComponent(url.pathname).startsWith(root + "/project/") });
  });
  const win = new BrowserWindow({ width: 1100, height: 800, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, webSecurity: true } });
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", event => event.preventDefault());
  await win.loadFile(path.join(root, "project/index.html"));
  const wanted = manifest.documentHash;
  let rendered = false;
  for (let i = 0; i < 100; i++) {
    rendered = await win.webContents.executeJavaScript(${JSON.stringify('document.querySelector("meta[name=sceneaxi-pixels-drawn]")?.content === "true" && document.querySelector("meta[name=sceneaxi-source-project-digest]")?.content === ')} + JSON.stringify(wanted));
    if (rendered) break;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  if (!rendered) return finish(74);
  const capture = await win.webContents.capturePage();
  const bitmap = capture.toBitmap();
  const colors = new Set();
  for (let i = 0; i + 3 < bitmap.length; i += 4) { colors.add(bitmap.readUInt32LE(i)); if (colors.size >= 16) break; }
  if (colors.size < 16) return finish(75);
  const png = capture.toPNG();
  if (png.length < 100 || png.subarray(0,8).toString("hex") !== "89504e470d0a1a0a") return finish(75);
  const capturePath = process.argv[process.argv.indexOf("--sceneaxi-local-capture") + 1];
  fs.writeFileSync(capturePath, png, { flag: "wx", mode: 0o600 });
  console.log("SCENEAXI_LOCAL_PROJECT_SMOKE " + JSON.stringify({ schemaVersion: 1, receiptHash: expected, documentHash: wanted, pixelsDrawn: true, pngHash: hash(png), pngBytes: png.length }));
  finish(0);
}).catch(() => finish(76));
app.on("window-all-closed", () => finish(77));
`;

export function buildLocalProject(input: LocalProjectBuildInput): LocalProjectBuildResult {
  const policy = evaluateLocalProjectBuild({ purpose: input.purpose, target: input.target, profile: input.profile, host: process.platform });
  if (!policy.ok) return refuse(policy.reason);
  if (!safeName(input.name) || typeof input.exportPath !== "string" || !input.exportPath.startsWith("exports/web/")) return refuse(LOCAL_PROJECT_BUILD_REFUSALS.unsafePath);
  let root: number | undefined, source: number | undefined, parent: number | undefined, stage: number | undefined;
  let created = false;
  try {
    parts(input.exportPath);
    root = rootDirectory(input.projectRoot); source = walkDirectory(root, input.exportPath);
    const documentBytes = read(root, "scene.json"); const document = parseDocumentText(documentBytes.toString("utf8"));
    const handoffBytes = read(source, "delivery-handoff.json", LOCAL_PROJECT_BUILD_LIMITS.receiptBytes);
    const handoff = parseDeliveryHandoffText(handoffBytes.toString("utf8"));
    if (!document.ok || !handoff.ok || handoff.handoff.target !== "web" || handoff.handoff.product.id !== document.document.id) return refuse(LOCAL_PROJECT_BUILD_REFUSALS.exportInvalid);
    const artifacts = handoff.handoff.artifacts;
    const paths = Object.keys(artifacts).sort();
    if (paths.length > LOCAL_PROJECT_BUILD_LIMITS.files || !paths.includes("index.html") || !paths.includes("source/scene.json")) return refuse(LOCAL_PROJECT_BUILD_REFUSALS.exportInvalid);
    const files: Record<string, { digest: string; byteLength: number }> = {};
    let total = Buffer.byteLength(RUNTIME) + handoffBytes.length;
    // Validate all bytes before creating a destination, then revalidate while copying.
    for (const path of paths) {
      const bytes = read(source, path); total += bytes.length;
      if (total > LOCAL_PROJECT_BUILD_LIMITS.bytes) return refuse(LOCAL_PROJECT_BUILD_REFUSALS.budgetExceeded);
      if (digest(bytes) !== artifacts[path]?.digest) return refuse(LOCAL_PROJECT_BUILD_REFUSALS.exportInvalid);
      if (path === "source/scene.json" && !bytes.equals(documentBytes)) return refuse(LOCAL_PROJECT_BUILD_REFUSALS.projectChanged);
      files[`project/${path}`] = { digest: digest(bytes), byteLength: bytes.length };
    }
    parent = walkDirectory(root, "exports/local-linux", true);
    try { mkdirSync(join(fdPath(parent), input.name), { mode: 0o700 }); created = true; }
    catch (e) { if (e instanceof Error && "code" in e && e.code === "EEXIST") return refuse(LOCAL_PROJECT_BUILD_REFUSALS.destinationExists); throw e; }
    stage = directory(parent, input.name);
    for (const path of paths) {
      const bytes = read(source, path);
      if (digest(bytes) !== files[`project/${path}`]?.digest) throw new Error(LOCAL_PROJECT_BUILD_REFUSALS.projectChanged);
      write(stage, `project/${path}`, bytes);
    }
    write(stage, "project/delivery-handoff.json", handoffBytes);
    files["project/delivery-handoff.json"] = { digest: digest(handoffBytes), byteLength: handoffBytes.length };
    write(stage, "runtime.cjs", RUNTIME);
    files["runtime.cjs"] = { digest: digest(RUNTIME), byteLength: Buffer.byteLength(RUNTIME) };
    if (!read(root, "scene.json").equals(documentBytes)) throw new Error(LOCAL_PROJECT_BUILD_REFUSALS.projectChanged);
    const receipt: LocalProjectBuildReceipt = Object.freeze({ schemaVersion: 1, kind: "sceneaxi.local-project-build", purpose: "local-unsigned", target: "linux", profile: input.profile === "game" ? "game" : "web", signed: false, releaseReady: false, documentId: document.document.id, documentHash: digest(documentBytes), exportDigest: handoff.handoff.artifactSetDigest, files: Object.freeze(files) });
    if (realpathSync(fdPath(stage)) !== join(input.projectRoot, "exports/local-linux", input.name)) throw new Error(LOCAL_PROJECT_BUILD_REFUSALS.unsafePath);
    const receiptBytes = `${JSON.stringify(receipt)}\n`; write(stage, "local-project-build.json", receiptBytes);
    created = false;
    return Object.freeze({ ok: true, directory: join(input.projectRoot, "exports/local-linux", input.name), receipt, receiptHash: digest(receiptBytes) });
  } catch (e) { return failure(e, LOCAL_PROJECT_BUILD_REFUSALS.writeFailed); }
  finally {
    if (created && parent !== undefined && stage !== undefined) {
      const path = join(fdPath(parent), input.name);
      // Never remove a substituted destination after a concurrent rename.
      const original = fstatSync(stage);
      const current = lstatSync(path, { throwIfNoEntry: false });
      if (current?.isDirectory() && current.dev === original.dev && current.ino === original.ino) rmSync(path, { recursive: true, force: true });
    }
    if (stage !== undefined) closeSync(stage);
    for (const fd of [source, parent, root]) if (fd !== undefined) closeSync(fd);
  }
}

export function verifyLocalProjectBuild(input: Readonly<{ projectRoot: string; name: string }>): LocalProjectBuildResult {
  if (process.platform !== "linux") return refuse("PROJECT_BUILD_HOST_UNSUPPORTED");
  if (!safeName(input.name)) return refuse(LOCAL_PROJECT_BUILD_REFUSALS.unsafePath);
  let root: number | undefined, stage: number | undefined;
  try {
    root = rootDirectory(input.projectRoot); stage = walkDirectory(root, `exports/local-linux/${input.name}`);
    return verifyBuildDirectory(stage, input);
  } catch (e) { return failure(e, LOCAL_PROJECT_BUILD_REFUSALS.receiptInvalid); }
  finally { for (const fd of [stage, root]) if (fd !== undefined) closeSync(fd); }
}
/** Validate a pinned directory; copying admits only receipt-bound bytes, never later pathname reads. */
function verifyBuildDirectory(stage: number, input: Readonly<{ projectRoot: string; name: string }>, copyTo?: number): LocalProjectBuildResult {
  const bytes = read(stage, "local-project-build.json", LOCAL_PROJECT_BUILD_LIMITS.receiptBytes);
  const text = bytes.toString("utf8");
  const value: unknown = JSON.parse(text);
  // The generated canonical encoding is part of this new receipt contract.
  // Reject duplicate JSON members, noncanonical encodings and trailing data.
  if (`${JSON.stringify(value)}\n` !== text) return refuse(LOCAL_PROJECT_BUILD_REFUSALS.receiptInvalid);
  if (!validReceipt(value)) return refuse(LOCAL_PROJECT_BUILD_REFUSALS.receiptInvalid);
  let total = 0;
  for (const [path, file] of Object.entries(value.files)) {
    const data = read(stage, path); total += data.length;
    if (total > LOCAL_PROJECT_BUILD_LIMITS.bytes || data.length !== file.byteLength || digest(data) !== file.digest) return refuse(LOCAL_PROJECT_BUILD_REFUSALS.receiptInvalid);
    if (copyTo !== undefined) write(copyTo, path, data);
  }
  if (value.files["runtime.cjs"]?.digest !== digest(RUNTIME) || value.files["project/source/scene.json"]?.digest !== value.documentHash) return refuse(LOCAL_PROJECT_BUILD_REFUSALS.receiptInvalid);
  const doc = parseDocumentText(read(stage, "project/source/scene.json").toString("utf8"));
  const handoff = parseDeliveryHandoffText(read(stage, "project/delivery-handoff.json", LOCAL_PROJECT_BUILD_LIMITS.receiptBytes).toString("utf8"));
  if (!doc.ok || doc.document.id !== value.documentId || !handoff.ok || handoff.handoff.target !== "web" || handoff.handoff.product.id !== value.documentId || handoff.handoff.artifactSetDigest !== value.exportDigest) return refuse(LOCAL_PROJECT_BUILD_REFUSALS.receiptInvalid);
  const artifactPaths = Object.keys(handoff.handoff.artifacts).map(path => `project/${path}`).sort();
  const stagedPaths = Object.keys(value.files).filter(path => path !== "runtime.cjs" && path !== "project/delivery-handoff.json").sort();
  if (JSON.stringify(artifactPaths) !== JSON.stringify(stagedPaths) || artifactPaths.some(path => value.files[path]?.digest !== handoff.handoff.artifacts[path.slice("project/".length)]?.digest)) return refuse(LOCAL_PROJECT_BUILD_REFUSALS.receiptInvalid);
  const expected = ["local-project-build.json", ...Object.keys(value.files)].sort();
  if (JSON.stringify(listFiles(stage).sort()) !== JSON.stringify(expected)) return refuse(LOCAL_PROJECT_BUILD_REFUSALS.receiptInvalid);
  if (copyTo !== undefined) write(copyTo, "local-project-build.json", bytes);
  return Object.freeze({ ok: true, directory: join(input.projectRoot, "exports/local-linux", input.name), receipt: value, receiptHash: digest(bytes) });
}
function record(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function validReceipt(value: unknown): value is LocalProjectBuildReceipt {
  if (!record(value) || Object.keys(value).sort().join(",") !== "documentHash,documentId,exportDigest,files,kind,profile,purpose,releaseReady,schemaVersion,signed,target" || value.schemaVersion !== 1 || value.kind !== "sceneaxi.local-project-build" || value.purpose !== "local-unsigned" || value.target !== "linux" || !["game", "web"].includes(String(value.profile)) || value.signed !== false || value.releaseReady !== false || typeof value.documentId !== "string" || value.documentId.length > 256 || typeof value.documentHash !== "string" || !/^sha256:[0-9a-f]{64}$/.test(value.documentHash) || typeof value.exportDigest !== "string" || !/^sha256:[0-9a-f]{64}$/.test(value.exportDigest) || !record(value.files)) return false;
  const entries = Object.entries(value.files);
  if (entries.length > LOCAL_PROJECT_BUILD_LIMITS.files + 2 || !value.files["project/index.html"] || !value.files["runtime.cjs"]) return false;
  return entries.every(([path, file]) => (path.startsWith("project/") || path === "runtime.cjs") && record(file) && Object.keys(file).sort().join(",") === "byteLength,digest" && typeof file.digest === "string" && /^sha256:[0-9a-f]{64}$/.test(file.digest) && typeof file.byteLength === "number" && Number.isSafeInteger(file.byteLength) && file.byteLength >= 0 && file.byteLength <= LOCAL_PROJECT_BUILD_LIMITS.bytes);
}
function listFiles(root: number, prefix = "", depth = 0, budget = { entries: 0 }): string[] {
  if (depth > 16) throw new Error(LOCAL_PROJECT_BUILD_REFUSALS.budgetExceeded);
  const result: string[] = [];
  for (const entry of readdirSync(fdPath(root), { withFileTypes: true })) {
    if (++budget.entries > LOCAL_PROJECT_BUILD_LIMITS.files * 16) throw new Error(LOCAL_PROJECT_BUILD_REFUSALS.budgetExceeded);
    if (entry.isSymbolicLink()) throw new Error(LOCAL_PROJECT_BUILD_REFUSALS.unsafePath);
    const path = `${prefix}${entry.name}`;
    if (entry.isDirectory()) { const fd = directory(root, entry.name); try { result.push(...listFiles(fd, `${path}/`, depth + 1, budget)); } finally { closeSync(fd); } }
    else if (entry.isFile()) result.push(path);
    else throw new Error(LOCAL_PROJECT_BUILD_REFUSALS.unsafePath);
    if (result.length > LOCAL_PROJECT_BUILD_LIMITS.files + 3) throw new Error(LOCAL_PROJECT_BUILD_REFUSALS.budgetExceeded);
  }
  return result;
}

/** Snapshot files have no open writable handles and no write permission while the child runs.
 * This protects against untrusted project-path substitution, not hostile same-UID/root processes.
 */
function snapshotPermissions(root: number, writable: boolean): void {
  if (writable) fchmodSync(root, 0o700);
  for (const entry of readdirSync(fdPath(root), { withFileTypes: true })) {
    if (entry.isDirectory()) {
      const fd = directory(root, entry.name);
      try { snapshotPermissions(fd, writable); } finally { closeSync(fd); }
    } else if (!writable) {
      if (!entry.isFile()) throw new Error(LOCAL_PROJECT_BUILD_REFUSALS.unsafePath);
      const fd = openSync(join(fdPath(root), entry.name), constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
      try { if (!fstatSync(fd).isFile()) throw new Error(LOCAL_PROJECT_BUILD_REFUSALS.unsafePath); fchmodSync(fd, 0o400); }
      finally { closeSync(fd); }
    }
    // Cleanup needs writable directories only. Never reopen a substituted file
    // or follow a symlink just to remove entries from our owned namespace.
  }
  if (!writable) fchmodSync(root, 0o500);
}

export type LocalProjectLaunchInput = Readonly<{ projectRoot: string; name: string; executable: string; timeoutMs?: number }>;
export type LocalProjectLaunchSuccess = Readonly<{ ok: true; exitCode: 0; documentHash: string; receiptHash: string; pixelsDrawn: true; pngHash: string; pngBytes: number; png: Uint8Array; releaseReady: false }>;
/** Resolves only after verified smoke evidence AND exact child exit 0, never a fake handshake. */
export async function launchLocalProjectBuild(input: LocalProjectLaunchInput): Promise<LocalProjectLaunchSuccess | LocalProjectBuildRefusal> {
  const build = verifyLocalProjectBuild(input); if (!build.ok) return build;
  const timeoutMs = input.timeoutMs ?? LOCAL_PROJECT_BUILD_LIMITS.launchTimeoutMs;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > LOCAL_PROJECT_BUILD_LIMITS.launchTimeoutMs || !isAbsolute(input.executable)) return refuse(LOCAL_PROJECT_BUILD_REFUSALS.launchFailed);
  let parent: number | undefined, executable: number | undefined;
  try {
    const names = parts(input.executable.slice(1)); const name = names.pop(); if (!name) throw new Error("executable");
    parent = rootDirectory(`/${names.join("/")}`); executable = openSync(join(fdPath(parent), name), constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    if (!fstatSync(executable).isFile() || (fstatSync(executable).mode & 0o111) === 0) throw new Error("executable");
  } catch (e) { if (executable !== undefined) closeSync(executable); if (parent !== undefined) closeSync(parent); return failure(e, LOCAL_PROJECT_BUILD_REFUSALS.launchFailed); }
  let evidenceDirectory: string | undefined, evidenceDescriptor: number | undefined, snapshot: number | undefined, bootstrap: number | undefined;
  let snapshotDirectory: string;
  const cleanup = () => {
    let error: unknown;
    if (bootstrap !== undefined) { closeSync(bootstrap); bootstrap = undefined; }
    try {
      if (snapshot !== undefined) {
        try { snapshotPermissions(snapshot, true); } finally { closeSync(snapshot); snapshot = undefined; }
      }
    } catch (e) { error = e; }
    try {
      if (evidenceDescriptor !== undefined && evidenceDirectory !== undefined) {
        try {
          const original = fstatSync(evidenceDescriptor);
          const current = lstatSync(evidenceDirectory, { throwIfNoEntry: false });
          if (!current?.isDirectory() || current.dev !== original.dev || current.ino !== original.ino) throw new Error(LOCAL_PROJECT_BUILD_REFUSALS.cleanupFailed);
          rmSync(evidenceDirectory, { recursive: true, force: true });
        } finally { closeSync(evidenceDescriptor); evidenceDescriptor = undefined; }
      }
    } catch (e) { error ??= e; }
    if (error !== undefined) throw error;
  };
  try {
    evidenceDirectory = mkdtempSync(join(tmpdir(), "sceneaxi-local-launch-"));
    evidenceDescriptor = rootDirectory(evidenceDirectory);
    const owner = fstatSync(evidenceDescriptor);
    if (!owner.isDirectory() || owner.uid !== process.getuid?.() || (owner.mode & 0o077) !== 0) throw new Error(LOCAL_PROJECT_BUILD_REFUSALS.unsafePath);
    // No user-controlled path is used by the executable. Copy into a fresh private namespace,
    // using pinned source descriptors and validating every byte before the first spawn.
    mkdirSync(join(fdPath(evidenceDescriptor), "artifact"), { mode: 0o700 });
    snapshot = directory(evidenceDescriptor, "artifact");
    const sourceRoot = rootDirectory(input.projectRoot);
    let source: number | undefined;
    try {
      source = walkDirectory(sourceRoot, `exports/local-linux/${input.name}`);
      const copied = verifyBuildDirectory(source, input, snapshot);
      if (!copied.ok) throw new Error(copied.reason);
      if (copied.receiptHash !== build.receiptHash) throw new Error(LOCAL_PROJECT_BUILD_REFUSALS.receiptInvalid);
      const sealed = verifyBuildDirectory(snapshot, input);
      if (!sealed.ok || sealed.receiptHash !== build.receiptHash) throw new Error(LOCAL_PROJECT_BUILD_REFUSALS.receiptInvalid);
    } finally { if (source !== undefined) closeSync(source); closeSync(sourceRoot); }
    snapshotPermissions(snapshot, false);
    snapshotDirectory = realpathSync(fdPath(snapshot));
    // The entrypoint is generated trusted code, never a later pathname lookup in
    // the artifact. Acquire its read handle from the exclusive writer descriptor,
    // so even replacing artifact/runtime.cjs cannot select executable code.
    const writer = openSync(join(fdPath(evidenceDescriptor), "bootstrap.cjs"), constants.O_CREAT | constants.O_EXCL | constants.O_RDWR | constants.O_NOFOLLOW, 0o600);
    try {
      writeFileSync(writer, RUNTIME);
      fchmodSync(writer, 0o400);
      bootstrap = openSync(fdPath(writer), constants.O_RDONLY);
      const stat = fstatSync(bootstrap);
      const bytes = Buffer.alloc(Buffer.byteLength(RUNTIME));
      if (!stat.isFile() || stat.nlink !== 1 || stat.uid !== owner.uid || stat.size !== bytes.length || readSync(bootstrap, bytes, 0, bytes.length, 0) !== bytes.length || digest(bytes) !== digest(RUNTIME)) throw new Error(LOCAL_PROJECT_BUILD_REFUSALS.receiptInvalid);
    } finally { closeSync(writer); }
  } catch (e) {
    if (executable !== undefined) closeSync(executable); if (parent !== undefined) closeSync(parent);
    try { cleanup(); } catch { return refuse(LOCAL_PROJECT_BUILD_REFUSALS.cleanupFailed); }
    return failure(e, LOCAL_PROJECT_BUILD_REFUSALS.launchFailed);
  }
  // Keep descriptors alive through child close. Child fd5 is the verified bootstrap;
  // fd4 pins our owned snapshot. The private canonical root supports Electron file URLs.
  // Ownership/modes are not a sandbox against a compromised same-UID process.
  const captureDirectory = evidenceDirectory;
  const captureDescriptor = evidenceDescriptor;
  return new Promise(resolve => {
    let output = "", size = 0, terminal: string | undefined, settled = false;
    let child: ReturnType<typeof spawn>;
    try {
      child = spawn("/proc/self/fd/3", ["/proc/self/fd/5", "--sceneaxi-local-root", snapshotDirectory, "--sceneaxi-local-receipt", build.receiptHash, "--sceneaxi-local-capture", join(captureDirectory, "capture.png")], { shell: false, detached: true, cwd: snapshotDirectory, env: { NODE_ENV: "production", PATH: "/usr/bin:/bin", HOME: process.env.HOME, DISPLAY: process.env.DISPLAY, XAUTHORITY: process.env.XAUTHORITY, DBUS_SESSION_BUS_ADDRESS: process.env.DBUS_SESSION_BUS_ADDRESS }, stdio: ["ignore", "pipe", "pipe", executable, snapshot, bootstrap] });
    } catch {
      if (executable !== undefined) closeSync(executable); if (parent !== undefined) closeSync(parent);
      try { cleanup(); resolve(refuse(LOCAL_PROJECT_BUILD_REFUSALS.launchFailed)); } catch { resolve(refuse(LOCAL_PROJECT_BUILD_REFUSALS.cleanupFailed)); }
      return;
    }
    if (executable !== undefined) closeSync(executable); if (parent !== undefined) closeSync(parent);
    const kill = () => { if (child.pid) { try { process.kill(-child.pid, "SIGKILL"); } catch { child.kill("SIGKILL"); } } };
    const timer = setTimeout(() => { terminal ??= LOCAL_PROJECT_BUILD_REFUSALS.launchTimeout; kill(); }, timeoutMs);
    const finish = (result: LocalProjectLaunchSuccess | LocalProjectBuildRefusal) => {
      if (settled) return;
      settled = true; clearTimeout(timer);
      try { cleanup(); }
      catch { resolve(refuse(LOCAL_PROJECT_BUILD_REFUSALS.cleanupFailed)); return; }
      resolve(result);
    };
    const collect = (chunk: Buffer, stdout: boolean) => { size += chunk.length; if (size > LOCAL_PROJECT_BUILD_LIMITS.launchOutputBytes) { terminal ??= LOCAL_PROJECT_BUILD_REFUSALS.launchOutputExceeded; kill(); } else if (stdout) output += chunk.toString("utf8"); };
    child.stdout?.on("data", (chunk: Buffer) => collect(chunk, true)); child.stderr?.on("data", (chunk: Buffer) => collect(chunk, false));
    child.on("error", () => finish(refuse(LOCAL_PROJECT_BUILD_REFUSALS.launchFailed)));
    child.on("close", code => {
      if (terminal) return finish(refuse(terminal));
      if (code !== 0) return finish(refuse(LOCAL_PROJECT_BUILD_REFUSALS.launchFailed));
      const lines = output.split("\n").filter(line => line.startsWith("SCENEAXI_LOCAL_PROJECT_SMOKE "));
      try {
        if (lines.length !== 1) return finish(refuse(LOCAL_PROJECT_BUILD_REFUSALS.launchUnverified));
        const line = lines[0]; if (line === undefined) return finish(refuse(LOCAL_PROJECT_BUILD_REFUSALS.launchUnverified));
        const proof: unknown = JSON.parse(line.slice("SCENEAXI_LOCAL_PROJECT_SMOKE ".length));
        if (!record(proof) || Object.keys(proof).sort().join(",") !== "documentHash,pixelsDrawn,pngBytes,pngHash,receiptHash,schemaVersion" || proof.schemaVersion !== 1 || proof.receiptHash !== build.receiptHash || proof.documentHash !== build.receipt.documentHash || proof.pixelsDrawn !== true || typeof proof.pngHash !== "string" || !/^sha256:[0-9a-f]{64}$/.test(proof.pngHash) || typeof proof.pngBytes !== "number" || !Number.isSafeInteger(proof.pngBytes) || proof.pngBytes < 100) return finish(refuse(LOCAL_PROJECT_BUILD_REFUSALS.launchUnverified));
        const png = read(captureDescriptor, "capture.png", 8 * 1024 * 1024);
        if (png.length !== proof.pngBytes || digest(png) !== proof.pngHash || png.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") return finish(refuse(LOCAL_PROJECT_BUILD_REFUSALS.launchUnverified));
        const stillValid = verifyLocalProjectBuild(input); if (!stillValid.ok || stillValid.receiptHash !== build.receiptHash) return finish(refuse(LOCAL_PROJECT_BUILD_REFUSALS.receiptInvalid));
        finish(Object.freeze({ ok: true, exitCode: 0, documentHash: build.receipt.documentHash, receiptHash: build.receiptHash, pixelsDrawn: true, pngHash: proof.pngHash, pngBytes: proof.pngBytes, png: new Uint8Array(png), releaseReady: false }));
      } catch { finish(refuse(LOCAL_PROJECT_BUILD_REFUSALS.launchUnverified)); }
    });
  });
}
