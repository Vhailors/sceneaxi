/** Wave 1 vertical: typed desktop edit -> E1 review -> save -> reopen -> play. */
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { parseDocumentText } from "@sceneaxi/authoring-core";
import { ExitCode, runCli } from "../../packages/cli/src/index.ts";
import { shellProposeAndApply } from "../../apps/desktop-shell/src/index.ts";
import {
  DESKTOP_ACTIVE_DOCUMENT_PATH,
  DESKTOP_SCENE_TRANSLATION_X_PROPERTY,
  createDesktopBridge,
  seedDesktopProject,
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
  return response.data as {
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
  it("reviews without writing, saves atomically, reopens persisted bytes, and plays the saved transform", () => {
    const dir = seed("loop");
    const bridge = createDesktopBridge({ cwd: dir, nowMs: () => 1_753_920_000_000 });
    const before = readFileSync(join(dir, DESKTOP_ACTIVE_DOCUMENT_PATH), "utf8");
    const opened = editableStatus(bridge);
    expect(opened.editableScene.entities[0]).toMatchObject({
      id: DESKTOP_SCENE_TRANSLATION_X_PROPERTY.entityId,
      properties: [{ id: "translation-x", value: -4.4 }],
    });

    const proposed = bridge.handle({
      action: "authoring",
      payload: {
        op: "edit-property",
        documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
        expectedContentHash: opened.contentHash,
        entityId: DESKTOP_SCENE_TRANSLATION_X_PROPERTY.entityId,
        propertyId: DESKTOP_SCENE_TRANSLATION_X_PROPERTY.id,
        newValue: -3.25,
      },
    });
    expect(proposed.ok).toBe(true);
    if (!proposed.ok) return;
    expect(proposed.data).toMatchObject({
      phase: "reviewing",
      proposal: {
        edits: [
          {
            documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
            baseContentHash: opened.contentHash,
            jsonPointer: "/data/composedScene",
          },
        ],
      },
    });
    expect(readFileSync(join(dir, DESKTOP_ACTIVE_DOCUMENT_PATH), "utf8")).toBe(before);

    const saved = bridge.handle({ action: "authoring", payload: { op: "accept" } });
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    expect(saved.data).toMatchObject({ phase: "applied", diagnostics: null });
    const persisted = readFileSync(join(dir, DESKTOP_ACTIVE_DOCUMENT_PATH), "utf8");
    expect(persisted).not.toBe(before);

    const reopened = bridge.handle({
      action: "authoring",
      payload: { op: "restart", documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH },
    });
    expect(reopened.ok).toBe(true);
    if (!reopened.ok) return;
    expect(reopened.data).toMatchObject({
      ok: true,
      editableScene: {
        ok: true,
        entities: [{ properties: [{ value: -3.25 }] }],
      },
    });
    expect(readFileSync(join(dir, DESKTOP_ACTIVE_DOCUMENT_PATH), "utf8")).toBe(persisted);

    const played = bridge.handle({
      action: "open-path",
      payload: { documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH },
    });
    expect(played.ok).toBe(true);
    if (!played.ok) return;
    const beside = (played.data as {
      mountable: { instances: Array<{ instanceId: string; worldTransform: { translation: number[] } }> };
    }).mountable.instances.find(
      (instance) => instance.instanceId === DESKTOP_SCENE_TRANSLATION_X_PROPERTY.entityId,
    );
    expect(beside?.worldTransform.translation[0]).toBe(-3.25);
  });

  it("returns the shared validation diagnostic and the CLI conflict reason", () => {
    const dir = seed("refusals");
    const bridge = createDesktopBridge({ cwd: dir });
    const opened = editableStatus(bridge);
    const invalid = bridge.handle({
      action: "authoring",
      payload: {
        op: "edit-property",
        documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
        expectedContentHash: opened.contentHash,
        entityId: DESKTOP_SCENE_TRANSLATION_X_PROPERTY.entityId,
        propertyId: DESKTOP_SCENE_TRANSLATION_X_PROPERTY.id,
        newValue: "left",
      },
    });
    expect(invalid.ok).toBe(true);
    if (!invalid.ok) return;
    expect(invalid.data).toEqual({
      ok: false,
      diagnostics: [
        {
          code: "validation-failed",
          message: "$.placements[1].transform: Placement transform is invalid.",
          documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
        },
      ],
    });

    const current = readFileSync(join(dir, DESKTOP_ACTIVE_DOCUMENT_PATH), "utf8");
    writeFileSync(join(dir, DESKTOP_ACTIVE_DOCUMENT_PATH), `${current.trimEnd()}\n\n`);
    const stale = bridge.handle({
      action: "authoring",
      payload: {
        op: "edit-property",
        documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
        expectedContentHash: opened.contentHash,
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

    const bridge = createDesktopBridge({ cwd: desktopDir });
    const status = editableStatus(bridge);
    const desktop = bridge.handle({
      action: "authoring",
      payload: {
        op: "edit-property",
        documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
        expectedContentHash: status.contentHash,
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
});
