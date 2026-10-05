import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import type { Worker } from "node:worker_threads";
import { fileURLToPath } from "node:url";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { apply, composeScene, createDocument, parseDocumentText, reconstructSculpt, writeDocumentFile } from "@sceneaxi/authoring-core";
import { identitySculptTransform } from "@sceneaxi/schemas";
import { PROJECT_ASSET_MAX_BYTES, PROJECT_ASSET_MANIFEST_KEY, proposeProjectAssetImport } from "@sceneaxi/importers";

import { createDesktopBridge, type DesktopBridge } from "@sceneaxi/desktop-linux";

const bridges: DesktopBridge[] = [];

// Test source resolution only; production launches the tsc-built sibling worker entry.
// Every test still uses real Node Worker/terminate and the actual importer source.
const transport = vi.hoisted(() => {
  const workers: Worker[] = [];
  const errors: Error[] = [];
  const hooks: { onMessage: (() => void) | null; entry: string; loader: string } = { onMessage: null, entry: "", loader: "" };

  return { workers, hooks, errors };
});
vi.mock("node:worker_threads", async importOriginal => {
  const actual = await importOriginal<typeof import("node:worker_threads")>();

  return { ...actual, Worker: class extends actual.Worker {
    constructor(_url: ConstructorParameters<typeof Worker>[0], options: ConstructorParameters<typeof Worker>[1]) {
      super(transport.hooks.entry, { ...options, execArgv: ["--experimental-transform-types", "--import", transport.hooks.loader] });
      transport.workers.push(this);
      this.once("error", error => transport.errors.push(error instanceof Error ? error : new Error(String(error))));
      this.once("message", () => transport.hooks.onMessage?.());
    }
  } };
});
const roots: string[] = [];
let compilation = "";
let realEntry = "";
beforeAll(() => {
  compilation = mkdtempSync(join(tmpdir(), "sceneaxi-worker-source-"));
  realEntry = fileURLToPath(new URL("../../../packages/importers/src/asset-preparation-worker.ts", import.meta.url));
  transport.hooks.loader = join(compilation, "source-loader.mjs");
  // Node's stock type stripping executes actual source. A test-only resolve hook
  // maps workspace names/.js references exactly as the built runtime resolver does.
  writeFileSync(transport.hooks.loader, `
    import {registerHooks} from "node:module";
    import {existsSync} from "node:fs";
    import {join} from "node:path";
    import {fileURLToPath,pathToFileURL} from "node:url";
    const root=${JSON.stringify(process.cwd())};
    registerHooks({resolve(specifier,context,next){
      if(specifier.startsWith("@sceneaxi/")) {
        const [name,...rest]=specifier.slice(10).split("/");
        specifier=pathToFileURL(join(root,"packages",name,"src",rest.length?rest.join("/")+".ts":"index.ts")).href;
      } else if(specifier.endsWith(".js") && context.parentURL) {
        const url=new URL(specifier,context.parentURL);
        if(url.protocol==="file:") {
          const source=fileURLToPath(url).slice(0,-3)+".ts";
          if(existsSync(source)) specifier=pathToFileURL(source).href;
        }
      }
      return next(specifier,context);
    }});
  `);
  transport.hooks.entry = realEntry;
});
afterEach(async () => {
  for (const bridge of bridges.splice(0)) expect(bridge.close()).toBe(true);
  vi.useRealTimers();
  transport.hooks.onMessage = null;
  transport.errors.splice(0);
  transport.hooks.entry = realEntry;

  for (const worker of transport.workers.splice(0)) {
    expect(worker.threadId).toBe(-1); // Terminal acknowledgement means an exited worker.
    await worker.terminate();
  }

  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});
afterAll(() => rmSync(compilation, { recursive: true, force: true }));

function fixture(size = 64 * 1024) {
  const root = mkdtempSync(join(tmpdir(), "sceneaxi-worker-project-")); roots.push(root);
  const artifact = reconstructSculpt({ schemaVersion: 1, kind: "sceneaxi.sculpt-intake", intakeId: "starter",
    mode: "structured-spec", structuredSpec: { schemaVersion: 1, kind: "sceneaxi.object-sculpt-spec",
      id: "starter-spec", rootNodeId: "starter-node",
      components: [{ id: "box", primitive: "box", dimensions: [1, 1, 1], materialId: "material" }],
      materials: [{ id: "material", baseColor: "#888888", metallic: 0, roughness: 1 }], sockets: [],
      hierarchy: [{ id: "starter-node", parentId: null, componentId: "box", transform: identitySculptTransform() }] } });

  if (!artifact.ok) throw new Error(artifact.message);
  const scene = composeScene({ schemaVersion: 1, kind: "sceneaxi.scene-composition-intake", sceneId: "import-scene",
    rootInstanceId: "root", placements: [{ instanceId: "root", artifactId: artifact.artifact.artifactId,
      parentInstanceId: null, transform: identitySculptTransform() },
      { instanceId: "child", artifactId: artifact.artifact.artifactId, parentInstanceId: "root",
        transform: { ...identitySculptTransform(), translation: [2, 0, 0] } }] }, [artifact.artifact]);

  if (!scene.ok) throw new Error(scene.message);
  expect(writeDocumentFile("scene.json", createDocument({ id: "import-project", data: scene.document.data }), { cwd: root }).ok).toBe(true);
  const positions = Buffer.from(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]).buffer);
  const json = Buffer.from(JSON.stringify({ asset: { version: "2.0" },
    buffers: [{ byteLength: 36, uri: "data:application/octet-stream;base64," + positions.toString("base64") }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 36 }],
    accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: "VEC3", min: [0, 0, 0], max: [1, 1, 0] }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, mode: 4 }] }], nodes: [{ mesh: 0 }], scenes: [{ nodes: [0] }], scene: 0 }));
  const source = Buffer.concat([json, Buffer.alloc(Math.max(0, size - json.byteLength), 0x20)]);
  const sourcePath = join(root, "triangle.gltf"); writeFileSync(sourcePath, source);

  return { root, source, input: { profile: "web", projectRoot: root, documentPath: "scene.json", sourcePath } as const,
    before: readFileSync(join(root, "scene.json"), "utf8") };
}

function bridgeFor(f: ReturnType<typeof fixture>) {
  const bridge = createDesktopBridge({ cwd: f.root, commandProfile: "web" });
  bridges.push(bridge);
  const input = { profile: f.input.profile, documentPath: f.input.documentPath, sourcePath: f.input.sourcePath };
  return { bridge, input };
}
function assertUnchanged(f: ReturnType<typeof fixture>) {
  expect(readFileSync(join(f.root, "scene.json"), "utf8")).toBe(f.before);
  expect(existsSync(join(f.root, "assets"))).toBe(false);
}
describe("public prepared asset handoff", () => {
  it("stages actual worker E1 compactly, accepts identical bytes, and preserves source evidence/stable reload ID", async () => {
    const f = fixture();
    const { bridge, input } = bridgeFor(f);
    const legacy = proposeProjectAssetImport(f.input);
    if (!legacy.ok || legacy.proposal === null) throw new Error("legacy fixture failed");
    const twin = fixture();
    expect(apply({ proposal: legacy.proposal, cwd: twin.root }).ok).toBe(true);
    const job = bridge.prepareAssetImport(input);
    const response = await job.result;
    expect(await job.cancel()).toBe(response);
    expect(response).toMatchObject({ ok: true, data: { outcome: "reviewing", authoring: { phase: "reviewing", proposal: null } } });
    const wire = JSON.stringify(response);
    expect(wire.length).toBeLessThan(6000);
    expect(wire).not.toContain(legacy.entry.canonicalBytesBase64);
    expect(wire).toContain(legacy.entry.provenance.sourceDigest);
    assertUnchanged(f);
    const accepted = bridge.handle({ action: "authoring", payload: { op: "accept" } });
    expect(accepted).toMatchObject({ ok: true, data: { phase: "applied", proposal: null } });
    expect(JSON.stringify(accepted).length).toBeLessThan(6000);
    expect(readFileSync(join(f.root, "scene.json"), "utf8")).toBe(readFileSync(join(twin.root, "scene.json"), "utf8"));
    expect(readFileSync(join(f.root, legacy.entry.relativePath))).toEqual(f.source);
    expect(`sha256:${createHash("sha256").update(f.source).digest("hex")}`).toBe(legacy.entry.provenance.sourceDigest);
    const stored = parseDocumentText(readFileSync(join(f.root, "scene.json"), "utf8"));
    if (!stored.ok) throw new Error("accepted document invalid");
    expect(JSON.stringify(stored.document.data[PROJECT_ASSET_MANIFEST_KEY])).toContain(legacy.entry.canonicalBytesBase64);
    const status = bridge.handle({ action: "authoring", payload: { op: "status", documentPath: "scene.json" } });
    expect(JSON.stringify(status)).not.toContain(legacy.entry.canonicalBytesBase64);
    const replayed = await bridge.prepareAssetImport(input).result;
    expect(replayed).toMatchObject({ ok: true, data: { outcome: "replayed", entry: { assetId: legacy.entry.assetId } } });
    writeFileSync(f.input.sourcePath, Buffer.concat([f.source, Buffer.from(" ")]));
    const reload = await bridge.prepareAssetImport({ ...input, assetId: legacy.entry.assetId, hotReload: true }).result;
    expect(reload).toMatchObject({ ok: true, data: { outcome: "reviewing", hotReload: true,
      entry: { assetId: legacy.entry.assetId, validation: { replacesDigest: legacy.entry.digest } } } });
    expect(bridge.handle({ action: "authoring", payload: { op: "accept" } })).toMatchObject({ ok: true, data: { phase: "applied" } });
    expect(readFileSync(join(f.root, legacy.entry.relativePath))).toEqual(Buffer.concat([f.source, Buffer.from(" ")]));
  });
  it("admits maximum original bytes with a compact response and the unchanged 100ms heartbeat bound", async () => {
    const f = fixture(PROJECT_ASSET_MAX_BYTES);
    const { bridge, input } = bridgeFor(f);
    const gaps: number[] = [];
    let previous = performance.now();
    const timer = setInterval(() => { const now = performance.now(); gaps.push(now - previous); previous = now; }, 10);
    let response;
    try { response = await bridge.prepareAssetImport(input).result; }
    finally { clearInterval(timer); }
    expect(response).toMatchObject({ ok: true, data: { outcome: "reviewing" } });
    expect(gaps.length).toBeGreaterThan(0);
    expect(Math.max(...gaps)).toBeLessThanOrEqual(100);
    expect(JSON.stringify(response).length).toBeLessThan(6000);
    bridge.handle({ action: "authoring", payload: { op: "reject" } });
    assertUnchanged(f);
  });
  it("cancels terminally without late review/write and keeps the slot busy until cleanup", async () => {
    const f = fixture(PROJECT_ASSET_MAX_BYTES);
    const { bridge, input } = bridgeFor(f);
    const job = bridge.prepareAssetImport(input);
    expect(await bridge.prepareAssetImport(input).result).toMatchObject({ ok: false, reason: "ASSET_PREPARATION_BUSY" });
    const result = await job.cancel();
    expect(result).toMatchObject({ ok: false, reason: "ASSET_PREPARATION_CANCELLED" });
    expect(await job.result).toBe(result);
    expect(bridge.handle({ action: "authoring", payload: { op: "accept" } })).toMatchObject({ ok: true, data: { phase: "idle" } });
    assertUnchanged(f);
  });
  it("reject retires in-flight preparation before it can stage a late response", async () => {
    const f = fixture();
    const { bridge, input } = bridgeFor(f);
    const job = bridge.prepareAssetImport(input);
    bridge.handle({ action: "authoring", payload: { op: "reject" } });
    expect(await job.result).toMatchObject({ ok: false, reason: "ASSET_PREPARATION_CANCELLED" });
    assertUnchanged(f);
  });
  it("close retires in-flight responses and a closed bridge cannot reopen preparation authority", async () => {
    const f = fixture();
    const { bridge, input } = bridgeFor(f);
    const job = bridge.prepareAssetImport(input);
    expect(bridge.close()).toBe(true);
    expect(await job.result).toMatchObject({ ok: false, reason: "ASSET_PREPARATION_CANCELLED" });
    const workerCount = transport.workers.length;
    expect(await bridge.prepareAssetImport(input).result).toMatchObject({ ok: false, reason: "ASSET_PREPARATION_CANCELLED" });
    expect(transport.workers.length).toBe(workerCount);
    assertUnchanged(f);
  });
  it("rejects changed source bytes between worker response and admission", async () => {
    const f = fixture();
    const { bridge, input } = bridgeFor(f);
    transport.hooks.onMessage = () => { writeFileSync(f.input.sourcePath, Buffer.concat([f.source, Buffer.from(" ")])); };
    expect(await bridge.prepareAssetImport(input).result).toMatchObject({ ok: false });
    assertUnchanged(f);
  });
  it("refuses path/accessor/forged prepared IPC before invoking getters or allocating a worker", async () => {
    const f = fixture();
    const { bridge, input } = bridgeFor(f);
    let reads = 0;
    const accessor = { ...input, get sourcePath() { reads += 1; return f.input.sourcePath; } };
    expect(await bridge.prepareAssetImport(accessor).result).toMatchObject({ ok: false, reason: "ASSET_PREPARATION_INPUT_INVALID" });
    expect(await bridge.prepareAssetImport({ ...input, documentPath: "../scene.json" }).result).toMatchObject({ ok: false });
    expect(bridge.handle({ action: "asset-import-prepared", payload: { prepared: {} } })).toMatchObject({ ok: false });
    expect(reads).toBe(0);
    expect(transport.workers).toHaveLength(0);
    assertUnchanged(f);
  });
  it("refuses source symlinks and forged prepared request fields without document/copy writes", async () => {
    const f = fixture();
    const { bridge, input } = bridgeFor(f);
    const link = join(f.root, "linked.gltf");
    symlinkSync(f.input.sourcePath, link);
    expect(await bridge.prepareAssetImport({ ...input, sourcePath: link }).result).toMatchObject({ ok: false });
    const forged = { ...input, prepared: { ok: true, proposal: {} } };
    const beforeWorkers = transport.workers.length;
    expect(await bridge.prepareAssetImport(forged).result).toMatchObject({ ok: false, reason: "ASSET_PREPARATION_INPUT_INVALID" });
    expect(transport.workers.length).toBe(beforeWorkers);
    assertUnchanged(f);
  });
  it("Kids refuses native preparation before a worker or project owner is acquired", async () => {
    const f = fixture();
    const bridge = createDesktopBridge({ cwd: f.root, commandProfile: "kids" });
    bridges.push(bridge);
    expect(await bridge.prepareAssetImport({ profile: "kids", documentPath: "scene.json", sourcePath: f.input.sourcePath }).result)
      .toMatchObject({ ok: false, reason: "ASSET_PREPARATION_KIDS_DENIED" });
    expect(transport.workers).toHaveLength(0);
    assertUnchanged(f);
  });
  it("build inventory emits the real fixed CJS sibling with the existing node22/common config", () => {
    const build = readFileSync(new URL("../scripts/build.mjs", import.meta.url), "utf8");
    expect(build).toContain('entryPoints: [resolve(appRoot, "../../packages/importers/src/asset-preparation-worker.ts")]');
    expect(build).toContain('outfile: join(dist, "asset-preparation-worker.cjs")');
    expect(build).toMatch(/asset-preparation-worker\.cjs"\),\s*platform: "node",\s*format: "cjs",\s*target: "node22"/);
  });
});
