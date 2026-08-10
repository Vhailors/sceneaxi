/** Golden proof for the offline desktop Ship → Export Web vertical. */
import { createHash } from "node:crypto";
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, relative, sep } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { contentHash } from "@sceneaxi/authoring-core";
import { parseDeliveryHandoffText } from "@sceneaxi/schemas";
import {
  DESKTOP_WEB_EXPORT_REFUSALS,
  createDesktopBridge,
  exportDesktopWebProject,
  seedDesktopProject,
} from "../../desktop/linux/src/index.ts";

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
});
