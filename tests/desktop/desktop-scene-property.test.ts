import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { parseDocumentText } from "@sceneaxi/authoring-core";
import {
  DESKTOP_ACTIVE_DOCUMENT_PATH,
  DESKTOP_SCENE_TRANSLATION_X_PROPERTY,
  inspectDesktopSceneProperties,
  seedDesktopProject,
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

describe("desktop supported Scene Document property — public seam", () => {
  it("exposes the starter entity's typed translation and stages one real composition edit", () => {
    const fixture = starter();
    const contentHash = `sha256:${"a".repeat(64)}`;
    const inspected = inspectDesktopSceneProperties({
      documentData: fixture.data,
      contentHash,
    });
    expect(inspected).toEqual({
      ok: true,
      contentHash,
      entities: [
        {
          id: DESKTOP_SCENE_TRANSLATION_X_PROPERTY.entityId,
          label: DESKTOP_SCENE_TRANSLATION_X_PROPERTY.entityLabel,
          properties: [
            {
              id: "translation-x",
              label: "Translation X",
              value: -4.4,
              step: 0.1,
            },
          ],
        },
      ],
    });

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
      entity: { properties: [{ value: -3.25 }] },
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
      propertyId: "rotation-y",
      newValue: -3.25,
    });
    expect(unsupportedProperty).toEqual({
      ok: false,
      diagnostics: [
        {
          code: "invalid-proposal",
          message: `Only ${DESKTOP_SCENE_TRANSLATION_X_PROPERTY.entityId}.${DESKTOP_SCENE_TRANSLATION_X_PROPERTY.id} is editable in this release.`,
          documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
        },
      ],
    });

    const unsupportedEntity = stageDesktopScenePropertyEdit({
      documentData: fixture.data,
      contentHash,
      entityId: "desktop-crate-stacked",
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
});
