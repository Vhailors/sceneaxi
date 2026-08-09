/**
 * The one rendering of safe rarity provenance, shared by every surface required
 * to display matching evidence.
 *
 * This module is its own package entry point (`@sceneaxi/authoring-core/rarity-evidence`)
 * and imports nothing at all. Both are load-bearing. The packaged Linux renderer
 * is bundled for the browser, so reaching this function through the root barrel
 * would drag `node:fs`, `node:crypto`, `node:path`, and `node:child_process` into
 * a bundle that cannot resolve them. And because the Engine Desktop chrome embeds
 * this exact function into its emitted browser script with `String()` — the way it
 * already embeds the web staging decision — a single module binding here would
 * emit a reference the browser cannot resolve.
 *
 * It validates the value it is handed and answers `null` rather than printing a
 * partially-known descriptor.
 */
export function formatSafeRarityEvidence(
  evidence: unknown,
  productSession?: unknown,
): string | null {
  const record = evidence as Record<string, unknown> | null | undefined;
  const provider = record === null || record === undefined
    ? undefined
    : (record["providerEvidence"] as Record<string, unknown> | undefined);
  const model = provider === null || provider === undefined
    ? undefined
    : (provider["model"] as Record<string, unknown> | undefined);
  const strings = [
    "eventId", "tier", "candidateId", "scope", "algorithmId", "policyDigest",
    "requestDigest", "outcomeDigest", "provenanceDigest", "namespaceDigest",
    "tierRollDigest", "candidateRollDigest",
  ];
  const numericFields = [
    "projectSeed",
    "tierDraw",
    "tierTotalWeight",
    "candidateDraw",
    "candidateTotalWeight",
  ];
  if (
    record === null || record === undefined || typeof record !== "object" || Array.isArray(record) ||
    !strings.every((field) => typeof record[field] === "string" && record[field].length > 0) ||
    !numericFields.every(
      (field) => typeof record[field] === "number" && Number.isSafeInteger(record[field]),
    ) ||
    Number(record["tierDraw"]) < 0 ||
    Number(record["tierTotalWeight"]) <= 0 ||
    Number(record["tierDraw"]) >= Number(record["tierTotalWeight"]) ||
    Number(record["candidateDraw"]) < 0 ||
    Number(record["candidateTotalWeight"]) <= 0 ||
    Number(record["candidateDraw"]) >= Number(record["candidateTotalWeight"]) ||
    provider === null || provider === undefined || typeof provider !== "object" ||
    Array.isArray(provider) ||
    provider["schemaVersion"] !== 1 ||
    provider["kind"] !== "sceneaxi.model-provider-call-evidence" ||
    provider["operation"] !== "tool-call" ||
    typeof provider["profile"] !== "string" ||
    !/^@sceneaxi\/profile-[a-z][a-z0-9-]*$/.test(provider["profile"]) ||
    model === null || model === undefined || typeof model !== "object" || Array.isArray(model) ||
    !["provider", "model", "quantization", "version"].every(
      (field) => typeof model[field] === "string" && model[field].length > 0,
    )
  ) {
    return null;
  }
  const lines = [
    "RARITY " + String(record["tier"]) + " · " + String(record["candidateId"]),
    "event " + String(record["eventId"]) + " · scope " + String(record["scope"]) +
      " · seed " + String(record["projectSeed"]),
    "algorithm " + String(record["algorithmId"]),
    "policy " + String(record["policyDigest"]),
    "request " + String(record["requestDigest"]),
    "outcome " + String(record["outcomeDigest"]),
    "provenance " + String(record["provenanceDigest"]),
    "namespace " + String(record["namespaceDigest"]),
    "tier draw " + String(record["tierDraw"]) + " / " + String(record["tierTotalWeight"]),
    "candidate draw " + String(record["candidateDraw"]) + " / " +
      String(record["candidateTotalWeight"]),
    "tier roll " + String(record["tierRollDigest"]),
    "candidate roll " + String(record["candidateRollDigest"]),
    "provider " + String(model["provider"]) + " · model " + String(model["model"]) +
      " · quantization " + String(model["quantization"]) +
      " · version " + String(model["version"]) +
      " · operation " + String(provider["operation"]) +
      " · profile " + String(provider["profile"]),
  ];
  if (productSession !== undefined) {
    const session = productSession as Record<string, unknown> | null;
    const replayDigest = session !== null && typeof session === "object" && !Array.isArray(session)
      ? session["replayDigest"]
      : undefined;
    lines.push(
      "verified in a separate product session" +
        (typeof replayDigest === "string" && /^sha256:[0-9a-f]{64}$/.test(replayDigest)
          ? " replayed to " + replayDigest
          : ""),
    );
  }
  return lines.join("\n");
}
