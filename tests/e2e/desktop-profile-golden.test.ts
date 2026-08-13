import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  PROFILE_REFUSALS,
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
  const root = mkdtempSync(join(tmpdir(), "sceneaxi-profile-golden-"));
  dirs.push(root);
  expect(seedDesktopProject(root)).toEqual({ ok: true, migrated: false });
  return root;
}

function bridge(root: string) {
  return createDesktopBridge({
    cwd: root,
    commandCapabilities: ["runtime.play", "scene.compose"],
  });
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

describe("full-editor profiling vertical", () => {
  it("refuses capture without Play and writes no authoring bytes after Play", () => {
    const root = fixture();
    const host = bridge(root);
    const before = readFileSync(join(root, DESKTOP_ACTIVE_DOCUMENT_PATH));
    expect(command(host, "profile-inspect", "desktop-control", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
      profile: "game",
    })).toMatchObject({ ok: false, reason: PROFILE_REFUSALS.playMissing });
    expect(command(host, "run-play", "desktop-control", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
    })).toMatchObject({ ok: true });
    const first = command(host, "profile-inspect", "cli", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
      profile: "game",
    });
    const second = command(host, "profile-inspect", "local-agent", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
      profile: "game",
    });
    expect(first).toMatchObject({
      ok: true,
      data: {
        kind: "sceneaxi.profile-evidence",
        savedBytesWritten: false,
        claimsPixels: false,
        claimsGpuTiming: false,
      },
    });
    expect(second).toEqual(first);
    expect(readFileSync(join(root, DESKTOP_ACTIVE_DOCUMENT_PATH))).toEqual(before);
  });
});
