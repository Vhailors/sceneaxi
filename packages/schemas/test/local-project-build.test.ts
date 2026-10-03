import { describe, expect, it } from "vitest";
import { evaluateLocalProjectBuild, evaluateProjectBuild } from "../src/desktop-project-build.js";

describe("explicit local unsigned project purpose", () => {
  it("allows Linux locally without granting release authority", () => {
    expect(evaluateLocalProjectBuild({ purpose: "local-unsigned", target: "linux", profile: "game", host: "linux" })).toEqual({ ok: true, purpose: "local-unsigned", target: "linux", releaseReady: false, signed: false });
  });
  it("denies Kids before unsupported host", () => {
    expect(evaluateLocalProjectBuild({ purpose: "local-unsigned", target: "linux", profile: "kids", host: "unknown" })).toMatchObject({ ok: false, reason: "PROJECT_BUILD_KIDS_DENIED" });
  });
  it.each(["macos", "windows", "unknown"])("refuses unsupported local host %s", (host) => {
    expect(evaluateLocalProjectBuild({ purpose: "local-unsigned", target: "linux", profile: "game", host })).toMatchObject({ ok: false, reason: "PROJECT_BUILD_HOST_UNSUPPORTED" });
  });
  it.each(["release", "", null])("does not silently interpret purpose %s", (purpose) => {
    expect(evaluateLocalProjectBuild({ purpose, target: "linux", profile: "web", host: "linux" })).toMatchObject({ ok: false, reason: "PROJECT_BUILD_INPUT_UNSUPPORTED" });
  });
  it("retains original signed release refusals even with all gates ready", () => {
    expect(evaluateProjectBuild({ target: "linux", profile: "game", host: { platform: "linux", signingReady: false, notarizationReady: false, releaseAuthority: false } })).toMatchObject({ ok: false, reason: "PROJECT_BUILD_SIGNING_MISSING" });
    expect(evaluateProjectBuild({ target: "linux", profile: "game", host: { platform: "linux", signingReady: true, notarizationReady: true, releaseAuthority: true } })).toMatchObject({ ok: false, reason: "PROJECT_BUILD_RELEASE_AUTHORITY_MISSING" });
  });
});
