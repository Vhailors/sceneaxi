import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
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

  it("smokes the packaging contract and refuses every absent release input", () => {
    const result = spawnSync(process.execPath, ["scripts/smoke.mjs"], {
      cwd: new URL("../../desktop/macos", import.meta.url),
      encoding: "utf8",
    });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("desktop-macos smoke OK");
    expect(result.stdout).toContain("missing signing/notarization/update inputs refused");
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
