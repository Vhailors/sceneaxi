import { describe, expect, it } from "vitest";
import { DESKTOP_SCENE_TRANSFORM_PROPERTY_DEFINITIONS } from "@sceneaxi/schemas";
import {
  mountInventory as mount,
  inventoryElement as element,
  settleInventory as settle,
} from "../helpers/desktop-chrome-golden.js";

describe("desktop mounted control inventory — tree", () => {
  it("renders project-backed instance, object, and parent identities", async () => {
    const properties = DESKTOP_SCENE_TRANSFORM_PROPERTY_DEFINITIONS.map((definition) => ({
      id: definition.id,
      value: definition.id.startsWith("scale-") ? 1 : 0,
    }));
    const snapshot = {
      phase: "idle",
      unifiedDiff: null,
      renderedDiff: null,
      proposal: null,
      appliedPaths: null,
      journalRecoveryPending: false,
      transactionId: null,
      diagnostics: null,
    };
    const status = {
      ok: true,
      documentId: "scene",
      data: {},
      contentHash: `sha256:${"3".repeat(64)}`,
      authoringSnapshot: snapshot,
    };
    const inspection = {
      ok: true,
      selection: { instanceIds: ["child-instance"], primaryInstanceId: "child-instance" },
      entities: [
        {
          id: "root-instance",
          label: "Root",
          artifactId: "root-object",
          parentInstanceId: null,
          depth: 0,
          properties,
        },
        {
          id: "child-instance",
          label: "Child",
          artifactId: "child-object",
          parentInstanceId: "root-instance",
          depth: 1,
          properties,
        },
      ],
    };
    const window = mount(undefined, {
      project: async () => ({
        ok: true,
        data: {
          status: {
            active: { name: "Hierarchy", root: "/project", documentPath: "scene.json" },
            recents: [],
          },
        },
      }),
      request: async (request) => (request as { action?: string }).action === "command"
        ? { ok: true, data: inspection }
        : { ok: true, data: status },
    });
    await settle();

    const select = element(window, '[data-action="scene-entity-select"]') as unknown as {
      options: ArrayLike<{ textContent: string | null }>;
    };
    expect(Array.from(select.options, (option) => option.textContent)).toEqual([
      "Object root-object · instance root-instance · root",
      "  Object child-object · instance child-instance · parent root-instance",
    ]);
  });
});
