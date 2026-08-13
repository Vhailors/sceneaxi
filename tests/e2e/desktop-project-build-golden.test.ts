import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  EDITOR_COMMAND_REFUSALS,
  PROJECT_BUILD_REFUSALS,
  createEditorCommandInvocation,
  type EditorCommandClient,
  type JsonObject,
} from "@sceneaxi/schemas";
import {
  createDesktopBridge,
  seedDesktopProject,
} from "../../desktop/linux/src/index.ts";

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "sceneaxi-project-build-golden-"));
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

describe("full-editor project build vertical", () => {
  it("refuses macos and windows project targets on this Linux host without a release-ready claim", () => {
    const root = fixture();
    const host = bridge(root);
    const macos = ["desktop-control", "cli", "local-agent"].map((client) =>
      command(host, "project-build", client as EditorCommandClient, {
        profile: "game",
        target: "macos",
      }),
    );
    expect(macos[0]).toMatchObject({
      ok: false,
      reason: PROJECT_BUILD_REFUSALS.hostUnsupported,
    });
    expect(macos[1]).toEqual(macos[0]);
    expect(macos[2]).toEqual(macos[0]);
    expect(command(host, "project-build", "cli", {
      profile: "game",
      target: "windows",
    })).toMatchObject({ ok: false, reason: PROJECT_BUILD_REFUSALS.hostUnsupported });
    expect(command(host, "project-build", "desktop-control", {
      profile: "kids",
      target: "macos",
    }, "kids")).toMatchObject({ ok: false, reason: EDITOR_COMMAND_REFUSALS.kidsDenied });
    expect(command(host, "project-build", "cli", {
      profile: "game",
      target: "linux",
    })).toMatchObject({
      ok: false,
      reason: PROJECT_BUILD_REFUSALS.signingMissing,
    });
  });
});
