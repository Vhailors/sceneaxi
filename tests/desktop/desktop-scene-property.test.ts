import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  composeScene,
  parseDocumentText,
  reconstructSculpt,
} from "@sceneaxi/authoring-core";
import {
  DESKTOP_SCENE_HIERARCHY_REFUSALS,
  SCENE_COMPOSITION_INTAKE_KIND,
  SCENE_COMPOSITION_SCHEMA_VERSION,
  SCENE_MAXIMUM_INSTANCES,
  composedSceneFromDocumentData,
} from "@sceneaxi/schemas";
import {
  DESKTOP_ACTIVE_DOCUMENT_PATH,
  DESKTOP_SCENE_TRANSLATION_X_PROPERTY,
  inspectDesktopSceneProperties,
  seedDesktopProject,
  stageDesktopSceneEdit,
  stageDesktopScenePropertyEdit,
} from "../../desktop/linux/src/index.ts";

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function starter() {
  const dir = mkdtempSync(join(tmpdir(), "sceneaxi-desktop-property-"));
  dirs.push(dir);
  expect(seedDesktopProject(dir)).toEqual({ ok: true, migrated: false });
  const bytes = readFileSync(join(dir, DESKTOP_ACTIVE_DOCUMENT_PATH), "utf8");
  const parsed = parseDocumentText(bytes);
  if (!parsed.ok) throw new Error(parsed.message);
  return { dir, bytes, data: parsed.document.data };
}

describe("desktop selected composed-instance edit — public seam", () => {
  it("exposes every instance and all nine bounded transform components", () => {
    const fixture = starter();
    const contentHash = `sha256:${"a".repeat(64)}`;
    const inspected = inspectDesktopSceneProperties({
      documentData: fixture.data,
      contentHash,
    });
    expect(inspected).toMatchObject({ ok: true, contentHash });
    if (!inspected.ok) return;
    expect(inspected.entities.map((entity) => entity.id)).toEqual([
      "desktop-crate-root",
      "desktop-crate-beside",
      "desktop-crate-stacked",
    ]);
    const beside = inspected.entities.find(
      (entity) => entity.id === DESKTOP_SCENE_TRANSLATION_X_PROPERTY.entityId,
    );
    expect(beside).toMatchObject({
      artifactId: "starter-service-crate-artifact",
      parentInstanceId: "desktop-crate-root",
      canRemove: true,
    });
    expect(beside?.properties.map((property) => property.id)).toEqual([
      "translation-x", "translation-y", "translation-z",
      "rotation-x", "rotation-y", "rotation-z",
      "scale-x", "scale-y", "scale-z",
    ]);
    expect(beside?.properties[0]).toMatchObject({ value: -4.4, step: 0.1 });
    expect(beside?.properties[6]).toMatchObject({ value: 1, min: 0.000001 });
  });

  it("stages translation, rotation, and scale as real composition edits without writing", () => {
    const fixture = starter();
    const contentHash = `sha256:${"a".repeat(64)}`;
    const operations = [
      { propertyId: "translation-z", value: 2.5 },
      { propertyId: "rotation-y", value: 45 },
      { propertyId: "scale-x", value: 1.25 },
    ] as const;
    for (const operation of operations) {
      const staged = stageDesktopSceneEdit({
        documentData: fixture.data,
        contentHash,
        profile: "game",
        operation: {
          kind: "set-transform-component",
          instanceId: DESKTOP_SCENE_TRANSLATION_X_PROPERTY.entityId,
          ...operation,
        },
      });
      expect(staged).toMatchObject({
        ok: true,
        operation: { kind: "set-transform-component", ...operation },
        edit: {
          documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
          jsonPointer: "/data/composedScene",
          expectedContentHash: contentHash,
        },
      });
    }

    const staged = stageDesktopScenePropertyEdit({
      documentData: fixture.data,
      contentHash,
      entityId: DESKTOP_SCENE_TRANSLATION_X_PROPERTY.entityId,
      propertyId: DESKTOP_SCENE_TRANSLATION_X_PROPERTY.id,
      newValue: -3.25,
    });
    expect(staged).toMatchObject({
      ok: true,
      edit: {
        documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
        jsonPointer: "/data/composedScene",
        expectedContentHash: contentHash,
      },
    });
    if (staged.ok) {
      expect(staged.entity.properties.find((property) => property.id === "translation-x"))
        .toMatchObject({ value: -3.25 });
    }
    expect(readFileSync(join(fixture.dir, DESKTOP_ACTIVE_DOCUMENT_PATH), "utf8")).toBe(
      fixture.bytes,
    );
  });

  it("adds and removes only validated local artifact instances", () => {
    const fixture = starter();
    const contentHash = `sha256:${"d".repeat(64)}`;
    const added = stageDesktopSceneEdit({
      documentData: fixture.data,
      contentHash,
      profile: "game",
      operation: {
        kind: "add-instance",
        sourceInstanceId: DESKTOP_SCENE_TRANSLATION_X_PROPERTY.entityId,
      },
    });
    expect(added).toMatchObject({
      ok: true,
      selectedInstanceId: "desktop-crate-beside-copy-1",
      inspection: { entities: [{}, {}, {}, { artifactId: "starter-service-crate-artifact" }] },
    });
    if (!added.ok) return;
    const addedScene = added.edit.newValue as {
      instances: Array<{ instanceId: string; artifact: unknown }>;
    };
    const sourceArtifact = addedScene.instances.find(
      (instance) => instance.instanceId === DESKTOP_SCENE_TRANSLATION_X_PROPERTY.entityId,
    )?.artifact;
    const copiedArtifact = addedScene.instances.find(
      (instance) => instance.instanceId === added.selectedInstanceId,
    )?.artifact;
    expect(copiedArtifact).toEqual(sourceArtifact);

    const removed = stageDesktopSceneEdit({
      documentData: { ...(fixture.data as object), composedScene: added.edit.newValue },
      contentHash,
      profile: "web",
      operation: { kind: "remove-instance", instanceId: added.selectedInstanceId },
    });
    expect(removed).toMatchObject({
      ok: true,
      selectedInstanceId: "desktop-crate-root",
      inspection: { entities: [{}, {}, {}] },
    });
  });

  it("refuses object creation at the composition instance budget by name", () => {
    const fixture = starter();
    const stored = composedSceneFromDocumentData(fixture.data);
    if (!stored.ok) throw new Error(stored.diagnostics[0]?.message);
    const first = stored.value.instances[0];
    if (first === undefined) throw new Error("starter instance is missing");
    const rootInstanceId = "budget-instance-0";
    const composed = composeScene(
      {
        schemaVersion: SCENE_COMPOSITION_SCHEMA_VERSION,
        kind: SCENE_COMPOSITION_INTAKE_KIND,
        sceneId: "desktop-budget-scene",
        rootInstanceId,
        placements: Array.from({ length: SCENE_MAXIMUM_INSTANCES }, (_unused, index) => ({
          instanceId: `budget-instance-${String(index)}`,
          artifactId: first.artifact.artifactId,
          parentInstanceId: index === 0 ? null : rootInstanceId,
          transform: first.localTransform,
        })),
      },
      [first.artifact],
    );
    if (!composed.ok) throw new Error(composed.message);

    expect(stageDesktopSceneEdit({
      documentData: composed.document.data,
      contentHash: `sha256:${"2".repeat(64)}`,
      profile: "game",
      operation: {
        kind: "create-object",
        sourceInstanceId: "budget-instance-1",
        parentInstanceId: rootInstanceId,
      },
    })).toMatchObject({
      ok: false,
      reason: DESKTOP_SCENE_HIERARCHY_REFUSALS.inputUnsupported,
    });
    expect(readFileSync(join(fixture.dir, DESKTOP_ACTIVE_DOCUMENT_PATH), "utf8"))
      .toBe(fixture.bytes);
  });

  it("reparents with explicit preserve-world or preserve-local deterministic transforms", () => {
    const fixture = starter();
    const contentHash = `sha256:${"7".repeat(64)}`;
    const reparent = (transformPolicy: "preserve-world" | "preserve-local") =>
      stageDesktopSceneEdit({
        documentData: fixture.data,
        contentHash,
        profile: "game",
        operation: {
          kind: "reparent-object",
          instanceId: "desktop-crate-beside",
          parentInstanceId: "desktop-crate-stacked",
          transformPolicy,
        },
      });

    const world = reparent("preserve-world");
    expect(world).toMatchObject({
      ok: true,
      operation: { transformPolicy: "preserve-world" },
      selectedInstanceIds: ["desktop-crate-beside"],
      inspection: {
        hierarchy: {
          schemaVersion: 1,
          kind: "sceneaxi.desktop-scene-hierarchy",
          objects: expect.arrayContaining([
            expect.objectContaining({
              id: "desktop-crate-beside",
              parentId: "desktop-crate-stacked",
              localTransform: expect.objectContaining({ translation: [-4.4, -2.3, 0] }),
              worldTransform: expect.objectContaining({ translation: [-4.4, 0, 0] }),
            }),
          ]),
        },
      },
    });
    const local = reparent("preserve-local");
    expect(local).toMatchObject({
      ok: true,
      inspection: {
        hierarchy: {
          objects: expect.arrayContaining([
            expect.objectContaining({
              id: "desktop-crate-beside",
              parentId: "desktop-crate-stacked",
              localTransform: expect.objectContaining({ translation: [-4.4, 0, 0] }),
              worldTransform: expect.objectContaining({ translation: [-4.4, 2.3, 0] }),
            }),
          ]),
        },
      },
    });
    expect(world.ok && local.ok && JSON.stringify(world.edit.newValue))
      .not.toBe(local.ok && JSON.stringify(local.edit.newValue));
    expect(readFileSync(join(fixture.dir, DESKTOP_ACTIVE_DOCUMENT_PATH), "utf8"))
      .toBe(fixture.bytes);
  });

  it("refuses preserve-world when no canonical local transform round-trips exactly", () => {
    const fixture = starter();
    const stored = composedSceneFromDocumentData(fixture.data);
    if (!stored.ok) throw new Error(stored.diagnostics[0]?.message);
    const artifacts = [...new Map(
      stored.value.instances.map((instance) => [instance.artifactId, instance.artifact]),
    ).values()];
    const composed = composeScene({
      schemaVersion: SCENE_COMPOSITION_SCHEMA_VERSION,
      kind: SCENE_COMPOSITION_INTAKE_KIND,
      sceneId: stored.value.sceneId,
      rootInstanceId: stored.value.rootInstanceId,
      placements: stored.value.instances.map((instance) => ({
        instanceId: instance.instanceId,
        artifactId: instance.artifactId,
        parentInstanceId: instance.parentInstanceId,
        transform: instance.instanceId === "desktop-crate-beside"
          ? { ...instance.localTransform, translation: [1, 0, 0] }
          : instance.instanceId === "desktop-crate-stacked"
            ? { ...instance.localTransform, translation: [0, 0, 0], scale: [3, 1, 1] }
            : instance.localTransform,
      })),
    }, artifacts);
    if (!composed.ok) throw new Error(composed.message);

    expect(stageDesktopSceneEdit({
      documentData: composed.document.data,
      contentHash: `sha256:${"9".repeat(64)}`,
      profile: "game",
      operation: {
        kind: "reparent-object",
        instanceId: "desktop-crate-beside",
        parentInstanceId: "desktop-crate-stacked",
        transformPolicy: "preserve-world",
      },
    })).toMatchObject({
      ok: false,
      reason: DESKTOP_SCENE_HIERARCHY_REFUSALS.inputUnsupported,
    });
  });

  it("refuses hierarchy cycles, missing parents, protected roots, stale selections, and invalid policy by name", () => {
    const fixture = starter();
    const contentHash = `sha256:${"8".repeat(64)}`;
    const request = (operation: unknown, data: unknown = fixture.data) =>
      stageDesktopSceneEdit({ documentData: data, contentHash, profile: "game", operation });

    expect(request({
      kind: "reparent-object",
      instanceId: "desktop-crate-root",
      parentInstanceId: "desktop-crate-beside",
      transformPolicy: "preserve-local",
    })).toMatchObject({ ok: false, reason: DESKTOP_SCENE_HIERARCHY_REFUSALS.protectedRoot });
    expect(request({
      kind: "reparent-object",
      instanceId: "desktop-crate-beside",
      parentInstanceId: "missing-parent",
      transformPolicy: "preserve-local",
    })).toMatchObject({ ok: false, reason: DESKTOP_SCENE_HIERARCHY_REFUSALS.parentMissing });
    expect(request({
      kind: "reparent-object",
      instanceId: "missing-child",
      parentInstanceId: "desktop-crate-root",
      transformPolicy: "preserve-local",
    })).toMatchObject({ ok: false, reason: DESKTOP_SCENE_HIERARCHY_REFUSALS.selectionStale });
    expect(request({
      kind: "reparent-object",
      instanceId: "desktop-crate-beside",
      parentInstanceId: "desktop-crate-root",
      transformPolicy: "implicit",
    })).toMatchObject({ ok: false, reason: DESKTOP_SCENE_HIERARCHY_REFUSALS.policyInvalid });

    const first = request({
      kind: "reparent-object",
      instanceId: "desktop-crate-stacked",
      parentInstanceId: "desktop-crate-beside",
      transformPolicy: "preserve-local",
    });
    if (!first.ok) throw new Error(first.diagnostics[0]?.message);
    expect(request({
      kind: "reparent-object",
      instanceId: "desktop-crate-beside",
      parentInstanceId: "desktop-crate-stacked",
      transformPolicy: "preserve-local",
    }, { ...(fixture.data as object), composedScene: first.edit.newValue })).toMatchObject({
      ok: false,
      reason: DESKTOP_SCENE_HIERARCHY_REFUSALS.cycle,
    });
  });

  it("removes a leaf whose artifact has no remaining instance", () => {
    const fixture = starter();
    const stored = composedSceneFromDocumentData(fixture.data);
    if (!stored.ok) throw new Error(stored.diagnostics[0]?.message);
    const alternateInput = JSON.parse(
      readFileSync(
        join(
          process.cwd(),
          "tests/e2e/fixtures/sculpt-quality/richer-field-drone.intake.json",
        ),
        "utf8",
      ),
    ) as unknown;
    const alternate = reconstructSculpt(alternateInput, { seed: 8002 });
    if (!alternate.ok) throw new Error(alternate.message);
    const removableInstanceId = DESKTOP_SCENE_TRANSLATION_X_PROPERTY.entityId;
    const originalArtifact = stored.value.instances.find(
      (instance) => instance.artifactId !== alternate.artifact.artifactId,
    )?.artifact;
    if (originalArtifact === undefined) throw new Error("Starter artifact is missing.");
    const composed = composeScene(
      {
        schemaVersion: SCENE_COMPOSITION_SCHEMA_VERSION,
        kind: SCENE_COMPOSITION_INTAKE_KIND,
        sceneId: stored.value.sceneId,
        rootInstanceId: stored.value.rootInstanceId,
        placements: stored.value.instances.map((instance) => ({
          instanceId: instance.instanceId,
          artifactId:
            instance.instanceId === removableInstanceId
              ? alternate.artifact.artifactId
              : instance.artifactId,
          parentInstanceId: instance.parentInstanceId,
          transform: instance.localTransform,
        })),
      },
      [originalArtifact, alternate.artifact],
    );
    if (!composed.ok) throw new Error(composed.message);

    const inspected = inspectDesktopSceneProperties({
      documentData: composed.document.data,
      contentHash: `sha256:${"f".repeat(64)}`,
    });
    expect(inspected.ok).toBe(true);
    if (!inspected.ok) return;
    expect(inspected.entities).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: removableInstanceId,
        artifactId: alternate.artifact.artifactId,
        canRemove: true,
      }),
    ]));

    const removed = stageDesktopSceneEdit({
      documentData: composed.document.data,
      contentHash: `sha256:${"f".repeat(64)}`,
      profile: "game",
      operation: { kind: "remove-instance", instanceId: removableInstanceId },
    });
    expect(removed).toMatchObject({
      ok: true,
      selectedInstanceId: "desktop-crate-root",
      inspection: {
        entities: [
          { id: "desktop-crate-root", artifactId: originalArtifact.artifactId },
          { id: "desktop-crate-stacked", artifactId: originalArtifact.artifactId },
        ],
      },
    });
    expect(readFileSync(join(fixture.dir, DESKTOP_ACTIVE_DOCUMENT_PATH), "utf8")).toBe(
      fixture.bytes,
    );
  });

  it("returns the scene validator's exact diagnostic for a non-numeric translation", () => {
    const fixture = starter();
    const result = stageDesktopScenePropertyEdit({
      documentData: fixture.data,
      contentHash: `sha256:${"b".repeat(64)}`,
      entityId: DESKTOP_SCENE_TRANSLATION_X_PROPERTY.entityId,
      propertyId: DESKTOP_SCENE_TRANSLATION_X_PROPERTY.id,
      newValue: "left",
    });
    expect(result).toEqual({
      ok: false,
      diagnostics: [
        {
          code: "validation-failed",
          message: "$.placements[1].transform: Placement transform is invalid.",
          documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
        },
      ],
    });
    expect(readFileSync(join(fixture.dir, DESKTOP_ACTIVE_DOCUMENT_PATH), "utf8")).toBe(
      fixture.bytes,
    );
  });

  it("separates a request fault from a rejected value by diagnostic code", () => {
    const fixture = starter();
    const contentHash = `sha256:${"c".repeat(64)}`;
    const rejectedValue = stageDesktopScenePropertyEdit({
      documentData: fixture.data,
      contentHash,
      entityId: DESKTOP_SCENE_TRANSLATION_X_PROPERTY.entityId,
      propertyId: DESKTOP_SCENE_TRANSLATION_X_PROPERTY.id,
      newValue: Number.NaN,
    });
    expect(rejectedValue).toMatchObject({
      ok: false,
      diagnostics: [{ code: "validation-failed" }],
    });

    const unsupportedProperty = stageDesktopScenePropertyEdit({
      documentData: fixture.data,
      contentHash,
      entityId: DESKTOP_SCENE_TRANSLATION_X_PROPERTY.entityId,
      propertyId: "opacity",
      newValue: -3.25,
    });
    expect(unsupportedProperty).toEqual({
      ok: false,
      diagnostics: [
        {
          code: "invalid-proposal",
          message: "The selected-instance edit operation is malformed or outside its numeric range.",
          documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
        },
      ],
    });

    const unsupportedEntity = stageDesktopScenePropertyEdit({
      documentData: fixture.data,
      contentHash,
      entityId: "missing-instance",
      propertyId: DESKTOP_SCENE_TRANSLATION_X_PROPERTY.id,
      newValue: -3.25,
    });
    expect(unsupportedEntity).toMatchObject({
      ok: false,
      diagnostics: [{ code: "invalid-proposal" }],
    });

    const malformedHash = inspectDesktopSceneProperties({
      documentData: fixture.data,
      contentHash: "not-a-content-hash",
    });
    expect(malformedHash).toEqual({
      ok: false,
      diagnostics: [
        {
          code: "invalid-proposal",
          message: "The open Scene Document is missing its validated content hash.",
          documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
        },
      ],
    });

    expect(readFileSync(join(fixture.dir, DESKTOP_ACTIVE_DOCUMENT_PATH), "utf8")).toBe(
      fixture.bytes,
    );
  });

  it("refuses stale selection, missing local assets, malformed ranges, root removal, and Kids", () => {
    const fixture = starter();
    const contentHash = `sha256:${"e".repeat(64)}`;
    const request = (profile: unknown, operation: unknown) =>
      stageDesktopSceneEdit({ documentData: fixture.data, contentHash, profile, operation });

    expect(request("game", {
      kind: "set-transform-component",
      instanceId: "missing-instance",
      propertyId: "translation-x",
      value: 1,
    })).toMatchObject({ ok: false, diagnostics: [{ code: "invalid-proposal", message: expect.stringContaining("stale") }] });
    expect(request("game", { kind: "add-instance", sourceInstanceId: "missing-instance" }))
      .toMatchObject({ ok: false, diagnostics: [{ code: "invalid-proposal", message: expect.stringContaining("missing") }] });
    expect(request("game", { kind: "remove-instance", instanceId: "desktop-crate-root" }))
      .toMatchObject({ ok: false, diagnostics: [{ code: "invalid-proposal" }] });
    expect(request("game", {
      kind: "set-transform-component",
      instanceId: DESKTOP_SCENE_TRANSLATION_X_PROPERTY.entityId,
      propertyId: "scale-y",
      value: 0,
    })).toMatchObject({ ok: false, diagnostics: [{ code: "invalid-proposal", message: expect.stringContaining("range") }] });
    expect(request("kids", {
      kind: "remove-instance",
      instanceId: DESKTOP_SCENE_TRANSLATION_X_PROPERTY.entityId,
    })).toMatchObject({ ok: false, diagnostics: [{ code: "invalid-proposal", message: expect.stringContaining("Game and Web") }] });
  });
});
