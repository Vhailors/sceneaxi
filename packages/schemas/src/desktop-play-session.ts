/**
 * Isolated Play-session vocabulary. The runtime clone is a distinct object
 * graph recorded against an explicit source project version. It never writes
 * authoring document bytes.
 */
import { digestSculptJson } from "./sculpt-json.js";
import type { JsonValue } from "./document.js";

export const PLAY_SESSION_SCHEMA_VERSION = 1 as const;
export const PLAY_SESSION_KIND = "sceneaxi.play-session" as const;

export const PLAY_SESSION_STATES = Object.freeze([
  "idle",
  "playing",
  "stopped",
  "disposed",
  "error",
] as const);
export type PlaySessionState = (typeof PLAY_SESSION_STATES)[number];

export const PLAY_VIEWPORT_SOURCES = Object.freeze([
  "scene",
  "game",
  "sculpt-preview",
] as const);
export type PlayViewportSource = (typeof PLAY_VIEWPORT_SOURCES)[number];

export const PLAY_SESSION_REFUSALS = Object.freeze({
  sessionMissing: "PLAY_SESSION_MISSING",
  sessionDisposed: "PLAY_SESSION_DISPOSED",
  sourceHashMismatch: "PLAY_SESSION_SOURCE_HASH_MISMATCH",
  viewportSourceInvalid: "PLAY_SESSION_VIEWPORT_SOURCE_INVALID",
  runtimeMutatesAuthoring: "PLAY_SESSION_RUNTIME_MUTATES_AUTHORING",
  inputUnsupported: "PLAY_SESSION_INPUT_UNSUPPORTED",
  kidsDenied: "PLAY_SESSION_KIDS_DENIED",
} as const);

export type PlaySessionRefusal =
  (typeof PLAY_SESSION_REFUSALS)[keyof typeof PLAY_SESSION_REFUSALS];

export type PlaySession = Readonly<{
  schemaVersion: typeof PLAY_SESSION_SCHEMA_VERSION;
  kind: typeof PLAY_SESSION_KIND;
  sessionId: string;
  sourceDocumentPath: string;
  sourceContentHash: string;
  cloneDigest: string;
  state: PlaySessionState;
  viewportSource: PlayViewportSource;
  authoringBytesUnchanged: true;
}>;

type Failure = Readonly<{ ok: false; reason: PlaySessionRefusal; message: string }>;
const fail = (reason: PlaySessionRefusal, message: string): Failure =>
  Object.freeze({ ok: false as const, reason, message });

export function playCloneDigest(sourceContentHash: string, document: JsonValue): string {
  return digestSculptJson({
    kind: "sceneaxi.play-clone",
    sourceContentHash,
    document,
  });
}

export function startPlaySession(input: Readonly<{
  sourceDocumentPath: string;
  sourceContentHash: string;
  document: JsonValue;
}>):
  | Readonly<{ ok: true; session: PlaySession }>
  | Failure {
  if (!/^sha256:[0-9a-f]{64}$/.test(input.sourceContentHash) || input.sourceDocumentPath.length === 0) {
    return fail(
      PLAY_SESSION_REFUSALS.inputUnsupported,
      "Play requires an explicit contained document path and source content hash.",
    );
  }
  const cloneDigest = playCloneDigest(input.sourceContentHash, input.document);
  if (cloneDigest === input.sourceContentHash) {
    return fail(
      PLAY_SESSION_REFUSALS.runtimeMutatesAuthoring,
      "The Play clone digest must be distinct from the source project version.",
    );
  }
  return Object.freeze({
    ok: true as const,
    session: Object.freeze({
      schemaVersion: 1,
      kind: PLAY_SESSION_KIND,
      sessionId: `play-${input.sourceContentHash.slice(7, 23)}`,
      sourceDocumentPath: input.sourceDocumentPath,
      sourceContentHash: input.sourceContentHash,
      cloneDigest,
      state: "playing" as const,
      viewportSource: "game" as const,
      authoringBytesUnchanged: true as const,
    }),
  });
}

export function stopPlaySession(session: PlaySession | null):
  | Readonly<{ ok: true; session: PlaySession }>
  | Failure {
  if (session === null) {
    return fail(PLAY_SESSION_REFUSALS.sessionMissing, "No Play session is active.");
  }
  if (session.state === "disposed") {
    return fail(PLAY_SESSION_REFUSALS.sessionDisposed, "The Play session has already been disposed.");
  }
  return Object.freeze({
    ok: true as const,
    session: Object.freeze({
      ...session,
      state: "stopped" as const,
      viewportSource: "scene" as const,
      authoringBytesUnchanged: true as const,
    }),
  });
}

export function resetPlaySession(
  session: PlaySession | null,
  document: JsonValue,
):
  | Readonly<{ ok: true; session: PlaySession }>
  | Failure {
  if (session === null) {
    return fail(PLAY_SESSION_REFUSALS.sessionMissing, "No Play session is active.");
  }
  if (session.state === "disposed") {
    return fail(PLAY_SESSION_REFUSALS.sessionDisposed, "A disposed Play session cannot be reset.");
  }
  const started = startPlaySession({
    sourceDocumentPath: session.sourceDocumentPath,
    sourceContentHash: session.sourceContentHash,
    document,
  });
  if (!started.ok) return started;
  return Object.freeze({
    ok: true as const,
    session: Object.freeze({
      ...started.session,
      sessionId: session.sessionId,
    }),
  });
}

export function setPlayViewportSource(
  session: PlaySession | null,
  source: string,
):
  | Readonly<{ ok: true; session: PlaySession }>
  | Failure {
  if (session === null) {
    return fail(PLAY_SESSION_REFUSALS.sessionMissing, "No Play session is active.");
  }
  if (session.state === "disposed") {
    return fail(PLAY_SESSION_REFUSALS.sessionDisposed, "A disposed Play session has no viewport owner.");
  }
  if (!PLAY_VIEWPORT_SOURCES.some((candidate) => candidate === source)) {
    return fail(
      PLAY_SESSION_REFUSALS.viewportSourceInvalid,
      `Viewport source "${source}" is not scene, game, or sculpt-preview.`,
    );
  }
  if (source === "game" && session.state !== "playing") {
    return fail(
      PLAY_SESSION_REFUSALS.sessionMissing,
      "Game shows the isolated Play clone only while Play is running.",
    );
  }
  return Object.freeze({
    ok: true as const,
    session: Object.freeze({
      ...session,
      viewportSource: source as PlayViewportSource,
      authoringBytesUnchanged: true as const,
    }),
  });
}

export function disposePlaySession(session: PlaySession | null):
  | Readonly<{ ok: true; session: PlaySession }>
  | Failure {
  if (session === null) {
    return fail(PLAY_SESSION_REFUSALS.sessionMissing, "No Play session is active.");
  }
  return Object.freeze({
    ok: true as const,
    session: Object.freeze({
      ...session,
      state: "disposed" as const,
      viewportSource: "scene" as const,
      authoringBytesUnchanged: true as const,
    }),
  });
}
