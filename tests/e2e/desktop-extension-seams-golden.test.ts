import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  EXTENSION_SEAM_CAPABILITY_IDS,
  EXTENSION_SEAM_REFUSALS,
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

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "sceneaxi-extension-golden-"));
  dirs.push(root);
  expect(seedDesktopProject(root)).toEqual({ ok: true, migrated: false });
  return root;
}

function bridge(root: string) {
  return createDesktopBridge({
    cwd: root,
    commandCapabilities: ["scene.compose", "authoring.change-review"],
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
  profile: "game" | "web" | "kids" = "game",
) {
  return host.handle({
    action: "command",
    payload: createEditorCommandInvocation(commandId, client, input, profile),
  });
}

describe("full-editor extension seams vertical", () => {
  it("reports the same disabled seams across clients and never starts them", () => {
    const root = fixture();
    const host = bridge(root);
    const first = command(host, "extension-inspect", "desktop-control", { profile: "game" });
    const second = command(host, "extension-inspect", "cli", { profile: "game" });
    const third = command(host, "extension-inspect", "local-agent", { profile: "game" });
    expect(first).toMatchObject({
      ok: true,
      data: {
        kind: "sceneaxi.extension-seams",
        seams: [
          { id: "networking", status: "disabled", startsListener: false },
          { id: "xr", status: "disabled", startsSession: false },
          { id: "marketplace", status: "disabled", startsTransaction: false },
          { id: "collaboration", status: "disabled", startsChannel: false },
        ],
      },
    });
    expect(second).toEqual(first);
    expect(third).toEqual(first);
    expect(command(host, "extension-start", "desktop-control", {
      profile: "game",
      seamId: "networking",
    })).toMatchObject({ ok: false, reason: EXTENSION_SEAM_REFUSALS.adapterAbsent });
  });

  it("refuses Kids and package grants of declared-but-disabled seams", () => {
    const root = fixture();
    const host = bridge(root);
    expect(command(host, "extension-inspect", "desktop-control", { profile: "kids" }, "kids"))
      .toMatchObject({ ok: false });
    expect(command(host, "package-install", "cli", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
      expectedContentHash: hash(host),
      profile: "game",
      locator: "fixtures/plugin-host/sculpt-intake-source",
      manifest: {
        pluginId: "dev.sceneaxi.sample.intake-source",
        pluginVersion: "0.1.0",
        capabilities: [EXTENSION_SEAM_CAPABILITY_IDS.marketplace],
      },
      digest: `sha256:${createHash("sha256").update("extension-grant").digest("hex")}`,
    })).toMatchObject({ ok: false, reason: EXTENSION_SEAM_REFUSALS.undeclaredGrant });
  });
});
