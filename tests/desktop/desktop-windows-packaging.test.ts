import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  WINDOWS_UPDATE_REFUSALS,
  runWindowsUpdateCheck,
  seam,
} from "../../desktop/windows/src/index.ts";
import {
  WINDOWS_RELEASE_ENV,
  WINDOWS_SIGNING_ENV,
  windowsReleasePreflight,
} from "../../desktop/windows/scripts/release-preflight.mjs";

const root = new URL("../../", import.meta.url);
const read = (rel: string) => readFileSync(new URL(rel, root), "utf8");

describe("desktop-windows packaging", () => {
  it("exports a frozen desktop seam from its isolated install root", () => {
    expect(seam).toEqual({ name: "@sceneaxi/desktop-windows", releaseGroup: "desktop" });
    expect(Object.isFrozen(seam)).toBe(true);
    expect(read("desktop/windows/pnpm-workspace.yaml")).toMatch(
      /^packages:\s*\n\s*-\s*["']?\.["']?\s*$/m,
    );
  });

  it("declares one signed NSIS x64 artifact and signature-verified updates", () => {
    const builder = read("desktop/windows/electron-builder.yml");
    expect(builder).toMatch(/target:\s*nsis/);
    expect(builder).toMatch(/arch:\s*\n\s*- x64/);
    expect(builder).toMatch(/forceCodeSigning:\s*true/);
    expect(builder).toMatch(/verifyUpdateCodeSignature:\s*true/);
    expect(builder).toContain(
      "artifactName: SceneAxi-Engine-Desktop-${version}-windows-${arch}.${ext}",
    );
    expect(builder).toMatch(/provider:\s*github/);
    expect(builder).toMatch(/owner:\s*Vhailors/);
    expect(builder).toMatch(/repo:\s*sceneaxi/);
    expect(builder).toMatch(/releaseType:\s*draft/);
  });

  it("stages the existing application and does not fork its desktop product sources", () => {
    const build = read("desktop/windows/scripts/build.mjs");
    expect(build).toContain('resolve(appRoot, "../linux")');
    expect(build).toContain('"desktop-main.cjs"');
    expect(build).toContain("src/electron/main.ts");
    expect(read("desktop/windows/src/electron/main.ts")).toContain(
      'const existingDesktopMain = "./desktop-main.cjs"',
    );
  });

  it("refuses every absent signing, publishing, and tool prerequisite", () => {
    const result = windowsReleasePreflight({
      env: {},
      platform: "win32",
      commandAvailable: () => false,
      publishing: true,
    });
    expect(result.ok).toBe(false);
    for (const name of [...WINDOWS_SIGNING_ENV, ...WINDOWS_RELEASE_ENV]) {
      expect(result.reasons).toContain(`WINDOWS_RELEASE_ENV_MISSING:${name}`);
    }
    expect(result.reasons).toContain("WINDOWS_RELEASE_TOOL_MISSING:signtool.exe");
    expect(result.reasons).toContain("WINDOWS_RELEASE_TOOL_MISSING:gh.exe");
  });

  it("stops the real dist entry before build when signing inputs are missing", () => {
    const result = spawnSync(process.execPath, ["desktop/windows/scripts/dist.mjs"], {
      cwd: new URL("../../", import.meta.url),
      encoding: "utf8",
      env: {
        ...process.env,
        WIN_CSC_LINK: "",
        WIN_CSC_KEY_PASSWORD: "",
      },
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("desktop-windows release preflight refused");
    expect(result.stderr).toContain("WINDOWS_RELEASE_ENV_MISSING:WIN_CSC_LINK");
    expect(result.stderr).toContain("WINDOWS_RELEASE_ENV_MISSING:WIN_CSC_KEY_PASSWORD");
  });

  it("keeps local distribution non-publishing and publication on an existing draft", () => {
    expect(read("desktop/windows/scripts/dist.mjs")).toContain('publish: "never"');
    const release = read("desktop/windows/scripts/release.mjs");
    expect(release).toContain('publish: "onTagOrDraft"');
    expect(release).toContain("the matching GitHub release must already exist as a draft");
    expect(release).not.toMatch(/release\W+create/);
  });

  it("runs the host-independent smoke without signing or publishing", () => {
    const result = spawnSync(process.execPath, ["desktop/windows/scripts/smoke.mjs"], {
      cwd: new URL("../../", import.meta.url),
      encoding: "utf8",
    });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("missing authority refuses");
    expect(result.stdout).toContain("no public artifact is claimed");
  });
});

describe("desktop-windows update refusal", () => {
  it("does not reach the updater without generated configuration", async () => {
    let checks = 0;
    const result = await runWindowsUpdateCheck({
      packaged: true,
      smokeMode: false,
      configurationExists: false,
      checkForUpdates: async () => {
        checks += 1;
      },
    });
    expect(result).toEqual({
      ok: false,
      reason: WINDOWS_UPDATE_REFUSALS.configurationMissing,
    });
    expect(checks).toBe(0);
  });

  it("turns update transport failure into a named refusal", async () => {
    await expect(
      runWindowsUpdateCheck({
        packaged: true,
        smokeMode: false,
        configurationExists: true,
        checkForUpdates: async () => {
          throw new Error("offline");
        },
      }),
    ).resolves.toEqual({ ok: false, reason: WINDOWS_UPDATE_REFUSALS.checkFailed });
  });
});
