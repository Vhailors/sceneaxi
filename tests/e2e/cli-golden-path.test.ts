import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseDocumentText,
} from "../../packages/authoring-core/src/index.ts";
import { ExitCode, runCli } from "../../packages/cli/src/index.ts";
import {
  createNullPresentationRuntime,
} from "../../packages/engine-presentation/src/index.ts";
import { openPluginHost } from "../../packages/plugin-host/src/index.ts";
import { conformance as gameProfile } from "@sceneaxi/profile-game";
import { describe, expect, it } from "vitest";
import {
  GOLDEN_PROJECT_DOCUMENT_INPUT,
  productManifestFrom,
} from "./fixtures/golden-project.ts";

const REPO_ROOT = fileURLToPath(new URL("../..", import.meta.url));
const EVIDENCE_RELATIVE_PATH =
  ".sceneaxi/evidence/issue-51-cli-golden-path.json";
const EVIDENCE_PATH = join(REPO_ROOT, EVIDENCE_RELATIVE_PATH);
const DOCUMENT_PATH = "project.sceneaxi.json";
const PROPOSAL_PATH = "hero-move.proposal.json";
const SAMPLE_PLUGIN_ID = "dev.sceneaxi.sample.inert";
const ILLEGAL_PLUGIN_ID = "dev.sceneaxi.sample.illegal-claim";
const ILLEGAL_CAPABILITY_ID =
  "test.sceneaxi.fixture.capability.issue-53-never-registered";
const SAMPLE_PLUGIN_PATH = join(
  REPO_ROOT,
  "tests/e2e/fixtures/plugin-host/sample-inert",
);
const ILLEGAL_PLUGIN_PATH = join(
  REPO_ROOT,
  "tests/e2e/fixtures/plugin-host/illegal-claim",
);

const STEP_NAMES = Object.freeze([
  "profile-game-development-consumer",
  "create-open-project-fixture",
  "cli-project-propose",
  "cli-project-apply",
  "kernel-open",
  "kernel-dispatch-advance",
  "kernel-observe",
  "presentation-null-frame",
  "plugin-host-load-sample",
  "plugin-host-refuse-illegal-capability-claim",
  "kernel-save-replay",
  "held-key-refuse-currency-unavailable",
  "emit-stable-evidence",
]);

function namedStep<T>(name: (typeof STEP_NAMES)[number], action: () => T) {
  try {
    return action();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Golden path step '${name}' failed: ${message}`, {
      cause: error,
    });
  }
}

async function namedAsyncStep<T>(
  name: (typeof STEP_NAMES)[number],
  action: () => Promise<T>,
) {
  try {
    return await action();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Golden path step '${name}' failed: ${message}`, {
      cause: error,
    });
  }
}

describe("MVP golden path", () => {
  it("runs Game profile -> authoring -> kernel/presentation -> plugin load/refuse -> save/replay -> held-key refusal -> evidence", async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), "sceneaxi-cli-golden-"));
    rmSync(EVIDENCE_PATH, { force: true });

    try {
      namedStep("profile-game-development-consumer", () => {
        expect(gameProfile.seam.name).toBe("@sceneaxi/profile-game");
        expect(gameProfile.claim.claimStatus).toBe("development-consumer");
        expect(gameProfile.claim.corePin).toBe(gameProfile.seam.corePin);
        expect(gameProfile.claim.shippingClaim).toBe(false);
      });

      namedStep("create-open-project-fixture", () => {
        const document = gameProfile.core.authoring.createDocument(
          GOLDEN_PROJECT_DOCUMENT_INPUT,
        );
        const written = gameProfile.core.authoring.writeDocumentFile(
          DOCUMENT_PATH,
          document,
          { cwd: projectRoot },
        );
        expect(written.ok).toBe(true);

        const opened = parseDocumentText(
          readFileSync(join(projectRoot, DOCUMENT_PATH), "utf8"),
        );
        expect(opened.ok).toBe(true);
      });

      const proposed = namedStep("cli-project-propose", () => {
        const result = runCli([
          "project",
          "propose",
          "--cwd",
          projectRoot,
          "--document",
          DOCUMENT_PATH,
          "--pointer",
          "/data/productManifest/entities/0/x",
          "--value",
          "2",
          "--out",
          PROPOSAL_PATH,
          "--json",
        ]);
        expect(result.exitCode).toBe(ExitCode.OK);
        expect(result.envelope.ok).toBe(true);
        if (!result.envelope.ok) {
          throw new Error(result.envelope.error.message);
        }
        expect(result.envelope.result["status"]).toBe("proposed");
        expect(result.envelope.result["proposalPath"]).toBe(PROPOSAL_PATH);
        return result;
      });

      const applied = namedStep("cli-project-apply", () => {
        const result = runCli([
          "project",
          "apply",
          "--cwd",
          projectRoot,
          "--proposal",
          PROPOSAL_PATH,
          "--json",
        ]);
        expect(result.exitCode).toBe(ExitCode.OK);
        expect(result.envelope.ok).toBe(true);
        if (!result.envelope.ok) {
          throw new Error(result.envelope.error.message);
        }
        expect(result.envelope.result["status"]).toBe("applied");
        expect(result.envelope.result["appliedPaths"]).toEqual([DOCUMENT_PATH]);
        return result;
      });

      const host = { nowMs: () => 1_753_334_400_000 };
      const session = namedStep("kernel-open", () => {
        const parsed = parseDocumentText(
          readFileSync(join(projectRoot, DOCUMENT_PATH), "utf8"),
        );
        if (!parsed.ok) throw new Error(parsed.message);
        const manifest = productManifestFrom(
          parsed.document.data["productManifest"],
        );
        expect(manifest.entities?.[0]?.x).toBe(2);
        return gameProfile.core.kernel.open(manifest, host);
      });

      const initialSnapshot = session.observe();

      namedStep("kernel-dispatch-advance", () => {
        session.dispatch({ type: "move", actor: "hero", axis: [3, -1] });
        session.advance({ tick: 1, deltaMs: 16 });
      });

      const terminalSnapshot = namedStep("kernel-observe", () => {
        const snapshot = session.observe();
        expect(snapshot.tick).toBe(1);
        expect(snapshot.entities).toEqual([{ id: "hero", x: 5, y: 0 }]);
        return snapshot;
      });

      namedStep("presentation-null-frame", () => {
        const presenter = createNullPresentationRuntime();
        presenter.mount();
        presenter.present(terminalSnapshot, [], 0);
        expect(presenter.capture()).toBeNull();
        presenter.dispose();
      });

      const loadedPlugin = await namedAsyncStep(
        "plugin-host-load-sample",
        async () => {
          const pluginHost = openPluginHost();
          const result = await pluginHost.load([SAMPLE_PLUGIN_PATH]);
          expect(result.refused).toEqual([]);
          expect(result.loaded).toHaveLength(1);
          expect(pluginHost.list()).toEqual(result);

          const loaded = result.loaded[0];
          if (loaded === undefined) {
            throw new Error("sample plugin did not appear in the loaded list");
          }
          expect(loaded).toMatchObject({
            pluginId: SAMPLE_PLUGIN_ID,
            capabilities: [],
          });
          return loaded;
        },
      );

      const illegalClaimRefusal = await namedAsyncStep(
        "plugin-host-refuse-illegal-capability-claim",
        async () => {
          const pluginHost = openPluginHost();
          const result = await pluginHost.load([ILLEGAL_PLUGIN_PATH]);
          expect(result.loaded).toEqual([]);
          expect(result.refused).toHaveLength(1);
          expect(pluginHost.list()).toEqual(result);

          const refusal = result.refused[0];
          if (refusal === undefined) {
            throw new Error("illegal capability claim was not refused");
          }
          expect(refusal).toMatchObject({
            pluginId: ILLEGAL_PLUGIN_ID,
            capabilityId: ILLEGAL_CAPABILITY_ID,
            reason: "unknown-capability",
            phase: "descriptor",
            entrypointEvaluated: false,
          });
          expect(
            pluginHost.getImplementation(
              ILLEGAL_PLUGIN_ID,
              ILLEGAL_CAPABILITY_ID,
            ),
          ).toMatchObject({ ok: false, reason: "plugin-not-loaded" });
          return refusal;
        },
      );

      const saved = namedStep("kernel-save-replay", () => {
        const artifact = session.save();
        const replayed = gameProfile.core.kernel
          .replay(artifact, host)
          .observe();
        expect(replayed).toEqual(terminalSnapshot);
        expect(replayed.digest).toBe(artifact.terminalDigest);
        return { artifact, replayed };
      });

      const heldKeyRefusal = namedStep(
        "held-key-refuse-currency-unavailable",
        () => {
          const result = runCli(["demo", "gated", "--json"]);
          expect(result.exitCode).toBe(ExitCode.HELD_KEY);
          expect(result.envelope.ok).toBe(false);
          if (result.envelope.ok) {
            throw new Error("gated command unexpectedly ran");
          }
          expect(result.envelope.error.code).toBe("HELD_KEY");
          expect(result.envelope.error.heldKeyReason).toBe(
            "currency-unavailable",
          );
          return result;
        },
      );

      namedStep("emit-stable-evidence", () => {
        if (
          !proposed.envelope.ok ||
          !applied.envelope.ok ||
          heldKeyRefusal.envelope.ok
        ) {
          throw new Error("validated CLI outcomes changed before evidence emit");
        }

        const evidence = {
          schemaVersion: 1,
          kind: "sceneaxi.mvp-golden-path-evidence",
          artifactPath: EVIDENCE_RELATIVE_PATH,
          command: "pnpm test:golden",
          status: "passed",
          steps: STEP_NAMES.map((name) => ({ name, status: "passed" })),
          project: {
            documentPath: DOCUMENT_PATH,
            proposalPath: PROPOSAL_PATH,
            proposedStatus: proposed.envelope.result["status"],
            appliedStatus: applied.envelope.result["status"],
          },
          profile: {
            name: gameProfile.seam.name,
            claimStatus: gameProfile.claim.claimStatus,
            corePin: gameProfile.claim.corePin,
            shippingClaim: gameProfile.claim.shippingClaim,
          },
          kernel: {
            initialDigest: initialSnapshot.digest,
            terminalSnapshot,
            save: {
              schemaVersion: saved.artifact.schemaVersion,
              kernelVersion: saved.artifact.kernelVersion,
              bomVersion: saved.artifact.bomVersion,
              eventCount: saved.artifact.events.length,
              terminalDigest: saved.artifact.terminalDigest,
            },
            replayDigest: saved.replayed.digest,
            replayMatches: saved.replayed.digest === terminalSnapshot.digest,
          },
          pluginHost: {
            loadedPluginId: loadedPlugin.pluginId,
            capabilities: [...loadedPlugin.capabilities],
            refusal: {
              name: "plugin-host-refuse-illegal-capability-claim",
              pluginId: illegalClaimRefusal.pluginId,
              capabilityId: illegalClaimRefusal.capabilityId,
              reason: illegalClaimRefusal.reason,
              phase: illegalClaimRefusal.phase,
              entrypointEvaluated: illegalClaimRefusal.entrypointEvaluated,
            },
          },
          heldKeyRefusal: {
            name: "held-key-refuse-currency-unavailable",
            command: "sceneaxi demo gated --json",
            exitCode: heldKeyRefusal.exitCode,
            code: heldKeyRefusal.envelope.error.code,
            reason: heldKeyRefusal.envelope.error.heldKeyReason,
          },
        };

        mkdirSync(dirname(EVIDENCE_PATH), { recursive: true });
        writeFileSync(EVIDENCE_PATH, `${JSON.stringify(evidence, null, 2)}\n`);
        expect(
          JSON.parse(readFileSync(EVIDENCE_PATH, "utf8")) as unknown,
        ).toEqual(evidence);
      });
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });
});
