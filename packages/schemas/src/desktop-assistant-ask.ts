/**
 * Assistant Ask: evidence-bound answers from an explicit inspection scope.
 * Ask never calls a provider and never writes authoring bytes.
 */
import { digestSculptJson } from "./sculpt-json.js";

export const ASSISTANT_ASK_SCHEMA_VERSION = 1 as const;
export const ASSISTANT_ASK_ANSWER_KIND = "sceneaxi.assistant-ask-answer" as const;

export const ASSISTANT_ASK_SCOPES = Object.freeze([
  "document",
  "hierarchy",
  "assets",
  "animation",
  "physics",
  "play",
] as const);

export const ASSISTANT_ASK_REFUSALS = Object.freeze({
  kidsDenied: "ASSISTANT_ASK_KIDS_DENIED",
  scopeUnsupported: "ASSISTANT_ASK_SCOPE_UNSUPPORTED",
  questionUnsupported: "ASSISTANT_ASK_QUESTION_UNSUPPORTED",
  staleVersion: "ASSISTANT_ASK_STALE_VERSION",
  inputUnsupported: "ASSISTANT_ASK_INPUT_UNSUPPORTED",
  fixtureNotCloud: "ASSISTANT_ASK_FIXTURE_NOT_CLOUD",
  capabilityMissing: "ASSISTANT_ASK_CAPABILITY_MISSING",
} as const);

export type AssistantAskRefusal =
  (typeof ASSISTANT_ASK_REFUSALS)[keyof typeof ASSISTANT_ASK_REFUSALS];

export type AssistantAskScope = (typeof ASSISTANT_ASK_SCOPES)[number];

export const ASSISTANT_PROVIDER_CLASSES = Object.freeze([
  "none",
  "fixture",
  "configured",
] as const);

export type AssistantProviderClass = (typeof ASSISTANT_PROVIDER_CLASSES)[number];

export type AssistantAskScopeState = Readonly<{
  instanceIds: readonly string[];
  assetIds: readonly string[];
  clipIds: readonly string[];
  bodyIds: readonly string[];
  playActive: boolean;
}>;

export type AssistantAskAnswer = Readonly<{
  schemaVersion: typeof ASSISTANT_ASK_SCHEMA_VERSION;
  kind: typeof ASSISTANT_ASK_ANSWER_KIND;
  sourceContentHash: string;
  scope: AssistantAskScope;
  savedBytesWritten: false;
  providerClass: "none";
  answer: string;
  evidence: AssistantAskScopeState;
  digest: string;
}>;

type Failure = Readonly<{ ok: false; reason: AssistantAskRefusal; message: string }>;
const fail = (reason: AssistantAskRefusal, message: string): Failure =>
  Object.freeze({ ok: false as const, reason, message });

export function isAssistantAskScope(value: unknown): value is AssistantAskScope {
  return typeof value === "string" &&
    (ASSISTANT_ASK_SCOPES as readonly string[]).includes(value);
}

function normalizePrompt(prompt: string): string {
  return prompt.trim().toLowerCase().replace(/\s+/g, " ");
}

function questionKind(prompt: string): "list" | "count" | "hash" | null {
  const text = normalizePrompt(prompt);
  if (text.length === 0) return null;
  if (/\b(hash|version|digest|content hash)\b/.test(text)) return "hash";
  if (/\b(how many|count|number of)\b/.test(text)) return "count";
  if (/\b(what|which|list|show|inspect|name)\b/.test(text)) return "list";
  return null;
}

function scopeIds(scope: AssistantAskScope, state: AssistantAskScopeState): readonly string[] {
  switch (scope) {
    case "document":
    case "hierarchy":
      return state.instanceIds;
    case "assets":
      return state.assetIds;
    case "animation":
      return state.clipIds;
    case "physics":
      return state.bodyIds;
    case "play":
      return state.playActive ? Object.freeze(["active"]) : Object.freeze(["inactive"]);
  }
}

function scopeNoun(scope: AssistantAskScope): string {
  switch (scope) {
    case "document":
    case "hierarchy":
      return "instances";
    case "assets":
      return "assets";
    case "animation":
      return "clips";
    case "physics":
      return "bodies";
    case "play":
      return "play session";
  }
}

export function answerAssistantAsk(input: Readonly<{
  prompt: string;
  scope: unknown;
  sourceContentHash: string;
  profile: unknown;
  state: AssistantAskScopeState;
}>):
  | Readonly<{ ok: true; answer: AssistantAskAnswer }>
  | Failure {
  if (input.profile === "@sceneaxi/profile-kids") {
    return fail(
      ASSISTANT_ASK_REFUSALS.kidsDenied,
      "Ask is denied for Kids before inspection, credential access, or project I/O.",
    );
  }
  if (input.profile !== "@sceneaxi/profile-game" && input.profile !== "@sceneaxi/profile-web") {
    return fail(ASSISTANT_ASK_REFUSALS.inputUnsupported, "Ask requires a Game or Web profile.");
  }
  if (!/^sha256:[0-9a-f]{64}$/.test(input.sourceContentHash)) {
    return fail(ASSISTANT_ASK_REFUSALS.staleVersion, "Ask names the exact project version being inspected.");
  }
  if (!isAssistantAskScope(input.scope)) {
    return fail(
      ASSISTANT_ASK_REFUSALS.scopeUnsupported,
      "Ask requires an explicit inspection scope: document, hierarchy, assets, animation, physics, or play.",
    );
  }
  if (typeof input.prompt !== "string" || input.prompt.trim().length === 0) {
    return fail(ASSISTANT_ASK_REFUSALS.inputUnsupported, "Ask requires a non-empty prompt.");
  }
  const kind = questionKind(input.prompt);
  if (kind === null) {
    return fail(
      ASSISTANT_ASK_REFUSALS.questionUnsupported,
      "Ask refuses unsupported questions rather than inventing an answer.",
    );
  }
  const ids = scopeIds(input.scope, input.state);
  const noun = scopeNoun(input.scope);
  const answer = kind === "hash"
    ? `Project content hash is ${input.sourceContentHash}.`
    : kind === "count"
      ? input.scope === "play"
        ? `Play session is ${input.state.playActive ? "active" : "inactive"}.`
        : `There are ${String(ids.length)} ${noun}.`
      : input.scope === "play"
        ? `Play session is ${input.state.playActive ? "active" : "inactive"}.`
        : ids.length === 0
          ? `No ${noun} are authored in this ${input.scope} scope.`
          : `${noun} in this ${input.scope} scope: ${ids.join(", ")}.`;
  const frozenState = Object.freeze({
    instanceIds: Object.freeze([...input.state.instanceIds]),
    assetIds: Object.freeze([...input.state.assetIds]),
    clipIds: Object.freeze([...input.state.clipIds]),
    bodyIds: Object.freeze([...input.state.bodyIds]),
    playActive: input.state.playActive,
  });
  const payload = Object.freeze({
    schemaVersion: 1 as const,
    kind: ASSISTANT_ASK_ANSWER_KIND,
    sourceContentHash: input.sourceContentHash,
    scope: input.scope,
    savedBytesWritten: false as const,
    providerClass: "none" as const,
    answer,
    evidence: frozenState,
  });
  return Object.freeze({
    ok: true as const,
    answer: Object.freeze({
      ...payload,
      digest: digestSculptJson(payload),
    }),
  });
}

export const SCENE_ASSISTANT_BUILD_CATALOG_KEY = "sceneAssistantBuilds" as const;
export const SCENE_ASSISTANT_BUILD_CATALOG_KIND = "sceneaxi.scene-assistant-build-catalog" as const;

export type SceneAssistantBuildEntry = Readonly<{
  buildId: string;
  artifactDigest: string;
  providerClass: AssistantProviderClass;
  model: string;
  provider: string;
  version: string;
  fallbackPolicy: "none";
}>;

export type SceneAssistantBuildCatalog = Readonly<{
  schemaVersion: 1;
  kind: typeof SCENE_ASSISTANT_BUILD_CATALOG_KIND;
  entries: readonly SceneAssistantBuildEntry[];
}>;

export function emptySceneAssistantBuildCatalog(): SceneAssistantBuildCatalog {
  return Object.freeze({
    schemaVersion: 1,
    kind: SCENE_ASSISTANT_BUILD_CATALOG_KIND,
    entries: Object.freeze([]),
  });
}

export function parseSceneAssistantBuildCatalog(value: unknown): SceneAssistantBuildCatalog | null {
  if (value === undefined || value === null) return emptySceneAssistantBuildCatalog();
  if (typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (record["schemaVersion"] !== 1 || record["kind"] !== SCENE_ASSISTANT_BUILD_CATALOG_KIND) {
    return null;
  }
  return value as SceneAssistantBuildCatalog;
}

export function applyAssistantBuildEntry(input: Readonly<{
  catalog: SceneAssistantBuildCatalog;
  entry: SceneAssistantBuildEntry;
}>): SceneAssistantBuildCatalog {
  return Object.freeze({
    ...input.catalog,
    entries: Object.freeze([
      ...input.catalog.entries.filter((candidate) => candidate.buildId !== input.entry.buildId),
      input.entry,
    ]),
  });
}

export function isFixtureProviderDescriptor(input: Readonly<{
  model?: string;
  provider?: string;
}>): boolean {
  return input.provider === "sceneaxi-fixture" || input.model === "wayfinder-rarity-fixture";
}
