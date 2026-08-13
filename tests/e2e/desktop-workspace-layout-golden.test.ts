import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  WORKSPACE_LAYOUT_REFUSALS,
  createEditorCommandInvocation,
  type EditorCommandClient,
  type JsonObject,
} from "@sceneaxi/schemas";
import {
  DESKTOP_ACTIVE_DOCUMENT_PATH,
  createDesktopBridge,
  seedDesktopProject,
} from "../../desktop/linux/src/index.ts";
import { WORKSPACE_LAYOUT_PATH } from "../../desktop/linux/src/lib/workspace-layout-host.ts";

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "sceneaxi-workspace-golden-"));
  dirs.push(root);
  expect(seedDesktopProject(root)).toEqual({ ok: true, migrated: false });
  return root;
}

function bridge(root: string) {
  return createDesktopBridge({
    cwd: root,
    commandCapabilities: ["scene.compose"],
  });
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

describe("full-editor workspace layout vertical", () => {
  it("persists a layout outside the Scene Document and resets it", () => {
    const root = fixture();
    const host = bridge(root);
    const before = readFileSync(join(root, DESKTOP_ACTIVE_DOCUMENT_PATH));
    expect(command(host, "workspace-layout-apply", "desktop-control", {
      profile: "game",
      assistantVisible: false,
      dockHeight: 160,
    })).toMatchObject({
      ok: true,
      data: { layout: { assistantVisible: false, dockHeight: 160, documentUndo: false } },
    });
    expect(command(host, "workspace-layout-inspect", "cli", {})).toMatchObject({
      ok: true,
      data: { layout: { assistantVisible: false, dockHeight: 160 } },
    });
    expect(command(host, "workspace-layout-inspect", "local-agent", {})).toEqual(
      command(host, "workspace-layout-inspect", "cli", {}),
    );
    expect(readFileSync(join(root, DESKTOP_ACTIVE_DOCUMENT_PATH))).toEqual(before);
    expect(command(host, "workspace-layout-reset", "desktop-control", {})).toMatchObject({
      ok: true,
      data: { layout: { layoutId: "default", assistantVisible: true } },
    });
  });

  it("recovers corrupt layout bytes and refuses Kids", () => {
    const root = fixture();
    mkdirSync(join(root, ".sceneaxi"), { recursive: true });
    writeFileSync(join(root, WORKSPACE_LAYOUT_PATH), "{not-json");
    const host = bridge(root);
    expect(command(host, "workspace-layout-inspect", "desktop-control", {})).toMatchObject({
      ok: true,
      data: { layout: { layoutId: "default" } },
    });
    expect(command(host, "workspace-layout-apply", "desktop-control", {
      profile: "kids",
      leftVisible: false,
    }, "kids")).toMatchObject({ ok: false });
    expect(command(host, "workspace-layout-apply", "desktop-control", {
      profile: "game",
      dockHeight: 9000,
    })).toMatchObject({ ok: false, reason: WORKSPACE_LAYOUT_REFUSALS.offscreen });
  });
});
