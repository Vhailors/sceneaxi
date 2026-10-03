import { isJsonValue } from "./document.js";
import type { snapshotPlainRecord } from "./record-validation.js";

type InputActionInput = Parameters<typeof isJsonValue>[0];

type RawInputActionRecord = NonNullable<ReturnType<typeof snapshotPlainRecord>>;

/**
 * Full-editor v1 input-action registry.
 *
 * Physical inputs are data. Editor commands and Play-facing viewport controls
 * resolve through this one versioned vocabulary so a client cannot acquire a
 * private accelerator table or let an editor binding leak into Play.
 */
import type { JsonObject } from "./document.js";
import type { EditorCommandId } from "./editor-command-registry.js";
import { digestSculptJson } from "./sculpt-json.js";

export const INPUT_ACTION_SCHEMA_VERSION = 1 as const;

export const INPUT_ACTION_MAP_KIND = "sceneaxi.input-action-map" as const;

export const INPUT_ACTION_OVERRIDES_KIND = "sceneaxi.input-action-overrides" as const;

export const INPUT_ACTION_CONTEXTS = Object.freeze(["editor", "play", "viewport-fly"] as const);

export type InputActionContext = (typeof INPUT_ACTION_CONTEXTS)[number];

export const INPUT_ACTION_SCOPES = Object.freeze(["workspace", "project"] as const);

export type InputActionScope = (typeof INPUT_ACTION_SCOPES)[number];

export const INPUT_ACTION_DEVICES = Object.freeze([
  "keyboard",
  "pointer",
  "wheel",
  "controller",
  "gamepad",
] as const);

export type InputActionDevice = (typeof INPUT_ACTION_DEVICES)[number];

export const INPUT_ACTION_REFUSALS = Object.freeze({
  registryInvalid: "INPUT_ACTION_REGISTRY_INVALID",
  mapInvalid: "INPUT_ACTION_MAP_INVALID",
  actionUnknown: "INPUT_ACTION_UNKNOWN",
  bindingDuplicate: "INPUT_ACTION_BINDING_DUPLICATE",
  bindingConflict: "INPUT_ACTION_BINDING_CONFLICT",
  reservedAction: "INPUT_ACTION_RESERVED",
  deviceInputInvalid: "INPUT_ACTION_DEVICE_INPUT_INVALID",
  contextDenied: "INPUT_ACTION_CONTEXT_DENIED",
  unbound: "INPUT_ACTION_UNBOUND",
  staleBase: "INPUT_ACTION_STALE_BASE_VERSION",
  reviewMismatch: "INPUT_ACTION_REVIEW_MISMATCH",
  persistedStateInvalid: "INPUT_ACTION_PERSISTED_STATE_INVALID",
  writeFailed: "INPUT_ACTION_WRITE_FAILED",
} as const);

export type InputActionRefusal =
  (typeof INPUT_ACTION_REFUSALS)[keyof typeof INPUT_ACTION_REFUSALS];

export type InputActionId =
  | "editor.palette.open"
  | "editor.project.open"
  | "editor.project.save"
  | "editor.edit.undo"
  | "editor.edit.redo"
  | "editor.run.play"
  | "editor.focus.next"
  | "editor.overlay.dismiss"
  | "viewport.orbit"
  | "viewport.zoom"
  | "play.primary"
  | "editor.run.pause"
  | "editor.run.step"
  | "editor.tool.select"
  | "editor.tool.move"
  | "editor.tool.rotate"
  | "editor.tool.scale"
  | "editor.tool.space"
  | "editor.tool.snap"
  | "editor.selection.frame"
  | "editor.selection.delete"
  | "editor.selection.duplicate"
  | "editor.selection.rename"
  | "editor.selection.all"
  | "editor.asset.import"
  | "editor.workspace.1"
  | "editor.workspace.2"
  | "editor.workspace.3"
  | "editor.workspace.4"
  | "editor.panel.bottom"
  | "editor.panel.assets"
  | "editor.panel.problems"
  | "editor.assistant.focus"
  | "editor.assistant.new"
  | "editor.assistant.ask-about"
  | "editor.assistant.stop"
  | "editor.project.new"
  | "viewport.pan"
  | "viewport.look"
  | "viewport.fly.forward"
  | "viewport.fly.back"
  | "viewport.fly.left"
  | "viewport.fly.right"
  | "viewport.fly.up"
  | "viewport.fly.down";

export type KeyboardInputBinding = Readonly<{
  device: "keyboard";
  code: string;
  modifiers: readonly ("alt" | "control" | "meta" | "primary" | "shift")[];
}>;

export type PointerInputBinding = Readonly<{
  device: "pointer";
  button: number;
  gesture: "click" | "drag";
  modifiers?: KeyboardInputBinding["modifiers"];
}>;

export type WheelInputBinding = Readonly<{
  device: "wheel";
  axis: "x" | "y";
  direction: "any" | "negative" | "positive";
}>;

export type ControllerInputBinding = Readonly<{
  device: "controller";
  controller: number;
  input: "axis" | "button";
  control: number;
  direction: "any" | "negative" | "positive";
}>;

export type GamepadInputBinding = Readonly<{
  device: "gamepad";
  gamepad: number;
  input: "axis" | "button";
  control: number;
  direction: "any" | "negative" | "positive";
  deadzone: number;
}>;

export type InputActionBinding =
  | KeyboardInputBinding
  | PointerInputBinding
  | WheelInputBinding
  | ControllerInputBinding
  | GamepadInputBinding;

export type InputActionDefinition = Readonly<{
  schemaVersion: typeof INPUT_ACTION_SCHEMA_VERSION;
  id: InputActionId;
  label: string;
  contexts: readonly InputActionContext[];
  commandId: EditorCommandId | null;
  reserved: boolean;
  allowInTextEntry: boolean;
  defaultBinding: InputActionBinding;
}>;

export type InputActionMapEntry = Readonly<{
  actionId: InputActionId;
  binding: InputActionBinding;
}>;

export type InputActionMap = Readonly<{
  schemaVersion: typeof INPUT_ACTION_SCHEMA_VERSION;
  kind: typeof INPUT_ACTION_MAP_KIND;
  bindings: readonly InputActionMapEntry[];
}>;

export type InputActionOverrides = Readonly<{
  schemaVersion: typeof INPUT_ACTION_SCHEMA_VERSION;
  kind: typeof INPUT_ACTION_OVERRIDES_KIND;
  scope: InputActionScope;
  bindings: readonly InputActionMapEntry[];
}>;

export type InputActionResolution =
  | Readonly<{ ok: true; action: InputActionDefinition; binding: InputActionBinding }>
  | Readonly<{ ok: false; reason: InputActionRefusal; message: string }>;

const keyboard = (
  code: string,
  modifiers: KeyboardInputBinding["modifiers"] = [],
): KeyboardInputBinding => Object.freeze({
  device: "keyboard" as const,
  code,
  modifiers: Object.freeze([...modifiers]),
});

const pointer = (gesture: PointerInputBinding["gesture"]): PointerInputBinding =>
  Object.freeze({ device: "pointer" as const, button: 0, gesture });

const wheel = (): WheelInputBinding =>
  Object.freeze({ device: "wheel" as const, axis: "y" as const, direction: "any" as const });

const action = (definition: InputActionDefinition): InputActionDefinition => Object.freeze({
  ...definition,
  contexts: Object.freeze([...definition.contexts]),
});

const keyboardAction = (
  id: InputActionId,
  label: string,
  code: string,
  modifiers: KeyboardInputBinding["modifiers"] = [],
  commandId: EditorCommandId | null = null,
  context: InputActionContext = "editor",
): InputActionDefinition => action({
  schemaVersion: INPUT_ACTION_SCHEMA_VERSION,
  id,
  label,
  contexts: [context],
  commandId,
  reserved: false,
  allowInTextEntry: false,
  defaultBinding: keyboard(code, modifiers),
});

export const INPUT_ACTION_REGISTRY = Object.freeze([
  action({
    schemaVersion: 1,
    id: "editor.palette.open",
    label: "Commands",
    contexts: ["editor"],
    commandId: null,
    reserved: false,
    allowInTextEntry: true,
    defaultBinding: keyboard("KeyK", ["primary"]),
  }),
  action({
    schemaVersion: 1,
    id: "editor.project.open",
    label: "Open Project",
    contexts: ["editor"],
    commandId: "project-open",
    reserved: false,
    allowInTextEntry: false,
    defaultBinding: keyboard("KeyO", ["primary"]),
  }),
  action({
    schemaVersion: 1,
    id: "editor.project.save",
    label: "Save",
    contexts: ["editor"],
    commandId: "project-save",
    reserved: false,
    allowInTextEntry: false,
    defaultBinding: keyboard("KeyS", ["primary"]),
  }),
  action({
    schemaVersion: 1,
    id: "editor.edit.undo",
    label: "Undo",
    contexts: ["editor"],
    commandId: "edit-undo",
    reserved: false,
    allowInTextEntry: false,
    defaultBinding: keyboard("KeyZ", ["primary"]),
  }),
  action({
    schemaVersion: 1,
    id: "editor.edit.redo",
    label: "Redo",
    contexts: ["editor"],
    commandId: "edit-redo",
    reserved: false,
    allowInTextEntry: false,
    defaultBinding: keyboard("KeyZ", ["primary", "shift"]),
  }),
  action({
    schemaVersion: 1,
    id: "editor.run.play",
    label: "Play",
    contexts: ["editor"],
    commandId: "run-play",
    reserved: false,
    allowInTextEntry: false,
    defaultBinding: keyboard("KeyP", ["primary"]),
  }),
  action({
    schemaVersion: 1,
    id: "editor.focus.next",
    label: "Move focus",
    contexts: ["editor"],
    commandId: null,
    reserved: true,
    allowInTextEntry: true,
    defaultBinding: keyboard("Tab"),
  }),
  action({
    schemaVersion: 1,
    id: "editor.overlay.dismiss",
    label: "Dismiss",
    contexts: ["editor"],
    commandId: null,
    reserved: true,
    allowInTextEntry: true,
    defaultBinding: keyboard("Escape"),
  }),
  action({
    schemaVersion: 1,
    id: "viewport.orbit",
    label: "Orbit viewport",
    contexts: ["editor", "play"],
    commandId: null,
    reserved: false,
    allowInTextEntry: false,
    defaultBinding: pointer("drag"),
  }),
  action({
    schemaVersion: 1,
    id: "viewport.zoom",
    label: "Zoom viewport",
    contexts: ["editor", "play"],
    commandId: null,
    reserved: false,
    allowInTextEntry: false,
    defaultBinding: wheel(),
  }),
  action({
    schemaVersion: 1,
    id: "play.primary",
    label: "Play primary action",
    contexts: ["play"],
    commandId: null,
    reserved: false,
    allowInTextEntry: false,
    defaultBinding: Object.freeze({
      device: "gamepad" as const,
      gamepad: 0,
      input: "button" as const,
      control: 0,
      direction: "any" as const,
      deadzone: 0.2,
    }),
  }),
  keyboardAction("editor.run.pause", "Pause", "KeyP", ["primary", "shift"]),
  keyboardAction("editor.run.step", "Step one tick", "KeyP", ["alt", "primary"]),
  keyboardAction("editor.tool.select", "Select tool", "KeyQ"),
  keyboardAction("editor.tool.move", "Move tool", "KeyW"),
  keyboardAction("editor.tool.rotate", "Rotate tool", "KeyE"),
  keyboardAction("editor.tool.scale", "Scale tool", "KeyR"),
  keyboardAction("editor.tool.space", "Toggle local/world", "KeyT"),
  keyboardAction("editor.tool.snap", "Toggle snapping", "KeyY"),
  keyboardAction("editor.selection.frame", "Frame selection", "KeyF"),
  keyboardAction("editor.selection.delete", "Delete", "Delete", [], "scene-object-remove"),
  keyboardAction("editor.selection.duplicate", "Duplicate", "KeyD", ["primary"], "scene-object-create"),
  keyboardAction("editor.selection.rename", "Rename", "F2"),
  keyboardAction("editor.selection.all", "Select all", "KeyA", ["primary"], "scene-selection-set"),
  // The host owns the asset picker; there is no registry command for it.
  keyboardAction("editor.asset.import", "Import asset", "KeyI", ["primary"]),
  keyboardAction("editor.workspace.1", "Workspace Scene", "Digit1", ["primary"]),
  keyboardAction("editor.workspace.2", "Workspace Animate", "Digit2", ["primary"]),
  keyboardAction("editor.workspace.3", "Workspace Play", "Digit3", ["primary"]),
  keyboardAction("editor.workspace.4", "Workspace Ship", "Digit4", ["primary"]),
  keyboardAction("editor.panel.bottom", "Toggle bottom panel", "KeyJ", ["primary"]),
  keyboardAction("editor.panel.assets", "Assets drawer", "Space", ["primary"]),
  keyboardAction("editor.panel.problems", "Problems", "KeyM", ["primary", "shift"]),
  keyboardAction("editor.assistant.focus", "Assistant", "KeyL", ["primary"]),
  keyboardAction("editor.assistant.new", "New chat", "KeyL", ["primary", "shift"]),
  keyboardAction("editor.assistant.ask-about", "Ask about this", "F1", [], "assistant-ask"),
  keyboardAction("editor.assistant.stop", "Stop assistant job", "Backspace", ["primary", "shift"], "assistant-cancel"),
  keyboardAction("editor.project.new", "New project", "KeyN", ["primary"], "project-new"),
  action({
    schemaVersion: 1,
    id: "viewport.pan",
    label: "Pan viewport",
    contexts: ["editor"],
    commandId: null,
    reserved: false,
    allowInTextEntry: false,
    defaultBinding: Object.freeze({ device: "pointer", button: 1, gesture: "drag" }),
  }),
  action({
    schemaVersion: 1,
    id: "viewport.look",
    label: "Look / fly",
    contexts: ["editor"],
    commandId: null,
    reserved: false,
    allowInTextEntry: false,
    defaultBinding: Object.freeze({ device: "pointer", button: 2, gesture: "drag" }),
  }),
  keyboardAction("viewport.fly.forward", "Fly forward", "KeyW", [], null, "viewport-fly"),
  keyboardAction("viewport.fly.back", "Fly back", "KeyS", [], null, "viewport-fly"),
  keyboardAction("viewport.fly.left", "Fly left", "KeyA", [], null, "viewport-fly"),
  keyboardAction("viewport.fly.right", "Fly right", "KeyD", [], null, "viewport-fly"),
  keyboardAction("viewport.fly.up", "Fly up", "KeyE", [], null, "viewport-fly"),
  keyboardAction("viewport.fly.down", "Fly down", "KeyQ", [], null, "viewport-fly"),
] as const satisfies readonly InputActionDefinition[]);

const ACTION_BY_ID = new Map<string, InputActionDefinition>(
  INPUT_ACTION_REGISTRY.map((definition) => [definition.id, definition]),
);

export function inputAction(value: InputActionInput): InputActionDefinition | undefined {
  return isBoundaryString(value) ? ACTION_BY_ID.get(value) : undefined;
}

export function inputActionForCommand(
  commandId: EditorCommandId,
): InputActionDefinition | undefined {
  return INPUT_ACTION_REGISTRY.find((definition) => definition.commandId === commandId);
}

function record(value: InputActionInput): value is RawInputActionRecord {
  return isBoundaryObjectOrNull(value) && value !== null && !Array.isArray(value);
}

function exactKeys(value: RawInputActionRecord, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();

  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

const KEYBOARD_CODES = /^(?:Key[A-Z]|Digit[0-9]|F(?:[1-9]|1[0-2])|Arrow(?:Up|Down|Left|Right)|Backspace|Delete|End|Enter|Escape|Home|Page(?:Up|Down)|Space|Tab)$/;

const MODIFIERS = ["alt", "control", "meta", "primary", "shift"] as const;

export function validateInputActionBinding(value: InputActionInput): value is InputActionBinding {
  if (!record(value) || !isBoundaryString(value["device"])) return false;

  if (value["device"] === "keyboard" || (value["device"] === "pointer" && "modifiers" in value)) {
    const modifiers = value["modifiers"];

    if (!Array.isArray(modifiers) || modifiers.some((modifier) =>
      !MODIFIERS.some((allowed) => allowed === modifier))) return false;

    if (new Set(modifiers).size !== modifiers.length ||
      [...modifiers].sort().some((modifier, index) => modifier !== modifiers[index])) return false;

    if (modifiers.includes("primary") &&
      (modifiers.includes("control") || modifiers.includes("meta"))) return false;
  }

  switch (value["device"]) {
    case "keyboard":
      return exactKeys(value, ["device", "code", "modifiers"]) &&
        isBoundaryString(value["code"]) && KEYBOARD_CODES.test(value["code"]);
    case "pointer":
      return exactKeys(value, "modifiers" in value
        ? ["device", "button", "gesture", "modifiers"]
        : ["device", "button", "gesture"]) &&
        Number.isInteger(value["button"]) && Number(value["button"]) >= 0 &&
        Number(value["button"]) <= 4 &&
        (value["gesture"] === "click" || value["gesture"] === "drag");
    case "wheel":
      return exactKeys(value, ["device", "axis", "direction"]) &&
        (value["axis"] === "x" || value["axis"] === "y") &&
        (value["direction"] === "any" || value["direction"] === "negative" ||
          value["direction"] === "positive");
    case "controller":
      return exactKeys(value, ["device", "controller", "input", "control", "direction"]) &&
        Number.isInteger(value["controller"]) && Number(value["controller"]) >= 0 &&
        Number(value["controller"]) <= 3 &&
        (value["input"] === "axis" || value["input"] === "button") &&
        Number.isInteger(value["control"]) && Number(value["control"]) >= 0 &&
        Number(value["control"]) <= (value["input"] === "axis" ? 15 : 31) &&
        (value["direction"] === "any" || value["direction"] === "negative" ||
          value["direction"] === "positive");
    case "gamepad":
      return exactKeys(value, ["device", "gamepad", "input", "control", "direction", "deadzone"]) &&
        Number.isInteger(value["gamepad"]) && Number(value["gamepad"]) >= 0 &&
        Number(value["gamepad"]) <= 3 &&
        (value["input"] === "axis" || value["input"] === "button") &&
        Number.isInteger(value["control"]) && Number(value["control"]) >= 0 &&
        Number(value["control"]) <= (value["input"] === "axis" ? 3 : 16) &&
        (value["direction"] === "any" || value["direction"] === "negative" ||
          value["direction"] === "positive") &&
        Number.isFinite(value["deadzone"]) && Number(value["deadzone"]) >= 0 &&
        Number(value["deadzone"]) < 1;
    default:
      return false;
  }
}

function freezeBinding(binding: InputActionBinding): InputActionBinding {
  if (binding.device === "keyboard" || (binding.device === "pointer" && binding.modifiers !== undefined)) {
    return Object.freeze({ ...binding, modifiers: Object.freeze([...(binding.modifiers ?? [])]) });
  }

  return Object.freeze({ ...binding });
}

function entry(value: InputActionInput): InputActionMapEntry | null {
  if (!record(value) || !exactKeys(value, ["actionId", "binding"]) ||
    !isBoundaryString(value["actionId"]) || inputAction(value["actionId"]) === undefined ||
    !validateInputActionBinding(value["binding"])) return null;

  // SAFETY: inputAction found this actionId in the fixed INPUT_ACTION_REGISTRY above.
  return Object.freeze({
    actionId: value["actionId"] as InputActionId,
    binding: freezeBinding(value["binding"]),
  });
}

/** Normalize the original full v1 map to today's registry, retaining every supplied binding. */
export function validateInputActionMap(value: InputActionInput): InputActionMap | null {
  if (!record(value) || !exactKeys(value, ["schemaVersion", "kind", "bindings"]) || value["schemaVersion"] !== INPUT_ACTION_SCHEMA_VERSION || value["kind"] !== INPUT_ACTION_MAP_KIND || !Array.isArray(value["bindings"]))
    return null;
  const legacy = value["bindings"].length === LEGACY_INPUT_ACTION_IDS.length;
  const ids = legacy ? LEGACY_INPUT_ACTION_IDS : INPUT_ACTION_REGISTRY.map(definition => definition.id);

  if (value["bindings"].length !== ids.length)
    return null;
  const bindings: InputActionMapEntry[] = [];

  for (let index = 0; index < ids.length; index += 1) {
    const parsed = entry(value["bindings"][index]);

    if (parsed === null || parsed.actionId !== ids[index])
      return null;
    bindings.push(parsed);
  }

  if (legacy) {
    // A historical custom binding may now collide with a newly introduced default.
    // Refuse ambiguity rather than discard that binding or steal the new command.
    for (const definition of INPUT_ACTION_REGISTRY) {
      if (LEGACY_INPUT_ACTION_IDS.includes(definition.id))
        continue;

      if (bindings.some(row => inputActionBindingEquals(row.binding, definition.defaultBinding) && inputAction(row.actionId)?.contexts.some(context => definition.contexts.includes(context))))
        return null;
      bindings.push(Object.freeze({ actionId: definition.id, binding: definition.defaultBinding }));
    }
  }

  return Object.freeze({ schemaVersion: INPUT_ACTION_SCHEMA_VERSION, kind: INPUT_ACTION_MAP_KIND, bindings: Object.freeze(bindings) });
}

export function validateInputActionOverrides(
  value: InputActionInput,
  expectedScope?: InputActionScope,
): InputActionOverrides | null {
  if (!record(value) || !exactKeys(value, ["schemaVersion", "kind", "scope", "bindings"]) ||
    value["schemaVersion"] !== INPUT_ACTION_SCHEMA_VERSION ||
    value["kind"] !== INPUT_ACTION_OVERRIDES_KIND ||
    !INPUT_ACTION_SCOPES.some(scope => scope === value["scope"]) ||
    (expectedScope !== undefined && value["scope"] !== expectedScope) ||
    !Array.isArray(value["bindings"])) return null;
  const bindings: InputActionMapEntry[] = [];
  const seen = new Set<InputActionId>();
  let lastIndex = -1;

  for (const raw of value["bindings"]) {
    const parsed = entry(raw);

    if (parsed === null || seen.has(parsed.actionId)) return null;
    const index = INPUT_ACTION_REGISTRY.findIndex((definition) => definition.id === parsed.actionId);

    if (index <= lastIndex) return null;
    lastIndex = index;
    seen.add(parsed.actionId);
    bindings.push(parsed);
  }

  // SAFETY: scope membership was checked against INPUT_ACTION_SCOPES before bindings were parsed.
  return Object.freeze({
    schemaVersion: INPUT_ACTION_SCHEMA_VERSION,
    kind: INPUT_ACTION_OVERRIDES_KIND,
    scope: value["scope"] as InputActionScope,
    bindings: Object.freeze(bindings),
  });
}

export const DEFAULT_INPUT_ACTION_MAP: InputActionMap = Object.freeze({
  schemaVersion: INPUT_ACTION_SCHEMA_VERSION,
  kind: INPUT_ACTION_MAP_KIND,
  bindings: Object.freeze(INPUT_ACTION_REGISTRY.map((definition) => Object.freeze({
    actionId: definition.id,
    binding: definition.defaultBinding,
  }))),
});

export function emptyInputActionOverrides(scope: InputActionScope): InputActionOverrides {
  return Object.freeze({
    schemaVersion: INPUT_ACTION_SCHEMA_VERSION,
    kind: INPUT_ACTION_OVERRIDES_KIND,
    scope,
    bindings: Object.freeze([]),
  });
}

export function composeInputActionMap(
  workspace: InputActionOverrides,
  project: InputActionOverrides,
): InputActionMap {
  const workspaceMap = new Map(workspace.bindings.map((row) => [row.actionId, row.binding]));
  const projectMap = new Map(project.bindings.map((row) => [row.actionId, row.binding]));

  return Object.freeze({
    schemaVersion: INPUT_ACTION_SCHEMA_VERSION,
    kind: INPUT_ACTION_MAP_KIND,
    bindings: Object.freeze(INPUT_ACTION_REGISTRY.map((definition) => Object.freeze({
      actionId: definition.id,
      binding: projectMap.get(definition.id) ?? workspaceMap.get(definition.id) ??
        definition.defaultBinding,
    }))),
  });
}

export function inputActionMapDigest(map: InputActionMap): string {
  // SAFETY: InputActionMap owns only version, kind, and typed JSON binding fields.
  return digestSculptJson(map as JsonObject);
}

export function inputActionOverridesDigest(overrides: InputActionOverrides): string {
  // SAFETY: InputActionOverrides owns only version, kind, scope, and typed JSON binding fields.
  return digestSculptJson(overrides as JsonObject);
}

export function serializeInputActionOverrides(overrides: InputActionOverrides): string {
  return `${JSON.stringify(overrides, null, 2)}\n`;
}

/** Read-only migration: full effective v1 maps become minimal scoped overrides.
 * Old controller bindings remain controller bindings; no invented deadzone or index narrowing.
 * Persistence is still an explicit reviewed atomic host write, never a read side effect.
 */
export function parseInputActionOverrides(text: string, scope: InputActionScope): InputActionOverrides | null {
  try {
    const value: InputActionInput = JSON.parse(text);
    const overrides = validateInputActionOverrides(value, scope);

    if (overrides !== null)
      return overrides;
    const map = validateInputActionMap(value);

    if (map === null)
      return null;

    return validateInputActionOverrides({
      schemaVersion: INPUT_ACTION_SCHEMA_VERSION, kind: INPUT_ACTION_OVERRIDES_KIND, scope, bindings: map.bindings.filter(row => {
        const definition = inputAction(row.actionId);

        return definition !== undefined && !inputActionBindingEquals(row.binding, definition.defaultBinding);
      })
    }, scope);
  }
  catch {
    return null;
  }
}

export function inputActionBindingEquals(
  left: InputActionBinding,
  right: InputActionBinding,
): boolean {
  if (left.device === "pointer" && right.device === "pointer") {
    return left.button === right.button && left.gesture === right.gesture &&
      JSON.stringify(left.modifiers ?? []) === JSON.stringify(right.modifiers ?? []);
  }

  return JSON.stringify(left) === JSON.stringify(right);
}

export function reviewInputActionRebind(
  current: InputActionMap,
  actionId: InputActionInput,
  binding: InputActionInput,
): InputActionResolution | Readonly<{ ok: true; map: InputActionMap; action: InputActionDefinition; binding: InputActionBinding }> {
  const normalized = validateInputActionMap(current);

  if (normalized === null) return Object.freeze({ ok: false as const, reason: INPUT_ACTION_REFUSALS.mapInvalid, message: "The input-action map is invalid." });
  const definition = inputAction(actionId);

  if (definition === undefined) {
    return Object.freeze({ ok: false as const, reason: INPUT_ACTION_REFUSALS.actionUnknown, message: "The input action is not registered." });
  }

  if (definition.reserved) {
    return Object.freeze({ ok: false as const, reason: INPUT_ACTION_REFUSALS.reservedAction, message: `${definition.id} is reserved to preserve focus and accessibility behavior.` });
  }

  if (!validateInputActionBinding(binding)) {
    return Object.freeze({ ok: false as const, reason: INPUT_ACTION_REFUSALS.deviceInputInvalid, message: "The physical device input is invalid." });
  }

  const existing = normalized.bindings.find((row) => row.actionId === definition.id);

  if (existing !== undefined && inputActionBindingEquals(existing.binding, binding)) {
    return Object.freeze({ ok: false as const, reason: INPUT_ACTION_REFUSALS.bindingDuplicate, message: `${definition.id} already uses that binding.` });
  }

  for (const row of normalized.bindings) {
    if (row.actionId === definition.id || !inputActionBindingEquals(row.binding, binding)) continue;
    const other = inputAction(row.actionId);

    if (other !== undefined && other.contexts.some((context) => definition.contexts.includes(context))) {
      return Object.freeze({ ok: false as const, reason: INPUT_ACTION_REFUSALS.bindingConflict, message: `${definition.id} conflicts with ${other.id} in ${definition.contexts.filter((context) => other.contexts.includes(context)).join(", ")}.` });
    }
  }

  const next = Object.freeze({
    schemaVersion: INPUT_ACTION_SCHEMA_VERSION,
    kind: INPUT_ACTION_MAP_KIND,
    bindings: Object.freeze(normalized.bindings.map((row) => row.actionId === definition.id
      ? Object.freeze({ actionId: definition.id, binding: freezeBinding(binding) })
      : row)),
  });

  return Object.freeze({ ok: true as const, map: next, action: definition, binding: freezeBinding(binding) });
}

function bindingMatches(binding: InputActionBinding, input: InputActionBinding): boolean {
  if (binding.device !== input.device) return false;

  if (binding.device === "wheel" && input.device === "wheel") {
    return binding.axis === input.axis &&
      (binding.direction === "any" || input.direction === "any" || binding.direction === input.direction);
  }

  if (binding.device === "controller" && input.device === "controller") {
    return binding.controller === input.controller && binding.input === input.input &&
      binding.control === input.control &&
      (binding.direction === "any" || input.direction === "any" || binding.direction === input.direction);
  }

  if (binding.device === "gamepad" && input.device === "gamepad") {
    return binding.gamepad === input.gamepad && binding.input === input.input &&
      binding.control === input.control &&
      (binding.direction === "any" || input.direction === "any" || binding.direction === input.direction);
  }

  return inputActionBindingEquals(binding, input);
}

export function resolveInputAction(
  map: InputActionMap,
  context: InputActionContext,
  input: InputActionInput,
): InputActionResolution {
  const normalized = validateInputActionMap(map);

  if (normalized === null) {
    return Object.freeze({ ok: false as const, reason: INPUT_ACTION_REFUSALS.mapInvalid, message: "The input-action map is invalid." });
  }

  if (!validateInputActionBinding(input)) {
    return Object.freeze({ ok: false as const, reason: INPUT_ACTION_REFUSALS.deviceInputInvalid, message: "The physical device input is invalid." });
  }

  const candidates = normalized.bindings.filter((row) => bindingMatches(row.binding, input));
  const matched = candidates.find((row) => inputAction(row.actionId)?.contexts.includes(context));

  if (matched !== undefined) {
    const definition = inputAction(matched.actionId);

    if (definition !== undefined) {
      return Object.freeze({ ok: true as const, action: definition, binding: matched.binding });
    }
  }

  if (candidates.length > 0) {
    return Object.freeze({ ok: false as const, reason: INPUT_ACTION_REFUSALS.contextDenied, message: `The binding is registered outside ${context} context.` });
  }

  return Object.freeze({ ok: false as const, reason: INPUT_ACTION_REFUSALS.unbound, message: "The physical input is not bound." });
}

/** Exact v1 registry shipped at Git740c7e9. Other truncated maps are corrupt, not migrations. */
const LEGACY_INPUT_ACTION_IDS: readonly InputActionId[] = Object.freeze([
  "editor.palette.open", "editor.project.open", "editor.project.save", "editor.edit.undo", "editor.edit.redo", "editor.run.play", "editor.focus.next", "editor.overlay.dismiss", "viewport.orbit", "viewport.zoom", "play.primary"
]);

function isBoundaryString(value: InputActionInput): value is string {
  return typeof value === "string";
}

function isBoundaryObjectOrNull(value: InputActionInput): value is object | null {
  return isBoundaryObjectValue(value);
}

type BoundaryObjectValue = object | null;

function isBoundaryObjectValue<Input>(value: Input): value is Input & Readonly<BoundaryObjectValue> {
  return typeof value === "object";
}
