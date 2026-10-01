import { describe, expect, it } from "vitest";
import {
  DESKTOP_VIEWPORT_SOURCE_IDS,
  DESKTOP_VISUAL_REFUSALS,
  createDesktopVisualState,
  desktopVisualView,
} from "@sceneaxi/desktop-shell";

describe("desktop visual model — viewport", () => {
  it("models the three viewport sources as inert controls with a reason", () => {
    // A viewport source cannot be switched on a surface that mounts no renderer,
    // so all three declare a kind and name that reason rather than being three
    // tab-shaped elements no control kind accounts for.
    const view = desktopVisualView(createDesktopVisualState());
    expect(view.viewport.sources.map((source) => source.id)).toEqual([
      ...DESKTOP_VIEWPORT_SOURCE_IDS,
    ]);
    for (const source of view.viewport.sources) {
      expect(source.control.kind).toBe("inert");
      expect(source.control.refusal).toBe(
        DESKTOP_VISUAL_REFUSALS.noPresentationRuntime,
      );
      expect(source.control.id).toBe(`viewport-source-${source.id}`);
    }
    expect(view.viewport.sources.filter((source) => source.active)).toHaveLength(1);
  });
});
