import {
  PresentationRuntimeError,
  createNullPresentationRuntime,
} from "@sceneaxi/engine-presentation";
import { open, type ProductManifest } from "@sceneaxi/engine-kernel";
import { describe, expect, it } from "vitest";

const manifest: ProductManifest = {
  productId: "null-presentation-test",
  seed: 52,
  entities: [{ id: "hero", x: 1, y: 2 }],
};

function openSession() {
  return open(manifest, { nowMs: () => 1_753_420_800_000 });
}

describe("null presentation runtime", () => {
  it("mounts and disposes around a kernel session path", () => {
    const runtime = createNullPresentationRuntime();

    expect(() => runtime.mount()).not.toThrow();
    expect(() => runtime.dispose()).not.toThrow();
  });

  it("presents a no-op frame without mutating authoritative state", () => {
    const session = openSession();
    const before = session.observe();
    const runtime = createNullPresentationRuntime();

    runtime.mount();
    runtime.present(before, [], 0);

    expect(session.observe()).toEqual(before);
    expect(runtime.capture()).toBeNull();
    runtime.dispose();
  });

  it("refuses lifecycle operations while detached or already mounted", () => {
    const runtime = createNullPresentationRuntime();
    const snapshot = openSession().observe();

    expect(() => runtime.present(snapshot, [], 0)).toThrow(
      new PresentationRuntimeError("presentation runtime is not mounted"),
    );
    expect(() => runtime.capture()).toThrow(
      new PresentationRuntimeError("presentation runtime is not mounted"),
    );
    expect(() => runtime.dispose()).toThrow(
      new PresentationRuntimeError("presentation runtime is not mounted"),
    );

    runtime.mount();
    expect(() => runtime.mount()).toThrow(
      new PresentationRuntimeError("presentation runtime is already mounted"),
    );
    runtime.dispose();
    expect(() => runtime.present(snapshot, [], 0)).toThrow(
      new PresentationRuntimeError("presentation runtime is not mounted"),
    );
  });
});
