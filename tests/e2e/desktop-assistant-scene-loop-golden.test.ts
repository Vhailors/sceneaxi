import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createEditorCommandInvocation } from "@sceneaxi/schemas";
import {
  DESKTOP_ACTIVE_DOCUMENT_PATH,
  DESKTOP_BRIDGE_REFUSALS,
  createDesktopBridge,
  seedDesktopProject,
} from "../../desktop/linux/src/index.ts";
import {
  DESKTOP_DEEPSEEK_MODEL,
  createDesktopOpenCodeLiveTransport,
} from "../../desktop/linux/src/electron/live-transport.ts";

const CAPABILITIES = Object.freeze([
  "scene.compose",
  "authoring.change-review",
  "authoring.undo",
  "assistant.progress",
  "assistant.build.local",
  "assistant.build.byo",
]);

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function project() {
  const root = mkdtempSync(join(tmpdir(), "sceneaxi-scene-loop-"));
  roots.push(root);
  expect(seedDesktopProject(root)).toEqual({ ok: true, migrated: false });
  return {
    root,
    bridge: createDesktopBridge({ cwd: root, commandCapabilities: CAPABILITIES }),
  };
}

function hash(bridge: ReturnType<typeof createDesktopBridge>) {
  const response = bridge.handle({
    action: "authoring",
    payload: { op: "status", documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH },
  });
  if (!response.ok) throw new Error(response.reason);
  return (response.data as { contentHash: string }).contentHash;
}

function command(
  bridge: ReturnType<typeof createDesktopBridge>,
  id: Parameters<typeof createEditorCommandInvocation>[0],
  input: Record<string, unknown>,
) {
  return bridge.handle({
    action: "command",
    payload: createEditorCommandInvocation(id, "desktop-control", input, "game"),
  });
}

async function settle(bridge: ReturnType<typeof createDesktopBridge>) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
    const response = bridge.handle({ action: "assistant", payload: { op: "status" } });
    if (response.ok && response.data !== null && (response.data as { status?: string }).status !== "running") {
      return response.data as { status: string; refusal?: { reason?: string } };
    }
  }
  throw new Error("assistant did not settle");
}

describe("desktop assistant scene loop and named refusals", () => {
  it("refuses Kids, Hosted, empty prompts, missing apply, and BYOK without a runner", () => {
    const { bridge } = project();
    expect(bridge.handle({
      action: "assistant",
      payload: {
        op: "start",
        route: "local",
        profile: "@sceneaxi/profile-kids",
        prompt: "Make an archer shooting to the tree",
        mode: "build",
      },
    })).toMatchObject({ ok: false, reason: "ASSISTANT_SCULPT_KIDS_DENIED" });
    expect(bridge.handle({
      action: "assistant",
      payload: {
        op: "start",
        route: "hosted",
        profile: "@sceneaxi/profile-game",
        prompt: "Make an archer shooting to the tree",
        mode: "build",
      },
    })).toMatchObject({ ok: false, reason: DESKTOP_BRIDGE_REFUSALS.assistantHostedMeteringUnavailable });
    expect(bridge.handle({
      action: "assistant",
      payload: {
        op: "start",
        route: "local",
        profile: "@sceneaxi/profile-game",
        prompt: "   ",
        mode: "build",
      },
    })).toMatchObject({ ok: false, reason: DESKTOP_BRIDGE_REFUSALS.requestMalformed });
    expect(command(bridge, "assistant-apply-build", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
      expectedContentHash: hash(bridge),
    })).toMatchObject({ ok: false, reason: DESKTOP_BRIDGE_REFUSALS.assistantJobMissing });
    expect(bridge.handle({
      action: "assistant",
      payload: {
        op: "start",
        route: "byo",
        profile: "@sceneaxi/profile-game",
        prompt: "Make an archer shooting to the tree",
        mode: "build",
      },
    })).toMatchObject({ ok: false, reason: DESKTOP_BRIDGE_REFUSALS.assistantByoUnavailable });
  });

  it("applies a directed local Build into the composed scene and undoes it", async () => {
    const { root, bridge } = project();
    const before = readFileSync(join(root, DESKTOP_ACTIVE_DOCUMENT_PATH), "utf8");
    expect(bridge.handle({
      action: "assistant",
      payload: {
        op: "start",
        route: "local",
        profile: "@sceneaxi/profile-game",
        prompt: "Make an archer shooting to the tree",
        mode: "build",
      },
    }).ok).toBe(true);
    expect(await settle(bridge)).toMatchObject({ status: "ready" });
    expect(command(bridge, "assistant-apply-build", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
      expectedContentHash: hash(bridge),
    }).ok).toBe(true);
    expect(command(bridge, "change-review-accept", {}).ok).toBe(true);
    const accepted = readFileSync(join(root, DESKTOP_ACTIVE_DOCUMENT_PATH), "utf8");
    expect(accepted).not.toBe(before);
    expect(accepted).toContain("tree-trunk");
    expect(accepted).toContain("archer-body");
    expect(accepted).toContain("sceneAssistantBuilds");
    const replay = command(bridge, "assistant-apply-build", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
      expectedContentHash: hash(bridge),
    });
    expect(replay.ok).toBe(true);
    expect(command(bridge, "change-review-reject", {}).ok).toBe(true);
    expect(command(bridge, "edit-undo", {}).ok).toBe(true);
    expect(readFileSync(join(root, DESKTOP_ACTIVE_DOCUMENT_PATH), "utf8")).toBe(before);
  });

  it("refuses the DeepSeek PRC endpoint before any credential is sent", async () => {
    const transport = createDesktopOpenCodeLiveTransport({
      credential: { read: () => "synthetic-opencode-key" },
      apiBase: "https://api.deepseek.com/v1",
    });
    await expect(transport.complete("ping", DESKTOP_DEEPSEEK_MODEL)).rejects.toMatchObject({
      message: expect.stringMatching(/PRC endpoint/i),
    });
  });
});
