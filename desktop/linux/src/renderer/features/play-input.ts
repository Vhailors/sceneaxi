import type { InputActionContext, InputActionMap } from "@sceneaxi/schemas";
import type { ViewportServices } from "./services.js";

export function dispatchDesktopPlayInput(
  target: EventTarget,
  actionId: string,
  pressed: boolean,
  value: number,
): void {
  target.dispatchEvent(new CustomEvent("sceneaxi:play-input", {
    detail: { actionId, pressed, value },
  }));
}

export function createDesktopGamepadInputPoller(input: {
  readonly map: InputActionMap;
  readonly getGamepads: () => readonly (Readonly<{
    connected: boolean;
    axes: readonly number[];
    buttons: readonly Pick<GamepadButton, "value">[];
  }> | null)[];
  readonly onAction: (actionId: string, pressed: boolean, value: number) => void;
}) {
  const active = new Map<string, number>();
  return (context: InputActionContext): void => {
    if (context !== "play") {
      for (const actionId of active.keys()) input.onAction(actionId, false, 0);
      active.clear();
      return;
    }
    const seen = new Set<string>();
    const gamepads = input.getGamepads();
    for (const row of input.map.bindings) {
      const binding = row.binding;
      if (binding.device !== "gamepad") continue;
      const gamepad = gamepads[binding.gamepad];
      const raw = gamepad?.connected
        ? binding.input === "axis"
          ? gamepad.axes[binding.control] ?? 0
          : gamepad.buttons[binding.control]?.value ?? 0
        : 0;
      const value = Math.abs(raw) < binding.deadzone ? 0 : raw;
      const direction = value < 0 ? "negative" : value > 0 ? "positive" : "any";
      const matches = binding.direction === "any" ? value !== 0 : binding.direction === direction;
      const pressed = matches && (binding.input === "button" || Math.abs(value) >= binding.deadzone);
      const key = row.actionId;
      seen.add(key);
      const previous = active.get(key) ?? 0;
      const current = pressed ? value : 0;
      if (current !== previous) {
        input.onAction(row.actionId, pressed, current);
        if (pressed) active.set(key, current);
        else active.delete(key);
      }
    }
    for (const [actionId, value] of active) {
      if (seen.has(actionId)) continue;
      input.onAction(actionId, false, value);
      active.delete(actionId);
    }
  };
}

export function installPlayInput(services: ViewportServices): void {
  const pollGamepadInput = createDesktopGamepadInputPoller({
    map: services.inputActionMap,
    getGamepads: () => navigator.getGamepads(),
    onAction: (actionId, pressed, value) =>
      dispatchDesktopPlayInput(services.canvas, actionId, pressed, value),
  });
  services.onFrame(() => pollGamepadInput(services.inputContext));
}
