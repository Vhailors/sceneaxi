import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  SCENE_PACKAGE_REFUSALS,
  createEditorCommandInvocation,
  type EditorCommandClient,
  type JsonObject,
} from "@sceneaxi/schemas";
import {
  DESKTOP_ACTIVE_DOCUMENT_PATH,
  createDesktopBridge,
  seedDesktopProject,
} from "../../desktop/linux/src/index.ts";

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const manifest = Object.freeze({
  pluginId: "dev.sceneaxi.sample.intake-source",
  pluginVersion: "0.1.0",
  capabilities: Object.freeze(["sceneaxi.sculpt.intake-source.v1"]),
});
const digest = `sha256:${createHash("sha256").update("contained-package-lock").digest("hex")}`;

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "sceneaxi-package-golden-"));
  dirs.push(root);
  expect(seedDesktopProject(root)).toEqual({ ok: true, migrated: false });
  return root;
}

function bridge(root: string) {
  return createDesktopBridge({
    cwd: root,
    commandCapabilities: ["scene.compose", "authoring.change-review", "authoring.undo", "authoring.redo"],
  });
}

function hash(host: ReturnType<typeof createDesktopBridge>) {
  const response = host.handle({
    action: "authoring",
    payload: { op: "status", documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH },
  });
  if (!response.ok || typeof (response.data as { contentHash?: unknown }).contentHash !== "string") {
    throw new Error("fixture status did not return a content hash");
  }
  return (response.data as { contentHash: string }).contentHash;
}

function command(
  host: ReturnType<typeof createDesktopBridge>,
  commandId: Parameters<typeof createEditorCommandInvocation>[0],
  client: EditorCommandClient,
  input: JsonObject,
) {
  return host.handle({
    action: "command",
    payload: createEditorCommandInvocation(commandId, client, input, "game"),
  });
}

describe("full-editor package manager vertical", () => {
  it("installs a contained package through review and consumes the same lock after undo/redo", () => {
    const root = fixture();
    const host = bridge(root);
    const before = readFileSync(join(root, DESKTOP_ACTIVE_DOCUMENT_PATH));
    expect(command(host, "package-install", "desktop-control", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
      expectedContentHash: hash(host),
      profile: "game",
      locator: "fixtures/plugin-host/sculpt-intake-source",
      manifest,
      digest,
    })).toMatchObject({ ok: true, data: { marketplace: false, networking: false } });
    expect(command(host, "change-review-accept", "cli", {})).toMatchObject({ ok: true });
    const inspected = command(host, "package-inspect", "local-agent", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
      profile: "game",
    });
    expect(inspected).toMatchObject({
      ok: true,
      data: {
        kind: "sceneaxi.scene-package-inspection",
        catalog: { lock: [{ packageId: "dev.sceneaxi.sample.intake-source", version: "0.1.0" }] },
        savedBytesWritten: false,
      },
    });
    expect(command(host, "edit-undo", "desktop-control", {})).toMatchObject({ ok: true });
    expect(command(host, "package-inspect", "cli", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
      profile: "game",
    })).toMatchObject({ ok: true, data: { catalog: { lock: [] } } });
    expect(command(host, "edit-redo", "desktop-control", {})).toMatchObject({ ok: true });
    expect(before.equals(readFileSync(join(root, DESKTOP_ACTIVE_DOCUMENT_PATH)))).toBe(false);
  });

  it("names unavailable sources, missing capabilities, and Kids before writes", () => {
    const root = fixture();
    const host = bridge(root);
    expect(command(host, "package-install", "desktop-control", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
      expectedContentHash: hash(host),
      profile: "game",
      locator: "https://example.invalid/plugin",
      manifest,
      digest,
    })).toMatchObject({ ok: false, reason: SCENE_PACKAGE_REFUSALS.sourceUnavailable });
    expect(command(host, "package-install", "desktop-control", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
      expectedContentHash: hash(host),
      profile: "game",
      locator: "fixtures/plugin-host/sculpt-intake-source",
      manifest: { ...manifest, capabilities: ["sceneaxi.unknown.v1"] },
      digest,
    })).toMatchObject({ ok: false, reason: SCENE_PACKAGE_REFUSALS.capabilityMissing });
    expect(createEditorCommandInvocation("package-install", "desktop-control", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
      expectedContentHash: hash(host),
      profile: "kids",
      locator: "fixtures/plugin-host/sculpt-intake-source",
      manifest,
      digest,
    }, "kids")).toBeTruthy();
    expect(host.handle({
      action: "command",
      payload: createEditorCommandInvocation("package-install", "desktop-control", {
        documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
        expectedContentHash: hash(host),
        profile: "kids",
        locator: "fixtures/plugin-host/sculpt-intake-source",
        manifest,
        digest,
      }, "kids"),
    })).toMatchObject({ ok: false });
  });

  it("returns PACKAGE_CATALOG_INVALID when a project-controlled catalog is malformed", () => {
    const root = fixture();
    const host = bridge(root);
    const documentPath = join(root, DESKTOP_ACTIVE_DOCUMENT_PATH);
    const document = JSON.parse(readFileSync(documentPath, "utf8")) as { data: Record<string, unknown> };
    const before = readFileSync(documentPath, "utf8");
    document.data["scenePackages"] = {
      schemaVersion: 1,
      kind: "sceneaxi.scene-package-catalog",
      lock: "evil",
    };
    writeFileSync(documentPath, `${JSON.stringify(document, null, 2)}\n`);
    expect(readFileSync(documentPath, "utf8")).not.toBe(before);

    expect(command(host, "package-inspect", "local-agent", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
      profile: "game",
    })).toMatchObject({ ok: false, reason: SCENE_PACKAGE_REFUSALS.catalogInvalid });

    expect(command(host, "package-install", "desktop-control", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
      expectedContentHash: hash(host),
      profile: "game",
      locator: "fixtures/plugin-host/sculpt-intake-source",
      manifest,
      digest,
    })).toMatchObject({ ok: false, reason: SCENE_PACKAGE_REFUSALS.catalogInvalid });
  });

  it("refuses a present null catalog while keeping the absent-key empty default", () => {
    const root = fixture();
    const host = bridge(root);
    const documentPath = join(root, DESKTOP_ACTIVE_DOCUMENT_PATH);
    const document = JSON.parse(readFileSync(documentPath, "utf8")) as { data: Record<string, unknown> };
    document.data["scenePackages"] = null;
    writeFileSync(documentPath, `${JSON.stringify(document, null, 2)}\n`);

    expect(command(host, "package-inspect", "local-agent", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
      profile: "game",
    })).toMatchObject({ ok: false, reason: SCENE_PACKAGE_REFUSALS.catalogInvalid });
    expect(command(host, "package-install", "desktop-control", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
      expectedContentHash: hash(host),
      profile: "game",
      locator: "fixtures/plugin-host/sculpt-intake-source",
      manifest,
      digest,
    })).toMatchObject({ ok: false, reason: SCENE_PACKAGE_REFUSALS.catalogInvalid });

    delete document.data["scenePackages"];
    writeFileSync(documentPath, `${JSON.stringify(document, null, 2)}\n`);
    expect(command(host, "package-inspect", "local-agent", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
      profile: "game",
    })).toMatchObject({
      ok: true,
      data: { kind: "sceneaxi.scene-package-inspection", catalog: { lock: [] } },
    });
  });
});
