/**
 * Play-backed profiling evidence. Headless records never claim pixels or GPU
 * timing. Absent measurements are named disabled states, not zeros.
 */
import { digestSculptJson } from "./sculpt-json.js";

export const PROFILE_EVIDENCE_SCHEMA_VERSION = 1 as const;
export const PROFILE_EVIDENCE_KIND = "sceneaxi.profile-evidence" as const;

export const PROFILE_METRIC_IDS = Object.freeze([
  "frame-timing",
  "draw-calls",
  "simulation-steps",
  "animation-evaluation",
  "asset-activity",
  "command-span",
] as const);

export const PROFILE_REFUSALS = Object.freeze({
  playMissing: "PROFILE_PLAY_MISSING",
  kidsDenied: "PROFILE_KIDS_DENIED",
  inputUnsupported: "PROFILE_INPUT_UNSUPPORTED",
  staleVersion: "PROFILE_STALE_VERSION",
  capabilityMissing: "PROFILE_CAPABILITY_MISSING",
} as const);

export type ProfileRefusal = (typeof PROFILE_REFUSALS)[keyof typeof PROFILE_REFUSALS];
export type ProfileMetricId = (typeof PROFILE_METRIC_IDS)[number];

export type ProfileMetric =
  | Readonly<{
      id: ProfileMetricId;
      status: "measured";
      source: string;
      unit: string;
      sampleWindow: string;
      class: "deterministic" | "observational";
      value: number;
    }>
  | Readonly<{
      id: ProfileMetricId;
      status: "disabled";
      source: string;
      unit: string;
      sampleWindow: string;
      class: "deterministic" | "observational";
      reason: string;
    }>;

export type ProfileEvidence = Readonly<{
  schemaVersion: typeof PROFILE_EVIDENCE_SCHEMA_VERSION;
  kind: typeof PROFILE_EVIDENCE_KIND;
  sourceContentHash: string;
  playSessionId: string;
  cloneDigest: string;
  savedBytesWritten: false;
  claimsPixels: false;
  claimsGpuTiming: false;
  metrics: readonly ProfileMetric[];
  digest: string;
}>;

type Failure = Readonly<{ ok: false; reason: ProfileRefusal; message: string }>;
const fail = (reason: ProfileRefusal, message: string): Failure =>
  Object.freeze({ ok: false as const, reason, message });

function measured(
  id: ProfileMetricId,
  source: string,
  unit: string,
  sampleWindow: string,
  metricClass: "deterministic" | "observational",
  value: number,
): ProfileMetric {
  return Object.freeze({ id, status: "measured" as const, source, unit, sampleWindow, class: metricClass, value });
}

function disabled(
  id: ProfileMetricId,
  source: string,
  unit: string,
  sampleWindow: string,
  metricClass: "deterministic" | "observational",
  reason: string,
): ProfileMetric {
  return Object.freeze({ id, status: "disabled" as const, source, unit, sampleWindow, class: metricClass, reason });
}

export function captureProfileEvidence(input: Readonly<{
  sourceContentHash: string;
  playSessionId: string | null;
  cloneDigest: string | null;
  profile: unknown;
  frame?: Readonly<{ frame: number; drawCalls: number; pixelsDrawn: boolean | null }>;
  simulationSteps?: number;
  animationSampleCount?: number;
  assetCount?: number;
  lastCommandMs?: number;
}>):
  | Readonly<{ ok: true; evidence: ProfileEvidence }>
  | Failure {
  if (input.profile === "@sceneaxi/profile-kids" || input.profile === "kids") {
    return fail(PROFILE_REFUSALS.kidsDenied, "Profiling is denied for Kids before Play inspection.");
  }
  if (!/^sha256:[0-9a-f]{64}$/.test(input.sourceContentHash)) {
    return fail(PROFILE_REFUSALS.staleVersion, "Profiling names the exact project version being measured.");
  }
  if (input.playSessionId === null || input.cloneDigest === null) {
    return fail(PROFILE_REFUSALS.playMissing, "Profiling requires an isolated Play clone.");
  }
  const metrics = Object.freeze([
    input.frame === undefined
      ? disabled("frame-timing", "play-session", "ms", "last-frame", "observational", "PROFILE_FRAME_ABSENT")
      : measured("frame-timing", "play-session", "count", "last-frame", "observational", input.frame.frame),
    input.frame === undefined
      ? disabled("draw-calls", "presentation-frame-report", "calls", "last-frame", "observational", "PROFILE_FRAME_ABSENT")
      : measured("draw-calls", "presentation-frame-report", "calls", "last-frame", "observational", input.frame.drawCalls),
    input.simulationSteps === undefined
      ? disabled("simulation-steps", "scene-physics-evaluation", "steps", "last-evaluate", "deterministic", "PROFILE_SIMULATION_ABSENT")
      : measured("simulation-steps", "scene-physics-evaluation", "steps", "last-evaluate", "deterministic", input.simulationSteps),
    input.animationSampleCount === undefined
      ? disabled("animation-evaluation", "scene-animation-evaluation", "samples", "last-evaluate", "deterministic", "PROFILE_ANIMATION_ABSENT")
      : measured("animation-evaluation", "scene-animation-evaluation", "samples", "last-evaluate", "deterministic", input.animationSampleCount),
    input.assetCount === undefined
      ? disabled("asset-activity", "project-asset-manifest", "assets", "current-document", "deterministic", "PROFILE_ASSETS_ABSENT")
      : measured("asset-activity", "project-asset-manifest", "assets", "current-document", "deterministic", input.assetCount),
    input.lastCommandMs === undefined
      ? disabled("command-span", "editor-command-transaction", "ms", "last-command", "observational", "PROFILE_COMMAND_ABSENT")
      : measured("command-span", "editor-command-transaction", "ms", "last-command", "observational", input.lastCommandMs),
  ]);
  const payload = Object.freeze({
    schemaVersion: 1 as const,
    kind: PROFILE_EVIDENCE_KIND,
    sourceContentHash: input.sourceContentHash,
    playSessionId: input.playSessionId,
    cloneDigest: input.cloneDigest,
    savedBytesWritten: false as const,
    claimsPixels: false as const,
    claimsGpuTiming: false as const,
    metrics,
  });
  return Object.freeze({
    ok: true as const,
    evidence: Object.freeze({
      ...payload,
      digest: digestSculptJson(payload),
    }),
  });
}
