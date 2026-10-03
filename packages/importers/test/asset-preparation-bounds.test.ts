import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { Worker } from "node:worker_threads";
import { fileURLToPath } from "node:url";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { composeScene, createDocument, reconstructSculpt, writeDocumentFile } from "@sceneaxi/authoring-core";
import { identitySculptTransform } from "@sceneaxi/schemas";
import { PROJECT_ASSET_MAX_BYTES, proposeProjectAssetImport, ASSET_PREPARATION_DEADLINE_MS, startProjectAssetPreparation as prepareWithHost } from "@sceneaxi/importers";

// Test source resolution only; production launches the tsc-built sibling worker entry.
// Every test still uses real Node Worker/terminate and the actual importer source.
interface PreparationTransport { workers: Worker[]; errors: Error[]; hooks: WorkerTransportHooks }

const transport: PreparationTransport = {
  workers: [],
  errors: [],
  hooks: { onMessage: null, entry: "", loader: "" },
};

const preparationHost: PreparationHost = {
  createWorker(_url, options) {
    const worker = new Worker(transport.hooks.entry, { ...options, execArgv: ["--experimental-transform-types", "--import", transport.hooks.loader] });
    transport.workers.push(worker);
    worker.once("error", error => transport.errors.push(error instanceof Error ? error : new Error(String(error))));
    worker.once("message", () => transport.hooks.onMessage?.());

    return worker;
  },
};

const startProjectAssetPreparation = (input: Parameters<typeof prepareWithHost>[0]) => prepareWithHost(input, preparationHost);

const roots: string[] = [];

let compilation = "";

let realEntry = "";

beforeAll(() => {
  compilation = mkdtempSync(join(tmpdir(), "sceneaxi-worker-source-"));
  realEntry = fileURLToPath(new URL("../src/asset-preparation-worker.ts", import.meta.url));
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

function fixture(size = PROJECT_ASSET_MAX_BYTES) {
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

function unchanged(f: ReturnType<typeof fixture>) {
  expect(readFileSync(join(f.root, "scene.json"), "utf8")).toBe(f.before);
  expect(existsSync(join(f.root, "assets"))).toBe(false);
}

describe("bounded off-main asset preparation", () => {
    it("rejects invalid route input and accessors before Worker allocation or getter execution", async () => {
      let reads = 0;

      const accessor = { get profile() {
          reads += 1;

 return "web"; } };

      for (const input of [null, undefined, {}, accessor, new Proxy({}, { get() { reads += 1;

 return undefined; } }),
        { profile: "web", projectRoot: "/tmp", documentPath: "../scene.json", sourcePath: "/tmp/a.gltf" },
        { profile: "web", projectRoot: "/tmp", documentPath: "scene.json", sourcePath: "x".repeat(4097) }]) {
        expect(await startProjectAssetPreparation(input).result).toMatchObject({ ok: false, reason: "ASSET_PREPARATION_INPUT_INVALID" });
      }

      expect(reads).toBe(0);
      expect(transport.workers).toHaveLength(0);
    });

  it("prepares actual maximum bytes without blocking main heartbeat or changing canonical evidence", async () => {
    const f = fixture();
    const gaps: number[] = []; let previous = performance.now();
    const timer = setInterval(() => { const now = performance.now(); gaps.push(now - previous); previous = now; }, 10);
    let outcome;
    const job = startProjectAssetPreparation(f.input);

    try { outcome = await job.result; }
    finally { clearInterval(timer); }

    expect(gaps.length).toBeGreaterThan(0);
    expect(Math.max(...gaps)).toBeLessThanOrEqual(100);
    expect(outcome.ok, transport.errors.map(error => error.message).join("\n")).toBe(true);
    expect(await job.cancel()).toBe(outcome);

    if (!outcome.ok || !outcome.prepared.ok) throw new Error("Maximum asset did not prepare.");
    const synchronous = proposeProjectAssetImport(f.input);
    expect(outcome.prepared).toEqual(synchronous);
    expect(Buffer.from(outcome.prepared.entry.canonicalBytesBase64, "base64")).toEqual(f.source);
    expect(outcome.prepared.entry.digest).toBe("sha256:" + createHash("sha256").update(f.source).digest("hex"));
    unchanged(f);
  });

  it("acknowledges cancellation after real worker exit and fences all late publication", async () => {
    const f = fixture(); const job = startProjectAssetPreparation(f.input); const start = performance.now();
    const cancelled = await job.cancel();
    expect(performance.now() - start).toBeLessThanOrEqual(500);
    expect(cancelled).toEqual({ ok: false, generation: job.generation, reason: "ASSET_PREPARATION_CANCELLED" });
    expect(await job.result).toBe(cancelled);
    expect(await job.cancel()).toBe(cancelled);
    unchanged(f);
  });

  it("cancels during streamed publication and cannot publish a late successful proposal", async () => {
    const f = fixture();
    let acknowledge: (() => void) = () => undefined;
    const reached = new Promise<void>(resolve => { acknowledge = resolve; });
    let cancellation: ReturnType<ReturnType<typeof startProjectAssetPreparation>["cancel"]> | undefined;
    const job = startProjectAssetPreparation(f.input);
    transport.hooks.onMessage = () => {
      setTimeout(() => { cancellation = job.cancel(); acknowledge(); }, 0);
    };

    await reached;
    const cancelled = await cancellation;
    expect(cancelled).toMatchObject({ ok: false, generation: job.generation, reason: "ASSET_PREPARATION_CANCELLED" });
    expect(await job.result).toBe(cancelled);
    expect(await job.cancel()).toBe(cancelled);
    unchanged(f);
  });

  it("refuses concurrent preparation and releases the slot only after terminal cleanup", async () => {
    const f = fixture(); const job = startProjectAssetPreparation(f.input);
    expect(await startProjectAssetPreparation(f.input).result).toMatchObject({ ok: false, reason: "ASSET_PREPARATION_BUSY" });
    await job.cancel();
    const next = startProjectAssetPreparation(f.input); expect(next.generation).toBeGreaterThan(job.generation);
    expect(await next.cancel()).toMatchObject({ reason: "ASSET_PREPARATION_CANCELLED" });
    unchanged(f);
  });

  it("enforces the existing four-second preparation deadline, including a stalled worker", async () => {
    const f = fixture(1024);
    const hanging = join(compilation, "hanging.mjs");
    writeFileSync(hanging, 'import {parentPort} from "node:worker_threads"; parentPort.on("message", () => {});');
    transport.hooks.entry = hanging;
    vi.useFakeTimers();
    const job = startProjectAssetPreparation(f.input);
    await vi.advanceTimersByTimeAsync(ASSET_PREPARATION_DEADLINE_MS);
    expect(await job.result).toMatchObject({ ok: false, reason: "ASSET_PREPARATION_DEADLINE" });
    unchanged(f);
  });

  it("rechecks document authority before publishing a worker result", async () => {
    const f = fixture(1024);
    transport.hooks.onMessage = () => writeFileSync(join(f.root, "scene.json"), f.before + " ");
    expect(await startProjectAssetPreparation(f.input).result).toMatchObject({ ok: false, reason: "ASSET_IMPORT_PROPOSAL_REFUSED" });
    expect(readFileSync(join(f.root, "scene.json"), "utf8")).toBe(f.before + " ");
    expect(existsSync(join(f.root, "assets"))).toBe(false);
  });

  it("rechecks original source digest before publishing a worker result", async () => {
    const f = fixture(1024);
    transport.hooks.onMessage = () => writeFileSync(f.input.sourcePath, Buffer.concat([f.source, Buffer.from(" ")]));
    expect(await startProjectAssetPreparation(f.input).result).toMatchObject({ ok: false, reason: "ASSET_IMPORT_PROPOSAL_REFUSED" });
    unchanged(f);
  });

  it("refuses a source swapped to a symlink while the worker was preparing", async () => {
    const f = fixture(1024);
    const original = join(f.root, "original.gltf"); writeFileSync(original, f.source);
    transport.hooks.onMessage = () => { rmSync(f.input.sourcePath); symlinkSync(original, f.input.sourcePath); };

    expect(await startProjectAssetPreparation(f.input).result).toMatchObject({ ok: false, reason: "ASSET_IMPORT_SOURCE_SYMLINK" });
    unchanged(f);
  });

  it("denies Kids before creating a worker or reading asset bytes", async () => {
    const f = fixture(1024);
    expect(await startProjectAssetPreparation({ ...f.input, profile: "kids" }).result).toMatchObject({ ok: false,
      reason: "ASSET_PREPARATION_KIDS_DENIED" });
    expect(transport.workers).toHaveLength(0);
    unchanged(f);
  });

  it("refuses worker startup failure, retires resources and releases the single slot", async () => {
    const f = fixture(1024);
    transport.hooks.entry = join(compilation, "does-not-exist.mjs");
    expect(await startProjectAssetPreparation(f.input).result).toMatchObject({ ok: false, reason: "ASSET_PREPARATION_UNAVAILABLE" });
    transport.hooks.entry = realEntry;
    expect(await startProjectAssetPreparation(f.input).cancel()).toMatchObject({ ok: false, reason: "ASSET_PREPARATION_CANCELLED" });
    unchanged(f);
  });

  it("retains next-byte and source-symlink named refusals without mutations", async () => {
    const f = fixture(PROJECT_ASSET_MAX_BYTES + 1);
    expect(await startProjectAssetPreparation(f.input).result).toMatchObject({ ok: false, reason: "ASSET_IMPORT_OVERSIZE" });
    const alias = join(f.root, "alias.gltf"); symlinkSync(f.input.sourcePath, alias);
    expect(await startProjectAssetPreparation({ ...f.input, sourcePath: alias }).result).toMatchObject({ ok: false, reason: "ASSET_IMPORT_SOURCE_SYMLINK" });
    unchanged(f);
  });
});

interface WorkerTransportHooks { onMessage: (() => void) | null; entry: string; loader: string }

type PreparationHost = NonNullable<Parameters<typeof prepareWithHost>[1]>;
