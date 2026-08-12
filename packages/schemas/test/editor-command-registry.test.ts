import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  DESKTOP_SCENE_HIERARCHY_REFUSALS,
  EDITOR_COMMAND_REFUSALS,
  EDITOR_COMMAND_REGISTRY,
  contracts,
  defineEditorCommandRegistry,
  editorCommand,
  editorCommandTerminalResult,
  validateEditorCommandInvocation,
  type EditorCommandDefinition,
} from "@sceneaxi/schemas";

describe("full-editor command registry", () => {
  it("owns one typed versioned definition for every first-slice operation", () => {
    const schema = JSON.parse(readFileSync(
      new URL(`../${contracts.editorCommandRegistry}`, import.meta.url),
      "utf8",
    )) as { $id: string; type: string };
    expect(schema.$id).toBe(
      "https://sceneaxi.invalid/contracts/editor-command-registry/v1",
    );
    expect(schema.type).toBe("array");
    expect(EDITOR_COMMAND_REGISTRY.map((command) => command.id)).toEqual([
      "project-new",
      "project-inspect",
      "project-migration-propose",
      "project-migration-commit",
      "project-migration-recover",
      "ship-export-web",
      "project-open",
      "project-save",
      "edit-undo",
      "edit-redo",
      "scene-hierarchy-inspect",
      "scene-selection-set",
      "scene-property-set",
      "scene-object-create",
      "scene-object-remove",
      "scene-object-reparent",
      "run-play",
      "change-review-accept",
      "change-review-reject",
      "assistant-local-build",
      "assistant-byo-build",
      "assistant-local-agent",
      "assistant-status",
      "assistant-cancel",
    ]);
    for (const command of EDITOR_COMMAND_REGISTRY) {
      expect(command).toMatchObject({
        schemaVersion: 1,
        capability: { profiles: ["game", "web"] },
        progress: { minimum: 0, maximum: 100 },
      });
      expect(["edit-undo", "edit-redo", null]).toContain(command.undo.commandId);
      expect(command.acceptedClients.length).toBeGreaterThan(0);
      expect(command.refusals.length).toBeGreaterThan(0);
      expect(command.evidence.kind).toBeTruthy();
    }
  });

  it("registers hierarchy inputs once for desktop, CLI, and assistant clients", () => {
    const hierarchyBaseRefusals = [
      EDITOR_COMMAND_REFUSALS.clientDenied,
      EDITOR_COMMAND_REFUSALS.schemaUnsupported,
      DESKTOP_SCENE_HIERARCHY_REFUSALS.inputUnsupported,
      EDITOR_COMMAND_REFUSALS.permissionDenied,
      DESKTOP_SCENE_HIERARCHY_REFUSALS.capabilityMissing,
      DESKTOP_SCENE_HIERARCHY_REFUSALS.kidsDenied,
    ];
    for (const id of [
      "scene-hierarchy-inspect",
      "scene-selection-set",
      "scene-object-create",
      "scene-object-remove",
      "scene-object-reparent",
    ] as const) {
      const command = editorCommand(id);
      expect(command).toMatchObject({
        acceptedClients: ["desktop-control", "cli", "local-agent"],
        capability: { id: "scene.compose" },
        evidence: { kind: "scene-hierarchy" },
      });
      expect(command?.refusals).toEqual(expect.arrayContaining(hierarchyBaseRefusals));
      expect(command?.refusals).not.toContain(EDITOR_COMMAND_REFUSALS.inputInvalid);
      expect(command?.refusals).not.toContain(EDITOR_COMMAND_REFUSALS.capabilityDenied);
      expect(command?.refusals).not.toContain(EDITOR_COMMAND_REFUSALS.kidsDenied);
      expect(new Set(command?.refusals).size).toBe(command?.refusals.length);
    }
    expect(editorCommand("scene-property-set")).toMatchObject({
      acceptedClients: ["desktop-control", "cli", "local-agent"],
      capability: { id: "scene.compose" },
      mutation: "stages-change",
      undo: { kind: "none", commandId: null },
    });
    expect(validateEditorCommandInvocation({
      schemaVersion: 1,
      commandId: "scene-property-set",
      client: "desktop-control",
      permission: "project:write",
      profile: "game",
      input: {
        documentPath: "scene.json",
        expectedContentHash: `sha256:${"a".repeat(64)}`,
        profile: "game",
        instanceId: "child",
        propertyId: "translation-x",
        newValue: 2.5,
      },
    }).ok).toBe(true);
    expect(validateEditorCommandInvocation({
      schemaVersion: 1,
      commandId: "scene-object-reparent",
      client: "cli",
      permission: "project:write",
      profile: "game",
      input: {
        documentPath: "scene.json",
        expectedContentHash: `sha256:${"a".repeat(64)}`,
        profile: "game",
        instanceId: "child",
        parentInstanceId: "parent",
        transformPolicy: "preserve-world",
      },
    }).ok).toBe(true);
    expect(validateEditorCommandInvocation({
      schemaVersion: 1,
      commandId: "scene-hierarchy-inspect",
      client: "local-agent",
      permission: "project:read",
      input: { documentPath: "scene.json" },
    })).toMatchObject({
      ok: false,
      reason: DESKTOP_SCENE_HIERARCHY_REFUSALS.inputUnsupported,
    });
    expect(validateEditorCommandInvocation({
      schemaVersion: 1,
      commandId: "scene-selection-set",
      client: "local-agent",
      permission: "project:read",
      profile: "kids",
      input: { documentPath: "scene.json", profile: "kids", instanceIds: ["root"] },
    })).toMatchObject({
      ok: false,
      reason: DESKTOP_SCENE_HIERARCHY_REFUSALS.kidsDenied,
    });
    expect(validateEditorCommandInvocation({
      schemaVersion: 1,
      commandId: "scene-hierarchy-inspect",
      client: "cli",
      permission: "project:read",
      profile: "game",
      input: { documentPath: "scene.json", profile: "game" },
      extra: true,
    })).toMatchObject({
      ok: false,
      reason: DESKTOP_SCENE_HIERARCHY_REFUSALS.inputUnsupported,
    });
    for (const id of ["scene-object-create", "scene-object-remove", "scene-object-reparent"] as const) {
      expect(editorCommand(id)?.undo).toEqual({ kind: "none", commandId: null });
    }
  });

  it("rejects duplicate ids and invalid registry declarations", () => {
    const first = EDITOR_COMMAND_REGISTRY[0] as EditorCommandDefinition;
    expect(() => defineEditorCommandRegistry([first, first])).toThrow(
      `${EDITOR_COMMAND_REFUSALS.registryInvalid}: duplicate command id`,
    );
    expect(() => defineEditorCommandRegistry([
      { ...first, schemaVersion: 2 as 1 },
    ])).toThrow("incompatible schema version");
    expect(() => defineEditorCommandRegistry([
      { ...first, acceptedClients: [] },
    ])).toThrow("invalid accepted clients");
  });

  it("fails closed before execution on client, version, input, permission, and Kids", () => {
    const valid = {
      schemaVersion: 1,
      commandId: "assistant-local-build",
      client: "cli",
      permission: "assistant:run",
      input: { prompt: "Build a blue crate", profile: "@sceneaxi/profile-game" },
    } as const;
    expect(validateEditorCommandInvocation(valid).ok).toBe(true);
    expect(validateEditorCommandInvocation({ ...valid, schemaVersion: 2 })).toMatchObject({
      ok: false,
      reason: EDITOR_COMMAND_REFUSALS.schemaUnsupported,
    });
    expect(validateEditorCommandInvocation({ ...valid, client: "unknown" })).toMatchObject({
      ok: false,
      reason: EDITOR_COMMAND_REFUSALS.clientDenied,
    });
    expect(validateEditorCommandInvocation({ ...valid, permission: "assistant:read" })).toMatchObject({
      ok: false,
      reason: EDITOR_COMMAND_REFUSALS.permissionDenied,
    });
    expect(validateEditorCommandInvocation({
      schemaVersion: valid.schemaVersion,
      commandId: valid.commandId,
      client: valid.client,
      input: valid.input,
    })).toMatchObject({
      ok: false,
      reason: EDITOR_COMMAND_REFUSALS.permissionDenied,
    });
    expect(validateEditorCommandInvocation({ ...valid, input: {} })).toMatchObject({
      ok: false,
      reason: EDITOR_COMMAND_REFUSALS.inputInvalid,
    });
    expect(validateEditorCommandInvocation({ ...valid, extra: true })).toMatchObject({
      ok: false,
      reason: EDITOR_COMMAND_REFUSALS.inputInvalid,
    });
    expect(validateEditorCommandInvocation({
      ...valid,
      input: { prompt: "Build", profile: "@sceneaxi/profile-kids" },
    })).toMatchObject({ ok: false, reason: EDITOR_COMMAND_REFUSALS.kidsDenied });
    expect(validateEditorCommandInvocation({
      ...valid,
      commandId: "project-new",
      permission: "project:write",
      input: {},
    })).toMatchObject({ ok: false, reason: EDITOR_COMMAND_REFUSALS.clientDenied });
  });

  it("binds assistant results and cancellation to registered targets and terminal progress", () => {
    expect(editorCommand("assistant-local-build")?.evidence).toEqual({
      kind: "sculpt-artifact",
      target: "live-viewport",
    });
    expect(editorCommand("assistant-local-agent")?.evidence.target).toBe("change-review");
    expect(editorCommandTerminalResult({
      commandId: "assistant-cancel",
      jobId: "desktop-assistant-7",
      status: "cancelled",
      phase: "cancelled",
      message: "Cancelled exact job.",
      refusal: "DESKTOP_ASSISTANT_ABANDONED",
    })).toMatchObject({
      jobId: "desktop-assistant-7",
      status: "cancelled",
      progress: { percent: 100, terminal: true },
      evidenceKind: "command-progress",
    });
  });
});
