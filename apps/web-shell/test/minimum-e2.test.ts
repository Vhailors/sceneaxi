import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  createDocument,
  reconstructSculpt,
  writeDocumentFile,
} from "@sceneaxi/authoring-core";
import { SCULPT_INTAKE_KIND } from "@sceneaxi/schemas";
import {
  createMinimumE2Editor,
  type MinimumE2Editor,
} from "@sceneaxi/web-shell";

const digest = (character: string) => `sha256:${character.repeat(64)}`;

function fixtureDir() {
  return mkdtempSync(join(tmpdir(), "sceneaxi-minimum-e2-"));
}

function demoArtifact() {
  const reconstructed = reconstructSculpt({
    schemaVersion: 1,
    kind: SCULPT_INTAKE_KIND,
    intakeId: "demo-lantern",
    mode: "image+brief",
    image: {
      mediaType: "image/png",
      uri: "fixtures/demo-lantern.png",
      digest: digest("a"),
    },
    brief: "A compact lantern with a warm cap that gently bobs.",
  });
  expect(reconstructed.ok).toBe(true);
  if (!reconstructed.ok) throw new Error(reconstructed.message);
  return reconstructed.artifact;
}

function sceneFile(dir: string) {
  const result = writeDocumentFile(
    "scene.json",
    createDocument({ id: "minimum-e2-scene", data: { title: "Hybrid demo" } }),
    { cwd: dir },
  );
  expect(result.ok).toBe(true);
}

describe("Minimum E2 hybrid editor surface", () => {
  it("covers viewport, tree, selection, numeric transform, inspector, and add/remove", () => {
    const dir = fixtureDir();
    sceneFile(dir);
    const editor = createMinimumE2Editor({
      cwd: dir,
      documentPath: "scene.json",
      backend: "experimental-three",
      seed: 72,
    });
    const artifact = demoArtifact();

    editor.addSculpt({ instanceId: "lantern-one", artifact });
    expect(editor.viewport()).toMatchObject({
      backend: "experimental-three",
      drawCalls: 2,
    });
    expect(editor.snapshot().sceneTree).toHaveLength(3);

    editor.select("lantern-one");
    expect(editor.snapshot().inspector).toMatchObject({
      instanceId: "lantern-one",
      componentCount: 2,
      socketCount: 1,
    });
    editor.setSelectedTransform({
      translation: [4, 1, -2],
      rotationEulerDegrees: [0, 45, 0],
      scale: [1, 1, 1],
    });
    expect(editor.snapshot().inspector?.transform.translation).toEqual([4, 1, -2]);

    editor.addSculpt({ instanceId: "lantern-two", artifact });
    expect(editor.snapshot().sceneTree).toHaveLength(6);
    editor.removeSculpt("lantern-two");
    expect(editor.snapshot().sceneTree).toHaveLength(3);
    editor.dispose();
  });

  it("drives kernel sessions with play, pause, and explicit step", () => {
    const dir = fixtureDir();
    sceneFile(dir);
    const editor = createMinimumE2Editor({ cwd: dir, documentPath: "scene.json", backend: "null", seed: 7 });
    editor.addSculpt({ instanceId: "lantern", artifact: demoArtifact() });
    editor.select("lantern");

    editor.tick(16);
    expect(editor.snapshot().tick).toBe(0);
    editor.play();
    editor.tick(16);
    expect(editor.snapshot()).toMatchObject({ playState: "playing", tick: 1 });
    expect(editor.snapshot().inspector?.kernel.tick).toBe(1);
    editor.pause();
    editor.tick(16);
    expect(editor.snapshot().tick).toBe(1);
    editor.step(16);
    expect(editor.snapshot()).toMatchObject({ playState: "paused", tick: 2 });
    expect(editor.snapshot().inspector?.kernel.tick).toBe(2);
    editor.dispose();
  });

  it("saves and loads editor state through a reviewed propose/apply artifact", () => {
    const dir = fixtureDir();
    sceneFile(dir);
    const editor = createMinimumE2Editor({ cwd: dir, documentPath: "scene.json", backend: "null" });
    editor.addSculpt({ instanceId: "lantern", artifact: demoArtifact() });
    editor.select("lantern");
    editor.setSelectedTransform({
      translation: [2, 3, 4],
      rotationEulerDegrees: [0, 15, 0],
      scale: [1.5, 1.5, 1.5],
    });

    const saved = editor.save();
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    expect(saved.proposal.edits).toHaveLength(1);
    expect(saved.proposal.edits[0]?.jsonPointer).toBe("/data");
    expect(saved.unifiedDiff).toContain('"minimumE2"');
    expect(saved.appliedPaths).toEqual(["scene.json"]);
    editor.dispose();

    const persisted = JSON.parse(readFileSync(join(dir, "scene.json"), "utf8")) as {
      data: { minimumE2: { schemaVersion: number } };
    };
    expect(persisted.data.minimumE2.schemaVersion).toBe(1);

    const restored = createMinimumE2Editor({ cwd: dir, documentPath: "scene.json", backend: "null" });
    expect(restored.load()).toEqual({ ok: true, instanceIds: ["lantern"] });
    expect(restored.snapshot().selectedInstanceId).toBe("lantern");
    expect(restored.snapshot().inspector?.transform).toEqual({
      translation: [2, 3, 4],
      rotationEulerDegrees: [0, 15, 0],
      scale: [1.5, 1.5, 1.5],
    });
    expect(restored.viewport()).toMatchObject({ backend: "null", drawCalls: 0 });
    restored.dispose();
  });

  it.each([
    {
      name: "invalid instance identifiers",
      persistedInstance: (artifact: ReturnType<typeof demoArtifact>) => ({
        instanceId: "Invalid_Instance",
        artifact,
        transform: {
          translation: [0, 0, 0],
          rotationEulerDegrees: [0, 0, 0],
          scale: [1, 1, 1],
        },
      }),
    },
    {
      name: "unexpected transform fields",
      persistedInstance: (artifact: ReturnType<typeof demoArtifact>) => ({
        instanceId: "replacement",
        artifact,
        transform: {
          translation: [0, 0, 0],
          rotationEulerDegrees: [0, 0, 0],
          scale: [1, 1, 1],
          skew: [0, 0, 0],
        },
      }),
    },
  ])("refuses $name without replacing the current scene", ({ persistedInstance }) => {
    const dir = fixtureDir();
    sceneFile(dir);
    const artifact = demoArtifact();
    const editor = createMinimumE2Editor({ cwd: dir, documentPath: "scene.json", backend: "null" });
    editor.addSculpt({ instanceId: "current", artifact });
    editor.select("current");

    const written = writeDocumentFile(
      "scene.json",
      createDocument({
        id: "minimum-e2-scene",
        data: {
          minimumE2: {
            schemaVersion: 1,
            selectedInstanceId: null,
            instances: [persistedInstance(artifact)],
          },
        },
      }),
      { cwd: dir },
    );
    expect(written.ok).toBe(true);
    expect(editor.load()).toMatchObject({ ok: false, code: "state-invalid" });
    const unchanged = editor.snapshot();
    expect(unchanged.selectedInstanceId).toBe("current");
    expect(unchanged.sceneTree).toHaveLength(3);
    expect(unchanged.sceneTree[0]?.id).toBe("current");
    expect(unchanged.inspector?.instanceId).toBe("current");
    editor.dispose();
  });

  it("is a bounded checklist rather than a full editor clone", () => {
    const dir = fixtureDir();
    sceneFile(dir);
    const editor: MinimumE2Editor = createMinimumE2Editor({ cwd: dir, documentPath: "scene.json" });
    for (const outOfScope of ["shaderGraph", "animationGraph", "tilemap", "particles", "assetStore", "dockLayout"]) {
      expect(editor).not.toHaveProperty(outOfScope);
    }
    editor.dispose();
  });
});
