/** Wave 1 vertical: typed desktop edit -> E1 review -> save -> reopen -> play. */
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { parseDocumentText } from "@sceneaxi/authoring-core";
import {
  DESKTOP_SCENE_HIERARCHY_REFUSALS,
  createEditorCommandInvocation,
} from "@sceneaxi/schemas";
import { ExitCode, runCli } from "../../packages/cli/src/index.ts";
import { shellProposeAndApply } from "../../apps/desktop-shell/src/index.ts";
import {
  DESKTOP_ACTIVE_DOCUMENT_PATH,
  DESKTOP_SCENE_TRANSLATION_X_PROPERTY,
  createDesktopBridge,
  seedDesktopProject,
  stageDesktopSceneEdit,
  stageDesktopScenePropertyEdit,
} from "../../desktop/linux/src/index.ts";

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function seed(label: string) {
  const dir = mkdtempSync(join(tmpdir(), `sceneaxi-desktop-edit-${label}-`));
  dirs.push(dir);
  expect(seedDesktopProject(dir)).toEqual({ ok: true, migrated: false });
  return dir;
}

function editableStatus(bridge: ReturnType<typeof createDesktopBridge>) {
  const response = bridge.handle({
    action: "authoring",
    payload: { op: "status", documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH },
  });
  if (!response.ok) throw new Error(response.reason);
  if (typeof response.data !== "object" || response.data === null || Array.isArray(response.data)) {
    throw new Error("Desktop authoring status did not return an object.");
  }
  const inspected = bridge.handle({
    action: "command",
    payload: createEditorCommandInvocation("scene-hierarchy-inspect", "desktop-control", {
      documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
      profile: "game",
    }),
  });
  if (!inspected.ok) throw new Error(inspected.reason);
  return {
    ...response.data,
    editableScene: inspected.data,
  } as {
    ok: true;
    contentHash: string;
    data: Record<string, unknown>;
    editableScene: {
      ok: true;
      entities: Array<{ id: string; properties: Array<{ id: string; value: number }> }>;
    };
  };
}

describe("desktop typed Scene Document edit golden", () => {
  it("stages desktop properties through registered hierarchy authority", () => {
    const dir = seed("registered-authority");
    const bridge = createDesktopBridge({ cwd: dir, commandCapabilities: ["scene.compose"] });
    const opened = editableStatus(bridge);
    const staged = bridge.handle({
      action: "command",
      payload: createEditorCommandInvocation("scene-property-set", "desktop-control", {
        documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
        expectedContentHash: opened.contentHash,
        profile: "game",
        instanceId: DESKTOP_SCENE_TRANSLATION_X_PROPERTY.entityId,
        propertyId: DESKTOP_SCENE_TRANSLATION_X_PROPERTY.id,
        newValue: -3.25,
      }),
    });
    expect(staged).toMatchObject({
      ok: true,
      data: {
        phase: "reviewing",
        editableScene: {
          ok: true,
          contentHash: opened.contentHash,
          entities: expect.arrayContaining([
            expect.objectContaining({ id: DESKTOP_SCENE_TRANSLATION_X_PROPERTY.entityId }),
          ]),
        },
      },
    });
  });

  it("reviews without writing, saves atomically, reopens persisted bytes, and plays the saved transform", () => {
    const dir = seed("loop");
    const bridge = createDesktopBridge({
      cwd: dir,
      nowMs: () => 1_753_920_000_000,
      commandCapabilities: ["scene.compose"],
    });
    const before = readFileSync(join(dir, DESKTOP_ACTIVE_DOCUMENT_PATH), "utf8");
    const opened = editableStatus(bridge);
    const openedBeside = opened.editableScene.entities.find(
      (entity) => entity.id === DESKTOP_SCENE_TRANSLATION_X_PROPERTY.entityId,
    );
    expect(openedBeside?.id).toBe(DESKTOP_SCENE_TRANSLATION_X_PROPERTY.entityId);
    expect(openedBeside?.properties.find((property) => property.id === "translation-x"))
      .toMatchObject({ value: -4.4 });

    const proposed = bridge.handle({
      action: "authoring",
      payload: {
        op: "edit-property",
        documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
        expectedContentHash: opened.contentHash,
        profile: "game",
        entityId: DESKTOP_SCENE_TRANSLATION_X_PROPERTY.entityId,
        propertyId: DESKTOP_SCENE_TRANSLATION_X_PROPERTY.id,
        newValue: -3.25,
      },
    });
    expect(proposed.ok).toBe(true);
    if (!proposed.ok) return;
    expect(proposed.data).toMatchObject({
      phase: "reviewing",
      proposal: null,
      unifiedDiff: null,
      renderedDiff: null,
    });
    expect(JSON.stringify(proposed.data)).not.toContain("composedScene");
    expect(proposed.data).not.toHaveProperty("editableScene");
    expect(readFileSync(join(dir, DESKTOP_ACTIVE_DOCUMENT_PATH), "utf8")).toBe(before);

    const saved = bridge.handle({ action: "authoring", payload: { op: "accept" } });
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    expect(saved.data).toMatchObject({ phase: "applied", diagnostics: null });
    expect(saved.data).not.toHaveProperty("editableScene");
    const persisted = readFileSync(join(dir, DESKTOP_ACTIVE_DOCUMENT_PATH), "utf8");
    expect(persisted).not.toBe(before);

    const reopened = bridge.handle({
      action: "authoring",
      payload: { op: "restart", documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH },
    });
    expect(reopened.ok).toBe(true);
    if (!reopened.ok) return;
    expect(reopened.data).toMatchObject({ ok: true });
    expect(reopened.data).not.toHaveProperty("editableScene");
    const reopenedData = editableStatus(bridge) as {
      editableScene: { entities: Array<{ id: string; properties: Array<{ id: string; value: number }> }> };
    };
    expect(reopenedData.editableScene.entities.find(
      (entity) => entity.id === DESKTOP_SCENE_TRANSLATION_X_PROPERTY.entityId,
    )?.properties.find((property) => property.id === "translation-x")?.value).toBe(-3.25);
    expect(readFileSync(join(dir, DESKTOP_ACTIVE_DOCUMENT_PATH), "utf8")).toBe(persisted);

    const played = bridge.handle({
      action: "open-path",
      payload: { documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH },
    });
    if (!played.ok) throw new Error(JSON.stringify(played));
    const beside = (played.data as {
      mountable: { instances: Array<{ instanceId: string; worldTransform: { translation: number[] } }> };
    }).mountable.instances.find(
      (instance) => instance.instanceId === DESKTOP_SCENE_TRANSLATION_X_PROPERTY.entityId,
    );
    expect(beside?.worldTransform.translation[0]).toBe(-3.25);
  });

  it("returns the hierarchy input refusal and the CLI conflict reason", () => {
    const dir = seed("refusals");
    const bridge = createDesktopBridge({ cwd: dir, commandCapabilities: ["scene.compose"] });
    const opened = editableStatus(bridge);
    const invalid = bridge.handle({
      action: "authoring",
      payload: {
        op: "edit-property",
        documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
        expectedContentHash: opened.contentHash,
        profile: "game",
        entityId: DESKTOP_SCENE_TRANSLATION_X_PROPERTY.entityId,
        propertyId: DESKTOP_SCENE_TRANSLATION_X_PROPERTY.id,
        newValue: "left",
      },
    });
    expect(invalid).toMatchObject({
      ok: false,
      reason: "SCENE_HIERARCHY_INPUT_UNSUPPORTED",
    });

    const current = readFileSync(join(dir, DESKTOP_ACTIVE_DOCUMENT_PATH), "utf8");
    writeFileSync(join(dir, DESKTOP_ACTIVE_DOCUMENT_PATH), `${current.trimEnd()}\n\n`);
    const stale = bridge.handle({
      action: "authoring",
      payload: {
        op: "edit-property",
        documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
        expectedContentHash: opened.contentHash,
        profile: "game",
        entityId: DESKTOP_SCENE_TRANSLATION_X_PROPERTY.entityId,
        propertyId: DESKTOP_SCENE_TRANSLATION_X_PROPERTY.id,
        newValue: -3.25,
      },
    });
    expect(stale.ok).toBe(true);
    if (!stale.ok) return;
    expect(stale.data).toMatchObject({
      phase: "idle",
      diagnostics: [{ code: "content-hash-conflict" }],
    });
  });

  it("produces byte-identical canonical output through protocol, CLI, and desktop", () => {
    const desktopDir = seed("parity-desktop");
    const protocolDir = seed("parity-protocol");
    const cliDir = seed("parity-cli");
    const initial = readFileSync(join(desktopDir, DESKTOP_ACTIVE_DOCUMENT_PATH), "utf8");
    cpSync(join(desktopDir, DESKTOP_ACTIVE_DOCUMENT_PATH), join(protocolDir, DESKTOP_ACTIVE_DOCUMENT_PATH));
    cpSync(join(desktopDir, DESKTOP_ACTIVE_DOCUMENT_PATH), join(cliDir, DESKTOP_ACTIVE_DOCUMENT_PATH));
    const parsed = parseDocumentText(initial);
    if (!parsed.ok) throw new Error(parsed.message);

    const bridge = createDesktopBridge({ cwd: desktopDir, commandCapabilities: ["scene.compose"] });
    const status = editableStatus(bridge);
    const desktop = bridge.handle({
      action: "authoring",
      payload: {
        op: "edit-property",
        documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
        expectedContentHash: status.contentHash,
        profile: "game",
        entityId: DESKTOP_SCENE_TRANSLATION_X_PROPERTY.entityId,
        propertyId: DESKTOP_SCENE_TRANSLATION_X_PROPERTY.id,
        newValue: -2.75,
      },
    });
    expect(desktop.ok).toBe(true);
    expect(bridge.handle({ action: "authoring", payload: { op: "accept" } })).toMatchObject({
      ok: true,
      data: { phase: "applied" },
    });

    const staged = stageDesktopScenePropertyEdit({
      documentData: parsed.document.data,
      contentHash: status.contentHash,
      entityId: DESKTOP_SCENE_TRANSLATION_X_PROPERTY.entityId,
      propertyId: DESKTOP_SCENE_TRANSLATION_X_PROPERTY.id,
      newValue: -2.75,
    });
    if (!staged.ok) throw new Error(staged.diagnostics[0]?.message);
    expect(shellProposeAndApply({ ...staged.edit, cwd: protocolDir }).ok).toBe(true);
    expect(
      runCli([
        "project",
        "propose",
        "--cwd",
        cliDir,
        "--document",
        staged.edit.documentPath,
        "--pointer",
        staged.edit.jsonPointer,
        "--value",
        JSON.stringify(staged.edit.newValue),
        "--out",
        "edit.json",
      ]).exitCode,
    ).toBe(ExitCode.OK);
    expect(
      runCli(["project", "apply", "--cwd", cliDir, "--proposal", "edit.json"]).exitCode,
    ).toBe(ExitCode.OK);

    const desktopBytes = readFileSync(join(desktopDir, DESKTOP_ACTIVE_DOCUMENT_PATH));
    const protocolBytes = readFileSync(join(protocolDir, DESKTOP_ACTIVE_DOCUMENT_PATH));
    const cliBytes = readFileSync(join(cliDir, DESKTOP_ACTIVE_DOCUMENT_PATH));
    expect(desktopBytes.equals(protocolBytes)).toBe(true);
    expect(desktopBytes.equals(cliBytes)).toBe(true);
  });

  it("settles selected transforms and add/remove through review, persistence, undo, and Play", () => {
    const dir = seed("breadth-loop");
    const bridge = createDesktopBridge({
      cwd: dir,
      nowMs: () => 1_753_920_000_000,
      commandCapabilities: ["scene.compose"],
    });
    const documentFile = join(dir, DESKTOP_ACTIVE_DOCUMENT_PATH);
    const initialBytes = readFileSync(documentFile, "utf8");
    const selected = DESKTOP_SCENE_TRANSLATION_X_PROPERTY.entityId;

    const status = () => editableStatus(bridge);
    const stage = (operation: unknown) => {
      const response = bridge.handle({
        action: "authoring",
        payload: {
          op: "edit-scene",
          documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
          expectedContentHash: status().contentHash,
          profile: "game",
          operation,
        },
      });
      expect(response).toMatchObject({ ok: true, data: { phase: "reviewing" } });
      return response;
    };
    const accept = () =>
      expect(bridge.handle({ action: "authoring", payload: { op: "accept" } }))
        .toMatchObject({ ok: true, data: { phase: "applied" } });

    stage({ kind: "set-transform-component", instanceId: selected, propertyId: "rotation-y", value: 45 });
    expect(readFileSync(documentFile, "utf8")).toBe(initialBytes);
    expect(bridge.handle({ action: "authoring", payload: { op: "reject" } }))
      .toMatchObject({ ok: true, data: { phase: "rejected" } });
    expect(readFileSync(documentFile, "utf8")).toBe(initialBytes);

    for (const [propertyId, value] of [
      ["translation-z", 2.5],
      ["rotation-y", 45],
      ["scale-z", 1.5],
    ] as const) {
      stage({ kind: "set-transform-component", instanceId: selected, propertyId, value });
      accept();
    }

    const added = stage({ kind: "add-instance", sourceInstanceId: selected });
    expect(added).toMatchObject({ ok: true, data: { phase: "reviewing" } });
    if (added.ok) {
      expect(added.data).not.toHaveProperty("editableScene");
      expect(added.data).not.toHaveProperty("selectedInstanceId");
    }
    accept();
    const afterAdd = readFileSync(documentFile, "utf8");
    expect(status().editableScene.entities.some(
      (entity) => entity.id === "desktop-crate-beside-copy-1",
    )).toBe(true);
    const reopened = bridge.handle({
      action: "authoring",
      payload: { op: "restart", documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH },
    });
    expect(reopened).toMatchObject({ ok: true, data: { ok: true } });
    expect(readFileSync(documentFile, "utf8")).toBe(afterAdd);

    stage({ kind: "remove-instance", instanceId: "desktop-crate-beside-copy-1" });
    accept();
    expect(status().editableScene.entities.some(
      (entity) => entity.id === "desktop-crate-beside-copy-1",
    )).toBe(false);
    expect(bridge.handle({ action: "authoring", payload: { op: "undo" } }))
      .toMatchObject({ ok: true, data: { ok: true } });
    expect(readFileSync(documentFile, "utf8")).toBe(afterAdd);

    const played = bridge.handle({
      action: "open-path",
      payload: { documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH },
    });
    if (!played.ok) throw new Error(JSON.stringify(played));
    const instances = (played.data as {
      mountable: { instances: Array<{ instanceId: string; worldTransform: {
        translation: number[]; rotationEulerDegrees: number[]; scale: number[];
      } }> };
    }).mountable.instances;
    expect(instances.find((instance) => instance.instanceId === selected)?.worldTransform)
      .toMatchObject({ translation: [-4.4, 0, 2.5], rotationEulerDegrees: [0, 45, 0], scale: [1, 1, 1.5] });
    expect(instances.some((instance) => instance.instanceId === "desktop-crate-beside-copy-1"))
      .toBe(true);
  });

  it("keeps canonical transform and add bytes identical across desktop, protocol, and CLI", () => {
    const cases = [
      { kind: "set-transform-component", instanceId: DESKTOP_SCENE_TRANSLATION_X_PROPERTY.entityId, propertyId: "rotation-z", value: 30 },
      { kind: "add-instance", sourceInstanceId: DESKTOP_SCENE_TRANSLATION_X_PROPERTY.entityId },
    ] as const;
    for (const [index, operation] of cases.entries()) {
      const desktopDir = seed(`breadth-parity-desktop-${String(index)}`);
      const protocolDir = seed(`breadth-parity-protocol-${String(index)}`);
      const cliDir = seed(`breadth-parity-cli-${String(index)}`);
      const initial = readFileSync(join(desktopDir, DESKTOP_ACTIVE_DOCUMENT_PATH), "utf8");
      cpSync(join(desktopDir, DESKTOP_ACTIVE_DOCUMENT_PATH), join(protocolDir, DESKTOP_ACTIVE_DOCUMENT_PATH));
      cpSync(join(desktopDir, DESKTOP_ACTIVE_DOCUMENT_PATH), join(cliDir, DESKTOP_ACTIVE_DOCUMENT_PATH));
      const parsed = parseDocumentText(initial);
      if (!parsed.ok) throw new Error(parsed.message);
      const bridge = createDesktopBridge({
        cwd: desktopDir,
        commandCapabilities: ["scene.compose"],
      });
      const opened = editableStatus(bridge);
      expect(bridge.handle({
        action: "authoring",
        payload: {
          op: "edit-scene",
          documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
          expectedContentHash: opened.contentHash,
          profile: "game",
          operation,
        },
      })).toMatchObject({ ok: true, data: { phase: "reviewing" } });
      expect(bridge.handle({ action: "authoring", payload: { op: "accept" } }))
        .toMatchObject({ ok: true, data: { phase: "applied" } });

      const staged = stageDesktopSceneEdit({
        documentData: parsed.document.data,
        contentHash: opened.contentHash,
        profile: "game",
        operation,
      });
      if (!staged.ok) throw new Error(staged.diagnostics[0]?.message);
      expect(shellProposeAndApply({ ...staged.edit, cwd: protocolDir }).ok).toBe(true);
      expect(runCli([
        "project", "propose", "--cwd", cliDir,
        "--document", staged.edit.documentPath,
        "--pointer", staged.edit.jsonPointer,
        "--value", JSON.stringify(staged.edit.newValue),
        "--out", "edit.json",
      ]).exitCode).toBe(ExitCode.OK);
      expect(runCli(["project", "apply", "--cwd", cliDir, "--proposal", "edit.json"]).exitCode)
        .toBe(ExitCode.OK);

      const desktopBytes = readFileSync(join(desktopDir, DESKTOP_ACTIVE_DOCUMENT_PATH));
      expect(desktopBytes.equals(readFileSync(join(protocolDir, DESKTOP_ACTIVE_DOCUMENT_PATH))))
        .toBe(true);
      expect(desktopBytes.equals(readFileSync(join(cliDir, DESKTOP_ACTIVE_DOCUMENT_PATH))))
        .toBe(true);
    }
  });

  it("refuses malformed, stale, missing-asset, Kids, and escaping edit-scene requests", () => {
    const dir = seed("breadth-refusals");
    const bridge = createDesktopBridge({ cwd: dir, commandCapabilities: ["scene.compose"] });
    const contentHash = editableStatus(bridge).contentHash;
    const edit = (profile: unknown, operation: unknown, documentPath = DESKTOP_ACTIVE_DOCUMENT_PATH) =>
      bridge.handle({
        action: "authoring",
        payload: { op: "edit-scene", documentPath, expectedContentHash: contentHash, profile, operation },
      });
    expect(edit("game", { kind: "set-transform-component", instanceId: "bad", propertyId: "scale-x", value: 0 }))
      .toMatchObject({ ok: false, reason: "SCENE_HIERARCHY_INPUT_UNSUPPORTED" });
    expect(edit("game", { kind: "remove-instance", instanceId: "missing-instance" }))
      .toMatchObject({
        ok: true,
        data: {
          ok: false,
          diagnostics: [{ code: DESKTOP_SCENE_HIERARCHY_REFUSALS.selectionStale }],
        },
      });
    expect(edit("game", { kind: "add-instance", sourceInstanceId: "missing-instance" }))
      .toMatchObject({ ok: true, data: { ok: false, diagnostics: [{ message: expect.stringContaining("missing") }] } });
    expect(edit("kids", { kind: "remove-instance", instanceId: DESKTOP_SCENE_TRANSLATION_X_PROPERTY.entityId }))
      .toMatchObject({ ok: false, reason: "SCENE_HIERARCHY_KIDS_DENIED" });
    expect(edit("game", { kind: "remove-instance", instanceId: DESKTOP_SCENE_TRANSLATION_X_PROPERTY.entityId }, "../scene.json"))
      .toMatchObject({ ok: false, reason: "SCENE_HIERARCHY_INPUT_UNSUPPORTED" });
  });
});
