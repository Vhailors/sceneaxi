import {
  DEFAULT_INPUT_ACTION_MAP,
  INPUT_ACTION_REFUSALS,
  INPUT_ACTION_REGISTRY,
  contracts,
  inputAction,
  inputActionBindingEquals,
  parseInputActionOverrides,
  resolveInputAction,
  reviewInputActionRebind,
  validateInputActionBinding,
  validateInputActionMap,
} from "@sceneaxi/schemas";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("input-action registry", () => {
  it("ships the versioned schema and one ordered default for every action", () => {
    // SAFETY: The committed input-action-map schema defines these fields; this test checks their values against the exported registry.
    const schema = JSON.parse(readFileSync(
      new URL(`../${contracts.inputActionMap}`, import.meta.url),
      "utf8",
    )) as {
      $id: string;
      $defs: {
        actionId: { enum: string[] };
        map: { properties: { bindings: { minItems: number; maxItems: number } } };
        overrides: { properties: { bindings: { maxItems: number } } };
      };
    };

    expect(schema.$defs.actionId.enum).toEqual(INPUT_ACTION_REGISTRY.map((row) => row.id));
    expect(schema.$defs.map.properties.bindings.minItems).toBe(INPUT_ACTION_REGISTRY.length);
    expect(schema.$defs.map.properties.bindings.maxItems).toBe(INPUT_ACTION_REGISTRY.length);
    expect(schema.$defs.overrides.properties.bindings.maxItems).toBe(INPUT_ACTION_REGISTRY.length);
    expect(validateInputActionMap(DEFAULT_INPUT_ACTION_MAP)).toEqual(DEFAULT_INPUT_ACTION_MAP);
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

  it.each([
    ["editor.run.pause", "KeyP", ["primary", "shift"], null],
    ["editor.run.step", "KeyP", ["alt", "primary"], null],
    ["editor.tool.select", "KeyQ", [], null],
    ["editor.tool.move", "KeyW", [], null],
    ["editor.tool.rotate", "KeyE", [], null],
    ["editor.tool.scale", "KeyR", [], null],
    ["editor.tool.space", "KeyT", [], null],
    ["editor.tool.snap", "KeyY", [], null],
    ["editor.selection.frame", "KeyF", [], null],
    ["editor.selection.delete", "Delete", [], "scene-object-remove"],
    ["editor.selection.duplicate", "KeyD", ["primary"], "scene-object-create"],
    ["editor.selection.rename", "F2", [], null],
    ["editor.selection.all", "KeyA", ["primary"], "scene-selection-set"],
    ["editor.asset.import", "KeyI", ["primary"], null],
    ["editor.workspace.1", "Digit1", ["primary"], null],
    ["editor.workspace.2", "Digit2", ["primary"], null],
    ["editor.workspace.3", "Digit3", ["primary"], null],
    ["editor.workspace.4", "Digit4", ["primary"], null],
    ["editor.panel.bottom", "KeyJ", ["primary"], null],
    ["editor.panel.assets", "Space", ["primary"], null],
    ["editor.panel.problems", "KeyM", ["primary", "shift"], null],
    ["editor.assistant.focus", "KeyL", ["primary"], null],
    ["editor.assistant.new", "KeyL", ["primary", "shift"], null],
    ["editor.assistant.ask-about", "F1", [], "assistant-ask"],
    ["editor.assistant.stop", "Backspace", ["primary", "shift"], "assistant-cancel"],
    ["editor.project.new", "KeyN", ["primary"], "project-new"],
  ])("resolves %s only in editor context", (id, code, modifiers, commandId) => {
    const binding = { device: "keyboard", code, modifiers };
    expect(resolveInputAction(DEFAULT_INPUT_ACTION_MAP, "editor", binding)).toMatchObject({
      ok: true, action: { id, commandId, reserved: false, allowInTextEntry: false },
    });
    expect(resolveInputAction(DEFAULT_INPUT_ACTION_MAP, "play", binding)).toMatchObject({
      ok: false, reason: INPUT_ACTION_REFUSALS.contextDenied,
    });
  });

  it.each([
    ["forward", "KeyW"], ["back", "KeyS"], ["left", "KeyA"],
    ["right", "KeyD"], ["up", "KeyE"], ["down", "KeyQ"],
  ])("isolates fly %s from editor tools", (direction, code) => {
    const binding = { device: "keyboard", code, modifiers: [] };
    expect(resolveInputAction(DEFAULT_INPUT_ACTION_MAP, "viewport-fly", binding)).toMatchObject({
      ok: true, action: { id: `viewport.fly.${direction}`, contexts: ["viewport-fly"] },
    });
    expect(resolveInputAction(DEFAULT_INPUT_ACTION_MAP, "play", binding)).toMatchObject({
      ok: false, reason: INPUT_ACTION_REFUSALS.contextDenied,
    });
  });

  it("keeps pan and look editor-only and the legacy orbit default intact", () => {
    for (const [button, id] of [[1, "viewport.pan"], [2, "viewport.look"]] as const) {
      const binding = { device: "pointer", button, gesture: "drag" };
      expect(resolveInputAction(DEFAULT_INPUT_ACTION_MAP, "editor", binding)).toMatchObject({
        ok: true, action: { id },
      });
      expect(resolveInputAction(DEFAULT_INPUT_ACTION_MAP, "play", binding)).toMatchObject({
        ok: false, reason: INPUT_ACTION_REFUSALS.contextDenied,
      });
    }

    expect(inputAction("viewport.orbit")?.defaultBinding).toEqual({
      device: "pointer", button: 0, gesture: "drag",
    });
  });

  it("validates and freezes optional pointer modifiers without changing legacy overrides", () => {
    const legacy = { device: "pointer", button: 0, gesture: "drag" } as const;
    expect(inputActionBindingEquals(legacy, { ...legacy, modifiers: [] })).toBe(true);
    expect(reviewInputActionRebind(DEFAULT_INPUT_ACTION_MAP, "viewport.orbit", {
      ...legacy, modifiers: [],
    })).toMatchObject({ ok: false, reason: INPUT_ACTION_REFUSALS.bindingDuplicate });

    for (const modifiers of [["alt", "alt"], ["shift", "alt"], ["primary", "meta"], ["bogus"], null]) {
      expect(validateInputActionBinding({ ...legacy, modifiers })).toBe(false);
    }

    expect(validateInputActionBinding({ ...legacy, modifiers: undefined })).toBe(false);
    const modifiers = ["alt"];

    const reviewed = reviewInputActionRebind(DEFAULT_INPUT_ACTION_MAP, "viewport.orbit", {
      ...legacy, modifiers,
    });

    if (!reviewed.ok || !("map" in reviewed)) throw new Error("pointer rebind refused");
    modifiers.push("shift");
    expect(Object.isFrozen(reviewed.binding)).toBe(true);
    expect(reviewed.binding).toMatchObject({ modifiers: ["alt"] });

    if (reviewed.binding.device !== "pointer") throw new Error("expected pointer binding");
    expect(Object.isFrozen(reviewed.binding.modifiers)).toBe(true);
    expect(resolveInputAction(reviewed.map, "editor", { ...legacy, modifiers: ["alt"] })).toMatchObject({
      ok: true, action: { id: "viewport.orbit" },
    });
    expect(resolveInputAction(reviewed.map, "editor", legacy)).toMatchObject({
      ok: false, reason: INPUT_ACTION_REFUSALS.unbound,
    });
    expect(reviewInputActionRebind(reviewed.map, "viewport.pan", {
      ...legacy, modifiers: ["alt"],
    })).toMatchObject({ ok: false, reason: INPUT_ACTION_REFUSALS.bindingConflict });
    expect(parseInputActionOverrides(JSON.stringify({
      schemaVersion: 1, kind: "sceneaxi.input-action-overrides", scope: "project",
      bindings: [{ actionId: "viewport.orbit", binding: legacy }],
    }), "project")?.bindings).toEqual([{ actionId: "viewport.orbit", binding: legacy }]);
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

describe("EF-INPUT historical full-map migration", () => {
  const legacy = {
    "schemaVersion": 1,
    "kind": "sceneaxi.input-action-map",
    "bindings": [
      {
        "actionId": "editor.palette.open",
        "binding": {
          "device": "keyboard",
          "code": "KeyK",
          "modifiers": [
            "primary"
          ]
        }
      },
      {
        "actionId": "editor.project.open",
        "binding": {
          "device": "keyboard",
          "code": "KeyO",
          "modifiers": [
            "primary"
          ]
        }
      },
      {
        "actionId": "editor.project.save",
        "binding": {
          "device": "keyboard",
          "code": "KeyS",
          "modifiers": [
            "primary"
          ]
        }
      },
      {
        "actionId": "editor.edit.undo",
        "binding": {
          "device": "keyboard",
          "code": "KeyZ",
          "modifiers": [
            "primary"
          ]
        }
      },
      {
        "actionId": "editor.edit.redo",
        "binding": {
          "device": "keyboard",
          "code": "KeyZ",
          "modifiers": [
            "primary",
            "shift"
          ]
        }
      },
      {
        "actionId": "editor.run.play",
        "binding": {
          "device": "keyboard",
          "code": "KeyP",
          "modifiers": [
            "primary"
          ]
        }
      },
      {
        "actionId": "editor.focus.next",
        "binding": {
          "device": "keyboard",
          "code": "Tab",
          "modifiers": []
        }
      },
      {
        "actionId": "editor.overlay.dismiss",
        "binding": {
          "device": "keyboard",
          "code": "Escape",
          "modifiers": []
        }
      },
      {
        "actionId": "viewport.orbit",
        "binding": {
          "device": "pointer",
          "button": 0,
          "gesture": "drag"
        }
      },
      {
        "actionId": "viewport.zoom",
        "binding": {
          "device": "wheel",
          "axis": "y",
          "direction": "any"
        }
      },
      {
        "actionId": "play.primary",
        "binding": {
          "device": "controller",
          "controller": 0,
          "input": "button",
          "control": 0,
          "direction": "any"
        }
      }
    ]
  } as const;

  it("upgrades the exact original eleven-row map without losing controller intent", () => {
    const migrated = validateInputActionMap(legacy);
    expect(migrated?.bindings).toHaveLength(INPUT_ACTION_REGISTRY.length);
    expect(migrated?.bindings.slice(0, 11)).toEqual(legacy.bindings);
    expect(migrated?.bindings.slice(11)).toEqual(DEFAULT_INPUT_ACTION_MAP.bindings.slice(11));
    expect(resolveInputAction(legacy, "play", legacy.bindings[10]?.binding)).toMatchObject({ ok: true, action: { id: "play.primary" } });
    expect(Object.isFrozen(migrated?.bindings)).toBe(true);
  });
  it("accepts persisted full-map bytes as minimal scope overrides without rewriting defaults", () => {
    const parsed = parseInputActionOverrides(JSON.stringify(legacy), "project");
    expect(parsed).toEqual({ schemaVersion: 1, kind: "sceneaxi.input-action-overrides", scope: "project", bindings: [legacy.bindings[10]] });
    expect(DEFAULT_INPUT_ACTION_MAP.bindings[10]?.binding.device).toBe("gamepad");
  });
  it("rejects arbitrary truncation, reordering, duplicates, bad versions and invalid old controller controls", () => {
    for (const invalid of [
      { ...legacy, bindings: legacy.bindings.slice(0, 10) },
      { ...legacy, bindings: [...legacy.bindings].reverse() },
      { ...legacy, bindings: [legacy.bindings[0], ...legacy.bindings.slice(0, 10)] },
      { ...legacy, schemaVersion: 2 },
      { ...legacy, bindings: legacy.bindings.map(row => row.actionId === "play.primary" ? { ...row, binding: { ...row.binding, control: 32 } } : row) },
    ]) {
      expect(validateInputActionMap(invalid)).toBeNull();
      expect(parseInputActionOverrides(JSON.stringify(invalid), "project")).toBeNull();
    }
  });
  it("keeps old controller overrides, context isolation and reserved/text-entry metadata", () => {
    const controller = { device: "controller", controller: 3, input: "axis", control: 15, direction: "negative" };
    const parsed = parseInputActionOverrides(JSON.stringify({ schemaVersion: 1, kind: "sceneaxi.input-action-overrides", scope: "workspace", bindings: [{ actionId: "play.primary", binding: controller }] }), "workspace");
    expect(parsed?.bindings[0]?.binding).toEqual(controller);
    expect(validateInputActionBinding({ ...controller, control: 16 })).toBe(false);
    expect(resolveInputAction(DEFAULT_INPUT_ACTION_MAP, "editor", DEFAULT_INPUT_ACTION_MAP.bindings[10]?.binding)).toMatchObject({ ok: false, reason: INPUT_ACTION_REFUSALS.contextDenied });
    expect(inputAction("editor.focus.next")).toMatchObject({ reserved: true, allowInTextEntry: true });
    expect(inputAction("editor.project.save")).toMatchObject({ allowInTextEntry: false });
    expect(reviewInputActionRebind(DEFAULT_INPUT_ACTION_MAP, "editor.focus.next", controller)).toMatchObject({ ok: false, reason: INPUT_ACTION_REFUSALS.reservedAction });
  });
});

describe("EF-INPUT normalization refusal and review closure", () => {
  const ids = ["editor.palette.open", "editor.project.open", "editor.project.save", "editor.edit.undo", "editor.edit.redo", "editor.run.play", "editor.focus.next", "editor.overlay.dismiss", "viewport.orbit", "viewport.zoom", "play.primary"];
  const oldMap = { schemaVersion: 1, kind: "sceneaxi.input-action-map", bindings: DEFAULT_INPUT_ACTION_MAP.bindings.filter(row => ids.includes(row.actionId)) } as const;
  it("refuses old bindings that collide with new commands instead of dropping caller intent", () => {
    const conflicting = { ...oldMap, bindings: oldMap.bindings.map(row => row.actionId === "editor.project.save" ? { ...row, binding: { device: "keyboard", code: "KeyL", modifiers: ["primary"] } } : row) };
    expect(validateInputActionMap(conflicting)).toBeNull();
    expect(parseInputActionOverrides(JSON.stringify(conflicting), "project")).toBeNull();
    expect(reviewInputActionRebind(oldMap, "editor.project.save", { device: "keyboard", code: "KeyL", modifiers: ["primary"] })).toMatchObject({ ok: false, reason: INPUT_ACTION_REFUSALS.bindingConflict });
  });
  it("reviews old callers into full maps and retains current controls", () => {
    const reviewed = reviewInputActionRebind(oldMap, "editor.project.save", { device: "keyboard", code: "F8", modifiers: [] });
    expect(reviewed.ok).toBe(true);

    if (!reviewed.ok || !("map" in reviewed))
      throw Error("review refused");
    expect(reviewed.map.bindings).toHaveLength(INPUT_ACTION_REGISTRY.length);
    expect(resolveInputAction(reviewed.map, "viewport-fly", { device: "keyboard", code: "KeyW", modifiers: [] })).toMatchObject({ ok: true, action: { id: "viewport.fly.forward" } });
    expect(resolveInputAction(reviewed.map, "editor", { device: "keyboard", code: "KeyW", modifiers: [] })).toMatchObject({ ok: true, action: { id: "editor.tool.move" } });
  });
  it("keeps the modern full-map schema unchanged and explicitly declares exact historical input order", () => {
    const schema = JSON.parse(readFileSync(new URL("../contracts/input-action-map.schema.json", import.meta.url), "utf8"));
    expect(schema.oneOf).toContainEqual({ $ref: "#/$defs/legacyMap" });
    expect(schema.$defs.legacyMap.properties.bindings).toMatchObject({ minItems: 11, maxItems: 11, items: false });
    expect(schema.$defs.legacyMap.properties.bindings.prefixItems.map((row: {
      allOf: readonly [
        unknown,
        {
          properties: {
            actionId: {
              const: string;
            };
          };
        }
      ];
    }) => row.allOf[1].properties.actionId.const)).toEqual(ids);
    expect(schema.$defs.map.properties.bindings).toMatchObject({ minItems: 45, maxItems: 45 });
  });
});
