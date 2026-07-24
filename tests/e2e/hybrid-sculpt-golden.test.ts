import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  createDocument,
  createMinimumE2Editor,
  reconstructSculpt,
  writeDocumentFile,
} from "../../packages/authoring-core/src/index.ts";
import {
  openSculptKernelSession,
  replaySculptKernelSession,
} from "../../packages/engine-kernel/src/index.ts";
import {
  createExperimentalThreeSculptPresentationBackend,
  createSculptMountApi,
} from "../../packages/engine-presentation/src/index.ts";

const REPO_ROOT = fileURLToPath(new URL("../..", import.meta.url));
const FIXTURE_INTAKE = "tests/e2e/fixtures/hybrid-sculpt/structured-spec.intake.json";
const DEMO_INTAKE = "tests/e2e/fixtures/hybrid-sculpt/demo-image-brief.intake.json";
const EVIDENCE_PATH = ".sceneaxi/evidence/issue-73-hybrid-sculpt-golden.json";

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(join(REPO_ROOT, path), "utf8")) as unknown;
}

function digest(value: string) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function namedStep<T>(name: string, action: () => T): T {
  try {
    return action();
  } catch (error) {
    throw new Error(
      `Hybrid sculpt golden step "${name}" failed: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
}

describe("hybrid sculpt + Minimum E2 golden vertical", () => {
  it("reconstructs -> mounts -> animates/collides -> saves/replays -> opens editor/demo with stable evidence", () => {
    const projectRoot = mkdtempSync(join(tmpdir(), "sceneaxi-hybrid-golden-"));
    try {
      const fixture = namedStep("fixture-reconstruction", () => {
        const result = reconstructSculpt(readJson(FIXTURE_INTAKE));
        expect(result.ok).toBe(true);
        if (!result.ok) throw new Error(result.message);
        return result;
      });

      const mountedFrame = namedStep("experimental-mount", () => {
        const mounts = createSculptMountApi(
          createExperimentalThreeSculptPresentationBackend(),
        );
        mounts.mount({ instanceId: "golden-one", artifact: fixture.artifact });
        const frame = mounts.render();
        expect(frame.drawCalls).toBe(2);
        expect(frame.label).toContain("non-decision");
        mounts.dispose();
        return frame;
      });

      const kernel = namedStep("kernel-animation-collision-replay", () => {
        const session = openSculptKernelSession(fixture.artifact, { seed: 73 });
        const initial = session.observe();
        for (let tick = 1; tick <= 12; tick += 1) {
          session.advance({ tick, deltaMs: 100 });
        }
        const terminal = session.observe();
        expect(terminal.sockets.find((socket) => socket.id === "cap-bob")?.value).not.toBe(
          initial.sockets.find((socket) => socket.id === "cap-bob")?.value,
        );
        expect(terminal.collisionCount).toBeGreaterThan(0);
        const save = session.save();
        const replay = replaySculptKernelSession(save).observe();
        expect(replay.digest).toBe(terminal.digest);
        return { initial, terminal, save, replay };
      });

      const editor = namedStep("minimum-e2-save-load", () => {
        const written = writeDocumentFile(
          "hybrid.sceneaxi.json",
          createDocument({ id: "hybrid-golden", data: { title: "Hybrid golden" } }),
          { cwd: projectRoot },
        );
        expect(written.ok).toBe(true);
        const first = createMinimumE2Editor({
          cwd: projectRoot,
          documentPath: "hybrid.sceneaxi.json",
          backend: "experimental-three",
          seed: 73,
        });
        first.addSculpt({ instanceId: "golden-one", artifact: fixture.artifact });
        first.select("golden-one");
        first.play();
        first.tick(100);
        first.pause();
        first.step(100);
        const treeSize = first.snapshot().sceneTree.length;
        const preview = first.viewport();
        const saved = first.save();
        expect(saved.ok).toBe(true);
        if (!saved.ok) throw new Error(saved.diagnostics[0]?.message ?? "editor save refused");
        first.dispose();

        const restored = createMinimumE2Editor({
          cwd: projectRoot,
          documentPath: "hybrid.sceneaxi.json",
          backend: "null",
          seed: 73,
        });
        const loaded = restored.load();
        expect(loaded.ok).toBe(true);
        const restoredIds = loaded.ok ? loaded.instanceIds : [];
        expect(restored.snapshot().selectedInstanceId).toBe("golden-one");
        restored.dispose();
        const documentBytes = readFileSync(join(projectRoot, "hybrid.sceneaxi.json"), "utf8");
        return {
          treeSize,
          preview,
          proposalPointer: saved.proposal.edits[0]?.jsonPointer,
          restoredIds,
          documentDigest: digest(documentBytes),
        };
      });

      const liveDemo = namedStep("live-image-brief-demo", () => {
        const reconstructed = reconstructSculpt(readJson(DEMO_INTAKE));
        expect(reconstructed.ok).toBe(true);
        if (!reconstructed.ok) throw new Error(reconstructed.message);
        const demo = createMinimumE2Editor({
          cwd: projectRoot,
          documentPath: "hybrid.sceneaxi.json",
          backend: "experimental-three",
        });
        demo.addSculpt({ instanceId: "demo-lantern", artifact: reconstructed.artifact });
        demo.select("demo-lantern");
        const preview = demo.viewport();
        const inspector = demo.snapshot().inspector;
        expect(preview.drawCalls).toBeGreaterThan(0);
        expect(inspector?.artifactId).toBe("demo-lantern-artifact");
        demo.dispose();
        return { reconstructed, preview, inspector };
      });

      const refusal = namedStep("named-refusal", () => {
        const result = reconstructSculpt({ mode: "structured-spec" });
        expect(result).toMatchObject({ ok: false, code: "invalid-intake" });
        return result;
      });

      const actualEvidence = {
        schemaVersion: 1,
        kind: "sceneaxi.hybrid-sculpt-golden-evidence",
        artifactPath: EVIDENCE_PATH,
        status: "passed",
        fixture: {
          intakePath: FIXTURE_INTAKE,
          artifactId: fixture.artifact.artifactId,
          artifactDigest: fixture.artifactDigest,
          artifactBytesDigest: digest(fixture.artifactBytes),
        },
        mount: {
          backend: mountedFrame.backend,
          label: mountedFrame.label,
          drawCalls: mountedFrame.drawCalls,
          frameDigest: digest(JSON.stringify(mountedFrame)),
        },
        kernel: {
          seed: kernel.terminal.seed,
          initialDigest: kernel.initial.digest,
          terminalDigest: kernel.terminal.digest,
          socketValue: kernel.terminal.sockets.find((socket) => socket.id === "cap-bob")?.value,
          collisionCount: kernel.terminal.collisionCount,
          replayDigest: kernel.replay.digest,
          saveDigest: digest(JSON.stringify(kernel.save)),
        },
        editor: {
          treeSize: editor.treeSize,
          previewDrawCalls: editor.preview.drawCalls,
          proposalPointer: editor.proposalPointer,
          restoredIds: editor.restoredIds,
          documentDigest: editor.documentDigest,
        },
        liveDemo: {
          intakePath: DEMO_INTAKE,
          artifactId: liveDemo.reconstructed.artifact.artifactId,
          artifactDigest: liveDemo.reconstructed.artifactDigest,
          previewDrawCalls: liveDemo.preview.drawCalls,
          selectedArtifactId: liveDemo.inspector?.artifactId,
        },
        refusal: {
          code: refusal.ok ? "unexpected-success" : refusal.code,
        },
        claims: {
          stage1Run: false,
          rendererWinner: null,
          experimentalThree: "non-decision",
        },
      };

      expect(actualEvidence).toEqual(readJson(EVIDENCE_PATH));
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });
});
