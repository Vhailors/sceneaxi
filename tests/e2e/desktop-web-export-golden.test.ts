/** Golden proof for the offline desktop Ship → Export Web vertical. */
import { createHash } from "node:crypto";
import { execFileSync as runFileSync } from "node:child_process";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  readdirSync,
  renameSync,
  rmSync,
  symlinkSync,
  truncateSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, sep } from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { contentHash } from "@sceneaxi/authoring-core";
import { parseDeliveryHandoffText } from "@sceneaxi/schemas";
import { PROJECT_ASSET_MAX_BYTES } from "../../packages/importers/src/index.ts";
import {
  DESKTOP_WEB_EXPORT_REFUSALS,
  DESKTOP_WEB_EXPORT_TOOL_VERSION,
  createDesktopBridge,
  exportDesktopWebProject,
  seedDesktopProject,
} from "../../desktop/linux/src/index.ts";

const exportCommit = vi.hoisted(() => ({
  afterCommit: null as
    | ((oldPath: unknown, newPath: unknown, stagingDescriptor?: number) => void)
    | null,
  afterRealpath: null as ((path: unknown, resolved: string) => void) | null,
  beforeDirectoryRead: null as ((path: unknown) => void) | null,
  beforeMkdtemp: null as ((prefix: unknown) => void) | null,
  beforeMkdir: null as ((path: unknown) => void) | null,
  beforePublish: null as ((source: string, destination: string) => void) | null,
  beforeReadFile: null as ((path: unknown) => void) | null,
  beforeFstat: null as ((descriptor: number) => void) | null,
  failPublish: false,
  failOpenSuffix: null as string | null,
  maximumReadLength: 0,
  rejectLinks: false,
}));

vi.mock("node:child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:child_process")>();
  const execFileSync = ((
    ...args: Parameters<typeof actual.execFileSync>
  ) => {
    if (
      basename(String(args[0])) === "sceneaxi-publish-no-replace" &&
      Array.isArray(args[1])
    ) {
      const operands = args[1].map(String);
      if (operands[0] !== "publish") {
        return Reflect.apply(actual.execFileSync, actual, args);
      }
      const options = args[2] as { stdio?: readonly unknown[] } | undefined;
      const inheritedDescriptor = options?.stdio?.[4];
      const inheritedStagingDescriptor = options?.stdio?.[5];
      const parentDescriptor = typeof inheritedDescriptor === "number"
        ? inheritedDescriptor
        : -1;
      const parentAccess = `/proc/self/fd/${String(parentDescriptor)}`;
      const source = join(parentAccess, operands[1] ?? "");
      const destination = join(parentAccess, operands[2] ?? "");
      exportCommit.beforePublish?.(source, destination);
      if (exportCommit.failPublish) {
        exportCommit.failPublish = false;
        throw Object.assign(new Error("injected publication interruption"), {
          code: "EINTR",
        });
      }
      const result = Reflect.apply(actual.execFileSync, actual, args);
      exportCommit.afterCommit?.(
        source,
        destination,
        typeof inheritedStagingDescriptor === "number"
          ? inheritedStagingDescriptor
          : undefined,
      );
      return result;
    }
    return Reflect.apply(actual.execFileSync, actual, args);
  }) as typeof actual.execFileSync;
  return { ...actual, execFileSync };
});

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  const hookedFstatSync = ((
    ...args: Parameters<typeof actual.fstatSync>
  ) => {
    exportCommit.beforeFstat?.(args[0]);
    return Reflect.apply(actual.fstatSync, actual, args);
  }) as typeof actual.fstatSync;
  const hookedRealpathSync = Object.assign(
    (path: Parameters<typeof actual.realpathSync>[0]) => {
      const result = actual.realpathSync(path);
      exportCommit.afterRealpath?.(path, result);
      return result;
    },
    { native: actual.realpathSync.native },
  );
  const hookedReadFileSync = ((
    ...args: Parameters<typeof actual.readFileSync>
  ) => {
    exportCommit.beforeReadFile?.(args[0]);
    return Reflect.apply(actual.readFileSync, actual, args);
  }) as typeof actual.readFileSync;
  const hookedOpendirSync = ((
    ...args: Parameters<typeof actual.opendirSync>
  ) => {
    exportCommit.beforeDirectoryRead?.(args[0]);
    return Reflect.apply(actual.opendirSync, actual, args);
  }) as typeof actual.opendirSync;
  const hookedReaddirSync = ((
    ...args: Parameters<typeof actual.readdirSync>
  ) => {
    exportCommit.beforeDirectoryRead?.(args[0]);
    return Reflect.apply(actual.readdirSync, actual, args);
  }) as typeof actual.readdirSync;
  const hookedWriteFileSync = ((
    ...args: Parameters<typeof actual.writeFileSync>
  ) => {
    const target = typeof args[0] === "number"
      ? actual.realpathSync(`/proc/self/fd/${String(args[0])}`)
      : String(args[0]);
    const result = Reflect.apply(actual.writeFileSync, actual, args);
    if (target.endsWith("/delivery-handoff.json")) {
      const directory = actual.realpathSync(
        target.slice(0, -"/delivery-handoff.json".length),
      );
      if (/\/[0-9a-f]{64}$/.test(directory)) {
        exportCommit.afterCommit?.(args[0], directory);
      }
    }
    return result;
  }) as typeof actual.writeFileSync;
  return {
    ...actual,
    fstatSync: hookedFstatSync,
    linkSync: (
      oldPath: Parameters<typeof actual.linkSync>[0],
      newPath: Parameters<typeof actual.linkSync>[1],
    ) => {
      if (exportCommit.rejectLinks) {
        throw Object.assign(new Error("hard links are unavailable"), {
          code: "ENOTSUP",
        });
      }
      actual.linkSync(oldPath, newPath);
      if (String(newPath).endsWith("/delivery-handoff.json")) {
        exportCommit.afterCommit?.(
          oldPath,
          actual.realpathSync(
            String(newPath).slice(0, -"/delivery-handoff.json".length),
          ),
        );
      }
    },
    mkdirSync: (
      path: Parameters<typeof actual.mkdirSync>[0],
      options?: Parameters<typeof actual.mkdirSync>[1],
    ) => {
      exportCommit.beforeMkdir?.(path);
      return actual.mkdirSync(path, options);
    },
    mkdtempSync: (
      prefix: Parameters<typeof actual.mkdtempSync>[0],
      options?: Parameters<typeof actual.mkdtempSync>[1],
    ) => {
      exportCommit.beforeMkdtemp?.(prefix);
      return actual.mkdtempSync(prefix, options);
    },
    openSync: (
      path: Parameters<typeof actual.openSync>[0],
      flags: Parameters<typeof actual.openSync>[1],
      mode?: Parameters<typeof actual.openSync>[2],
    ) => {
      if (
        exportCommit.failOpenSuffix !== null &&
        typeof flags === "number" &&
        (flags & actual.constants.O_WRONLY) !== 0 &&
        String(path).endsWith(exportCommit.failOpenSuffix)
      ) {
        exportCommit.failOpenSuffix = null;
        throw Object.assign(new Error("injected export write failure"), {
          code: "EIO",
        });
      }
      return actual.openSync(path, flags, mode);
    },
    opendirSync: hookedOpendirSync,
    readFileSync: hookedReadFileSync,
    readdirSync: hookedReaddirSync,
    readSync: (
      descriptor: Parameters<typeof actual.readSync>[0],
      buffer: Parameters<typeof actual.readSync>[1],
      offset: Parameters<typeof actual.readSync>[2],
      length: Parameters<typeof actual.readSync>[3],
      position: Parameters<typeof actual.readSync>[4],
    ) => {
      exportCommit.maximumReadLength = Math.max(
        exportCommit.maximumReadLength,
        length,
      );
      return actual.readSync(descriptor, buffer, offset, length, position);
    },
    realpathSync: hookedRealpathSync,
    renameSync: (
      oldPath: Parameters<typeof actual.renameSync>[0],
      newPath: Parameters<typeof actual.renameSync>[1],
    ) => {
      actual.renameSync(oldPath, newPath);
      exportCommit.afterCommit?.(oldPath, newPath);
    },
    writeFileSync: hookedWriteFileSync,
  };
});

const roots: string[] = [];
const nativeHelperRoot = mkdtempSync(join(tmpdir(), "sceneaxi-publisher-helper-"));
const publisherExecutable = join(nativeHelperRoot, "sceneaxi-publish-no-replace");
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

beforeAll(() => {
  runFileSync(
    process.env["CC"] ?? "cc",
    [
      "-std=c11",
      "-O2",
      "-Wall",
      "-Wextra",
      "-Werror",
      join(
        import.meta.dirname,
        "../../desktop/linux/src/native/publish-no-replace.c",
      ),
      "-o",
      publisherExecutable,
    ],
    { stdio: "inherit" },
  );
});

afterAll(() => {
  rmSync(nativeHelperRoot, { recursive: true, force: true });
});

afterEach(() => {
  exportCommit.afterCommit = null;
  exportCommit.afterRealpath = null;
  exportCommit.beforeDirectoryRead = null;
  exportCommit.beforeMkdtemp = null;
  exportCommit.beforeMkdir = null;
  exportCommit.beforePublish = null;
  exportCommit.beforeReadFile = null;
  exportCommit.beforeFstat = null;
  exportCommit.failPublish = false;
  exportCommit.failOpenSuffix = null;
  exportCommit.maximumReadLength = 0;
  exportCommit.rejectLinks = false;
  vi.restoreAllMocks();
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function temporary(prefix: string) {
  const root = mkdtempSync(join(tmpdir(), prefix));
  roots.push(root);
  return root;
}

function replaceWithFifo(path: string) {
  unlinkSync(path);
  runFileSync("mkfifo", ["--", path]);
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

function statusIdentity(bridge: ReturnType<typeof createDesktopBridge>) {
  const response = bridge.handle({
    action: "authoring",
    payload: { op: "status", documentPath: "scene.json" },
  });
  expect(response).toMatchObject({ ok: true, data: { ok: true } });
  if (!response.ok) throw new Error(response.message);
  return response.data as {
    contentHash: string;
    contentByteLength: number;
  };
}

function statusHash(bridge: ReturnType<typeof createDesktopBridge>) {
  return statusIdentity(bridge).contentHash;
}

function exportProject(root: string, runtimeJavaScript = RUNTIME) {
  const bridge = createDesktopBridge({ cwd: root });
  const identity = statusIdentity(bridge);
  return exportDesktopWebProject({
    projectRoot: root,
    documentPath: "scene.json",
    expectedContentHash: identity.contentHash,
    expectedContentByteLength: identity.contentByteLength,
    runtimeJavaScript,
    publisherExecutable,
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
  const bridge = createDesktopBridge({
    cwd: root,
    webExportRuntime: RUNTIME,
    webExportPublisherExecutable: publisherExecutable,
  });
  const expectedContentHash = statusHash(bridge);
  const response = bridge.handle({
    action: "ship",
    payload: { op: "export-web", documentPath: "scene.json", expectedContentHash },
  });
  if (!response.ok) throw new Error(response.message);
  expect(response).toMatchObject({ ok: true, action: "ship" });
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
    expect(
      readdirSync(join(firstRoot, "exports/web"))
        .filter((name) => name.startsWith(".sceneaxi-export-")),
    ).toEqual([]);

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
    expect(first.bundleDigest).not.toBe(second.bundleDigest);
    const firstToolVersionBytes = Buffer.from(`${first.handoff.product.version}\n`);
    const secondToolVersionBytes = Buffer.from(`${second.handoff.product.version}\n`);
    expect(
      readFileSync(join(first.outputDirectory, "sceneaxi-tool-version.txt")),
    ).toEqual(firstToolVersionBytes);
    expect(
      readFileSync(join(second.outputDirectory, "sceneaxi-tool-version.txt")),
    ).toEqual(secondToolVersionBytes);
    expect(first.handoff.artifacts["sceneaxi-tool-version.txt"]?.digest).toBe(
      sha256(firstToolVersionBytes),
    );
    expect(second.handoff.artifacts["sceneaxi-tool-version.txt"]?.digest).toBe(
      sha256(secondToolVersionBytes),
    );
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
        expectedContentByteLength: Buffer.byteLength(invalid),
        runtimeJavaScript: RUNTIME,
        publisherExecutable,
      }),
    ).toMatchObject({ ok: false, reason: DESKTOP_WEB_EXPORT_REFUSALS.sceneInvalid });

    const staleRoot = temporary("sceneaxi-export-stale-");
    expect(seedDesktopProject(staleRoot)).toEqual({ ok: true, migrated: false });
    const staleIdentity = statusIdentity(createDesktopBridge({ cwd: staleRoot }));
    expect(
      exportDesktopWebProject({
        projectRoot: staleRoot,
        documentPath: "scene.json",
        expectedContentHash: `sha256:${"0".repeat(64)}`,
        expectedContentByteLength: staleIdentity.contentByteLength,
        runtimeJavaScript: RUNTIME,
        publisherExecutable,
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
      webExportPublisherExecutable: publisherExecutable,
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
    const dirtyBridge = createDesktopBridge({
      cwd: dirtyRoot,
      webExportRuntime: RUNTIME,
      webExportPublisherExecutable: publisherExecutable,
    });
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

  it("refuses a FIFO scene document before preparing export storage", () => {
    const root = temporary("sceneaxi-export-fifo-document-");
    expect(seedDesktopProject(root)).toEqual({ ok: true, migrated: false });
    const bridge = createDesktopBridge({
      cwd: root,
      webExportRuntime: RUNTIME,
      webExportPublisherExecutable: publisherExecutable,
    });
    const expectedContentHash = statusHash(bridge);
    replaceWithFifo(join(root, "scene.json"));

    const result = bridge.handle({
      action: "ship",
      payload: {
        op: "export-web",
        documentPath: "scene.json",
        expectedContentHash,
      },
    });

    expect(result).toMatchObject({
      ok: false,
      reason: DESKTOP_WEB_EXPORT_REFUSALS.unsafePath,
    });
    expect(existsSync(join(root, "exports"))).toBe(false);
  });

  it("refuses unsupported desktop platforms before project access", () => {
    for (const webExportPlatform of ["win32", "darwin"] as const) {
      const root = temporary(`sceneaxi-export-${webExportPlatform}-`);
      let sessionCreated = false;
      const bridge = createDesktopBridge({
        cwd: root,
        webExportPlatform,
        createAuthoringSession: () => {
          sessionCreated = true;
          throw new Error("unsupported platform reached the authoring session");
        },
      });

      const result = bridge.handle({
        action: "ship",
        payload: {
          op: "export-web",
          documentPath: "scene.json",
          expectedContentHash: `sha256:${"0".repeat(64)}`,
        },
      });

      expect(result).toMatchObject({
        ok: false,
        reason: DESKTOP_WEB_EXPORT_REFUSALS.platformUnsupported,
      });
      expect(sessionCreated).toBe(false);
      expect(readdirSync(root)).toEqual([]);
    }
  });

  it("refuses final document size drift without an unbounded replacement read", () => {
    const root = temporary("sceneaxi-export-document-size-drift-");
    expect(seedDesktopProject(root)).toEqual({ ok: true, migrated: false });
    const bridge = createDesktopBridge({ cwd: root });
    const identity = statusIdentity(bridge);
    let replaced = false;
    exportCommit.afterCommit = () => {
      exportCommit.afterCommit = null;
      replaced = true;
      truncateSync(join(root, "scene.json"), PROJECT_ASSET_MAX_BYTES + 1);
      exportCommit.maximumReadLength = 0;
    };

    const result = exportDesktopWebProject({
      projectRoot: root,
      documentPath: "scene.json",
      expectedContentHash: identity.contentHash,
      expectedContentByteLength: identity.contentByteLength,
      runtimeJavaScript: RUNTIME,
      publisherExecutable,
    });

    expect(replaced).toBe(true);
    expect(result).toMatchObject({
      ok: false,
      reason: DESKTOP_WEB_EXPORT_REFUSALS.projectChanged,
    });
    expect(exportCommit.maximumReadLength).toBeLessThanOrEqual(64 * 1024);
  });

  it("refuses initial document size drift before reading replacement bytes", () => {
    const root = temporary("sceneaxi-export-initial-size-drift-");
    expect(seedDesktopProject(root)).toEqual({ ok: true, migrated: false });
    const bridge = createDesktopBridge({
      cwd: root,
      webExportRuntime: RUNTIME,
      webExportPublisherExecutable: publisherExecutable,
    });
    const expectedContentHash = statusHash(bridge);
    truncateSync(join(root, "scene.json"), 64 * 1024 + 1);
    exportCommit.maximumReadLength = 0;

    const result = bridge.handle({
      action: "ship",
      payload: {
        op: "export-web",
        documentPath: "scene.json",
        expectedContentHash,
      },
    });

    expect(result).toMatchObject({
      ok: false,
      reason: DESKTOP_WEB_EXPORT_REFUSALS.projectChanged,
    });
    expect(exportCommit.maximumReadLength).toBe(0);
    expect(existsSync(join(root, "exports"))).toBe(false);
  });

  it("refuses a FIFO accepted asset before preparing export storage", () => {
    const sourceRoot = temporary("sceneaxi-export-fifo-source-");
    const source = join(sourceRoot, "triangle.gltf");
    writeFileSync(source, containedTriangle());
    const root = temporary("sceneaxi-export-fifo-asset-");
    seedWithAsset(root, source);
    const bridge = createDesktopBridge({ cwd: root });
    const identity = statusIdentity(bridge);
    replaceWithFifo(join(root, "assets/triangle.gltf"));

    const result = exportDesktopWebProject({
      projectRoot: root,
      documentPath: "scene.json",
      expectedContentHash: identity.contentHash,
      expectedContentByteLength: identity.contentByteLength,
      runtimeJavaScript: RUNTIME,
      publisherExecutable,
    });

    expect(result).toMatchObject({
      ok: false,
      reason: DESKTOP_WEB_EXPORT_REFUSALS.unsafePath,
    });
    expect(existsSync(join(root, "exports"))).toBe(false);
  });

  it("refuses an asset that changes during the export commit", () => {
    const sourceRoot = temporary("sceneaxi-export-race-source-");
    const source = join(sourceRoot, "triangle.gltf");
    writeFileSync(source, containedTriangle());
    const root = temporary("sceneaxi-export-race-");
    seedWithAsset(root, source);
    const bridge = createDesktopBridge({ cwd: root });
    const identity = statusIdentity(bridge);
    let committed = false;
    exportCommit.afterCommit = () => {
      exportCommit.afterCommit = null;
      committed = true;
      writeFileSync(join(root, "assets/triangle.gltf"), "changed after capture");
    };

    const result = exportDesktopWebProject({
      projectRoot: root,
      documentPath: "scene.json",
      expectedContentHash: identity.contentHash,
      expectedContentByteLength: identity.contentByteLength,
      runtimeJavaScript: RUNTIME,
      publisherExecutable,
    });

    expect(committed).toBe(true);
    expect(result).toMatchObject({
      ok: false,
      reason: DESKTOP_WEB_EXPORT_REFUSALS.assetInvalid,
    });
  });

  it("preserves unrelated export scratch directories", () => {
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
    const identity = statusIdentity(bridge);

    const result = exportDesktopWebProject({
      projectRoot: root,
      documentPath: "scene.json",
      expectedContentHash: identity.contentHash,
      expectedContentByteLength: identity.contentByteLength,
      runtimeJavaScript: RUNTIME,
      publisherExecutable,
    });

    expect(result.ok).toBe(true);
    expect(existsSync(sentinel)).toBe(true);
    expect(readFileSync(sentinel, "utf8")).toBe("keep");
  });

  it("never adopts a predictable staging directory", () => {
    const root = temporary("sceneaxi-export-predictable-staging-");
    expect(seedDesktopProject(root)).toEqual({ ok: true, migrated: false });
    const first = ship(root);
    rmSync(first.outputDirectory, { recursive: true });
    const unowned = join(
      root,
      "exports/web",
      `.sceneaxi-export-${first.bundleDigest.slice("sha256:".length)}`,
    );
    mkdirSync(unowned);
    const sentinel = join(unowned, "operator-data.txt");
    writeFileSync(sentinel, "keep");

    const result = exportProject(root);

    expect(result.ok).toBe(true);
    expect(readFileSync(sentinel, "utf8")).toBe("keep");
    expect(existsSync(first.outputDirectory)).toBe(true);
  });

  it("preserves a staging pathname reoccupied after publication", () => {
    const root = temporary("sceneaxi-export-reoccupied-staging-");
    expect(seedDesktopProject(root)).toEqual({ ok: true, migrated: false });
    let replacement: string | null = null;
    exportCommit.afterCommit = (source) => {
      exportCommit.afterCommit = null;
      if (typeof source !== "string") throw new Error("staging source was not a path");
      replacement = join(realpathSync(dirname(source)), basename(source));
      mkdirSync(source);
      writeFileSync(join(source, "operator-data.txt"), "keep");
    };

    const result = exportProject(root);

    expect(result.ok).toBe(true);
    expect(replacement).not.toBeNull();
    expect(readFileSync(join(replacement ?? "", "operator-data.txt"), "utf8"))
      .toBe("keep");
  });

  it("never cleans a successfully published workspace", () => {
    const root = temporary("sceneaxi-export-published-cleanup-");
    expect(seedDesktopProject(root)).toEqual({ ok: true, migrated: false });
    let movedBundle: string | null = null;
    exportCommit.afterCommit = (source, destination, stagingDescriptor) => {
      exportCommit.afterCommit = null;
      if (typeof source !== "string" || typeof destination !== "string") {
        throw new Error("publication paths were not strings");
      }
      const stableSource = join(realpathSync(dirname(source)), basename(source));
      const stableDestination = join(
        realpathSync(dirname(destination)),
        basename(destination),
      );
      exportCommit.beforeFstat = (descriptor) => {
        if (descriptor !== stagingDescriptor) return;
        let held: string;
        try {
          held = realpathSync(`/proc/self/fd/${String(descriptor)}`);
        } catch {
          return;
        }
        if (held !== stableDestination) return;
        exportCommit.beforeFstat = null;
        renameSync(destination, source);
        movedBundle = stableSource;
      };
    };

    const result = exportProject(root);

    expect(result.ok).toBe(true);
    expect(movedBundle).not.toBeNull();
    expect(readFileSync(join(movedBundle ?? "", "sceneaxi-web.js"))).toEqual(
      RUNTIME,
    );
  });

  it("refuses a committed bundle that changes before success", () => {
    const root = temporary("sceneaxi-export-destination-race-");
    expect(seedDesktopProject(root)).toEqual({ ok: true, migrated: false });
    const bridge = createDesktopBridge({ cwd: root });
    const identity = statusIdentity(bridge);
    let committed = false;
    exportCommit.afterCommit = (_oldPath, newPath) => {
      exportCommit.afterCommit = null;
      if (typeof newPath !== "string") throw new Error("export destination was not a path");
      committed = true;
      writeFileSync(join(newPath, "index.html"), "changed after commit");
    };

    const result = exportDesktopWebProject({
      projectRoot: root,
      documentPath: "scene.json",
      expectedContentHash: identity.contentHash,
      expectedContentByteLength: identity.contentByteLength,
      runtimeJavaScript: RUNTIME,
      publisherExecutable,
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
    exportCommit.afterCommit = () => {
      exportCommit.afterCommit = null;
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

  it("never replaces a directory raced into the content address", () => {
    const root = temporary("sceneaxi-export-destination-claim-");
    expect(seedDesktopProject(root)).toEqual({ ok: true, migrated: false });
    const first = ship(root);
    rmSync(first.outputDirectory, { recursive: true });
    exportCommit.beforePublish = (_source, destination) => {
      exportCommit.beforePublish = null;
      mkdirSync(destination);
    };

    const result = exportProject(root);

    expect(result).toMatchObject({
      ok: false,
      reason: DESKTOP_WEB_EXPORT_REFUSALS.destinationConflict,
    });
    expect(readdirSync(first.outputDirectory)).toEqual([]);
  });

  it("never trusts a forged recovery claim at the content address", () => {
    const root = temporary("sceneaxi-export-forged-claim-");
    expect(seedDesktopProject(root)).toEqual({ ok: true, migrated: false });
    const first = ship(root);
    const digest = basename(first.outputDirectory);
    rmSync(first.outputDirectory, { recursive: true });
    mkdirSync(first.outputDirectory);
    const claim = `sceneaxi-web-export-claim-v1\n${digest}\n`;
    writeFileSync(join(first.outputDirectory, ".sceneaxi-claim"), claim);
    writeFileSync(join(first.outputDirectory, "index.html"), "operator bytes");

    const result = exportProject(root);

    expect(result).toMatchObject({
      ok: false,
      reason: DESKTOP_WEB_EXPORT_REFUSALS.destinationConflict,
    });
    expect(readFileSync(join(first.outputDirectory, ".sceneaxi-claim"), "utf8"))
      .toBe(claim);
    expect(readFileSync(join(first.outputDirectory, "index.html"), "utf8"))
      .toBe("operator bytes");
  });

  it("holds the export parent when its pathname becomes a symlink", () => {
    const root = temporary("sceneaxi-export-parent-race-");
    expect(seedDesktopProject(root)).toEqual({ ok: true, migrated: false });
    const webRoot = join(root, "exports/web");
    mkdirSync(webRoot, { recursive: true });
    const outside = temporary("sceneaxi-export-parent-race-outside-");
    let swapped = false;
    const swap = () => {
      if (swapped) return;
      rmSync(webRoot, { recursive: true });
      symlinkSync(outside, webRoot, "dir");
      swapped = true;
    };
    exportCommit.afterRealpath = (path, resolved) => {
      if (!String(path).startsWith("/proc/self/fd/") || resolved !== webRoot) return;
      exportCommit.afterRealpath = null;
      exportCommit.beforeMkdtemp = null;
      swap();
    };
    exportCommit.beforeMkdtemp = (prefix) => {
      if (dirname(String(prefix)) !== webRoot) return;
      exportCommit.afterRealpath = null;
      exportCommit.beforeMkdtemp = null;
      swap();
    };

    const result = exportProject(root);

    expect(swapped).toBe(true);
    expect(result.ok).toBe(false);
    expect(readdirSync(outside)).toEqual([]);
  });

  it("names symlinked export ancestors as unsafe paths", () => {
    for (const nested of [false, true]) {
      const root = temporary(
        nested
          ? "sceneaxi-export-unsafe-web-parent-"
          : "sceneaxi-export-unsafe-exports-parent-",
      );
      expect(seedDesktopProject(root)).toEqual({ ok: true, migrated: false });
      const outside = temporary("sceneaxi-export-unsafe-parent-outside-");
      const target = nested ? join(root, "exports/web") : join(root, "exports");
      if (nested) mkdirSync(join(root, "exports"));
      symlinkSync(outside, target, "dir");

      const result = exportProject(root);

      expect(result).toMatchObject({
        ok: false,
        reason: DESKTOP_WEB_EXPORT_REFUSALS.unsafePath,
      });
      expect(readdirSync(outside)).toEqual([]);
    }
  });

  it("refuses publication after the held export parent is detached", () => {
    const root = temporary("sceneaxi-export-detached-parent-");
    expect(seedDesktopProject(root)).toEqual({ ok: true, migrated: false });
    const first = ship(root);
    rmSync(first.outputDirectory, { recursive: true });
    const webRoot = join(root, "exports/web");
    const outside = temporary("sceneaxi-export-detached-parent-outside-");
    const detached = join(outside, "web");
    let swapped = false;
    exportCommit.beforePublish = () => {
      exportCommit.beforePublish = null;
      renameSync(webRoot, detached);
      mkdirSync(webRoot);
      swapped = true;
    };

    const result = exportProject(root);

    expect(swapped).toBe(true);
    expect(result.ok).toBe(false);
    expect(
      existsSync(join(detached, first.bundleDigest.slice("sha256:".length))),
    ).toBe(false);
  });

  it("prepares export ancestors through held directory identities", () => {
    const root = temporary("sceneaxi-export-ancestor-race-");
    expect(seedDesktopProject(root)).toEqual({ ok: true, migrated: false });
    const exportsRoot = join(root, "exports");
    const outside = temporary("sceneaxi-export-ancestor-race-outside-");
    let swapped = false;
    exportCommit.beforeMkdir = (path) => {
      const candidate = String(path);
      if (basename(candidate) !== "web") return;
      if (realpathSync(dirname(candidate)) !== exportsRoot) return;
      exportCommit.beforeMkdir = null;
      rmSync(exportsRoot, { recursive: true });
      symlinkSync(outside, exportsRoot, "dir");
      swapped = true;
    };

    const result = exportProject(root);

    expect(swapped).toBe(true);
    expect(result.ok).toBe(false);
    expect(readdirSync(outside)).toEqual([]);
  });

  it("exports when hard links are unavailable", () => {
    const root = temporary("sceneaxi-export-without-hardlinks-");
    expect(seedDesktopProject(root)).toEqual({ ok: true, migrated: false });
    exportCommit.rejectLinks = true;

    const result = exportProject(root);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.message);
    expect(readFileSync(join(result.outputDirectory, "sceneaxi-web.js"))).toEqual(
      RUNTIME,
    );
  });

  it("publishes without resolving a host utility from PATH", () => {
    const root = temporary("sceneaxi-export-packaged-publisher-");
    expect(seedDesktopProject(root)).toEqual({ ok: true, migrated: false });
    const previousPath = process.env["PATH"];
    process.env["PATH"] = "";
    try {
      const result = exportProject(root);
      expect(result.ok).toBe(true);
    } finally {
      if (previousPath === undefined) delete process.env["PATH"];
      else process.env["PATH"] = previousPath;
    }
  });

  it("adds the native publisher only to the Linux runtime build", () => {
    const appRoot = join(import.meta.dirname, "../../desktop/linux");
    runFileSync(
      process.execPath,
      [join(appRoot, "scripts/build.mjs")],
      {
        cwd: appRoot,
        env: { ...process.env, CC: "/missing-sceneaxi-compiler" },
        stdio: "pipe",
      },
    );
    expect(readdirSync(join(appRoot, "dist")).sort()).toEqual([
      "index.html",
      "main.cjs",
      "preload.cjs",
      "renderer.js",
    ]);

    runFileSync(
      process.execPath,
      [join(appRoot, "scripts/build-linux.mjs")],
      { cwd: appRoot, stdio: "pipe" },
    );
    expect(readdirSync(join(appRoot, "dist")).sort()).toEqual([
      "index.html",
      "main.cjs",
      "preload.cjs",
      "renderer.js",
      "sceneaxi-publish-no-replace",
    ]);
  });

  it("streams maximum-size assets through bounded reads", () => {
    const root = temporary("sceneaxi-export-bounded-stream-");
    expect(seedDesktopProject(root)).toEqual({ ok: true, migrated: false });
    const asset = join(root, "assets/maximum.bin");
    mkdirSync(join(root, "assets"), { recursive: true });
    writeFileSync(asset, "fixture");
    truncateSync(asset, PROJECT_ASSET_MAX_BYTES);
    rewriteDocument(root, (document) => {
      (document["data"] as Record<string, unknown>)["webExperience"] = {
        html: "<main>Fixture</main>",
        assets: ["assets/maximum.bin"],
      };
    });
    exportCommit.maximumReadLength = 0;

    const result = exportProject(root);

    expect(result.ok).toBe(true);
    expect(exportCommit.maximumReadLength).toBeLessThanOrEqual(64 * 1024);
  });

  it("retries an export after an interrupted staging write", () => {
    const root = temporary("sceneaxi-export-resumable-commit-");
    expect(seedDesktopProject(root)).toEqual({ ok: true, migrated: false });
    exportCommit.failOpenSuffix = "/sceneaxi-web.js";

    const interrupted = exportProject(root);
    const retainedStaging = readdirSync(join(root, "exports/web"))
      .filter((name) => name.startsWith(".sceneaxi-export-"));

    expect(interrupted).toMatchObject({
      ok: false,
      reason: DESKTOP_WEB_EXPORT_REFUSALS.writeFailed,
    });
    expect(retainedStaging).toHaveLength(1);
    const retained = join(root, "exports/web", retainedStaging[0] ?? "");
    expect(lstatSync(retained).isDirectory()).toBe(true);
    expect(readdirSync(retained)).toEqual([]);
    const resumed = exportProject(root);
    expect(resumed.ok).toBe(true);
    if (!resumed.ok) throw new Error(resumed.message);
    expect(
      readdirSync(join(root, "exports/web"))
        .filter((name) => name.startsWith(".sceneaxi-export-")),
    ).toEqual(retainedStaging);
    expect(readdirSync(retained)).toEqual([]);
    expect(readFileSync(join(resumed.outputDirectory, "sceneaxi-web.js"))).toEqual(
      RUNTIME,
    );
  });

  it("reports asset staging write failures as export write failures", () => {
    const sourceRoot = temporary("sceneaxi-export-asset-write-source-");
    const source = join(sourceRoot, "triangle.gltf");
    writeFileSync(source, containedTriangle());
    const root = temporary("sceneaxi-export-asset-write-");
    seedWithAsset(root, source);
    exportCommit.failOpenSuffix = "/triangle.gltf";

    const result = exportProject(root);

    expect(result).toMatchObject({
      ok: false,
      reason: DESKTOP_WEB_EXPORT_REFUSALS.writeFailed,
    });
  });

  it("retries after publication is interrupted before the content address", () => {
    const root = temporary("sceneaxi-export-interrupted-publication-");
    expect(seedDesktopProject(root)).toEqual({ ok: true, migrated: false });
    const first = ship(root);
    rmSync(first.outputDirectory, { recursive: true });
    exportCommit.failPublish = true;

    const interrupted = exportProject(root);

    expect(interrupted).toMatchObject({
      ok: false,
      reason: DESKTOP_WEB_EXPORT_REFUSALS.writeFailed,
    });
    expect(existsSync(first.outputDirectory)).toBe(false);

    const retried = exportProject(root);
    expect(retried.ok).toBe(true);
    if (!retried.ok) throw new Error(retried.message);
    expect(retried.outputDirectory).toBe(first.outputDirectory);
  });

  it("never writes through a raced nested destination symlink", () => {
    const root = temporary("sceneaxi-export-nested-destination-");
    expect(seedDesktopProject(root)).toEqual({ ok: true, migrated: false });
    const first = ship(root);
    rmSync(first.outputDirectory, { recursive: true });
    const outside = temporary("sceneaxi-export-nested-destination-outside-");
    let raced = false;
    exportCommit.beforeMkdir = (path) => {
      const candidate = String(path);
      if (basename(candidate) !== "source") return;
      if (!basename(realpathSync(dirname(candidate))).startsWith(".sceneaxi-export-")) {
        return;
      }
      exportCommit.beforeMkdir = null;
      symlinkSync(outside, candidate, "dir");
      raced = true;
    };

    const result = exportProject(root);

    expect(result).toMatchObject({
      ok: false,
      reason: DESKTOP_WEB_EXPORT_REFUSALS.writeFailed,
    });
    expect(raced).toBe(true);
    expect(readdirSync(outside)).toEqual([]);
  });

  it("refuses a replay whose artifact becomes an out-of-root symlink", () => {
    const root = temporary("sceneaxi-export-replay-link-race-");
    expect(seedDesktopProject(root)).toEqual({ ok: true, migrated: false });
    const first = ship(root);
    const index = join(first.outputDirectory, "index.html");
    const outside = temporary("sceneaxi-export-replay-link-race-outside-");
    const outsideIndex = join(outside, "index.html");
    writeFileSync(outsideIndex, readFileSync(index));
    let swapped = false;
    const swap = (resolved: string) => {
      if (resolved !== index || swapped) return;
      exportCommit.afterRealpath = null;
      exportCommit.beforeReadFile = null;
      unlinkSync(index);
      symlinkSync(outsideIndex, index);
      swapped = true;
    };
    exportCommit.afterRealpath = (_path, resolved) => swap(resolved);
    exportCommit.beforeReadFile = (path) => swap(String(path));

    const result = exportProject(root);

    expect(swapped).toBe(true);
    expect(result).toMatchObject({
      ok: false,
      reason: DESKTOP_WEB_EXPORT_REFUSALS.destinationConflict,
    });
    expect(lstatSync(index).isSymbolicLink()).toBe(true);
  });

  it("rejects an unexpected replay subtree without entering it", () => {
    const root = temporary("sceneaxi-export-replay-subtree-");
    expect(seedDesktopProject(root)).toEqual({ ok: true, migrated: false });
    const first = ship(root);
    const unexpected = join(first.outputDirectory, "unexpected");
    mkdirSync(join(unexpected, "nested", "tree"), { recursive: true });
    writeFileSync(join(unexpected, "nested", "tree", "bytes.bin"), "unexpected");
    let enteredUnexpectedTree = false;
    exportCommit.beforeDirectoryRead = (path) => {
      const resolved = realpathSync(String(path));
      if (
        resolved === unexpected ||
        resolved.startsWith(`${unexpected}${sep}`)
      ) {
        enteredUnexpectedTree = true;
      }
    };

    const result = exportProject(root);

    expect(result).toMatchObject({
      ok: false,
      reason: DESKTOP_WEB_EXPORT_REFUSALS.destinationConflict,
    });
    expect(enteredUnexpectedTree).toBe(false);
  });

  it("reads a contained asset through one stable file identity", () => {
    const root = temporary("sceneaxi-export-stable-asset-");
    expect(seedDesktopProject(root)).toEqual({ ok: true, migrated: false });
    const asset = join(root, "assets/web-only.bin");
    mkdirSync(join(root, "assets"), { recursive: true });
    const inside = Buffer.from("contained bytes");
    const outside = Buffer.from("outside bytes");
    writeFileSync(asset, inside);
    rewriteDocument(root, (document) => {
      (document["data"] as Record<string, unknown>)["webExperience"] = {
        html: "<main>Fixture</main>",
        assets: ["assets/web-only.bin"],
      };
    });
    const outsideRoot = temporary("sceneaxi-export-stable-asset-outside-");
    const outsideAsset = join(outsideRoot, "outside.bin");
    writeFileSync(outsideAsset, outside);
    let swapped = false;
    let assetReads = 0;
    exportCommit.afterRealpath = (path, resolved) => {
      if (!String(path).startsWith("/proc/self/fd/") || resolved !== asset) return;
      assetReads += 1;
      if (assetReads !== 2) return;
      exportCommit.afterRealpath = null;
      unlinkSync(asset);
      symlinkSync(outsideAsset, asset);
      swapped = true;
    };
    exportCommit.afterCommit = () => {
      exportCommit.afterCommit = null;
      if (!swapped) return;
      unlinkSync(asset);
      writeFileSync(asset, inside);
    };

    const result = exportProject(root);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.message);
    expect(swapped).toBe(true);
    expect(readFileSync(join(result.outputDirectory, "assets/web-only.bin"))).toEqual(
      inside,
    );
  });

  it("refuses an oversized Web-only asset before reading its bytes", () => {
    const root = temporary("sceneaxi-export-oversized-web-asset-");
    expect(seedDesktopProject(root)).toEqual({ ok: true, migrated: false });
    const asset = join(root, "assets/web-only.bin");
    mkdirSync(join(root, "assets"), { recursive: true });
    writeFileSync(asset, "fixture");
    truncateSync(asset, PROJECT_ASSET_MAX_BYTES + 1);
    rewriteDocument(root, (document) => {
      (document["data"] as Record<string, unknown>)["webExperience"] = {
        html: "<main>Fixture</main>",
        assets: ["assets/web-only.bin"],
      };
    });

    expect(exportProject(root)).toMatchObject({
      ok: false,
      reason: DESKTOP_WEB_EXPORT_REFUSALS.assetInvalid,
    });
  });
});
