import { describe, expect, it } from "vitest";
import { renderEditorState, readEditorState } from "@sceneaxi/site-kit";

describe("renderEditorState — real Minimum E2 session from URL state", () => {
  it("renders a snapshot, a viewport frame, a save, and a composition", () => {
    const state = readEditorState({});
    expect(state.ok).toBe(true);
    if (!state.ok) return;
    const render = renderEditorState(state.value);
    expect(render.ok).toBe(true);
    if (!render.ok) return;
    expect(render.value.snapshot.sceneTree.length).toBeGreaterThan(0);
    expect(render.value.viewport.instanceIds.length).toBeGreaterThan(0);
    expect(render.value.viewport.backend).toBe("null");
    expect(render.value.save.ok).toBe(true);
    expect(render.value.composition.ok).toBe(true);
    if (!render.value.composition.ok) return;
    expect(render.value.composition.scene.instances.length).toBeGreaterThan(0);
    expect(render.value.artifactId.length).toBeGreaterThan(0);
  });

  it("reconstructs deterministically for the same state", () => {
    const state = readEditorState({ "tx-object-1": "3,0,0", sel: "object-1" });
    expect(state.ok).toBe(true);
    if (!state.ok) return;
    const first = renderEditorState(state.value);
    const second = renderEditorState(state.value);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.value.snapshot.sceneTree).toEqual(second.value.snapshot.sceneTree);
    if (!first.value.composition.ok || !second.value.composition.ok) return;
    expect(first.value.composition.scene.instances.length).toEqual(
      second.value.composition.scene.instances.length,
    );
  });
});
