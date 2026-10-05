import { afterEach, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

// Packaging adapters are runtime JavaScript, not product TypeScript exports.
const { validateReleaseArtifacts, packageWindowsRelease } = await import("../scripts/package-release.mjs");

const { requireEmptyWindowsOutput, windowsCheckoutProvenance } = await import("../scripts/release-preflight.mjs");

const roots: string[] = [];

afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

const scratch = () => { const root = mkdtempSync(join(tmpdir(), "release-byte-oracle-")); roots.push(root);

 return root; };

function candidate() {
  const release = scratch(); const version = "0.0.0"; const updateArtifact = "test-candidate.exe"; const bytes = Buffer.from("SYNTHETIC BYTE INTEGRITY FIXTURE ONLY; NOT AN EXECUTABLE OR SIGNED RELEASE");
  const sha512 = createHash("sha512").update(bytes).digest("base64");
  writeFileSync(join(release, updateArtifact), bytes);
  writeFileSync(join(release, "latest.yml"), `version: ${version}\nfiles:\n  - url: ${updateArtifact}\n    sha512: ${sha512}\n    size: ${bytes.length}\npath: ${updateArtifact}\nsha512: ${sha512}\n`);
  const expectedNames = [updateArtifact, "latest.yml"];

  const artifacts = expectedNames.map(fileName => {
    const content = fileName === updateArtifact ? bytes : Buffer.from(`version: ${version}\nfiles:\n  - url: ${updateArtifact}\n    sha512: ${sha512}\n    size: ${bytes.length}\npath: ${updateArtifact}\nsha512: ${sha512}\n`);

    return { fileName, bytes: content.length, sha256: createHash("sha256").update(content).digest("hex") };
  });

  writeFileSync(join(release, "SHA256SUMS"), artifacts.map(a => `${a.sha256}  ${a.fileName}`).join("\n") + "\n");

  return { release, version, expectedNames, updateFile: "latest.yml", updateArtifact, manifest: { schemaVersion: 1, version, sourceCommit: "a".repeat(40), artifacts } };
}

describe("independent release admission (no signing/publication)", () => {
  it("accepts synthetic byte facts only, with no signature/native implication", () => { const c = candidate(); expect(validateReleaseArtifacts(c)).toMatchObject({ version: c.version, artifacts: c.manifest.artifacts }); });
  it("refuses an unexpected artifact outside the exact admitted set", () => { const c = candidate(); writeFileSync(join(c.release, "rogue.zip"), "unadmitted"); expect(() => validateReleaseArtifacts(c)).toThrow("RELEASE_INTEGRITY_DIRECTORY_SET_MISMATCH"); });
  it.each(["version", "size", "hash", "duplicate", "escape", "update"])("refuses mutated %s facts", mutation => {
    const c = candidate(); const first = c.manifest.artifacts[0];

 if (!first) throw new Error("fixture absent");

    if (mutation === "version") c.manifest.version = "9.0.0";

    if (mutation === "size") first.bytes += 1;

    if (mutation === "hash") first.sha256 = "0".repeat(64);

    if (mutation === "duplicate") c.manifest.artifacts.push({ ...first });

    if (mutation === "escape") first.fileName = "../outside.exe";

    if (mutation === "update") { writeFileSync(join(c.release, "latest.yml"), "version: 0.0.0\nurl: https://hostile.invalid\n"); }

    expect(() => validateReleaseArtifacts(c)).toThrow(/RELEASE_INTEGRITY_/);
  });
  it("refuses symlink outputs without following them", () => { const root = scratch(); const link = join(root, "link"); symlinkSync(candidate().release, link); expect(() => requireEmptyWindowsOutput(link)).toThrow("WINDOWS_RELEASE_OUTPUT_INVALID"); });
  it("refuses nonempty output, implicit publish, dirty checkout and mismatched HEAD", () => {
    const root = scratch(); writeFileSync(join(root, "old.bin"), "retained");
    expect(() => requireEmptyWindowsOutput(root)).toThrow("WINDOWS_RELEASE_OUTPUT_NOT_EMPTY");
    expect(() => packageWindowsRelease({ appRoot: root, publish: "always", env: {} })).toThrow("WINDOWS_RELEASE_IMPLICIT_PUBLISH_DENIED");
    const head = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).stdout.trim();
    expect(() => windowsCheckoutProvenance({ GITHUB_SHA: head })).toThrow("WINDOWS_PROVENANCE_WORKTREE_DIRTY");
    expect(() => windowsCheckoutProvenance({ GITHUB_SHA: "0".repeat(40) })).toThrow("WINDOWS_PROVENANCE_COMMIT_MISMATCH");
  });
  it.each(["--wat", "--packaged=1", "--packaged --packaged"])("real smoke rejects malformed %s", flag => {
    const r = spawnSync(process.execPath, ["desktop/windows/scripts/smoke.mjs", ...flag.split(" ")], { encoding: "utf8", timeout: 5000 });
    expect(r.status).toBe(1); expect(r.stderr).toContain("WINDOWS_SMOKE_ARGUMENT_INVALID");
  });
  it("non-Windows packaged smoke is a named refusal before artifact access", () => {
    if (process.platform === "win32") throw new Error("This Linux-host oracle must run on the assigned non-Windows host");
    const r = spawnSync(process.execPath, ["desktop/windows/scripts/smoke.mjs", "--packaged"], { encoding: "utf8", timeout: 5000 });
    expect(r.status).toBe(1); expect(r.stderr).toContain("WINDOWS_RELEASE_HOST_REQUIRED");
  });
});
