import { describe, expect, it } from "vitest";
import {
  EDITOR_MAX_OBJECTS,
  EDITOR_MIN_OBJECTS,
  editorHref,
  readEditorState,
  type EditorState,
} from "@sceneaxi/site-kit";

const find = (state: EditorState, id: string) =>
  state.instances.find((instance) => instance.instanceId === id);

describe("readEditorState — per-instance transforms", () => {
  it("defaults every instance when no transform is supplied", () => {
    const state = readEditorState({});
    expect(state.ok).toBe(true);
    if (!state.ok) return;
    expect(state.value.instances.length).toBe(EDITOR_MIN_OBJECTS);
    expect(find(state.value, "object-1")?.transform.translation).toEqual([0, 0, 0]);
    expect(find(state.value, "object-2")?.transform.translation).toEqual([2, 0, 0]);
    expect(state.value.selectedInstanceId).toBe("object-1");
  });

  it("applies each instance's own translation and leaves the others intact", () => {
    const state = readEditorState({ "tx-object-1": "5,5,5", sel: "object-2" });
    expect(state.ok).toBe(true);
    if (!state.ok) return;
    expect(find(state.value, "object-1")?.transform.translation).toEqual([5, 5, 5]);
    expect(find(state.value, "object-2")?.transform.translation).toEqual([2, 0, 0]);
    expect(state.value.selectedInstanceId).toBe("object-2");
  });

  it("changing selection cannot clobber another object's transform", () => {
    // Simulates the form submitting each instance's own translation plus a new sel.
    const moved = readEditorState({ "tx-object-1": "9,8,7", sel: "object-1" });
    expect(moved.ok).toBe(true);
    if (!moved.ok) return;
    const href = editorHref(moved.value, {});
    const params = Object.fromEntries(new URL(href, "https://x").searchParams);
    const reselected = readEditorState({ ...params, sel: "object-2" });
    expect(reselected.ok).toBe(true);
    if (!reselected.ok) return;
    expect(find(reselected.value, "object-1")?.transform.translation).toEqual([9, 8, 7]);
    expect(find(reselected.value, "object-2")?.transform.translation).toEqual([2, 0, 0]);
    expect(reselected.value.selectedInstanceId).toBe("object-2");
  });

  it("clamps the object count into the bounded range", () => {
    const tooFew = readEditorState({ objects: "0" });
    const tooMany = readEditorState({ objects: "9" });
    expect(tooFew.ok && tooFew.value.instances.length).toBe(EDITOR_MIN_OBJECTS);
    expect(tooMany.ok && tooMany.value.instances.length).toBe(EDITOR_MAX_OBJECTS);
  });

  it("falls selection back to the first instance when sel is unknown", () => {
    const state = readEditorState({ sel: "object-99" });
    expect(state.ok && state.value.selectedInstanceId).toBe("object-1");
  });
});

describe("readEditorState — refusals", () => {
  it.each(["1junk,2,3", "1,,3", "0x10,2,3"])("refuses a malformed translation %s", (tx) => {
    expect(readEditorState({ "tx-object-1": tx })).toMatchObject({
      ok: false,
      reason: "SITE_REQUEST_MALFORMED",
    });
  });

  it("refuses a parameter outside the editor and deep-link contracts", () => {
    expect(readEditorState({ session: "abc" })).toMatchObject({
      ok: false,
      reason: "DEEP_LINK_UNKNOWN_PARAMETER",
    });
  });

  it("accepts complete decimal and exponent translation components", () => {
    const state = readEditorState({ "tx-object-1": "-1.5,2e1,.25" });
    expect(state.ok).toBe(true);
    if (!state.ok) return;
    expect(find(state.value, "object-1")?.transform.translation).toEqual([-1.5, 20, 0.25]);
  });
});

describe("readEditorState — catalog deep link", () => {
  it("parses a catalog deep link alongside editor state", () => {
    const state = readEditorState({
      source: "catalog-game",
      item: "game-lantern-prop",
      "tx-object-1": "1,2,3",
    });
    expect(state.ok).toBe(true);
    if (!state.ok) return;
    expect(state.value.deepLink?.source).toBe("catalog-game");
    expect(state.value.deepLink?.itemId).toBe("game-lantern-prop");
    expect(find(state.value, "object-1")?.transform.translation).toEqual([1, 2, 3]);
  });
});

describe("editorHref", () => {
  it("serializes every instance translation and the deep link", () => {
    const state = readEditorState({
      source: "catalog-web",
      item: "web-hero-diorama",
      "tx-object-1": "4,5,6",
      sel: "object-1",
    });
    expect(state.ok).toBe(true);
    if (!state.ok) return;
    const href = editorHref(state.value, { play: true });
    const params = new URL(href, "https://x").searchParams;
    expect(params.get("source")).toBe("catalog-web");
    expect(params.get("item")).toBe("web-hero-diorama");
    expect(params.get("tx-object-1")).toBe("4,5,6");
    expect(params.get("tx-object-2")).toBe("2,0,0");
    expect(params.get("play")).toBe("1");
  });
});
