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
import {
  validateObjectSculptSpec,
  validateSculptIntake,
  type ObjectSculptSpec,
} from "../../packages/schemas/src/index.ts";

const REPO_ROOT = fileURLToPath(new URL("../..", import.meta.url));
const GOLDEN_PATH = "tests/e2e/fixtures/sculpt-quality/golden-digests.json";
const MINIMAL_SUPPORT_EVIDENCE_PATH =
  "tests/e2e/fixtures/sculpt-quality/minimal-support-evidence.json";
const DEMOS = [
  {
    id: "service-crate",
    category: "hard-surface-prop",
    path: "tests/e2e/fixtures/sculpt-quality/hard-surface-service-crate.intake.json",
    seed: 8001,
  },
  {
    id: "field-drone",
    category: "richer-object",
    path: "tests/e2e/fixtures/sculpt-quality/richer-field-drone.intake.json",
    seed: 8002,
  },
] as const;

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
      `Sculpt quality golden step "${name}" failed: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
}

function structuredSpec(path: string): ObjectSculptSpec {
  const intake = validateSculptIntake(readJson(path));
  if (!intake.ok || intake.value.mode !== "structured-spec") {
    throw new Error(`Demo fixture "${path}" is not a valid structured-spec intake.`);
  }
  return intake.value.structuredSpec;
}

describe("sculpt-quality v1 golden demos", () => {
  it("opens both multi-pass demos through Mount, kernel, and existing Minimum E2 with stable digests", () => {
    const projectRoot = mkdtempSync(join(tmpdir(), "sceneaxi-sculpt-quality-"));
    try {
      const demos = DEMOS.map((demo) => namedStep(demo.id, () => {
        const intake = readJson(demo.path);
        const spec = structuredSpec(demo.path);
        const reconstruction = reconstructSculpt(intake, { seed: demo.seed });
        expect(reconstruction.ok).toBe(true);
        if (!reconstruction.ok) throw new Error(reconstruction.message);

        const mounts = createSculptMountApi(
          createExperimentalThreeSculptPresentationBackend(),
        );
        mounts.mount({ instanceId: demo.id, artifact: reconstruction.artifact });
        const frame = mounts.render();
        expect(frame.drawCalls).toBe(spec.components.length);
        mounts.dispose();

        const kernel = openSculptKernelSession(reconstruction.artifact, {
          seed: demo.seed,
        });
        const initial = kernel.observe();
        for (let tick = 1; tick <= 8; tick += 1) {
          kernel.advance({ tick, deltaMs: 100 });
        }
        const terminal = kernel.observe();
        const save = kernel.save();
        const replay = replaySculptKernelSession(save).observe();
        expect(replay.digest).toBe(terminal.digest);
        expect(terminal.digest).not.toBe(initial.digest);

        const documentPath = `${demo.id}.sceneaxi.json`;
        const written = writeDocumentFile(
          documentPath,
          createDocument({
            id: `${demo.id}-quality-demo`,
            data: { title: `${demo.category} sculpt-quality demo` },
          }),
          { cwd: projectRoot },
        );
        expect(written.ok).toBe(true);
        const editor = createMinimumE2Editor({
          cwd: projectRoot,
          documentPath,
          backend: "experimental-three",
          seed: demo.seed,
        });
        editor.addSculpt({ instanceId: demo.id, artifact: reconstruction.artifact });
        editor.select(demo.id);
        editor.play();
        editor.tick(100);
        editor.pause();
        editor.step(100);
        const snapshot = editor.snapshot();
        const preview = editor.viewport();
        const saved = editor.save();
        expect(saved.ok).toBe(true);
        if (!saved.ok) throw new Error(saved.diagnostics[0]?.message ?? "demo save refused");
        editor.dispose();

        const restored = createMinimumE2Editor({
          cwd: projectRoot,
          documentPath,
          backend: "null",
          seed: demo.seed,
        });
        const loaded = restored.load();
        expect(loaded).toMatchObject({ ok: true, instanceIds: [demo.id] });
        const restoredIds = loaded.ok ? loaded.instanceIds : [];
        restored.dispose();

        const inventory = spec.detailInventory;
        if (spec.complexityClass !== "non-trivial" || inventory === undefined) {
          throw new Error(`Demo "${demo.id}" lost its non-trivial detail inventory.`);
        }
        return {
          id: demo.id,
          category: demo.category,
          intakePath: demo.path,
          seed: demo.seed,
          passes: spec.passes.map((pass) => pass.id),
          inventory: {
            silhouette: inventory.silhouetteFeatures.length,
            structural: inventory.structuralFeatures.length,
            surface: inventory.surfaceFeatures.length,
            materials: inventory.materialIds.length,
            sockets: inventory.socketIds.length,
          },
          artifactDigest: reconstruction.artifactDigest,
          emitDigest: reconstruction.artifact.proceduralModule.emitDigest,
          mount: {
            drawCalls: frame.drawCalls,
            frameDigest: digest(JSON.stringify(frame)),
          },
          kernel: {
            initialDigest: initial.digest,
            terminalDigest: terminal.digest,
            replayDigest: replay.digest,
            collisionCount: terminal.collisionCount,
            saveDigest: digest(JSON.stringify(save)),
          },
          editor: {
            treeSize: snapshot.sceneTree.length,
            previewDrawCalls: preview.drawCalls,
            componentCount: snapshot.inspector?.componentCount,
            socketCount: snapshot.inspector?.socketCount,
            restoredIds,
            documentDigest: digest(
              readFileSync(join(projectRoot, documentPath), "utf8"),
            ),
          },
        };
      }));

      const hardSurfaceSpec = structuredSpec(DEMOS[0].path);
      const missingPass = validateObjectSculptSpec({
        ...hardSurfaceSpec,
        passes: hardSurfaceSpec.passes.filter((pass) => pass.id !== "materials"),
      });
      const shallowInventory = validateObjectSculptSpec({
        ...hardSurfaceSpec,
        detailInventory: {
          ...hardSurfaceSpec.detailInventory,
          silhouetteFeatures: ["case"],
        },
      });
      expect(missingPass.ok).toBe(false);
      expect(shallowInventory.ok).toBe(false);

      const actual = {
        schemaVersion: 1,
        kind: "sceneaxi.sculpt-quality-golden-evidence",
        status: "passed",
        demos,
        refusals: {
          missingPass: missingPass.ok
            ? "unexpected-success"
            : missingPass.diagnostics[0]?.code,
          shallowInventory: shallowInventory.ok
            ? "unexpected-success"
            : shallowInventory.diagnostics[0]?.code,
        },
        claims: {
          stage1Run: false,
          minimumE2Expanded: false,
          visionScoreHardGate: false,
          productionSpend: false,
        },
      };

      expect(actual).toEqual(readJson(GOLDEN_PATH));
      expect({
        schemaVersion: 1,
        kind: "sceneaxi.sculpt-quality-minimal-support-evidence",
        issue: 81,
        decision: "not-needed",
        proofTest: "tests/e2e/sculpt-quality-golden.test.ts",
        demoIds: demos.map((demo) => demo.id),
        existingPath: [
          "reconstructSculpt",
          "createSculptMountApi",
          "openSculptKernelSession",
          "createMinimumE2Editor",
        ],
        minimumE2ChecklistExpanded: false,
        engineAdapterAdded: false,
        physicsSuiteExpanded: false,
        stage1Run: false,
      }).toEqual(readJson(MINIMAL_SUPPORT_EVIDENCE_PATH));
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });
});
