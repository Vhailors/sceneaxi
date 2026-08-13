import { describe, expect, it } from "vitest";
import { PROFILE_REFUSALS, captureProfileEvidence } from "@sceneaxi/schemas";

const hash = `sha256:${"22".repeat(32)}`;

describe("desktop profile evidence", () => {
  it("names disabled metrics instead of inventing zeros when Play has no frame", () => {
    const captured = captureProfileEvidence({
      sourceContentHash: hash,
      playSessionId: "play-1",
      cloneDigest: `sha256:${"33".repeat(32)}`,
      profile: "game",
    });
    expect(captured).toMatchObject({
      ok: true,
      evidence: { savedBytesWritten: false, claimsPixels: false, claimsGpuTiming: false },
    });
    if (!captured.ok) throw new Error(captured.message);
    expect(captured.evidence.metrics.every((metric) => metric.status === "disabled")).toBe(true);
    expect(captured.evidence.metrics.map((metric) => metric.id)).toEqual([
      "frame-timing",
      "draw-calls",
      "simulation-steps",
      "animation-evaluation",
      "asset-activity",
      "command-span",
    ]);
  });

  it("refuses missing Play clones and Kids before recording", () => {
    expect(captureProfileEvidence({
      sourceContentHash: hash,
      playSessionId: null,
      cloneDigest: null,
      profile: "game",
    })).toMatchObject({ ok: false, reason: PROFILE_REFUSALS.playMissing });
    expect(captureProfileEvidence({
      sourceContentHash: hash,
      playSessionId: "play-1",
      cloneDigest: `sha256:${"33".repeat(32)}`,
      profile: "kids",
    })).toMatchObject({ ok: false, reason: PROFILE_REFUSALS.kidsDenied });
  });
});
