/** Versioned v1 calling conventions bound to explicit modern project authority. */
import { resolve } from "node:path";
import { validateDocument } from "@sceneaxi/schemas";
import { canonicalPath } from "./atomic-write.js";
import { apply, propose, writeDocumentFile, type ProposeInput, type ApplyInput } from "./propose-apply.js";

export function createAuthoringV1Adapter(authoritativeRoot: string) {
  const cwd = canonicalPath(resolve(authoritativeRoot));

  function writeLegacyDocument(path: string, document: Parameters<typeof validateDocument>[0]): ReturnType<typeof writeDocumentFile> {
    const checked = validateDocument(document);

    if (!checked.ok) {
      return { ok: false, diagnostics: [{ code: checked.code === "schema-major-mismatch" ? "schema-major-mismatch" : "validation-failed",
        message: checked.message, documentPath: path }] };
    }

    return writeDocumentFile(path, checked.document, { cwd });
  }

  function proposeLegacy(input: Omit<ProposeInput, "cwd">) {
    return propose({ ...input, cwd });
  }

  function applyLegacy(proposal: ApplyInput["proposal"]) {
    return apply({ proposal, cwd });
  }

  return Object.freeze({ schemaVersion: 1, writeDocumentFile: writeLegacyDocument, propose: proposeLegacy, apply: applyLegacy });
}
