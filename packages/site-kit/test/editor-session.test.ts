import { describe, expect, it } from "vitest";
import { EDITOR_SCENE_ID, renderEditorState, readEditorState } from "@sceneaxi/site-kit";

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
    expect(render.value.save.ok).toBe(true);
    expect(render.value.composition.ok).toBe(true);
    if (!render.value.composition.ok) return;
    expect(render.value.composition.scene.instances.length).toBeGreaterThan(0);
    expect(render.value.artifactId.length).toBeGreaterThan(0);
  });

  it("runs the server session on the Three core's no-pixel surface", () => {
    const state = readEditorState({});
    if (!state.ok) return;
    const render = renderEditorState(state.value);
    expect(render.ok).toBe(true);
    if (!render.ok) return;
    // The editor is bound to one presentation core; a server has no drawing buffer, so
    // its frame is the headless surface of that same core and must never claim pixels.
    expect(render.value.viewport.backend).toBe("three");
    expect(render.value.viewport.surface).toBe("headless");
    expect(render.value.viewport.pixelsDrawn).toBe(false);
    expect(render.value.viewport.drawCalls).toBeGreaterThan(0);
  });

  it("projects a browser mount payload from the same composition the page renders", () => {
    const state = readEditorState({ objects: "3", "tx-object-2": "5,0,0" });
    expect(state.ok).toBe(true);
    if (!state.ok) return;
    const render = renderEditorState(state.value);
    expect(render.ok).toBe(true);
    if (!render.ok) return;

    const { composition, mountable } = render.value;
    expect(composition.ok).toBe(true);
    expect(mountable).not.toBeNull();
    if (!composition.ok || mountable === null) return;

    expect(mountable.sceneId).toBe(EDITOR_SCENE_ID);
    expect(mountable.sceneDigest).toBe(composition.sceneDigest);
    expect(mountable.rootInstanceId).toBe(composition.scene.rootInstanceId);
    // Every drawn instance is one the pipeline placed, with the pipeline's own world
    // transform — the canvas cannot show a scene the server did not compose.
    expect(mountable.instances.map((instance) => instance.instanceId)).toEqual(
      composition.scene.instances.map((instance) => instance.instanceId),
    );
    for (const [index, instance] of mountable.instances.entries()) {
      const composed = composition.scene.instances[index];
      expect(instance.worldTransform).toEqual(composed?.worldTransform);
      expect(mountable.artifacts[instance.artifactId]).toEqual(composed?.artifact);
    }
    // One artifact on the wire, however many instances reference it.
    expect(Object.keys(mountable.artifacts)).toEqual([render.value.artifactId]);
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
    expect(first.value.mountable?.sceneDigest).toBe(second.value.mountable?.sceneDigest);
    if (!first.value.composition.ok || !second.value.composition.ok) return;
    expect(first.value.composition.scene.instances.length).toEqual(
      second.value.composition.scene.instances.length,
    );
  });
});
