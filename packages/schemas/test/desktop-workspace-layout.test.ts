import { describe, expect, it } from "vitest";
import {
  WORKSPACE_LAYOUT_REFUSALS,
  applyWorkspaceLayoutMutation,
  defaultWorkspaceLayout,
  parseWorkspaceLayout,
} from "@sceneaxi/schemas";

describe("desktop workspace layout", () => {
  it("recovers corrupt and off-screen bytes to the named default without inventing a write", () => {
    const corrupt = parseWorkspaceLayout({ schemaVersion: 2, kind: "nope" });
    expect(corrupt).toMatchObject({
      ok: true,
      recovered: true,
      reason: WORKSPACE_LAYOUT_REFUSALS.staleVersion,
      layout: { layoutId: "default", documentUndo: false },
    });
    const offscreen = parseWorkspaceLayout({
      schemaVersion: 1,
      kind: "sceneaxi.workspace-layout",
      dockHeight: 9000,
    });
    expect(offscreen).toMatchObject({
      ok: true,
      recovered: true,
      reason: WORKSPACE_LAYOUT_REFUSALS.offscreen,
    });
  });

  it("refuses Kids and keeps layout outside document undo", () => {
    expect(applyWorkspaceLayoutMutation({
      layout: defaultWorkspaceLayout(),
      profile: "kids",
      mutation: { kind: "set", next: { leftVisible: false } },
    })).toMatchObject({ ok: false, reason: WORKSPACE_LAYOUT_REFUSALS.kidsDenied });
    const applied = applyWorkspaceLayoutMutation({
      layout: defaultWorkspaceLayout(),
      profile: "game",
      mutation: { kind: "set", next: { assistantVisible: false, dockHeight: 180 } },
    });
    expect(applied).toMatchObject({
      ok: true,
      layout: { assistantVisible: false, dockHeight: 180, documentUndo: false },
    });
  });
});
