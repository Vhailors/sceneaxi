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
  createDocument,
  parseDocumentText,
  writeDocumentFile,
  type JsonObject,
} from "../../packages/authoring-core/src/index.ts";
import { ExitCode, runCli } from "../../packages/cli/src/index.ts";
import {
  open,
  replay,
  type ProductManifest,
} from "../../packages/engine-kernel/src/index.ts";
import { describe, expect, it } from "vitest";

const REPO_ROOT = fileURLToPath(new URL("../..", import.meta.url));
const EVIDENCE_RELATIVE_PATH =
  ".sceneaxi/evidence/issue-51-cli-golden-path.json";
const EVIDENCE_PATH = join(REPO_ROOT, EVIDENCE_RELATIVE_PATH);
const DOCUMENT_PATH = "project.sceneaxi.json";
const PROPOSAL_PATH = "hero-move.proposal.json";

const STEP_NAMES = Object.freeze([
  "create-open-project-fixture",
  "cli-project-propose",
  "cli-project-apply",
  "kernel-open",
  "kernel-dispatch-advance",
  "kernel-observe",
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

function isJsonObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function productManifestFrom(value: unknown): ProductManifest {
  if (!isJsonObject(value)) {
    throw new Error("applied project is missing data.productManifest");
  }

  const productId = value["productId"];
  const seed = value["seed"];
  const rawEntities = value["entities"];
  if (
    typeof productId !== "string" ||
    typeof seed !== "number" ||
    !Number.isInteger(seed) ||
    !Array.isArray(rawEntities)
  ) {
    throw new Error("applied project has an invalid product manifest");
  }

  const entities: NonNullable<ProductManifest["entities"]>[number][] =
    rawEntities.map((raw, index) => {
      if (!isJsonObject(raw)) {
        throw new Error(
          `product manifest entity ${String(index)} is not an object`,
        );
      }
      const id = raw["id"];
      const x = raw["x"];
      const y = raw["y"];
      if (
        typeof id !== "string" ||
        typeof x !== "number" ||
        !Number.isInteger(x) ||
        typeof y !== "number" ||
        !Number.isInteger(y)
      ) {
        throw new Error(`product manifest entity ${String(index)} is invalid`);
      }
      return { id, x, y };
    });

  return { productId, seed, entities };
}

describe("issue #51 CLI golden path", () => {
  it("runs create/open -> propose/apply -> kernel save/replay -> named held-key refusal -> evidence", () => {
    const projectRoot = mkdtempSync(join(tmpdir(), "sceneaxi-cli-golden-"));
    rmSync(EVIDENCE_PATH, { force: true });

    try {
      namedStep("create-open-project-fixture", () => {
        const document = createDocument({
          id: "golden-project",
          title: "Issue 51 CLI golden path",
          data: {
            productManifest: {
              productId: "golden-game",
              seed: 51,
              entities: [{ id: "hero", x: 0, y: 1 }],
            },
          },
        });
        const written = writeDocumentFile(DOCUMENT_PATH, document, {
          cwd: projectRoot,
        });
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
        return open(manifest, host);
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

      const saved = namedStep("kernel-save-replay", () => {
        const artifact = session.save();
        const replayed = replay(artifact, host).observe();
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
