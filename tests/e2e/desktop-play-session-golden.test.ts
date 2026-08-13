import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  PLAY_SESSION_REFUSALS,
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
  const root = mkdtempSync(join(tmpdir(), "sceneaxi-play-golden-"));
  dirs.push(root);
  expect(seedDesktopProject(root)).toEqual({ ok: true, migrated: false });
  return root;
}

function host(root: string) {
  return createDesktopBridge({
    cwd: root,
    commandCapabilities: ["runtime.play", "scene.compose"],
  });
}

function command(
  bridge: ReturnType<typeof createDesktopBridge>,
  id: Parameters<typeof createEditorCommandInvocation>[0],
  client: EditorCommandClient,
  input: JsonObject = {},
) {
  return bridge.handle({
    action: "command",
    payload: createEditorCommandInvocation(id, client, input, "game"),
  });
}

describe("isolated Play mode golden", () => {
  it("creates a distinct clone, inspects it from every client, and leaves saved bytes untouched", () => {
    const root = fixture();
    const bridge = host(root);
    const before = readFileSync(join(root, DESKTOP_ACTIVE_DOCUMENT_PATH));
    const played = command(bridge, "run-play", "desktop-control", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
    });
    expect(played).toMatchObject({
      ok: true,
      data: {
        playSession: { kind: "sceneaxi.play-session", state: "playing", viewportSource: "game" },
      },
    });
    if (!played.ok) throw new Error("play refused");
    const playSession = (played.data as {
      playSession: { cloneDigest: string; sourceContentHash: string };
    }).playSession;
    const cloneDigest = playSession.cloneDigest;
    const sourceHash = playSession.sourceContentHash;
    expect(cloneDigest).not.toBe(sourceHash);
    const inspected = (["desktop-control", "cli", "local-agent"] as const).map((client) =>
      command(bridge, "play-inspect", client),
    );
    expect(inspected[0]).toEqual(inspected[1]);
    expect(inspected[1]).toEqual(inspected[2]);
    expect(command(bridge, "viewport-source-set", "cli", { source: "scene" })).toMatchObject({
      ok: true,
      data: { viewportSource: "scene" },
    });
    expect(command(bridge, "run-stop", "local-agent")).toMatchObject({
      ok: true,
      data: { state: "stopped", viewportSource: "scene" },
    });
    expect(command(bridge, "run-reset", "desktop-control")).toMatchObject({
      ok: true,
      data: { state: "playing", cloneDigest },
    });
    expect(readFileSync(join(root, DESKTOP_ACTIVE_DOCUMENT_PATH))).toEqual(before);
  });

  it("names missing and invalid viewport-source refusals", () => {
    const root = fixture();
    const bridge = host(root);
    expect(command(bridge, "run-stop", "desktop-control")).toMatchObject({
      ok: false,
      reason: PLAY_SESSION_REFUSALS.sessionMissing,
    });
    expect(command(bridge, "run-play", "desktop-control", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
    })).toMatchObject({ ok: true });
    expect(() => command(bridge, "viewport-source-set", "desktop-control", {
      source: "unknown",
    })).toThrow(/EDITOR_COMMAND_REGISTRY_INVALID/);
  });
});
