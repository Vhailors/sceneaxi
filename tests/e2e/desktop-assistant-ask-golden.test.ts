import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  ASSISTANT_ASK_REFUSALS,
  EDITOR_COMMAND_REFUSALS,
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
  const root = mkdtempSync(join(tmpdir(), "sceneaxi-assistant-ask-golden-"));
  dirs.push(root);
  expect(seedDesktopProject(root)).toEqual({ ok: true, migrated: false });
  return root;
}

function bridge(root: string) {
  return createDesktopBridge({
    cwd: root,
    commandCapabilities: [
      "scene.compose",
      "authoring.change-review",
      "authoring.undo",
      "authoring.redo",
      "assistant.progress",
      "assistant.build.local",
    ],
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

describe("full-editor assistant inspect and apply", () => {
  it("answers Ask from typed hierarchy state identically across clients and writes no bytes", () => {
    const root = fixture();
    const host = bridge(root);
    const before = readFileSync(join(root, DESKTOP_ACTIVE_DOCUMENT_PATH));
    const version = hash(host);
    const first = command(host, "assistant-ask", "desktop-control", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
      expectedContentHash: version,
      profile: "@sceneaxi/profile-game",
      prompt: "What instances are in the hierarchy?",
      scope: "hierarchy",
    });
    const second = command(host, "assistant-ask", "cli", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
      expectedContentHash: version,
      profile: "@sceneaxi/profile-game",
      prompt: "What instances are in the hierarchy?",
      scope: "hierarchy",
    });
    const third = command(host, "assistant-ask", "local-agent", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
      expectedContentHash: version,
      profile: "@sceneaxi/profile-game",
      prompt: "What instances are in the hierarchy?",
      scope: "hierarchy",
    });
    expect(first).toMatchObject({
      ok: true,
      data: {
        kind: "sceneaxi.assistant-ask-answer",
        savedBytesWritten: false,
        providerClass: "none",
      },
    });
    expect(second).toEqual(first);
    expect(third).toEqual(first);
    expect(readFileSync(join(root, DESKTOP_ACTIVE_DOCUMENT_PATH))).toEqual(before);
  });

  it("refuses Kids, unsupported questions, and missing Build apply without fabricating an answer", () => {
    const root = fixture();
    const host = bridge(root);
    const version = hash(host);
    expect(command(host, "assistant-ask", "desktop-control", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
      expectedContentHash: version,
      profile: "@sceneaxi/profile-kids",
      prompt: "What instances are in the hierarchy?",
      scope: "hierarchy",
    })).toMatchObject({ ok: false, reason: EDITOR_COMMAND_REFUSALS.kidsDenied });
    expect(host.handle({
      action: "assistant",
      payload: {
        op: "start",
        route: "local",
        profile: "@sceneaxi/profile-kids",
        prompt: "What instances are in the document?",
        mode: "ask",
      },
    })).toMatchObject({ ok: false, reason: "ASSISTANT_SCULPT_KIDS_DENIED" });
    expect(command(host, "assistant-ask", "cli", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
      expectedContentHash: version,
      profile: "@sceneaxi/profile-game",
      prompt: "Write a slogan for this scene",
      scope: "hierarchy",
    })).toMatchObject({ ok: false, reason: ASSISTANT_ASK_REFUSALS.questionUnsupported });
    expect(command(host, "assistant-apply-build", "desktop-control", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
      expectedContentHash: version,
    })).toMatchObject({ ok: false, reason: "DESKTOP_ASSISTANT_JOB_MISSING" });
  });

  it("stages a local Build through Change Review and undoes it", async () => {
    const root = fixture();
    const host = bridge(root);
    const before = readFileSync(join(root, DESKTOP_ACTIVE_DOCUMENT_PATH));
    expect(host.handle({
      action: "assistant",
      payload: {
        op: "start",
        route: "local",
        profile: "@sceneaxi/profile-game",
        prompt: "crate",
        mode: "build",
      },
    })).toMatchObject({ ok: true });
    await new Promise((resolve) => setTimeout(resolve, 0));
    const status = host.handle({ action: "assistant", payload: { op: "status" } });
    expect(status).toMatchObject({
      ok: true,
      data: { status: "ready", result: { providerClass: "none", fallbackPolicy: "none" } },
    });
    expect(command(host, "assistant-apply-build", "desktop-control", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
      expectedContentHash: hash(host),
    })).toMatchObject({ ok: true });
    expect(command(host, "change-review-accept", "desktop-control", {})).toMatchObject({ ok: true });
    expect(command(host, "edit-undo", "desktop-control", {})).toMatchObject({ ok: true });
    expect(readFileSync(join(root, DESKTOP_ACTIVE_DOCUMENT_PATH))).toEqual(before);
    expect(command(host, "edit-redo", "desktop-control", {})).toMatchObject({ ok: true });
    expect(before.equals(readFileSync(join(root, DESKTOP_ACTIVE_DOCUMENT_PATH)))).toBe(false);
  });
});
