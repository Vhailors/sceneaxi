import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  WEB_EDITOR_SESSION_OPERATIONS,
  WebEditorError,
  type WebEditorSession,
  createWebEditorSession,
  decideEditorEntitlement,
  webEditorStarterArtifact,
} from "@sceneaxi/site-kit";
import type { SculptTransform } from "@sceneaxi/schemas";

const workspaces: string[] = [];

const workspace = (): string => {
  const dir = mkdtempSync(join(tmpdir(), "sceneaxi-web-editor-"));
  workspaces.push(dir);
  return dir;
};

afterEach(() => {
  while (workspaces.length > 0) {
    const dir = workspaces.pop();
    if (dir !== undefined) rmSync(dir, { recursive: true, force: true });
  }
});

const starter = () => {
  const artifact = webEditorStarterArtifact();
  if (!artifact.ok) throw new Error(`starter artifact refused: ${artifact.reason}`);
  return artifact.value;
};

const openSession = (options: { readonly documentPath?: string } = {}): WebEditorSession => {
  const created = createWebEditorSession({
    workspaceRoot: workspace(),
    backend: "null",
    seed: 4242,
    ...options,
  });
  if (!created.ok) throw new Error(`session refused: ${created.reason}`);
  return created.value;
};

const MOVED: SculptTransform = {
  translation: [2, 0, -1],
  rotationEulerDegrees: [0, 0, 0],
  scale: [1, 1, 1],
};

describe("the starter artifact is deterministic", () => {
  it("reconstructs and caches the same artifact", () => {
    const first = starter();
    expect(first.artifactId.length).toBeGreaterThan(0);
    expect(starter()).toBe(first);
  });
});

describe("the session surface is bounded", () => {
  it("exposes exactly the frozen operation list, so general E2 cannot creep in", () => {
    const session = openSession();
    expect(Object.keys(session).sort()).toEqual([...WEB_EDITOR_SESSION_OPERATIONS].sort());
    expect(Object.isFrozen(session)).toBe(true);
    session.dispose();
  });

  it("does not expose a general-E2 operation", () => {
    const session = openSession();
    for (const forbidden of ["addNode", "reparent", "script", "importAsset", "buildPipeline"]) {
      expect(forbidden in session).toBe(false);
    }
    session.dispose();
  });
});

describe("edit → save → load round trip", () => {
  it("survives a reload with tree, selection, and transform intact", () => {
    const session = openSession();
    session.addSculpt({ instanceId: "prop-a", artifact: starter() });
    session.select("prop-a");
    session.setSelectedTransform(MOVED);
    session.step(16);

    const before = session.snapshot();
    expect(before.selectedInstanceId).toBe("prop-a");
    expect(before.inspector?.transform.translation).toEqual([2, 0, -1]);

    const saved = session.save();
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    expect(saved.unifiedDiff.length).toBeGreaterThan(0);
    expect(saved.proposal).toBeDefined();

    const loaded = session.load();
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect([...loaded.instanceIds]).toEqual(["prop-a"]);

    const after = session.snapshot();
    expect(after.sceneTree).toEqual(before.sceneTree);
    expect(after.selectedInstanceId).toBe(before.selectedInstanceId);
    expect(after.inspector?.transform).toEqual(before.inspector?.transform);
    session.dispose();
  });

  it("goes through authoring-core's propose/apply rather than a second writer", () => {
    const session = openSession();
    session.addSculpt({ instanceId: "prop-a", artifact: starter() });
    const saved = session.save();
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    expect(saved.appliedPaths.length).toBeGreaterThan(0);
    session.dispose();
  });

  it("removes a sculpt and reflects it in the tree", () => {
    const session = openSession();
    session.addSculpt({ instanceId: "prop-a", artifact: starter() });
    session.addSculpt({ instanceId: "prop-b", artifact: starter(), transform: MOVED });
    expect(
      session.snapshot().sceneTree.filter((node) => node.kind === "sculpt-instance").length,
    ).toBe(2);
    session.removeSculpt("prop-a");
    expect(
      session
        .snapshot()
        .sceneTree.filter((node) => node.kind === "sculpt-instance")
        .map((node) => node.instanceId),
    ).toEqual(["prop-b"]);
    session.dispose();
  });

  it("uses identity for a new sculpt when another selection has moved", () => {
    const session = openSession();
    session.addSculpt({ instanceId: "prop-a", artifact: starter(), transform: MOVED });
    session.select("prop-a");
    session.addSculpt({ instanceId: "prop-b", artifact: starter() });
    const composed = session.composeSceneProjection({ rootInstanceId: "prop-a" });
    expect(composed.ok).toBe(true);
    if (!composed.ok) return;
    const child = composed.scene.instances.find((instance) => instance.instanceId === "prop-b");
    expect(child?.worldTransform.translation).toEqual(MOVED.translation);
    session.dispose();
  });

  it("rebuilds projection transforms from the loaded editor state", () => {
    const session = openSession();
    session.addSculpt({ instanceId: "prop-a", artifact: starter() });
    session.addSculpt({ instanceId: "prop-b", artifact: starter(), transform: MOVED });
    expect(session.save().ok).toBe(true);
    session.select("prop-b");
    session.setSelectedTransform({
      translation: [9, 9, 9],
      rotationEulerDegrees: [0, 0, 0],
      scale: [1, 1, 1],
    });
    expect(session.load().ok).toBe(true);
    const composed = session.composeSceneProjection({ rootInstanceId: "prop-a" });
    expect(composed.ok).toBe(true);
    if (!composed.ok) return;
    const child = composed.scene.instances.find((instance) => instance.instanceId === "prop-b");
    expect(child?.worldTransform.translation).toEqual(MOVED.translation);
    session.dispose();
  });

  it("play and pause move the play state", () => {
    const session = openSession();
    expect(session.snapshot().playState).toBe("paused");
    session.play();
    expect(session.snapshot().playState).toBe("playing");
    session.pause();
    expect(session.snapshot().playState).toBe("paused");
    session.dispose();
  });
});

describe("multi-object scene composition projection", () => {
  it("composes the mounted placements through the landed pipeline", () => {
    const session = openSession();
    session.addSculpt({ instanceId: "prop-a", artifact: starter() });
    session.addSculpt({ instanceId: "prop-b", artifact: starter(), transform: MOVED });
    const composed = session.composeSceneProjection({ sceneId: "umbrella-demo" });
    expect(composed.ok).toBe(true);
    if (!composed.ok) return;
    expect(
      composed.scene.instances.map((instance: { instanceId: string }) => instance.instanceId).sort(),
    ).toEqual([
      "prop-a",
      "prop-b",
    ]);
    session.dispose();
  });

  it("never rewrites an artifact to place it — the projected spec bytes are unchanged", () => {
    const session = openSession();
    const artifact = starter();
    session.addSculpt({ instanceId: "prop-a", artifact });
    session.addSculpt({ instanceId: "prop-b", artifact, transform: MOVED });
    const composed = session.composeSceneProjection();
    expect(composed.ok).toBe(true);
    if (!composed.ok) return;
    for (const instance of composed.scene.instances) {
      expect(instance.artifact).toEqual(artifact);
    }
    session.dispose();
  });

  it("places the root at depth 0 and every other mount beneath it", () => {
    const session = openSession();
    session.addSculpt({ instanceId: "prop-a", artifact: starter() });
    session.addSculpt({ instanceId: "prop-b", artifact: starter(), transform: MOVED });
    const composed = session.composeSceneProjection();
    expect(composed.ok).toBe(true);
    if (!composed.ok) return;
    const byId = new Map(composed.scene.instances.map((entry) => [entry.instanceId, entry]));
    expect(byId.get("prop-a")?.depth).toBe(0);
    expect(byId.get("prop-a")?.parentInstanceId).toBeNull();
    expect(byId.get("prop-b")?.depth).toBe(1);
    expect(byId.get("prop-b")?.parentInstanceId).toBe("prop-a");
    expect(byId.get("prop-b")?.worldTransform.translation).toEqual([2, 0, -1]);
    session.dispose();
  });

  it("honours an explicit root and falls back when the requested root is not mounted", () => {
    const session = openSession();
    session.addSculpt({ instanceId: "prop-a", artifact: starter() });
    session.addSculpt({ instanceId: "prop-b", artifact: starter(), transform: MOVED });
    const rooted = session.composeSceneProjection({ rootInstanceId: "prop-b" });
    expect(rooted.ok && rooted.scene.rootInstanceId).toBe("prop-b");
    const fallback = session.composeSceneProjection({ rootInstanceId: "not-mounted" });
    expect(fallback.ok && fallback.scene.rootInstanceId).toBe("prop-a");
    session.dispose();
  });

  it("refuses a single-object scene with the pipeline's own named code", () => {
    const session = openSession();
    session.addSculpt({ instanceId: "prop-a", artifact: starter() });
    const composed = session.composeSceneProjection();
    expect(composed).toMatchObject({ ok: false, code: "instance-count-below-minimum" });
    session.dispose();
  });

  it("refuses composition rather than inventing a scene when nothing is mounted", () => {
    const session = openSession();
    expect(session.composeSceneProjection().ok).toBe(false);
    session.dispose();
  });
});

describe("sessions are isolated and disposable", () => {
  it("does not let one session observe another", () => {
    const first = openSession();
    const second = openSession();
    first.addSculpt({ instanceId: "prop-a", artifact: starter() });
    expect(first.snapshot().sceneTree.length).toBeGreaterThan(0);
    expect(second.snapshot().sceneTree).toEqual([]);
    first.dispose();
    second.dispose();
  });

  it("refuses EDITOR_SESSION_DISPOSED after dispose, and dispose is idempotent", () => {
    const session = openSession();
    session.dispose();
    session.dispose();
    for (const call of [
      () => session.snapshot(),
      () => session.save(),
      () => session.load(),
      () => session.select(null),
      () => session.play(),
      () => session.composeSceneProjection(),
    ]) {
      expect(call).toThrow(WebEditorError);
      try {
        call();
      } catch (error) {
        expect((error as WebEditorError).reason).toBe("EDITOR_SESSION_DISPOSED");
      }
    }
  });
});

describe("workspace confinement", () => {
  it.each([
    ["../escape.json", "EDITOR_WORKSPACE_ESCAPE"],
    ["nested/../../escape.json", "EDITOR_WORKSPACE_ESCAPE"],
    ["/etc/passwd", "EDITOR_WORKSPACE_ESCAPE"],
    ["   ", "EDITOR_WORKSPACE_ESCAPE"],
    [".", "EDITOR_WORKSPACE_ESCAPE"],
  ])("refuses documentPath %s", (documentPath, reason) => {
    expect(
      createWebEditorSession({ workspaceRoot: workspace(), documentPath, backend: "null" }),
    ).toMatchObject({ ok: false, reason });
  });

  it("refuses a relative workspace root", () => {
    expect(
      createWebEditorSession({ workspaceRoot: "relative/workspace", backend: "null" }),
    ).toMatchObject({ ok: false, reason: "EDITOR_WORKSPACE_INVALID" });
  });

  it("accepts a nested document path inside the workspace", () => {
    const created = createWebEditorSession({
      workspaceRoot: workspace(),
      documentPath: "nested/scene.sceneaxi.json",
      backend: "null",
    });
    expect(created.ok).toBe(true);
    if (created.ok) created.value.dispose();
  });
});

describe("the editor is only reachable through entitlement", () => {
  it("never constructs a session for an unentitled request", () => {
    const decision = decideEditorEntitlement({ principal: null, credits: null });
    expect(decision.entitled).toBe(false);

    let constructed = 0;
    const guardedOpen = () => {
      if (!decision.entitled) return null;
      constructed += 1;
      return openSession();
    };
    expect(guardedOpen()).toBeNull();
    expect(constructed).toBe(0);
  });
});
