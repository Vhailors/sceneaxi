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
  const evidenceFields = [
    "eventId", "tier", "candidateId", "scope", "algorithmId", "policyDigest",
    "requestDigest", "outcomeDigest", "provenanceDigest", "namespaceDigest",
    "tierRollDigest", "candidateRollDigest", "providerEvidenceDigest",
    "projectSeed", "tierDraw", "tierTotalWeight", "candidateDraw",
    "candidateTotalWeight", "providerEvidence",
  ];
  const providerFields = ["schemaVersion", "kind", "operation", "profile", "model"];
  const modelFields = ["provider", "model", "quantization", "version"];
  const identifier = (value: unknown) =>
    typeof value === "string" && value.length >= 1 && value.length <= 128 &&
    /[a-z0-9]/.test(value[0] || "") &&
    [...value].every((character) => /[a-z0-9._:-]/.test(character));
  const digest = (value: unknown) =>
    typeof value === "string" && value.length === 71 && value.startsWith("sha256:") &&
    [...value.slice(7)].every((character) => /[0-9a-f]/.test(character));
  const providerDescriptor = (value: unknown) =>
    typeof value === "string" && value.length <= 128 &&
    [...value].every((character) => /[a-z0-9._:/+-]/.test(character)) &&
    /[a-z0-9]/.test(value[0] || "") &&
    !value.split(/[._:/+-]/).some((segment) =>
      ["sk", "key", "token", "secret", "credential", "password"].includes(segment)
    );
  const numericFields = [
    "projectSeed",
    "tierDraw",
    "tierTotalWeight",
    "candidateDraw",
    "candidateTotalWeight",
  ];
  if (
    record === null || record === undefined || typeof record !== "object" || Array.isArray(record) ||
    Object.keys(record).length !== evidenceFields.length ||
    !evidenceFields.every((field) => Object.prototype.hasOwnProperty.call(record, field)) ||
    !["eventId", "candidateId", "scope"].every(
      (field) => identifier(record[field]),
    ) ||
    !["common", "uncommon", "rare", "epic", "legendary"].includes(String(record["tier"])) ||
    record["algorithmId"] !== "sceneaxi.rarity.weighted-sha256-v1" ||
    ![
      "policyDigest", "requestDigest", "outcomeDigest", "provenanceDigest",
      "namespaceDigest", "tierRollDigest", "candidateRollDigest",
      "providerEvidenceDigest",
    ].every((field) => digest(record[field])) ||
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
    Object.keys(provider).length !== providerFields.length ||
    !providerFields.every((field) => Object.prototype.hasOwnProperty.call(provider, field)) ||
    provider["schemaVersion"] !== 1 ||
    provider["kind"] !== "sceneaxi.model-provider-call-evidence" ||
    provider["operation"] !== "tool-call" ||
    (provider["profile"] !== "@sceneaxi/profile-game" &&
      provider["profile"] !== "@sceneaxi/profile-web") ||
    model === null || model === undefined || typeof model !== "object" || Array.isArray(model) ||
    Object.keys(model).length !== modelFields.length ||
    !modelFields.every((field) => Object.prototype.hasOwnProperty.call(model, field)) ||
    !modelFields.every((field) => providerDescriptor(model[field]))
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
    "provider evidence " + String(record["providerEvidenceDigest"]),
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
    const bootstrap = session !== null && typeof session === "object" && !Array.isArray(session)
      ? session["bootstrap"] as Record<string, unknown> | null | undefined
      : undefined;
    const ticks = session !== null && typeof session === "object" && !Array.isArray(session)
      ? session["tickDigests"]
      : undefined;
    const sessionFields = ["bootstrap", "initialDigest", "tickDigests", "replayDigest"];
    const bootstrapFields = [
      "kind", "subjectId", "sessionId", "openedAtMs", "resumed", "kernelVersion", "bomVersion",
    ];
    if (
      session === null || typeof session !== "object" || Array.isArray(session) ||
      Object.keys(session).length !== sessionFields.length ||
      !sessionFields.every((field) => Object.prototype.hasOwnProperty.call(session, field)) ||
      bootstrap === null || bootstrap === undefined || typeof bootstrap !== "object" ||
      Array.isArray(bootstrap) ||
      Object.keys(bootstrap).length !== bootstrapFields.length ||
      !bootstrapFields.every((field) => Object.prototype.hasOwnProperty.call(bootstrap, field)) ||
      bootstrap["kind"] !== "product" ||
      typeof bootstrap["subjectId"] !== "string" ||
      !identifier(bootstrap["subjectId"]) ||
      !digest(bootstrap["sessionId"]) ||
      typeof bootstrap["openedAtMs"] !== "number" || !Number.isSafeInteger(bootstrap["openedAtMs"]) ||
      bootstrap["resumed"] !== false ||
      typeof bootstrap["kernelVersion"] !== "string" || bootstrap["kernelVersion"].length === 0 ||
      typeof bootstrap["bomVersion"] !== "string" || bootstrap["bomVersion"].length === 0 ||
      !digest(session["initialDigest"]) ||
      !Array.isArray(ticks) || ticks.length === 0 ||
      !ticks.every((value) => digest(value)) ||
      !digest(session["replayDigest"]) ||
      ticks[ticks.length - 1] !== session["replayDigest"]
    ) {
      return null;
    }
    lines.push(
      "verified in a separate product session " + String(bootstrap["subjectId"]) +
        " · session " + String(bootstrap["sessionId"]) +
        " · initial " + String(session["initialDigest"]) +
        " · ticks " + String(ticks.length) +
        " · replayed to " + String(session["replayDigest"]),
    );
  }
  return lines.join("\n");
}
