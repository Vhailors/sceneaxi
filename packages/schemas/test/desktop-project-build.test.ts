import { describe, expect, it } from "vitest";
import {
  PROJECT_BUILD_REFUSALS,
  detectProjectBuildHost,
  evaluateProjectBuild,
} from "@sceneaxi/schemas";

const readyHost = Object.freeze({
  platform: "macos" as const,
  signingReady: true,
  notarizationReady: true,
  releaseAuthority: true,
});

describe("desktop project build", () => {
  it("refuses macos and windows on a Linux host before any shipping claim", () => {
    const linux = Object.freeze({
      platform: "linux" as const,
      signingReady: false,
      notarizationReady: false,
      releaseAuthority: false,
    });
    expect(detectProjectBuildHost("linux")).toBe("linux");
    expect(evaluateProjectBuild({ target: "macos", profile: "game", host: linux }))
      .toMatchObject({ ok: false, reason: PROJECT_BUILD_REFUSALS.hostUnsupported, releaseReady: false });
    expect(evaluateProjectBuild({ target: "windows", profile: "game", host: linux }))
      .toMatchObject({ ok: false, reason: PROJECT_BUILD_REFUSALS.hostUnsupported, releaseReady: false });
  });

  it("refuses missing signing, notarization, Kids, and unsigned release claims", () => {
    expect(evaluateProjectBuild({
      target: "macos",
      profile: "kids",
      host: readyHost,
    })).toMatchObject({ ok: false, reason: PROJECT_BUILD_REFUSALS.kidsDenied });
    expect(evaluateProjectBuild({
      target: "macos",
      profile: "game",
      host: { ...readyHost, signingReady: false },
    })).toMatchObject({ ok: false, reason: PROJECT_BUILD_REFUSALS.signingMissing, releaseReady: false });
    expect(evaluateProjectBuild({
      target: "macos",
      profile: "game",
      host: { ...readyHost, notarizationReady: false },
    })).toMatchObject({ ok: false, reason: PROJECT_BUILD_REFUSALS.notarizationMissing, releaseReady: false });
    expect(evaluateProjectBuild({
      target: "windows",
      profile: "web",
      host: { platform: "windows", signingReady: true, notarizationReady: false, releaseAuthority: false },
    })).toMatchObject({ ok: false, reason: PROJECT_BUILD_REFUSALS.releaseAuthorityMissing, releaseReady: false });
    expect(evaluateProjectBuild({
      target: "macos",
      profile: "game",
      host: readyHost,
    })).toMatchObject({ ok: false, reason: PROJECT_BUILD_REFUSALS.releaseAuthorityMissing, releaseReady: false });
    expect(detectProjectBuildHost("freebsd")).toBe("unknown");
  });
});
