import { afterEach, describe, expect, it, vi } from "vitest";
import { Window } from "happy-dom";
import {
  DEFAULT_INPUT_ACTION_MAP,
  reviewInputActionRebind,
} from "@sceneaxi/schemas";
import {
  attachDesktopViewportInputActions,
  createDesktopGamepadInputPoller,
  dispatchDesktopPlayInput,
} from "../src/renderer/viewport.js";

const windows: Window[] = [];
afterEach(() => {
  for (const window of windows.splice(0)) window.close();
});

describe("desktop Play-facing viewport input actions", () => {
  it("publishes a consumable Play input event with the action state", () => {
    const target = new EventTarget();
    let detail: unknown;
    target.addEventListener("sceneaxi:play-input", (event) => {
      if (event instanceof CustomEvent) detail = event.detail;
    });
    dispatchDesktopPlayInput(target, "play.primary", true, 1);
    expect(detail).toEqual({ actionId: "play.primary", pressed: true, value: 1 });
  });

  it("polls injected gamepads only in Play and reports button press and release", () => {
    let connected = true;
    let polls = 0;
    const events: Array<readonly [string, boolean, number]> = [];
    const poll = createDesktopGamepadInputPoller({
      map: DEFAULT_INPUT_ACTION_MAP,
      getGamepads: () => {
        polls += 1;
        return [{
          connected,
          axes: [0, 0, 0, 0],
          buttons: [{ value: connected ? 1 : 0 }],
        }];
      },
      onAction: (actionId, pressed, value) => events.push([actionId, pressed, value]),
    });
    poll("editor");
    expect(polls).toBe(0);
    poll("play");
    expect(events).toEqual([["play.primary", true, 1]]);
    poll("play");
    expect(events).toHaveLength(1);
    connected = false;
    poll("play");
    expect(events).toEqual([
      ["play.primary", true, 1],
      ["play.primary", false, 0],
    ]);
  });

  it("releases held actions when Play context ends without polling", () => {
    const events: Array<readonly [string, boolean, number]> = [];
    let polls = 0;
    const poll = createDesktopGamepadInputPoller({
      map: DEFAULT_INPUT_ACTION_MAP,
      getGamepads: () => {
        polls += 1;
        return [{ connected: true, axes: [], buttons: [{ value: 1 }] }];
      },
      onAction: (actionId, pressed, value) => events.push([actionId, pressed, value]),
    });
    poll("play");
    poll("editor");
    expect(polls).toBe(1);
    expect(events).toEqual([
      ["play.primary", true, 1],
      ["play.primary", false, 0],
    ]);
  });

  it("applies the binding deadzone to axis polling", () => {
    const rebound = reviewInputActionRebind(DEFAULT_INPUT_ACTION_MAP, "play.primary", {
      device: "gamepad",
      gamepad: 0,
      input: "axis",
      control: 0,
      direction: "positive",
      deadzone: 0.25,
    });
    if (!rebound.ok || !("map" in rebound)) throw new Error("gamepad axis rebind refused");
    let axis = 0.1;
    const events: Array<readonly [string, boolean, number]> = [];
    const poll = createDesktopGamepadInputPoller({
      map: rebound.map,
      getGamepads: () => [{
        connected: true,
        axes: [axis],
        buttons: [],
      }],
      onAction: (actionId, pressed, value) => events.push([actionId, pressed, value]),
    });
    poll("play");
    expect(events).toEqual([]);
    axis = 0.5;
    poll("play");
    expect(events).toEqual([["play.primary", true, 0.5]]);
    axis = 0;
    poll("play");
    expect(events).toEqual([
      ["play.primary", true, 0.5],
      ["play.primary", false, 0],
    ]);
  });

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
