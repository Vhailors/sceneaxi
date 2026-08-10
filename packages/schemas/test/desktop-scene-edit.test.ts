import { describe, expect, it } from "vitest";
import {
  DESKTOP_SCENE_TRANSFORM_PROPERTY_DEFINITIONS,
  desktopSceneTransformProperty,
  isDesktopSceneEditOperation,
  isDesktopSceneEditProfile,
} from "@sceneaxi/schemas";

describe("canonical desktop selected-instance operation", () => {
  it("owns all nine bounded transform components", () => {
    expect(DESKTOP_SCENE_TRANSFORM_PROPERTY_DEFINITIONS.map((row) => row.id)).toEqual([
      "translation-x", "translation-y", "translation-z",
      "rotation-x", "rotation-y", "rotation-z",
      "scale-x", "scale-y", "scale-z",
    ]);
    expect(desktopSceneTransformProperty("scale-z")).toMatchObject({
      field: "scale",
      axis: 2,
      min: 0.000001,
    });
  });

  it("accepts exact canonical operations and refuses malformed or out-of-range input", () => {
    expect(isDesktopSceneEditOperation({
      kind: "set-transform-component",
      instanceId: "crate-one",
      propertyId: "rotation-y",
      value: 45,
    })).toBe(true);
    expect(isDesktopSceneEditOperation({
      kind: "add-instance",
      sourceInstanceId: "crate-one",
    })).toBe(true);
    expect(isDesktopSceneEditOperation({
      kind: "remove-instance",
      instanceId: "crate-one",
    })).toBe(true);
    expect(isDesktopSceneEditOperation({
      kind: "set-transform-component",
      instanceId: "crate-one",
      propertyId: "scale-y",
      value: 0,
    })).toBe(false);
    expect(isDesktopSceneEditOperation({
      kind: "remove-instance",
      instanceId: "crate-one",
      artifact: {},
    })).toBe(false);
    expect(isDesktopSceneEditProfile("game")).toBe(true);
    expect(isDesktopSceneEditProfile("web")).toBe(true);
    expect(isDesktopSceneEditProfile("kids")).toBe(false);
  });
});
