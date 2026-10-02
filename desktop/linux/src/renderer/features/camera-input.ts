import { resolveInputAction, type InputActionContext, type InputActionMap } from "@sceneaxi/schemas";
import type { ViewportServices } from "./services.js";

export function attachDesktopViewportInputActions(
  canvas: HTMLCanvasElement,
  camera: Readonly<{
    dragOrbit(deltaX: number, deltaY: number): unknown;
    wheelZoom(deltaY: number): unknown;
  }>,
  map: InputActionMap,
  context: () => InputActionContext,
): () => void {
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  const pointerBinding = (button: number) => ({
    device: "pointer" as const,
    button,
    gesture: "drag" as const,
  });
  const onPointerDown = (event: PointerEvent) => {
    const resolved = resolveInputAction(map, context(), pointerBinding(event.button));
    if (!resolved.ok || resolved.action.id !== "viewport.orbit") return;
    dragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
  };
  const onPointerMove = (event: PointerEvent) => {
    if (!dragging) return;
    camera.dragOrbit(event.clientX - lastX, event.clientY - lastY);
    lastX = event.clientX;
    lastY = event.clientY;
  };
  const stopDragging = () => { dragging = false; };
  const onWheel = (event: WheelEvent) => {
    const resolved = resolveInputAction(map, context(), {
      device: "wheel",
      axis: "y",
      direction: event.deltaY < 0 ? "negative" : event.deltaY > 0 ? "positive" : "any",
    });
    if (!resolved.ok || resolved.action.id !== "viewport.zoom") return;
    camera.wheelZoom(event.deltaY);
  };
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", stopDragging);
  canvas.addEventListener("pointercancel", stopDragging);
  canvas.addEventListener("pointerleave", stopDragging);
  canvas.addEventListener("wheel", onWheel, { passive: true });
  return () => {
    canvas.removeEventListener("pointerdown", onPointerDown);
    canvas.removeEventListener("pointermove", onPointerMove);
    canvas.removeEventListener("pointerup", stopDragging);
    canvas.removeEventListener("pointercancel", stopDragging);
    canvas.removeEventListener("pointerleave", stopDragging);
    canvas.removeEventListener("wheel", onWheel);
  };
}

export function installCameraInput(services: ViewportServices): () => void {
  return attachDesktopViewportInputActions(
    services.canvas,
    services.backend.camera,
    services.inputActionMap,
    () => services.inputContext,
  );
}
