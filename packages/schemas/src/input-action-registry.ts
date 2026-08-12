/**
 * Full-editor v1 input-action registry.
 *
 * Physical inputs are data. Editor commands and Play-facing viewport controls
 * resolve through this one versioned vocabulary so a client cannot acquire a
 * private accelerator table or let an editor binding leak into Play.
 */
import { digestSculptJson } from "./sculpt-json.js";
import type { JsonObject } from "./document.js";
import type { EditorCommandId } from "./editor-command-registry.js";

export const INPUT_ACTION_SCHEMA_VERSION = 1 as const;
export const INPUT_ACTION_MAP_KIND = "sceneaxi.input-action-map" as const;
export const INPUT_ACTION_OVERRIDES_KIND = "sceneaxi.input-action-overrides" as const;

export const INPUT_ACTION_CONTEXTS = Object.freeze(["editor", "play"] as const);
export type InputActionContext = (typeof INPUT_ACTION_CONTEXTS)[number];

export const INPUT_ACTION_SCOPES = Object.freeze(["workspace", "project"] as const);
export type InputActionScope = (typeof INPUT_ACTION_SCOPES)[number];

export const INPUT_ACTION_DEVICES = Object.freeze([
  "keyboard",
  "pointer",
  "wheel",
  "controller",
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
  | "play.primary";

export type KeyboardInputBinding = Readonly<{
  device: "keyboard";
  code: string;
  modifiers: readonly ("alt" | "control" | "meta" | "primary" | "shift")[];
}>;

export type PointerInputBinding = Readonly<{
  device: "pointer";
  button: number;
  gesture: "click" | "drag";
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

export type InputActionBinding =
  | KeyboardInputBinding
  | PointerInputBinding
  | WheelInputBinding
  | ControllerInputBinding;

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
      device: "controller" as const,
      controller: 0,
      input: "button" as const,
      control: 0,
      direction: "any" as const,
    }),
  }),
] as const satisfies readonly InputActionDefinition[]);

const ACTION_BY_ID = new Map<InputActionId, InputActionDefinition>(
  INPUT_ACTION_REGISTRY.map((definition) => [definition.id, definition]),
);

export function inputAction(value: unknown): InputActionDefinition | undefined {
  return typeof value === "string" ? ACTION_BY_ID.get(value as InputActionId) : undefined;
}

export function inputActionForCommand(
  commandId: EditorCommandId,
): InputActionDefinition | undefined {
  return INPUT_ACTION_REGISTRY.find((definition) => definition.commandId === commandId);
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

const KEYBOARD_CODES = /^(?:Key[A-Z]|Digit[0-9]|F(?:[1-9]|1[0-2])|Arrow(?:Up|Down|Left|Right)|Backspace|Delete|End|Enter|Escape|Home|Page(?:Up|Down)|Space|Tab)$/;
const MODIFIERS = ["alt", "control", "meta", "primary", "shift"] as const;

export function validateInputActionBinding(value: unknown): value is InputActionBinding {
  if (!record(value) || typeof value["device"] !== "string") return false;
  switch (value["device"]) {
    case "keyboard": {
      if (!exactKeys(value, ["device", "code", "modifiers"]) ||
        typeof value["code"] !== "string" || !KEYBOARD_CODES.test(value["code"]) ||
        !Array.isArray(value["modifiers"])) return false;
      const modifiers = value["modifiers"];
      if (modifiers.some((modifier) =>
        typeof modifier !== "string" || !(MODIFIERS as readonly string[]).includes(modifier))) {
        return false;
      }
      if (new Set(modifiers).size !== modifiers.length ||
        [...modifiers].sort().some((modifier, index) => modifier !== modifiers[index])) return false;
      return !(modifiers.includes("primary") &&
        (modifiers.includes("control") || modifiers.includes("meta")));
    }
    case "pointer":
      return exactKeys(value, ["device", "button", "gesture"]) &&
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
    default:
      return false;
  }
}

function freezeBinding(binding: InputActionBinding): InputActionBinding {
  return binding.device === "keyboard"
    ? Object.freeze({ ...binding, modifiers: Object.freeze([...binding.modifiers]) })
    : Object.freeze({ ...binding });
}

function entry(value: unknown): InputActionMapEntry | null {
  if (!record(value) || !exactKeys(value, ["actionId", "binding"]) ||
    typeof value["actionId"] !== "string" || inputAction(value["actionId"]) === undefined ||
    !validateInputActionBinding(value["binding"])) return null;
  return Object.freeze({
    actionId: value["actionId"] as InputActionId,
    binding: freezeBinding(value["binding"]),
  });
}

export function validateInputActionMap(value: unknown): InputActionMap | null {
  if (!record(value) || !exactKeys(value, ["schemaVersion", "kind", "bindings"]) ||
    value["schemaVersion"] !== INPUT_ACTION_SCHEMA_VERSION || value["kind"] !== INPUT_ACTION_MAP_KIND ||
    !Array.isArray(value["bindings"]) || value["bindings"].length !== INPUT_ACTION_REGISTRY.length) {
    return null;
  }
  const bindings: InputActionMapEntry[] = [];
  for (let index = 0; index < value["bindings"].length; index += 1) {
    const parsed = entry(value["bindings"][index]);
    if (parsed === null || parsed.actionId !== INPUT_ACTION_REGISTRY[index]?.id) return null;
    bindings.push(parsed);
  }
  return Object.freeze({
    schemaVersion: INPUT_ACTION_SCHEMA_VERSION,
    kind: INPUT_ACTION_MAP_KIND,
    bindings: Object.freeze(bindings),
  });
}

export function validateInputActionOverrides(
  value: unknown,
  expectedScope?: InputActionScope,
): InputActionOverrides | null {
  if (!record(value) || !exactKeys(value, ["schemaVersion", "kind", "scope", "bindings"]) ||
    value["schemaVersion"] !== INPUT_ACTION_SCHEMA_VERSION ||
    value["kind"] !== INPUT_ACTION_OVERRIDES_KIND ||
    !(INPUT_ACTION_SCOPES as readonly unknown[]).includes(value["scope"]) ||
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
  return digestSculptJson(map as unknown as JsonObject);
}

export function inputActionOverridesDigest(overrides: InputActionOverrides): string {
  return digestSculptJson(overrides as unknown as JsonObject);
}

export function serializeInputActionOverrides(overrides: InputActionOverrides): string {
  return `${JSON.stringify(overrides, null, 2)}\n`;
}

export function parseInputActionOverrides(
  text: string,
  scope: InputActionScope,
): InputActionOverrides | null {
  try {
    return validateInputActionOverrides(JSON.parse(text) as unknown, scope);
  } catch {
    return null;
  }
}

export function inputActionBindingEquals(
  left: InputActionBinding,
  right: InputActionBinding,
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function reviewInputActionRebind(
  current: InputActionMap,
  actionId: unknown,
  binding: unknown,
): InputActionResolution | Readonly<{ ok: true; map: InputActionMap; action: InputActionDefinition; binding: InputActionBinding }> {
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
  const existing = current.bindings.find((row) => row.actionId === definition.id);
  if (existing !== undefined && inputActionBindingEquals(existing.binding, binding)) {
    return Object.freeze({ ok: false as const, reason: INPUT_ACTION_REFUSALS.bindingDuplicate, message: `${definition.id} already uses that binding.` });
  }
  for (const row of current.bindings) {
    if (row.actionId === definition.id || !inputActionBindingEquals(row.binding, binding)) continue;
    const other = inputAction(row.actionId);
    if (other !== undefined && other.contexts.some((context) => definition.contexts.includes(context))) {
      return Object.freeze({ ok: false as const, reason: INPUT_ACTION_REFUSALS.bindingConflict, message: `${definition.id} conflicts with ${other.id} in ${definition.contexts.filter((context) => other.contexts.includes(context)).join(", ")}.` });
    }
  }
  const next = Object.freeze({
    schemaVersion: INPUT_ACTION_SCHEMA_VERSION,
    kind: INPUT_ACTION_MAP_KIND,
    bindings: Object.freeze(current.bindings.map((row) => row.actionId === definition.id
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
  return inputActionBindingEquals(binding, input);
}

export function resolveInputAction(
  map: InputActionMap,
  context: InputActionContext,
  input: unknown,
): InputActionResolution {
  if (validateInputActionMap(map) === null) {
    return Object.freeze({ ok: false as const, reason: INPUT_ACTION_REFUSALS.mapInvalid, message: "The input-action map is invalid." });
  }
  if (!validateInputActionBinding(input)) {
    return Object.freeze({ ok: false as const, reason: INPUT_ACTION_REFUSALS.deviceInputInvalid, message: "The physical device input is invalid." });
  }
  const candidates = map.bindings.filter((row) => bindingMatches(row.binding, input));
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
