import type { ViewportServices } from "./services.js";

/** L35 owns gizmo wiring; the behavior-preserving split attaches nothing. */
export function installGizmo(services: ViewportServices): void {
  void services;
}
