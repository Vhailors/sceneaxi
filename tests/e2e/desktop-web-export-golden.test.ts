/** Golden proof for the offline desktop Ship → Export Web vertical. */
import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, relative, sep } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { contentHash } from "@sceneaxi/authoring-core";
import { parseDeliveryHandoffText } from "@sceneaxi/schemas";
import {
  DESKTOP_WEB_EXPORT_REFUSALS,
  DESKTOP_WEB_EXPORT_TOOL_VERSION,
  createDesktopBridge,
  exportDesktopWebProject,
  seedDesktopProject,
} from "../../desktop/linux/src/index.ts";

const exportCommit = vi.hoisted(() => ({
  afterRename: null as
    | ((oldPath: unknown, newPath: unknown) => void)
    | null,
}));

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    renameSync: (
      oldPath: Parameters<typeof actual.renameSync>[0],
      newPath: Parameters<typeof actual.renameSync>[1],
    ) => {
      actual.renameSync(oldPath, newPath);
      exportCommit.afterRename?.(oldPath, newPath);
    },
  };
});

const roots: string[] = [];
const RUNTIME = Buffer.from(
  '/* SceneAxi deterministic Web renderer fixture v1 */\nvoid globalThis.sceneaxiDesktopLinux;\n',
);
const GOLDEN = JSON.parse(
  readFileSync(
    join(import.meta.dirname, "fixtures/desktop-web-export/golden-digests.json"),
    "utf8",
  ),
) as {
  sourceProjectDigest: string;
  bundleDigest: string;
  artifactDigests: Record<string, string>;
};

afterEach(() => {
  exportCommit.afterRename = null;
  vi.restoreAllMocks();
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function temporary(prefix: string) {
  const root = mkdtempSync(join(tmpdir(), prefix));
  roots.push(root);
  return root;
}

function sha256(bytes: Uint8Array | string) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function containedTriangle() {
  const positions = new Float32Array([-1, 0, 0, 1, 0, 0, 0, 1, 0]);
  const bytes = Buffer.from(positions.buffer);
  return Buffer.from(
    JSON.stringify({
      asset: { version: "2.0" },
      buffers: [
        {
          byteLength: bytes.byteLength,
          uri: `data:application/octet-stream;base64,${bytes.toString("base64")}`,
        },
      ],
      bufferViews: [{ buffer: 0, byteLength: bytes.byteLength }],
      accessors: [
        { bufferView: 0, componentType: 5126, count: 3, type: "VEC3" },
      ],
      meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
      nodes: [{ mesh: 0 }],
      scenes: [{ nodes: [0] }],
      scene: 0,
    }),
  );
}

function seedWithAsset(root: string, source: string) {
  expect(seedDesktopProject(root)).toEqual({ ok: true, migrated: false });
  const bridge = createDesktopBridge({ cwd: root, nowMs: () => 1_753_920_000_000 });
  expect(
    bridge.handle({
      action: "asset-import",
      payload: {
        profile: "web",
        documentPath: "scene.json",
        sourcePath: source,
      },
    }),
  ).toMatchObject({ ok: true, data: { outcome: "reviewing" } });
  expect(
    bridge.handle({ action: "authoring", payload: { op: "accept" } }),
  ).toMatchObject({ ok: true, data: { phase: "applied" } });
}

function statusHash(bridge: ReturnType<typeof createDesktopBridge>) {
  const response = bridge.handle({
    action: "authoring",
    payload: { op: "status", documentPath: "scene.json" },
  });
  expect(response).toMatchObject({ ok: true, data: { ok: true } });
  if (!response.ok) throw new Error(response.message);
  return (response.data as { contentHash: string }).contentHash;
}

function exportProject(root: string, runtimeJavaScript = RUNTIME) {
  const bridge = createDesktopBridge({ cwd: root });
  return exportDesktopWebProject({
    projectRoot: root,
    documentPath: "scene.json",
    expectedContentHash: statusHash(bridge),
    runtimeJavaScript,
  });
}

function rewriteDocument(
  root: string,
  mutate: (document: Record<string, unknown>) => void,
) {
  const document = JSON.parse(
    readFileSync(join(root, "scene.json"), "utf8"),
  ) as Record<string, unknown>;
  mutate(document);
  const bytes = Buffer.from(`${JSON.stringify(document, null, 2)}\n`);
  writeFileSync(join(root, "scene.json"), bytes);
  return bytes;
}

function ship(root: string) {
  const bridge = createDesktopBridge({ cwd: root, webExportRuntime: RUNTIME });
  const expectedContentHash = statusHash(bridge);
  const response = bridge.handle({
    action: "ship",
    payload: { op: "export-web", documentPath: "scene.json", expectedContentHash },
  });
  expect(response).toMatchObject({ ok: true, action: "ship" });
  if (!response.ok) throw new Error(response.message);
  return response.data as {
    replayed: boolean;
    outputDirectory: string;
    handoffPath: string;
    sourceProject: { contentHash: string };
    bundleDigest: string;
    artifactPaths: readonly string[];
  };
}

function fileMap(root: string, at = root): Map<string, Buffer> {
  const files = new Map<string, Buffer>();
  for (const entry of readdirSync(at, { withFileTypes: true })) {
    const target = join(at, entry.name);
    if (entry.isDirectory()) {
      for (const [path, bytes] of fileMap(root, target)) files.set(path, bytes);
    } else if (entry.isFile()) {
      files.set(relative(root, target).split(sep).join("/"), readFileSync(target));
    }
  }
  return files;
}

describe("desktop static Web export", () => {
  it("exports identical projects into byte-identical contained bundles and replays safely", () => {
    const sourceRoot = temporary("sceneaxi-export-source-");
    const source = join(sourceRoot, "triangle.gltf");
    writeFileSync(source, containedTriangle());
    const firstRoot = temporary("sceneaxi-export-first-");
    const secondRoot = temporary("sceneaxi-export-second-");
    seedWithAsset(firstRoot, source);
    seedWithAsset(secondRoot, source);

    const first = ship(firstRoot);
    const second = ship(secondRoot);
    expect(first.replayed).toBe(false);
    expect(second.replayed).toBe(false);
    expect(basename(first.outputDirectory)).toBe(
      first.bundleDigest.slice("sha256:".length),
    );
    expect(ship(firstRoot)).toMatchObject({
      replayed: true,
      sourceProject: { contentHash: first.sourceProject.contentHash },
      bundleDigest: first.bundleDigest,
    });

    const firstFiles = fileMap(first.outputDirectory);
    const secondFiles = fileMap(second.outputDirectory);
    expect([...firstFiles.keys()].sort()).toEqual([...secondFiles.keys()].sort());
    for (const [path, bytes] of firstFiles) expect(secondFiles.get(path)).toEqual(bytes);
    expect(firstFiles.get("source/scene.json")).toEqual(
      readFileSync(join(firstRoot, "scene.json")),
    );
    expect(firstFiles.get("assets/triangle.gltf")).toEqual(containedTriangle());
    expect(firstFiles.get("sceneaxi-web.js")).toEqual(RUNTIME);

    const handoff = parseDeliveryHandoffText(
      readFileSync(first.handoffPath, "utf8"),
    );
    expect(handoff.ok).toBe(true);
    if (!handoff.ok) return;
    expect(handoff.handoff.target).toBe("web");
    expect(handoff.handoff.artifactSetDigest).toBe(first.bundleDigest);
    expect(handoff.handoff.notes).toContain("no upload, deployment, signing, approval, or release");
    expect(handoff.handoff.artifacts["source/scene.json"]?.digest).toBe(
      first.sourceProject.contentHash,
    );
    for (const [path, artifact] of Object.entries(handoff.handoff.artifacts)) {
      expect(sha256(firstFiles.get(path) ?? Buffer.alloc(0))).toBe(artifact.digest);
    }
    expect(readFileSync(join(first.outputDirectory, "index.html"), "utf8")).toContain(
      "connect-src 'none'",
    );

    expect(
      {
        sourceProjectDigest: first.sourceProject.contentHash,
        bundleDigest: first.bundleDigest,
        artifactDigests: Object.fromEntries(
          Object.entries(handoff.handoff.artifacts).map(([path, artifact]) => [
            path,
            artifact.digest,
          ]),
        ),
      },
    ).toEqual(GOLDEN);
  });

  it("projects every valid document identity into a valid handoff display name", () => {
    const titledRoot = temporary("sceneaxi-export-display-title-");
    expect(seedDesktopProject(titledRoot)).toEqual({ ok: true, migrated: false });
    const title = `${"😀".repeat(199)}\ud800tail`;
    const titledBytes = rewriteDocument(titledRoot, (document) => {
      document["title"] = title;
    });
    const titled = exportProject(titledRoot);
    expect(titled.ok).toBe(true);
    if (!titled.ok) throw new Error(titled.message);
    expect(titled.handoff.product.displayName).toBe(
      `${"😀".repeat(199)}\ufffd`,
    );
    expect(readFileSync(join(titled.outputDirectory, "source/scene.json"))).toEqual(
      titledBytes,
    );

    const idRoot = temporary("sceneaxi-export-display-id-");
    expect(seedDesktopProject(idRoot)).toEqual({ ok: true, migrated: false });
    const longId = "a".repeat(240);
    rewriteDocument(idRoot, (document) => {
      document["id"] = longId;
      delete document["title"];
    });
    const identified = exportProject(idRoot);
    expect(identified.ok).toBe(true);
    if (!identified.ok) throw new Error(identified.message);
    expect(identified.handoff.product.id).toBe(longId);
    expect(identified.handoff.product.displayName).toBe("a".repeat(200));
  });

  it("binds the effective tool version to the packaged renderer bytes", () => {
    const firstRoot = temporary("sceneaxi-export-runtime-first-");
    const secondRoot = temporary("sceneaxi-export-runtime-second-");
    expect(seedDesktopProject(firstRoot)).toEqual({ ok: true, migrated: false });
    expect(seedDesktopProject(secondRoot)).toEqual({ ok: true, migrated: false });
    const alternateRuntime = Buffer.from("alternate packaged renderer");
    const first = exportProject(firstRoot, RUNTIME);
    const second = exportProject(secondRoot, alternateRuntime);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok) throw new Error(first.message);
    if (!second.ok) throw new Error(second.message);
    expect(first.handoff.product.version).toBe(
      `${DESKTOP_WEB_EXPORT_TOOL_VERSION}+export.1.renderer.${sha256(RUNTIME).slice("sha256:".length)}`,
    );
    expect(second.handoff.product.version).toBe(
      `${DESKTOP_WEB_EXPORT_TOOL_VERSION}+export.1.renderer.${sha256(alternateRuntime).slice("sha256:".length)}`,
    );
    expect(first.handoff.product.version).not.toBe(second.handoff.product.version);
    expect(first.handoff.artifacts["sceneaxi-web.js"]?.digest).toBe(sha256(RUNTIME));
    expect(second.handoff.artifacts["sceneaxi-web.js"]?.digest).toBe(
      sha256(alternateRuntime),
    );
  });

  it("refuses an invalid scene and stale source identity by name", () => {
    const root = temporary("sceneaxi-export-invalid-");
    expect(seedDesktopProject(root).ok).toBe(true);
    const invalid = "{}\n";
    writeFileSync(join(root, "scene.json"), invalid);
    expect(
      exportDesktopWebProject({
        projectRoot: root,
        documentPath: "scene.json",
        expectedContentHash: contentHash(invalid),
        runtimeJavaScript: RUNTIME,
      }),
    ).toMatchObject({ ok: false, reason: DESKTOP_WEB_EXPORT_REFUSALS.sceneInvalid });

    const staleRoot = temporary("sceneaxi-export-stale-");
    expect(seedDesktopProject(staleRoot)).toEqual({ ok: true, migrated: false });
    expect(
      exportDesktopWebProject({
        projectRoot: staleRoot,
        documentPath: "scene.json",
        expectedContentHash: `sha256:${"0".repeat(64)}`,
        runtimeJavaScript: RUNTIME,
      }),
    ).toMatchObject({ ok: false, reason: DESKTOP_WEB_EXPORT_REFUSALS.projectChanged });
  });

  it("refuses a missing referenced asset and a staged dirty project by name", () => {
    const sourceRoot = temporary("sceneaxi-export-refusal-source-");
    const source = join(sourceRoot, "triangle.gltf");
    writeFileSync(source, containedTriangle());
    const missingRoot = temporary("sceneaxi-export-missing-");
    seedWithAsset(missingRoot, source);
    unlinkSync(join(missingRoot, "assets/triangle.gltf"));
    const missingBridge = createDesktopBridge({
      cwd: missingRoot,
      webExportRuntime: RUNTIME,
    });
    expect(
      missingBridge.handle({
        action: "ship",
        payload: {
          op: "export-web",
          documentPath: "scene.json",
          expectedContentHash: statusHash(missingBridge),
        },
      }),
    ).toMatchObject({ ok: false, reason: DESKTOP_WEB_EXPORT_REFUSALS.assetMissing });

    const dirtyRoot = temporary("sceneaxi-export-dirty-");
    expect(seedDesktopProject(dirtyRoot).ok).toBe(true);
    const dirtyBridge = createDesktopBridge({ cwd: dirtyRoot, webExportRuntime: RUNTIME });
    const before = statusHash(dirtyBridge);
    expect(
      dirtyBridge.handle({
        action: "authoring",
        payload: {
          op: "propose",
          documentPath: "scene.json",
          jsonPointer: "/data/material/roughness",
          expectedContentHash: before,
          newValue: 0.9,
        },
      }),
    ).toMatchObject({ ok: true, data: { phase: "reviewing" } });
    expect(
      dirtyBridge.handle({
        action: "ship",
        payload: {
          op: "export-web",
          documentPath: "scene.json",
          expectedContentHash: before,
        },
      }),
    ).toMatchObject({ ok: false, reason: DESKTOP_WEB_EXPORT_REFUSALS.projectDirty });
  });

  it("refuses an asset that changes during the atomic export commit", () => {
    const sourceRoot = temporary("sceneaxi-export-race-source-");
    const source = join(sourceRoot, "triangle.gltf");
    writeFileSync(source, containedTriangle());
    const root = temporary("sceneaxi-export-race-");
    seedWithAsset(root, source);
    const bridge = createDesktopBridge({ cwd: root });
    let committed = false;
    exportCommit.afterRename = () => {
      exportCommit.afterRename = null;
      committed = true;
      writeFileSync(join(root, "assets/triangle.gltf"), "changed after capture");
    };

    const result = exportDesktopWebProject({
      projectRoot: root,
      documentPath: "scene.json",
      expectedContentHash: statusHash(bridge),
      runtimeJavaScript: RUNTIME,
    });

    expect(committed).toBe(true);
    expect(result).toMatchObject({
      ok: false,
      reason: DESKTOP_WEB_EXPORT_REFUSALS.assetInvalid,
    });
  });

  it("preserves an unowned directory when staging cannot claim its path", () => {
    const root = temporary("sceneaxi-export-owned-staging-");
    expect(seedDesktopProject(root)).toEqual({ ok: true, migrated: false });
    const webRoot = join(root, "exports/web");
    mkdirSync(webRoot, { recursive: true });
    const now = 1_754_844_800_000;
    vi.spyOn(Date, "now").mockReturnValue(now);
    const unowned = join(
      webRoot,
      `.sceneaxi-export-${process.pid}-${now.toString(36)}`,
    );
    mkdirSync(unowned);
    const sentinel = join(unowned, "operator-data.txt");
    writeFileSync(sentinel, "keep");
    const bridge = createDesktopBridge({ cwd: root });

    const result = exportDesktopWebProject({
      projectRoot: root,
      documentPath: "scene.json",
      expectedContentHash: statusHash(bridge),
      runtimeJavaScript: RUNTIME,
    });

    expect(result.ok).toBe(true);
    expect(existsSync(sentinel)).toBe(true);
    expect(readFileSync(sentinel, "utf8")).toBe("keep");
  });

  it("refuses a committed bundle that changes before success", () => {
    const root = temporary("sceneaxi-export-destination-race-");
    expect(seedDesktopProject(root)).toEqual({ ok: true, migrated: false });
    const bridge = createDesktopBridge({ cwd: root });
    let committed = false;
    exportCommit.afterRename = (_oldPath, newPath) => {
      exportCommit.afterRename = null;
      if (typeof newPath !== "string") throw new Error("export destination was not a path");
      committed = true;
      writeFileSync(join(newPath, "index.html"), "changed after commit");
    };

    const result = exportDesktopWebProject({
      projectRoot: root,
      documentPath: "scene.json",
      expectedContentHash: statusHash(bridge),
      runtimeJavaScript: RUNTIME,
    });

    expect(committed).toBe(true);
    expect(result).toMatchObject({
      ok: false,
      reason: DESKTOP_WEB_EXPORT_REFUSALS.destinationConflict,
    });
  });

  it("refuses when the source becomes an out-of-root symlink", () => {
    const root = temporary("sceneaxi-export-source-link-");
    expect(seedDesktopProject(root)).toEqual({ ok: true, migrated: false });
    const outside = temporary("sceneaxi-export-source-link-outside-");
    const documentPath = join(root, "scene.json");
    const outsideDocument = join(outside, "scene.json");
    writeFileSync(outsideDocument, readFileSync(documentPath));
    let committed = false;
    exportCommit.afterRename = () => {
      exportCommit.afterRename = null;
      committed = true;
      unlinkSync(documentPath);
      symlinkSync(outsideDocument, documentPath);
    };

    const result = exportProject(root);

    expect(committed).toBe(true);
    expect(lstatSync(documentPath).isSymbolicLink()).toBe(true);
    expect(result).toMatchObject({
      ok: false,
      reason: DESKTOP_WEB_EXPORT_REFUSALS.unsafePath,
    });
  });

  it("refuses a dangling symlink at the content address without replacing it", () => {
    const root = temporary("sceneaxi-export-destination-link-");
    expect(seedDesktopProject(root)).toEqual({ ok: true, migrated: false });
    const first = ship(root);
    rmSync(first.outputDirectory, { recursive: true, force: true });
    symlinkSync(join(root, "missing-export-target"), first.outputDirectory);

    const result = exportProject(root);

    expect(result).toMatchObject({
      ok: false,
      reason: DESKTOP_WEB_EXPORT_REFUSALS.destinationConflict,
    });
    expect(lstatSync(first.outputDirectory).isSymbolicLink()).toBe(true);
  });
});
