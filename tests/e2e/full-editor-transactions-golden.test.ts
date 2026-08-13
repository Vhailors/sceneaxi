import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  apply,
  propose,
  writeDocumentFile,
} from "@sceneaxi/authoring-core";
import {
  createDocument,
  createEditorCommandInvocation,
  type EditorCommandClient,
} from "@sceneaxi/schemas";
import { createDesktopSession, type DesktopSession } from "@sceneaxi/desktop-shell";
import { createDesktopBridge } from "../../desktop/linux/src/index.ts";

const clients = ["desktop-control", "cli", "local-agent"] as const satisfies readonly EditorCommandClient[];

function appliedSession(transactionId: string): DesktopSession {
  const snapshot = Object.freeze({
    phase: "applied" as const,
    unifiedDiff: null,
    renderedDiff: null,
    proposal: null,
    appliedPaths: Object.freeze(["scene.json"]),
    journalRecoveryPending: false,
    transactionId,
    diagnostics: null,
  });
  return Object.freeze({
    snapshot: () => snapshot,
    proposeEdit: () => snapshot,
    accept: () => snapshot,
    reject: () => snapshot,
    refreshRecovery: () => snapshot,
    status: () => { throw new Error("transaction result must not read the project"); },
    undo: () => ({ ok: false as const, diagnostics: [] }),
    redo: () => ({ ok: false as const, diagnostics: [] }),
  });
}

describe("full-editor transaction client parity", () => {
  it("returns one command-registry transaction id, progress, evidence, and refusal shape to every client", () => {
    const transactionId = "1700000000000-0123456789abcdef";
    const results = clients.map((client) => createDesktopBridge({
      cwd: "/not-read",
      createAuthoringSession: () => appliedSession(transactionId),
    }).handle({
      action: "command",
      payload: createEditorCommandInvocation("change-review-accept", client, {}),
    }));

    expect(results[0]).toEqual(results[1]);
    expect(results[1]).toEqual(results[2]);
    expect(results[0]).toMatchObject({
      ok: true,
      data: {
        transaction: {
          transactionId,
          status: "completed",
          progress: { phase: "completed", percent: 100, terminal: true },
          evidence: {
            kind: "authoring-snapshot",
            target: "change-review",
            documentPaths: ["scene.json"],
          },
          refusal: null,
        },
      },
    });
  });

  it("refuses Kids and missing capabilities before session, journal, or project I/O", () => {
    const createAuthoringSession = vi.fn(() => { throw new Error("must not execute"); });
    const invocation = createEditorCommandInvocation("edit-redo", "desktop-control", {});
    const kids = createDesktopBridge({
      cwd: "/does-not-exist",
      commandProfile: "kids",
      createAuthoringSession,
    }).handle({ action: "command", payload: invocation });
    const missing = createDesktopBridge({
      cwd: "/does-not-exist",
      commandProfile: "game",
      commandCapabilities: [],
      createAuthoringSession,
    }).handle({ action: "command", payload: invocation });

    expect(kids).toMatchObject({ ok: false, reason: "EDITOR_COMMAND_KIDS_DENIED", transaction: { refusal: "EDITOR_COMMAND_KIDS_DENIED" } });
    expect(missing).toMatchObject({ ok: false, reason: "EDITOR_COMMAND_CAPABILITY_DENIED", transaction: { refusal: "EDITOR_COMMAND_CAPABILITY_DENIED" } });
    expect(createAuthoringSession).not.toHaveBeenCalled();
  });

  it("does not let a command invocation overwrite the active Kids profile", () => {
    const bridge = createDesktopBridge({ cwd: "/does-not-exist" });
    expect(bridge.handle({ action: "profile", payload: { profile: "kids" } })).toMatchObject({
      ok: true,
      data: { profile: "kids" },
    });
    const result = bridge.handle({
      action: "command",
      payload: createEditorCommandInvocation("project-git-status", "desktop-control", {}, "game"),
    });
    expect(result).toMatchObject({ ok: false, reason: "EDITOR_COMMAND_KIDS_DENIED" });
    expect(bridge.activeProfile()).toBe("kids");
  });

  it("keeps staged review explicit when undo or redo is invoked", () => {
    const cwd = mkdtempSync(join(tmpdir(), "sceneaxi-staged-history-"));
    const path = join(cwd, "scene.json");
    expect(writeDocumentFile(path, createDocument({ id: "scene", data: { value: 0 } }), { cwd }).ok).toBe(true);
    const first = propose({ cwd, documentPath: "scene.json", jsonPointer: "/data/value", newValue: 1 });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(apply({ cwd, proposal: first.proposal }).ok).toBe(true);
    const session = createDesktopSession({ cwd });
    expect(session.undo().ok).toBe(true);
    const bytes = readFileSync(path, "utf8");
    const staged = session.proposeEdit({ documentPath: "scene.json", jsonPointer: "/data/value", newValue: 2 });
    expect(staged.phase).toBe("reviewing");

    expect(session.redo()).toMatchObject({ ok: false, diagnostics: [{ code: "invalid-transaction-phase" }] });
    expect(session.undo()).toMatchObject({ ok: false, diagnostics: [{ code: "invalid-transaction-phase" }] });
    expect(session.snapshot()).toMatchObject({ phase: "reviewing", proposal: staged.proposal });
    expect(readFileSync(path, "utf8")).toBe(bytes);
  });
});
