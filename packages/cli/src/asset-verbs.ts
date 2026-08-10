/** Offline contained GLB/glTF ingestion over the shared importer + E1 proposal. */
import { resolve } from "node:path";
import { writeProposalFile } from "@sceneaxi/authoring-core";
import { proposeContainedGltfAssetImport } from "@sceneaxi/importers";
import { failure, success, type CliOutcome, type ResultPayload } from "./envelope.js";
import { parseVerbArgs, requireFlag } from "./verb-args.js";
import { refuseUnknownArgs } from "./verb-support.js";

const IMPORT_FLAGS = new Set(["--source", "--document", "--cwd", "--asset-id", "--out"]);

export function runAssetImport(path: readonly string[], tokens: readonly string[]): CliOutcome {
  const args = parseVerbArgs(tokens);
  const unknown = refuseUnknownArgs(args, IMPORT_FLAGS, path);
  if (unknown) return unknown;
  const source = requireFlag(args, "--source");
  const document = requireFlag(args, "--document");
  if (!source.ok) {
    return failure("VALIDATION", source.message, {
      path,
      help: ["Usage: sceneaxi asset import --source <asset.glb|asset.gltf> --document <scene.json> [--cwd <project>] [--asset-id <slug>] [--out <proposal.json>]"],
    });
  }
  if (!document.ok) {
    return failure("VALIDATION", document.message, { path });
  }
  const projectRoot = resolve(args.flags.get("--cwd") ?? process.cwd());
  const assetId = args.flags.get("--asset-id");
  const result = proposeContainedGltfAssetImport({
    projectRoot,
    documentPath: document.value,
    sourcePath: resolve(projectRoot, source.value),
    ...(assetId === undefined ? {} : { assetId }),
  });
  if (!result.ok) return failure("VALIDATION", `${result.reason}: ${result.message}`, { path });
  const out = args.flags.get("--out");
  if (!result.replayed && out !== undefined && result.proposal !== null) {
    writeProposalFile(resolve(projectRoot, out), result.proposal);
  }
  return success(Object.freeze({
    status: result.replayed ? "asset-import-replayed" : "asset-import-proposed",
    copyPolicy: result.entry.copyPolicy,
    entry: result.entry as unknown as Record<string, unknown>,
    unifiedDiff: result.unifiedDiff,
    ...(result.proposal === null ? {} : { proposal: result.proposal as unknown as Record<string, unknown> }),
    ...(out === undefined ? {} : { proposalPath: out }),
  }), [
    result.replayed
      ? "Canonical project bytes already accepted; project apply/reopen verifies their copy"
      : "Review the E1 proposal, then use project apply to accept it atomically",
  ]);
}

export function assetImportHelp(): ResultPayload {
  return Object.freeze({
    command: "asset import",
    description: "Stage one contained glTF 2.0 .glb or embedded .gltf copy through E1 Change Review",
    flags: Object.freeze({
      "--source": "Local GLB/glTF file (required)",
      "--document": "Project-relative Scene Document (required)",
      "--cwd": "Selected project root (defaults to current directory)",
      "--asset-id": "Optional lowercase project identity",
      "--out": "Write the E1 proposal artifact",
    }),
  });
}
