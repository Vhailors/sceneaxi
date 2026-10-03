import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { runWindowsUpdateCheck, WINDOWS_UPDATE_REFUSALS } from "../../windows/src/index.js";
import { seam } from "@sceneaxi/desktop-macos";

describe("desktop-macos public seam", () => {
  it("exports the frozen desktop release-group identity", () => {
    expect(seam).toEqual({ name: "@sceneaxi/desktop-macos", releaseGroup: "desktop" });
    expect(Object.isFrozen(seam)).toBe(true);
  });
});

const repository = new URL("../../../", import.meta.url);

const inNode = (source: string) => {
  const result = spawnSync(process.execPath, ["--input-type=module", "--eval", source], {
    cwd: repository, encoding: "utf8", timeout: 20000,
  });

  expect(result.status, result.stderr).toBe(0);
};

// These are byte-only fixtures. They never claim platform signatures, notarization or launch.
for (const platform of ["macos", "windows"]) {
  describe(`${platform} independent release integrity`, () => {
    it("cross-binds exact checksums, version, sizes and update hashes; rejects omission, duplicate and path tampering", () => {
      inNode(`
        import assert from "node:assert/strict";
        import { mkdtempSync, writeFileSync, readFileSync, rmSync, symlinkSync } from "node:fs";
        import { tmpdir } from "node:os";
        import { join } from "node:path";
        import { hashReleaseFile, validateReleaseArtifacts } from "./desktop/${platform}/scripts/${platform === "macos" ? "artifact-validation" : "package-release"}.mjs";
        const release = mkdtempSync(join(tmpdir(), "sceneaxi-integrity-only-"));
        try {
          const name = "fixture.zip";
          writeFileSync(join(release, name), "unsigned byte fixture only");
          const bytes = Buffer.byteLength("unsigned byte fixture only");
          const sha256 = hashReleaseFile(join(release, name));
          const sha512 = hashReleaseFile(join(release, name), "sha512", "base64");
          const record = { schemaVersion: 1, version: "1.2.3", sourceCommit: "a".repeat(40), artifacts: [{fileName: name, bytes, sha256}] };
          const update = "version: 1.2.3\\nfiles:\\n  - url: fixture.zip\\n    sha512: " + sha512 + "\\n    size: " + bytes + "\\npath: fixture.zip\\nsha512: " + sha512 + "\\n";
          writeFileSync(join(release, "latest.yml"), update);
          writeFileSync(join(release, "SHA256SUMS"), sha256 + "  " + name + "\\n");
          const validate = (manifest = record) => validateReleaseArtifacts({release, manifest, version: "1.2.3", expectedNames: [name], updateFile: "latest.yml", updateArtifact: name});
          assert.equal(validate().version, "1.2.3");
          for (const manifest of [
            {...record, version: "2.0.0"},
            {...record, artifacts: []},
            {...record, artifacts: [...record.artifacts, ...record.artifacts]},
            {...record, artifacts: [{...record.artifacts[0], fileName: "../outside.zip"}]},
            {...record, artifacts: [{...record.artifacts[0], bytes: bytes + 1}]},
            {...record, artifacts: [{...record.artifacts[0], sha256: "0".repeat(64)}]},
          ]) assert.throws(() => validate(manifest), /RELEASE_INTEGRITY_/);
          for (const checksums of ["", sha256 + "  ../outside.zip\\n", sha256 + "  fixture.zip\\n" + sha256 + "  fixture.zip\\n"]) {
            writeFileSync(join(release, "SHA256SUMS"), checksums);
            assert.throws(() => validate(), /RELEASE_INTEGRITY_/);
          }
          writeFileSync(join(release, "SHA256SUMS"), sha256 + "  " + name + "\\n");
          for (const changed of [update.replace("version: 1.2.3", "version: 2.0.0"), update.replace("size: " + bytes, "size: " + (bytes + 1)), update.replace(sha512, "A".repeat(88)), update + "path: fixture.zip\\n"]) {
            writeFileSync(join(release, "latest.yml"), changed);
            assert.throws(() => validate(), /RELEASE_INTEGRITY_/);
          }
          writeFileSync(join(release, "latest.yml"), update);
          const data = readFileSync(join(release, name));
          rmSync(join(release, name));
          writeFileSync(join(release, "target.zip"), data);
          symlinkSync("target.zip", join(release, name));
          assert.throws(() => validate(), /RELEASE_INTEGRITY_FILE_INVALID/);
        } finally { rmSync(release, { recursive: true, force: true }); }
      `);
    });
  });
}

 describe("release front-door refusals", () => {
  it("Windows --packaged refuses this non-Windows host; unknown flags refuse on both roots", () => {
    for (const platform of ["macos", "windows"]) {
      const invalid = spawnSync(process.execPath, [`desktop/${platform}/scripts/smoke.mjs`, "--typo"], { cwd: repository, encoding: "utf8" });
      expect(invalid.status).toBe(1);
      expect(invalid.stderr).toContain("SMOKE_ARGUMENT_INVALID");
    }

    if (process.platform !== "win32") {
      const packaged = spawnSync(process.execPath, ["desktop/windows/scripts/smoke.mjs", "--packaged"], { cwd: repository, encoding: "utf8" });
      expect(packaged.status).toBe(1);
      expect(packaged.stderr).toContain("WINDOWS_RELEASE_HOST_REQUIRED");
    }
  });

  it("never removes nonempty or symlinked Windows output; refuses implicit upload before work", () => {
    inNode(`
      import assert from "node:assert/strict";
      import { mkdtempSync, writeFileSync, readFileSync, rmSync, symlinkSync } from "node:fs";
      import { tmpdir } from "node:os";
      import { join } from "node:path";
      import { requireEmptyWindowsOutput, windowsCheckoutProvenance } from "./desktop/windows/scripts/release-preflight.mjs";
      import { packageWindowsRelease, uploadVerifiedWindowsDraft } from "./desktop/windows/scripts/package-release.mjs";
      const root = mkdtempSync(join(tmpdir(), "sceneaxi-output-guard-"));
      try {
        const original = join(root, "prior-candidate");
        writeFileSync(original, "preserve");
        assert.throws(() => requireEmptyWindowsOutput(root), /WINDOWS_RELEASE_OUTPUT_NOT_EMPTY/);
        assert.equal(readFileSync(original, "utf8"), "preserve");
        symlinkSync(root, join(root, "link"));
        assert.throws(() => requireEmptyWindowsOutput(join(root, "link")), /WINDOWS_RELEASE_OUTPUT_INVALID/);
        assert.throws(() => packageWindowsRelease({appRoot: root, publish: "onTagOrDraft", env: {}}), /WINDOWS_RELEASE_IMPLICIT_PUBLISH_DENIED/);
        assert.throws(() => windowsCheckoutProvenance({}), /WINDOWS_PROVENANCE_REQUIRED:GITHUB_SHA/);
        assert.throws(() => windowsCheckoutProvenance({GITHUB_SHA: "invalid"}), /WINDOWS_PROVENANCE_INVALID/);
        assert.throws(() => windowsCheckoutProvenance({GITHUB_SHA: "a".repeat(40)}), /WINDOWS_PROVENANCE_COMMIT_MISMATCH/);
        let uploads = 0, smoke = 0, lookups = 0;
        const failedVerification = {
          appRoot: root, sourceCommit: "a".repeat(40), tag: "v1.2.3",
          verifyCandidate: () => { throw new Error("RELEASE_INTEGRITY_HASH_MISMATCH"); },
          verifyNative: () => { smoke++; }, readDraft: () => { lookups++; }, upload: () => { uploads++; },
        };
        assert.throws(() => uploadVerifiedWindowsDraft(failedVerification), /RELEASE_INTEGRITY_HASH_MISMATCH/);
        assert.equal(uploads, 0); assert.equal(smoke, 0); assert.equal(lookups, 0);
        assert.throws(() => uploadVerifiedWindowsDraft({...failedVerification,
          // An inert orchestration record, not a signed artifact; native port ALWAYS refuses.
          verifyCandidate: () => ({manifest: {sourceCommit: "a".repeat(40)}, digest: "inert"}),
          verifyNative: () => { throw new Error("WINDOWS_RELEASE_SIGNATURE_INVALID"); },
        }), /WINDOWS_RELEASE_SIGNATURE_INVALID/);
        assert.equal(uploads, 0); assert.equal(lookups, 0);
      } finally { rmSync(root, {recursive: true, force: true}); }
    `);
  });
});

const fixturePolicy = {
  schemaVersion: 1, enabled: true, platform: "windows-x64", version: "1.2.3",
  sourceCommit: "a".repeat(40), artifactSha256: "b".repeat(64),
  feedUrl: "https://github.com/Vhailors/sceneaxi/releases",
};

describe("Windows update ports default off", () => {
  it("configuration alone, disabled/malformed policy and smoke make zero calls", async () => {
    let calls = 0;

    for (const releasePolicy of [undefined, {}, {...fixturePolicy, enabled: false}, {...fixturePolicy, sourceCommit: "bad"}, {...fixturePolicy, feedUrl: "http://example.test"}, {...fixturePolicy, version: "9.9.9"}]) {
      const result = await runWindowsUpdateCheck({packaged: true, smokeMode: false, configurationExists: true, releasePolicy, version: "1.2.3", checkForUpdates: async () => { calls++; }});
      expect(result).toEqual({ok: false, reason: WINDOWS_UPDATE_REFUSALS.releaseNotVerified});
    }

    expect(await runWindowsUpdateCheck({packaged: true, smokeMode: true, configurationExists: true, releasePolicy: fixturePolicy, version: "1.2.3", checkForUpdates: async () => { calls++; }})).toEqual({ok: false, reason: WINDOWS_UPDATE_REFUSALS.smokeMode});
    expect(calls).toBe(0);
  });
  it("explicit validated fixture reaches one injected port and redacts its error; no network/signing proof", async () => {
    let calls = 0;
    const input = {packaged: true, smokeMode: false, configurationExists: true, releasePolicy: fixturePolicy, version: "1.2.3", checkForUpdates: async () => { calls++; }};
    expect(await runWindowsUpdateCheck(input)).toEqual({ok: true, checked: true});
    expect(calls).toBe(1);
    expect(await runWindowsUpdateCheck({...input, checkForUpdates: async () => { throw new Error("secret-like exception never echoed"); }})).toEqual({ok: false, reason: WINDOWS_UPDATE_REFUSALS.checkFailed});
  });
});
