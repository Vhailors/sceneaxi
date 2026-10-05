/** Bounded declarative gameplay; no eval, host calls or background timers. */
import { snapshotPlainRecord, inputAction, validateInputActionBinding, type GamepadInputBinding } from "@sceneaxi/schemas";
import { KernelSessionError } from "./errors.js";

export type { GameplayEffect, GameplayDefinition, GameplayActionCommand, GameplaySnapshot } from "@sceneaxi/schemas";

import type { GameplayEffect, GameplayDefinition, GameplaySnapshot } from "@sceneaxi/schemas";

const id = (v: unknown): v is string => typeof v === "string" && /^[a-z][a-z0-9.-]{0,63}$/.test(v) && !["constructor", "prototype", "__proto__"].includes(v);

const integer = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && Math.abs(v) <= 1_000_000;

const allowed = (record: Readonly<Record<string, unknown>>, fields: readonly string[]) => Object.keys(record).every(key => fields.includes(key));

const refuse = (): never => { throw new KernelSessionError("invalid or unsupported gameplay definition"); };

export function validateGameplay(value: unknown): GameplayDefinition {
  const record = snapshotPlainRecord(value);

  if (!record || !allowed(record,["profile","initialState","actions","timers"]) || (record["profile"] !== "game" && record["profile"] !== "web")) return refuse();
  const initial = snapshotPlainRecord(record["initialState"]);

  if (!initial || Object.keys(initial).length > 64) return refuse();
  const state: Record<string, number> = {};

  for (const key of Object.keys(initial).sort()) {
    const v = initial[key];

    if (!id(key) || !integer(v)) return refuse();
    state[key] = v;
  }

  const effects = (value: unknown): readonly GameplayEffect[] => {
    if (!Array.isArray(value) || value.length > 64) return refuse();

    return Object.freeze(value.map((raw: unknown): GameplayEffect => {
      const e = snapshotPlainRecord(raw);

      if (!e) return refuse();

      if (e["kind"] === "move") {
        const axis: unknown = e["axis"];

        if (!allowed(e,["kind","actor","axis"]) || !id(e["actor"]) || !Array.isArray(axis) || axis.length !== 2 || !integer(axis[0]) || !integer(axis[1])) return refuse();

        return Object.freeze({ kind: "move", actor: e["actor"], axis: Object.freeze([axis[0], axis[1]] as const) });
      }

      if (!allowed(e,["kind","key","value"]) || (e["kind"] !== "add-state" && e["kind"] !== "set-state") || !id(e["key"]) || !Object.hasOwn(state, e["key"]) || !integer(e["value"])) return refuse();

      return Object.freeze({ kind: e["kind"], key: e["key"], value: e["value"] });
    }));
  };

  const actions = record["actions"];
  const timers = record["timers"];

  if (!Array.isArray(actions) || actions.length > 64 || !Array.isArray(timers) || timers.length > 64) return refuse();
  const seen = new Set<string>();

  const normalizedActions = actions.map((raw: unknown) => {
    const a = snapshotPlainRecord(raw);

    if (!a || !allowed(a,["id","effects"]) || !id(a["id"]) || seen.has(a["id"])) return refuse();
    seen.add(a["id"]);

    return Object.freeze({ id: a["id"], effects: effects(a["effects"]) });
  });

  seen.clear();

  const normalizedTimers = timers.map((raw: unknown) => {
    const t = snapshotPlainRecord(raw);

    if (!t || !allowed(t,["id","afterMs","repeatMs","effects"]) || !id(t["id"]) || seen.has(t["id"]) || !integer(t["afterMs"]) || t["afterMs"] < 0 ||
        (t["repeatMs"] !== undefined && (!integer(t["repeatMs"]) || t["repeatMs"] <= 0))) return refuse();
    seen.add(t["id"]);

    return Object.freeze({ id: t["id"], afterMs: t["afterMs"], effects: effects(t["effects"]), ...(t["repeatMs"] === undefined ? {} : { repeatMs: t["repeatMs"] as number }) });
  });

  return Object.freeze({ profile: record["profile"], initialState: Object.freeze(state), actions: Object.freeze(normalizedActions), timers: Object.freeze(normalizedTimers) });
}

export function initialGameplay(definition: GameplayDefinition): GameplaySnapshot {
  return Object.freeze({ state: definition.initialState, elapsedMs: 0, nextTimers: Object.freeze(definition.timers.map(t => Object.freeze({ id: t.id, atMs: t.afterMs }))) });
}

/** Candidate calculation; caller commits it together with candidate entities. */
export function advanceGameplay(definition: GameplayDefinition, current: GameplaySnapshot, actions: readonly string[], deltaMs: number, move: (actor: string, axis: readonly [number, number]) => void): GameplaySnapshot {
  const state = { ...current.state };
  const elapsedMs = current.elapsedMs + deltaMs;

  if (!Number.isSafeInteger(elapsedMs)) throw new KernelSessionError("gameplay elapsed time capacity exceeded");
  let work = 0;

  const apply = (effects: readonly GameplayEffect[]) => {
    for (const effect of effects) {
      if (++work > 4096) throw new KernelSessionError("gameplay effect capacity exceeded");

      if (effect.kind === "move") move(effect.actor, effect.axis);
      else {
        const next = effect.kind === "set-state" ? effect.value : (state[effect.key] ?? 0) + effect.value;

        if (!integer(next)) throw new KernelSessionError("gameplay state exceeds numeric range");
        state[effect.key] = next;
      }
    }
  };

  for (const action of actions) {
    const found = definition.actions.find(a => a.id === action);

    if (!found) throw new KernelSessionError("unknown gameplay action");
    apply(found.effects);
  }

  // Timer order is stable by definition order, repeat catch-up is explicitly bounded.
  const nextTimers = current.nextTimers.map((timer, index) => {
    const definitionTimer = definition.timers[index];

    if (!definitionTimer) throw new KernelSessionError("gameplay timer disappeared");
    let atMs = timer.atMs;
    let firings = 0;

    while (atMs !== null && atMs <= elapsedMs) {
      if (++firings > 4096) throw new KernelSessionError("gameplay timer capacity exceeded");
      apply(definitionTimer.effects);
      atMs = definitionTimer.repeatMs === undefined ? null : atMs + definitionTimer.repeatMs;

      if (atMs !== null && !Number.isSafeInteger(atMs)) throw new KernelSessionError("gameplay timer time exceeds safe range");
    }

    return Object.freeze({ id: timer.id, atMs });
  });

  return Object.freeze({ state: Object.freeze(state), elapsedMs, nextTimers: Object.freeze(nextTimers) });
}

/** SDK pin: numeric standard Gamepad sampling; the host owns navigator and the frame loop. */
export type GameplayGamepadSample = Readonly<{ index: number; connected: boolean; mapping: string; axes: readonly number[]; buttons: readonly Readonly<{ value: number; pressed: boolean }>[] }>;

export interface GamepadActionSampler {
  sample(pads: readonly (GameplayGamepadSample | null)[], options: Readonly<{ profile: "game" | "web" | "kids"; active: boolean; binding?: GamepadInputBinding }>): readonly import("@sceneaxi/schemas").GameplayActionCommand[];
  reset(): void;
}

/** Rising-edge primary action only. Refused samples never consume the previous admitted edge. */
export function createGamepadActionSampler(): GamepadActionSampler {
  let pressed = false;

  return Object.freeze({
    reset() { pressed = false; },
    sample(pads: Parameters<GamepadActionSampler["sample"]>[0], options: Parameters<GamepadActionSampler["sample"]>[1]) {
      if (!options || !["game", "web", "kids"].includes(options.profile) || typeof options.active !== "boolean" || !Array.isArray(pads) || pads.length > 16) throw new KernelSessionError("invalid gamepad sample");
      const defaultBinding = inputAction("play.primary")?.defaultBinding;
      const binding = options.binding ?? defaultBinding;

      if (!binding || binding.device !== "gamepad" || !validateInputActionBinding(binding)) throw new KernelSessionError("invalid gamepad binding");
      const seen = new Set<number>();

      for (const pad of pads as readonly (GameplayGamepadSample | null)[]) {
        if (pad === null) continue;

        if (!pad || !Number.isSafeInteger(pad.index) || pad.index < 0 || pad.index > 15 || seen.has(pad.index) || typeof pad.connected !== "boolean" || typeof pad.mapping !== "string" || !Array.isArray(pad.axes) || pad.axes.length > 16 || !Array.from(pad.axes).every(v => typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= 1) || !Array.isArray(pad.buttons) || pad.buttons.length > 32 || !Array.from(pad.buttons as GameplayGamepadSample["buttons"]).every(b => b && typeof b.pressed === "boolean" && Number.isFinite(b.value) && b.value >= 0 && b.value <= 1)) throw new KernelSessionError("invalid gamepad sample");
        seen.add(pad.index);
      }

      if (options.profile === "kids" || !options.active) { pressed = false;

 return Object.freeze([]); }

      const pad = pads.find(p => p?.index === binding.gamepad && p.connected && p.mapping === "standard");
      const value = pad ? binding.input === "axis" ? pad.axes[binding.control] ?? 0 : pad.buttons[binding.control]?.value ?? 0 : 0;
      const next = binding.direction === "negative" ? value < -binding.deadzone : binding.direction === "positive" ? value > binding.deadzone : Math.abs(value) > binding.deadzone;
      const commands = next && !pressed ? [Object.freeze({ type: "action" as const, actionId: "play.primary" })] : [];
      pressed = next;

      return Object.freeze(commands);
    },
  });
}
