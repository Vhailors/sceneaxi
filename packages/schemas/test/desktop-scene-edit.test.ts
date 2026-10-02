import { describe, expect, it } from "vitest";
import {
  DESKTOP_SCENE_HIERARCHY_REFUSALS,
  DESKTOP_SCENE_TRANSFORM_PROPERTY_DEFINITIONS,
  desktopSceneTransformProperty,
  isDesktopSceneEditOperation,
  isDesktopSceneEditProfile,
  resolveDesktopSceneSelection,
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
      kind: "create-object",
      sourceInstanceId: "crate-one",
      parentInstanceId: "root",
    })).toBe(true);
    expect(isDesktopSceneEditOperation({
      kind: "remove-objects",
      instanceIds: ["crate-one", "crate-two"],
    })).toBe(true);
    expect(isDesktopSceneEditOperation({
      kind: "reparent-object",
      instanceId: "crate-one",
      parentInstanceId: "crate-two",
      transformPolicy: "preserve-world",
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

  it("validates exact rename operations with bounded canonical names", () => {
    const operation = { kind: "rename-object", instanceId: "crate-one", name: "Crate (2)" };
    expect(isDesktopSceneEditOperation(operation)).toBe(true);
    for (const name of ["A", "a".repeat(64), "\u{1f600}".repeat(64)]) {
      expect(isDesktopSceneEditOperation({ ...operation, name })).toBe(true);
    }
    for (const name of ["", " ", " leading", "trailing ", "a".repeat(65), "a\nb", "a\tb", "a\u0000b", "a\u007fb", "a\u0085b", null, 12]) {
      expect(isDesktopSceneEditOperation({ ...operation, name })).toBe(false);
    }
    expect(isDesktopSceneEditOperation({ kind: "rename-object", instanceId: "crate-one" })).toBe(false);
    expect(isDesktopSceneEditOperation({ ...operation, instanceId: "Bad Id" })).toBe(false);
    expect(isDesktopSceneEditOperation({ ...operation, artifact: {} })).toBe(false);
    expect(isDesktopSceneEditProfile("kids")).toBe(false);
    expect(DESKTOP_SCENE_HIERARCHY_REFUSALS.nameInvalid).toBe("SCENE_HIERARCHY_NAME_INVALID");
    expect(DESKTOP_SCENE_HIERARCHY_REFUSALS.primitiveUnsupported).toBe("SCENE_HIERARCHY_PRIMITIVE_UNSUPPORTED");
    expect(DESKTOP_SCENE_HIERARCHY_REFUSALS.nodeUnavailable).toBe("SCENE_HIERARCHY_NODE_UNAVAILABLE");
  });

  it("accepts only the three Sculpt primitives and exact node creation payloads", () => {
    const node = { kind: "create-node", parentInstanceId: "root", name: "Sun" };
    expect(isDesktopSceneEditOperation(node)).toBe(true);
    for (const primitive of ["box", "cylinder", "sphere"]) {
      expect(isDesktopSceneEditOperation({ ...node, kind: "create-primitive", primitive })).toBe(true);
    }
    for (const primitive of ["plane", "capsule", "Box", "", null, 1]) {
      expect(isDesktopSceneEditOperation({ ...node, kind: "create-primitive", primitive })).toBe(false);
    }
    for (const operation of [node, { ...node, kind: "create-primitive", primitive: "box" }]) {
      for (const name of ["", " ", " leading", "trailing ", "a".repeat(65), "a\nb", "a\u0085b", null, 1]) {
        expect(isDesktopSceneEditOperation({ ...operation, name })).toBe(false);
      }
      expect(isDesktopSceneEditOperation({ ...operation, name: "a".repeat(64) })).toBe(true);
      expect(isDesktopSceneEditOperation({ ...operation, parentInstanceId: null })).toBe(false);
      expect(isDesktopSceneEditOperation({ ...operation, parentInstanceId: "Bad Id" })).toBe(false);
      expect(isDesktopSceneEditOperation({ ...operation, artifact: {} })).toBe(false);
      expect(isDesktopSceneEditOperation({ ...operation, instanceId: "injected-id" })).toBe(false);
      expect(isDesktopSceneEditOperation({ kind: operation.kind, parentInstanceId: "root" })).toBe(false);
    }
    expect(isDesktopSceneEditOperation({ ...node, primitive: "box" })).toBe(false);
    // Shape validation performs no I/O; all mutations retain the same profile gate.
    expect(isDesktopSceneEditProfile("kids")).toBe(false);
    expect(DESKTOP_SCENE_HIERARCHY_REFUSALS.kidsDenied).toBe("SCENE_HIERARCHY_KIDS_DENIED");
  });

  it("canonicalizes every client selection to stable hierarchy order", () => {
    expect(resolveDesktopSceneSelection(
      ["child-b", "root", "child-a"],
      ["root", "child-a", "child-b"],
    )).toEqual({
      ok: true,
      selection: {
        schemaVersion: 1,
        instanceIds: ["root", "child-a", "child-b"],
        primaryInstanceId: "root",
      },
    });
    expect(resolveDesktopSceneSelection(
      ["missing"],
      ["root"],
    )).toMatchObject({
      ok: false,
      reason: DESKTOP_SCENE_HIERARCHY_REFUSALS.selectionStale,
    });
  });
});
