import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_INPUT_ACTION_MAP,
  INPUT_ACTION_REFUSALS,
  INPUT_ACTION_REGISTRY,
  contracts,
  resolveInputAction,
  reviewInputActionRebind,
} from "@sceneaxi/schemas";

describe("input-action registry", () => {
  it("ships the versioned schema and one ordered default for every action", () => {
    const schema = JSON.parse(readFileSync(
      new URL(`../${contracts.inputActionMap}`, import.meta.url),
      "utf8",
    )) as { $id: string };
    expect(schema.$id).toBe("https://sceneaxi.invalid/contracts/input-action-map/v1");
    expect(DEFAULT_INPUT_ACTION_MAP.bindings.map((row) => row.actionId)).toEqual(
      INPUT_ACTION_REGISTRY.map((action) => action.id),
    );
  });

  it("resolves keyboard, pointer, wheel, and gamepad fixtures through one vocabulary", () => {
    expect(resolveInputAction(DEFAULT_INPUT_ACTION_MAP, "editor", {
      device: "keyboard",
      code: "KeyS",
      modifiers: ["primary"],
    })).toMatchObject({ ok: true, action: { id: "editor.project.save" } });
    expect(resolveInputAction(DEFAULT_INPUT_ACTION_MAP, "editor", {
      device: "pointer",
      button: 0,
      gesture: "drag",
    })).toMatchObject({ ok: true, action: { id: "viewport.orbit" } });
    expect(resolveInputAction(DEFAULT_INPUT_ACTION_MAP, "play", {
      device: "wheel",
      axis: "y",
      direction: "positive",
    })).toMatchObject({ ok: true, action: { id: "viewport.zoom" } });
    expect(resolveInputAction(DEFAULT_INPUT_ACTION_MAP, "play", {
      device: "gamepad",
      gamepad: 0,
      input: "button",
      control: 0,
      direction: "any",
      deadzone: 0.2,
    })).toMatchObject({ ok: true, action: { id: "play.primary" } });
  });

  it("validates standard gamepad buttons and axes with a bounded deadzone", () => {
    expect(resolveInputAction(DEFAULT_INPUT_ACTION_MAP, "play", {
      device: "gamepad",
      gamepad: 0,
      input: "button",
      control: 0,
      direction: "any",
      deadzone: 0.2,
    })).toMatchObject({ ok: true, action: { id: "play.primary" } });
    const axis = reviewInputActionRebind(DEFAULT_INPUT_ACTION_MAP, "play.primary", {
      device: "gamepad",
      gamepad: 0,
      input: "axis",
      control: 0,
      direction: "positive",
      deadzone: 0.25,
    });
    expect(axis).toMatchObject({ ok: true, action: { id: "play.primary" } });
    if (!axis.ok || !("map" in axis)) throw new Error("gamepad axis rebind refused");
    expect(resolveInputAction(axis.map, "play", {
      device: "gamepad",
      gamepad: 0,
      input: "axis",
      control: 0,
      direction: "positive",
      deadzone: 0.25,
    })).toMatchObject({ ok: true, action: { id: "play.primary" } });
    expect(resolveInputAction(DEFAULT_INPUT_ACTION_MAP, "play", {
      device: "gamepad",
      gamepad: 0,
      input: "axis",
      control: 4,
      direction: "positive",
      deadzone: 1,
    })).toMatchObject({ ok: false, reason: INPUT_ACTION_REFUSALS.deviceInputInvalid });
  });

  it("refuses context leakage and malformed device inputs by stable name", () => {
    expect(resolveInputAction(DEFAULT_INPUT_ACTION_MAP, "editor", {
      device: "gamepad",
      gamepad: 0,
      input: "button",
      control: 0,
      direction: "any",
      deadzone: 0.2,
    })).toMatchObject({ ok: false, reason: INPUT_ACTION_REFUSALS.contextDenied });
    expect(resolveInputAction(DEFAULT_INPUT_ACTION_MAP, "play", {
      device: "keyboard",
      code: "KeyS",
      modifiers: ["primary"],
    })).toMatchObject({ ok: false, reason: INPUT_ACTION_REFUSALS.contextDenied });
    expect(resolveInputAction(DEFAULT_INPUT_ACTION_MAP, "editor", {
      device: "controller",
      controller: 99,
      input: "button",
      control: 0,
      direction: "any",
    })).toMatchObject({ ok: false, reason: INPUT_ACTION_REFUSALS.deviceInputInvalid });
  });

  it("refuses reserved, duplicate, and conflicting rebind reviews before a map changes", () => {
    expect(reviewInputActionRebind(
      DEFAULT_INPUT_ACTION_MAP,
      "editor.focus.next",
      { device: "keyboard", code: "KeyF", modifiers: ["primary"] },
    )).toMatchObject({ ok: false, reason: INPUT_ACTION_REFUSALS.reservedAction });
    expect(reviewInputActionRebind(
      DEFAULT_INPUT_ACTION_MAP,
      "editor.project.save",
      { device: "keyboard", code: "KeyS", modifiers: ["primary"] },
    )).toMatchObject({ ok: false, reason: INPUT_ACTION_REFUSALS.bindingDuplicate });
    expect(reviewInputActionRebind(
      DEFAULT_INPUT_ACTION_MAP,
      "editor.project.save",
      { device: "keyboard", code: "KeyO", modifiers: ["primary"] },
    )).toMatchObject({ ok: false, reason: INPUT_ACTION_REFUSALS.bindingConflict });
  });
});
