/** Offline first-class asset ingestion over the shared manifest + E1 proposal. */
import { resolve } from "node:path";
import { writeProposalFile } from "@sceneaxi/authoring-core";
import { proposeProjectAssetImport } from "@sceneaxi/importers";
import { failure, success, type CliOutcome, type ResultPayload } from "./envelope.js";
import { parseVerbArgs, requireFlag } from "./verb-args.js";
import { refuseUnknownArgs } from "./verb-support.js";

const IMPORT_FLAGS = new Set(["--source", "--document", "--cwd", "--asset-id", "--out"]);

export function runAssetImport(path: readonly string[], tokens: readonly string[]): CliOutcome {
  return runAssetProposal(path, tokens, false);
}

export function runAssetHotReload(path: readonly string[], tokens: readonly string[]): CliOutcome {
  return runAssetProposal(path, tokens, true);
}

function runAssetProposal(path: readonly string[], tokens: readonly string[], hotReload: boolean): CliOutcome {
  const args = parseVerbArgs(tokens);
  const unknown = refuseUnknownArgs(args, IMPORT_FLAGS, path);
  if (unknown) return unknown;
  const source = requireFlag(args, "--source");
  const document = requireFlag(args, "--document");
  if (!source.ok) {
    return failure("VALIDATION", source.message, {
      path,
      help: [`Usage: sceneaxi asset ${hotReload ? "reload" : "import"} --source <asset> --document <scene.json> [--cwd <project>] ${hotReload ? "--asset-id <slug>" : "[--asset-id <slug>]"} [--out <proposal.json>]`],
    });
  }
  if (!document.ok) {
    return failure("VALIDATION", document.message, { path });
  }
  const projectRoot = resolve(args.flags.get("--cwd") ?? process.cwd());
  const assetId = args.flags.get("--asset-id");
  if (hotReload && assetId === undefined) {
    return failure("VALIDATION", "asset reload requires --asset-id so ambient source paths never become identity.", { path });
  }
  const result = proposeProjectAssetImport({
    projectRoot,
    documentPath: document.value,
    sourcePath: resolve(projectRoot, source.value),
    ...(assetId === undefined ? {} : { assetId }),
    ...(hotReload ? { hotReload: true } : {}),
  });
  if (!result.ok) return failure("VALIDATION", `${result.reason}: ${result.message}`, { path });
  const out = args.flags.get("--out");
  if (!result.replayed && out !== undefined && result.proposal !== null) {
    writeProposalFile(resolve(projectRoot, out), result.proposal);
  }
  return success(Object.freeze({
    status: result.replayed ? "asset-import-replayed" : hotReload ? "asset-hot-reload-proposed" : "asset-import-proposed",
    copyPolicy: result.entry.copyPolicy,
    entry: result.entry as unknown as Record<string, unknown>,
    unifiedDiff: result.unifiedDiff,
    ...(result.proposal === null ? {} : { proposal: result.proposal as unknown as Record<string, unknown> }),
    ...(out === undefined ? {} : { proposalPath: out }),
  }), [
    result.replayed
      ? "Canonical project bytes already accepted; project apply/reopen verifies their copy"
      : hotReload
        ? "Review the digest replacement; saved document and project-copy bytes remain untouched until project apply"
        : "Review the E1 proposal, then use project apply to accept it atomically",
  ]);
}

export function assetImportHelp(): ResultPayload {
  return Object.freeze({
    command: "asset import",
    description: "Stage one validated SceneAxi, model, image, audio, font, or animation-data copy through E1 Change Review",
    flags: Object.freeze({
      "--source": "Local supported asset file (required)",
      "--document": "Project-relative Scene Document (required)",
      "--cwd": "Selected project root (defaults to current directory)",
      "--asset-id": "Optional lowercase project identity",
      "--out": "Write the E1 proposal artifact",
    }),
  });
}

export function assetHotReloadHelp(): ResultPayload {
  return Object.freeze({
    command: "asset reload",
    description: "Detect changed source bytes for one stable asset identity and stage a reviewable replacement",
    flags: Object.freeze({
      "--source": "Changed local supported asset file (required)",
      "--document": "Project-relative Scene Document (required)",
      "--cwd": "Selected project root (defaults to current directory)",
      "--asset-id": "Existing stable project asset identity (required)",
      "--out": "Write the E1 proposal artifact",
    }),
  });
}
