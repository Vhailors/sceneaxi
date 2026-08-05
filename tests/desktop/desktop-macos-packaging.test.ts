import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { seam } from "../../desktop/macos/src/index.ts";

const read = (rel: string): string =>
  readFileSync(new URL(`../../${rel}`, import.meta.url), "utf8");

describe("desktop-macos packaging seam", () => {
  it("is a standalone desktop install root around the existing application", () => {
    expect(seam).toEqual({ name: "@sceneaxi/desktop-macos", releaseGroup: "desktop" });
    expect(Object.isFrozen(seam)).toBe(true);

    expect(read("desktop/macos/pnpm-workspace.yaml")).toMatch(
      /^packages:\s*\n\s*-\s*["']?\.["']?\s*$/m,
    );

    const manifest = JSON.parse(read("desktop/macos/package.json")) as {
      private: boolean;
      main: string;
      scripts: Record<string, string>;
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    };
    expect(manifest.private).toBe(true);
    expect(manifest.main).toBe("dist/main.cjs");
    expect(manifest.dependencies["@sceneaxi/schemas"]).toBe(
      "link:../../packages/schemas",
    );
    expect(manifest.devDependencies["electron"]).toBeDefined();
    expect(manifest.devDependencies["electron-builder"]).toBeDefined();
    for (const script of ["build", "dist", "smoke", "typecheck"]) {
      expect(manifest.scripts[script]).toBeDefined();
    }

    // This suite is the tier's coverage, exactly as it is for `desktop/linux`: a
    // packaging install root that declares its own runner would ship a test surface
    // no pipeline runs, and drag that runner's tree into an Electron install root.
    expect(manifest.scripts["test"]).toBeUndefined();
    expect(manifest.devDependencies["vitest"]).toBeUndefined();
    expect(read("desktop/macos/pnpm-lock.yaml")).not.toContain("vitest");
    expect(existsSync(new URL("../../desktop/macos/test", import.meta.url))).toBe(false);
    expect(existsSync(new URL("../../desktop/macos/vitest.config.ts", import.meta.url))).toBe(
      false,
    );

    const build = read("desktop/macos/scripts/build.mjs");
    expect(build).toContain("desktop/linux");
    expect(build).toContain("scripts/build.mjs");
  });

  it("declares deterministic signed and notarized macOS release outputs without publishing", () => {
    const builder = read("desktop/macos/electron-builder.yml");
    expect(builder).toMatch(/^mac:/m);
    expect(builder).toContain("hardenedRuntime: true");
    expect(builder).toContain("notarize: true");
    expect(builder).toContain("target: dmg");
    expect(builder).toContain("target: zip");
    expect(builder).toContain("arch:");
    expect(builder).toContain("universal");
    expect(builder).toContain(
      "artifactName: SceneAxi-Engine-Desktop-${version}-macos-${arch}.${ext}",
    );
    expect(builder).toContain("entitlements: entitlements.mac.plist");
    expect(read("desktop/macos/entitlements.mac.plist")).toContain(
      "com.apple.security.cs.allow-jit",
    );
    expect(builder).not.toMatch(/^publish:/m);

    const dist = read("desktop/macos/scripts/dist.mjs");
    expect(dist).toContain('"--publish", "never"');
    expect(dist).toContain("SHA256SUMS");
    expect(dist).toContain("desktop-macos-release.json");
    expect(dist).toContain("latest-mac.yml");

    // electron-builder templates every artifact name from the manifest version, so
    // the manifest is the only place the release identity may be stated: a version
    // restated in the release command aborts the release after sign + notarize.
    const { version } = JSON.parse(read("desktop/macos/package.json")) as { version: string };
    expect(version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(dist).toContain('readFileSync(join(appRoot, "package.json")');
    expect(dist).toContain("SceneAxi-Engine-Desktop-${version}-macos-universal");
    expect(dist).toContain("version: ${version}");
    expect(dist).not.toContain(version);
  });

  it("refuses a release record the download IA could not consume", () => {
    const dist = read("desktop/macos/scripts/dist.mjs");
    for (const name of ["GITHUB_REPOSITORY", "GITHUB_SHA", "GITHUB_RUN_ID"]) {
      expect(dist).toContain(name);
    }
    expect(dist).toContain("MACOS_PROVENANCE_REQUIRED");
    expect(dist).toContain("MACOS_PROVENANCE_INVALID");
    for (const field of [
      "repository",
      "sourceCommit",
      "workflowRunId",
      "downloadHref",
      "verifiedOn",
    ]) {
      expect(dist).toContain(field);
    }
    expect(dist).toContain("https://github.com/${repository}/actions/runs/${workflowRunId}");

    // The packaged smoke is the second reader of that record, so an incomplete one
    // fails the release verification rather than reaching the download IA.
    const smoke = read("desktop/macos/scripts/smoke.mjs");
    expect(smoke).toContain("release record carries no complete provenance");
    expect(smoke).toContain("downloadHref");
  });

  it("verifies the recorded commit against the checkout instead of trusting its shape", () => {
    const macosRoot = new URL("../../desktop/macos", import.meta.url);
    const preflight = (sha: string): string => {
      const result = spawnSync(process.execPath, ["scripts/dist.mjs", "--preflight-only"], {
        cwd: macosRoot,
        encoding: "utf8",
        env: {
          ...process.env,
          GITHUB_REPOSITORY: "Vhailors/sceneaxi",
          GITHUB_SHA: sha,
          GITHUB_RUN_ID: "1",
        },
      });
      expect(result.status).toBe(1);
      return result.stderr;
    };

    const head = spawnSync("git", ["rev-parse", "--verify", "HEAD"], {
      cwd: new URL("../..", import.meta.url),
      encoding: "utf8",
    });
    if (head.status !== 0) {
      // No readable checkout: the release must refuse rather than record an unverifiable claim.
      expect(preflight("a".repeat(40))).toContain("MACOS_PROVENANCE_UNVERIFIABLE");
      return;
    }

    // A well-shaped commit that is not the one being packaged is refused by name, and
    // the real HEAD clears that gate — a dirty tree is refused separately, so this
    // holds whether or not the checkout running the gate has uncommitted changes.
    expect(preflight("a".repeat(40))).toContain("MACOS_PROVENANCE_COMMIT_MISMATCH");
    expect(preflight(head.stdout.trim())).not.toContain("MACOS_PROVENANCE_COMMIT_MISMATCH");

    const dist = read("desktop/macos/scripts/dist.mjs");
    expect(dist).toContain("MACOS_PROVENANCE_WORKTREE_DIRTY");
    expect(dist).toContain('git(["status", "--porcelain"])');
    expect(read("docs/desktop-macos.md")).toContain("MACOS_PROVENANCE_COMMIT_MISMATCH");
  });

  it("proves pixels on a GPU-less host with a real software rasterizer", () => {
    const smoke = read("desktop/macos/scripts/smoke.mjs");
    const linux = read("desktop/linux/scripts/smoke.mjs");
    for (const flag of ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"]) {
      expect(linux).toContain(flag);
      expect(smoke).toContain(flag);
    }
    expect(smoke).toContain("pixelsDrawn !== true");
    expect(read("docs/desktop-macos.md")).toContain("--use-angle=swiftshader");
  });

  it("spends macOS runner minutes only on the operator-dispatched release", () => {
    const workflow = read(".github/workflows/desktop-macos.yml");
    expect(workflow).toContain(
      "runs-on: ${{ github.event_name == 'workflow_dispatch' && 'macos-latest' || 'ubuntu-latest' }}",
    );
    expect(workflow).not.toMatch(/^\s*runs-on:\s*macos-latest\s*$/m);
    for (const step of ["pnpm dist", "pnpm smoke --packaged", "actions/upload-artifact@v4"]) {
      expect(workflow).toContain(step);
    }
    const dispatchOnly = workflow.match(/if: github\.event_name == 'workflow_dispatch'/g) ?? [];
    expect(dispatchOnly).toHaveLength(3);
  });

  it("smokes the packaging contract and refuses every absent release input", () => {
    const result = spawnSync(process.execPath, ["scripts/smoke.mjs"], {
      cwd: new URL("../../desktop/macos", import.meta.url),
      encoding: "utf8",
    });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("desktop-macos smoke OK");
    expect(result.stdout).toContain("missing signing/notarization/update inputs refused");
    expect(result.stdout).toContain("incomplete release provenance refused");
  });

  it("keeps runtime updates disabled until a signed release configures an HTTPS feed", () => {
    const bootstrap = read("desktop/macos/src/electron/main.ts");
    expect(bootstrap).toContain("autoUpdater.checkForUpdates()");
    expect(bootstrap).toContain("policy.enabled");
    expect(bootstrap).toContain('process.argv.includes("--smoke")');

    const build = read("desktop/macos/scripts/build.mjs");
    expect(build).toContain("MACOS_UPDATE_RELEASE_NOT_CONFIGURED");
    expect(build).toContain("app-update.yml");
    expect(build).toContain('parsed.protocol !== "https:"');
    expect(build).toContain('"--preflight-only"');
  });

  it("documents exact operator prerequisites, first run, and the absent public release", () => {
    const doc = read("docs/desktop-macos.md");
    for (const name of [
      "CSC_LINK",
      "CSC_KEY_PASSWORD",
      "APPLE_ID",
      "APPLE_APP_SPECIFIC_PASSWORD",
      "APPLE_TEAM_ID",
      "SCENEAXI_MACOS_RELEASE_BASE_URL",
      "GITHUB_REPOSITORY",
      "GITHUB_SHA",
      "GITHUB_RUN_ID",
    ]) {
      expect(doc).toContain(`\`${name}\``);
    }
    for (const tool of ["codesign", "hdiutil", "security", "spctl", "xcrun", "notarytool", "stapler"]) {
      expect(doc).toContain(`\`${tool}\``);
    }
    expect(doc).toContain("No macOS artifact has been published");
    expect(doc).toContain("desktop-macos-release.json");
    expect(doc).toContain("latest-mac.yml");
    expect(doc).toContain("Applications");
    expect(doc).toContain("first launch");

    const workflow = read(".github/workflows/desktop-macos.yml");
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).toContain("pnpm smoke --packaged");
    expect(workflow).toContain("actions/upload-artifact@v4");
    expect(workflow).not.toContain("gh release");
  });
});
