import { afterEach, describe, expect, it, vi } from "vitest";
import { Window } from "happy-dom";
import {
  DEFAULT_INPUT_ACTION_MAP,
  reviewInputActionRebind,
} from "@sceneaxi/schemas";
import { attachDesktopViewportInputActions } from "../src/renderer/viewport.js";

const windows: Window[] = [];
afterEach(() => {
  for (const window of windows.splice(0)) window.close();
});

describe("desktop Play-facing viewport input actions", () => {
  it("drives pointer and wheel controls only through the effective shared map", () => {
    const rebound = reviewInputActionRebind(
      DEFAULT_INPUT_ACTION_MAP,
      "viewport.orbit",
      { device: "pointer", button: 2, gesture: "drag" },
    );
    if (!rebound.ok || !("map" in rebound)) throw new Error("pointer fixture refused");
    const window = new Window();
    windows.push(window);
    const canvas = window.document.createElement("canvas");
    const camera = { dragOrbit: vi.fn(), wheelZoom: vi.fn() };
    let context: "editor" | "play" = "editor";
    const detach = attachDesktopViewportInputActions(
      canvas as unknown as HTMLCanvasElement,
      camera,
      rebound.map,
      () => context,
    );
    canvas.dispatchEvent(new window.PointerEvent("pointerdown", {
      button: 0, clientX: 1, clientY: 2,
    }));
    canvas.dispatchEvent(new window.PointerEvent("pointermove", { clientX: 5, clientY: 8 }));
    expect(camera.dragOrbit).not.toHaveBeenCalled();
    canvas.dispatchEvent(new window.PointerEvent("pointerdown", {
      button: 2, clientX: 10, clientY: 20,
    }));
    canvas.dispatchEvent(new window.PointerEvent("pointermove", { clientX: 14, clientY: 17 }));
    expect(camera.dragOrbit).toHaveBeenCalledWith(4, -3);
    context = "play";
    canvas.dispatchEvent(new window.WheelEvent("wheel", { deltaY: 120 }));
    expect(camera.wheelZoom).toHaveBeenCalledWith(120);
    detach();
    canvas.dispatchEvent(new window.WheelEvent("wheel", { deltaY: 240 }));
    expect(camera.wheelZoom).toHaveBeenCalledTimes(1);
  });
});
