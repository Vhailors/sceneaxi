import { describe, expect, it } from "vitest";
import {
  DESKTOP_SCENE_TRANSFORM_REFUSALS,
  resolveDesktopSceneTransform,
  type DesktopSceneTransformInstance,
  type DesktopSceneTransformRequest,
} from "@sceneaxi/schemas";

function instance(
  id: string,
  translation: readonly [number, number, number],
  world = translation,
): DesktopSceneTransformInstance {
  return Object.freeze({
    instanceId: id,
    local: Object.freeze({
      translation,
      rotationEulerDegrees: Object.freeze([0, 0, 0] as const),
      scale: Object.freeze([1, 1, 1] as const),
    }),
    world: Object.freeze({ translation: world }),
  });
}

function request(
  patch: Partial<DesktopSceneTransformRequest> &
    Pick<DesktopSceneTransformRequest, "instanceIds" | "instances">,
): DesktopSceneTransformRequest {
  return Object.freeze({
    mode: "translate",
    space: "local",
    pivot: "individual",
    axes: "x",
    snapIncrement: null,
    valueKind: "absolute",
    values: Object.freeze([2, 0, 0] as const),
    ...patch,
  });
}

describe("desktop scene transform resolver", () => {
  it("turns numeric entry and an identical gizmo delta into the same local component", () => {
    const subject = instance("crate", [1, 0, 0]);
    const numeric = resolveDesktopSceneTransform(request({
      instanceIds: ["crate"],
      instances: [subject],
      valueKind: "absolute",
      values: [4, 0, 0],
    }));
    const gizmo = resolveDesktopSceneTransform(request({
      instanceIds: ["crate"],
      instances: [subject],
      valueKind: "delta",
      values: [3, 0, 0],
    }));
    expect(numeric).toEqual(gizmo);
    expect(numeric).toMatchObject({
      ok: true,
      affectedIds: ["crate"],
      components: [{ instanceId: "crate", propertyId: "translation-x", value: 4 }],
    });
  });

  it("applies multi-selection in the given order and reports every stable id", () => {
    const resolved = resolveDesktopSceneTransform(request({
      instanceIds: ["b", "a"],
      instances: [instance("a", [0, 0, 0]), instance("b", [1, 0, 0])],
      valueKind: "delta",
      values: [0.5, 0, 0],
    }));
    expect(resolved).toMatchObject({
      ok: true,
      affectedIds: ["b", "a"],
    });
    if (!resolved.ok) return;
    expect(resolved.components.map((component) => component.instanceId)).toEqual(["b", "a"]);
  });

  it("snaps local numeric values and refuses a non-positive increment", () => {
    const snapped = resolveDesktopSceneTransform(request({
      instanceIds: ["crate"],
      instances: [instance("crate", [0.2, 0, 0])],
      snapIncrement: 0.5,
      valueKind: "absolute",
      values: [1.24, 0, 0],
    }));
    expect(snapped).toMatchObject({
      ok: true,
      components: [{ propertyId: "translation-x", value: 1 }],
    });
    expect(resolveDesktopSceneTransform(request({
      instanceIds: ["crate"],
      instances: [instance("crate", [0, 0, 0])],
      snapIncrement: 0,
    }))).toMatchObject({
      ok: false,
      reason: DESKTOP_SCENE_TRANSFORM_REFUSALS.snapInvalid,
    });
  });

  it("names invalid world rotate, origin-scale, empty selection, and axis-incompatible input", () => {
    const crate = instance("crate", [1, 0, 0]);
    expect(resolveDesktopSceneTransform(request({
      instanceIds: ["crate"],
      instances: [crate],
      mode: "rotate",
      space: "world",
    }))).toMatchObject({
      ok: false,
      reason: DESKTOP_SCENE_TRANSFORM_REFUSALS.spaceInvalid,
    });
    expect(resolveDesktopSceneTransform(request({
      instanceIds: ["crate"],
      instances: [crate],
      mode: "scale",
      pivot: "origin",
    }))).toMatchObject({
      ok: false,
      reason: DESKTOP_SCENE_TRANSFORM_REFUSALS.pivotInvalid,
    });
    expect(resolveDesktopSceneTransform(request({
      instanceIds: ["missing"],
      instances: [crate],
    }))).toMatchObject({
      ok: false,
      reason: DESKTOP_SCENE_TRANSFORM_REFUSALS.selectionEmpty,
    });
  });

  it("keeps world translation preview as local components without mutating the input records", () => {
    const subject = instance("crate", [1, 2, 3], [4, 5, 6]);
    const before = JSON.stringify(subject);
    const resolved = resolveDesktopSceneTransform(request({
      instanceIds: ["crate"],
      instances: [subject],
      space: "world",
      valueKind: "delta",
      values: [2, 0, 0],
    }));
    expect(JSON.stringify(subject)).toBe(before);
    expect(resolved).toMatchObject({
      ok: true,
      components: [{ instanceId: "crate", propertyId: "translation-x", value: 3 }],
    });
  });
});
