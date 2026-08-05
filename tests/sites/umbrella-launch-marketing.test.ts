import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  DOWNLOAD_PLATFORMS,
  downloadCallToAction,
  resolveDownloadPlatform,
} from "../../sites/umbrella/src/lib/download-platform.ts";
import {
  ENGINE_COMPARISONS,
  LAUNCH_PROOFS,
  PROFILE_RELEASE_MATRIX,
} from "../../sites/umbrella/src/lib/launch-marketing.ts";

const UMBRELLA = fileURLToPath(new URL("../../sites/umbrella/", import.meta.url));
const read = (path: string) => readFileSync(`${UMBRELLA}${path}`, "utf8");

describe("the first-release download call to action", () => {
  it.each([
    ["Mozilla/5.0 (X11; Linux x86_64)", "linux"],
    ["Mozilla/5.0 (Windows NT 10.0; Win64; x64)", "windows"],
    ["Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5)", "macos"],
    ["Mozilla/5.0 (X11; CrOS x86_64 15917.0.0)", "unknown"],
    ["Mozilla/5.0 (Linux; Android 15; Pixel 9)", "unknown"],
    ["", "unknown"],
  ] as const)("resolves %s to %s", (userAgent, expected) => {
    expect(resolveDownloadPlatform(userAgent)).toBe(expected);
  });

  it("offers Linux and keeps macOS and Windows in coming-soon states", () => {
    expect(DOWNLOAD_PLATFORMS).toEqual([
      expect.objectContaining({ id: "linux", availability: "recorded-build", href: "/engine" }),
      expect.objectContaining({ id: "macos", availability: "coming-soon", href: null }),
      expect.objectContaining({ id: "windows", availability: "coming-soon", href: null }),
    ]);
  });

  it("states the Linux offer as the recorded build it is, never as an available binary", () => {
    // `desktopLinuxAppOffer()` serves no binary: the artifacts are built from source or
    // taken from the named CI workflow artifact. No row may read as more than that.
    const linux = DOWNLOAD_PLATFORMS.find((entry) => entry.id === "linux");
    expect(linux?.label).toBe("Recorded build");
    expect(linux?.note).toMatch(/build it from source/i);
    for (const entry of DOWNLOAD_PLATFORMS) {
      expect(entry.label).not.toMatch(/\bavailable\b/i);
      expect(entry.note).not.toMatch(/\bavailable\b/i);
    }
    for (const platform of ["linux", "macos", "windows", "unknown"] as const) {
      expect(downloadCallToAction(platform).context).not.toMatch(/\bavailable\b/i);
    }
  });

  it("keeps Download as the primary action for every detected desktop", () => {
    for (const platform of ["linux", "macos", "windows", "unknown"] as const) {
      const action = downloadCallToAction(platform);
      expect(action.href).toBe("/engine");
      expect(action.label).toBe("Download");
      expect(action.platforms.find((entry) => entry.id === "linux")?.availability).toBe(
        "recorded-build",
      );
    }
  });
});

describe("the first-release marketing model", () => {
  it("compares SceneAxi with the three named alternatives without scoring them", () => {
    expect(ENGINE_COMPARISONS.map((entry) => entry.name)).toEqual([
      "SceneAxi",
      "Unity",
      "Godot",
      "Three.js",
    ]);
    for (const entry of ENGINE_COMPARISONS) {
      expect(entry.category.length).toBeGreaterThan(0);
      expect(entry.bestWhen.length).toBeGreaterThan(0);
      expect(entry.tradeoff.length).toBeGreaterThan(0);
      expect(entry.source.href).toMatch(entry.name === "SceneAxi" ? /^\// : /^https:\/\//);
      expect(entry).not.toHaveProperty("score");
    }
  });

  it("covers every trust claim the release brief requires", () => {
    expect(LAUNCH_PROOFS.map((proof) => proof.id)).toEqual([
      "engine-access",
      "local-byok",
      "hosted-credits",
      "kids-isolation",
    ]);
    expect(LAUNCH_PROOFS.find((proof) => proof.id === "engine-access")?.body).toContain(
      "cost zero credits",
    );
    expect(LAUNCH_PROOFS.find((proof) => proof.id === "local-byok")?.body).toContain(
      "your provider key",
    );
    expect(LAUNCH_PROOFS.find((proof) => proof.id === "hosted-credits")?.body).toContain(
      "opt-in",
    );
    expect(LAUNCH_PROOFS.find((proof) => proof.id === "kids-isolation")?.body).toContain(
      "separate",
    );
  });

  it("publishes an explicit three-profile capability matrix with no shipping claim", () => {
    expect(PROFILE_RELEASE_MATRIX.profiles.map((profile) => profile.name)).toEqual([
      "Game",
      "Web Experience",
      "Kids",
    ]);
    expect(PROFILE_RELEASE_MATRIX.capabilities.length).toBeGreaterThanOrEqual(5);
    expect(PROFILE_RELEASE_MATRIX.shippingClaim).toBe(false);
    for (const capability of PROFILE_RELEASE_MATRIX.capabilities) {
      expect(Object.keys(capability.values)).toEqual(["game", "web", "kids"]);
    }
  });

  it("freezes the release model so rendering cannot rewrite a claim", () => {
    expect(Object.isFrozen(ENGINE_COMPARISONS)).toBe(true);
    expect(Object.isFrozen(LAUNCH_PROOFS)).toBe(true);
    expect(Object.isFrozen(PROFILE_RELEASE_MATRIX)).toBe(true);
    expect(Object.isFrozen(PROFILE_RELEASE_MATRIX.profiles)).toBe(true);
    expect(Object.isFrozen(PROFILE_RELEASE_MATRIX.capabilities)).toBe(true);
  });
});

describe("the first-release overview composition", () => {
  const home = read("src/app/page.tsx");
  const layout = read("src/app/layout.tsx");
  const css = read("src/app/globals.css");

  it("makes the detected download action the hero primary and keeps the open path nearby", () => {
    expect(home).toContain("<DownloadCta");
    expect(home).toContain("LIVE_OPEN_PATH");
    expect(home.indexOf("<DownloadCta")).toBeLessThan(home.indexOf("LIVE_OPEN_PATH}"));
    expect(read("src/app/_components/download-cta.tsx")).toContain(
      "resolveDownloadPlatform(window.navigator.userAgent)",
    );
  });

  it("renders the comparisons, profile matrix, and trust model from their frozen data", () => {
    expect(home).toContain("ENGINE_COMPARISONS.map");
    expect(home).toContain("PROFILE_RELEASE_MATRIX.capabilities.map");
    expect(home).toContain("LAUNCH_PROOFS.map");
    expect(home).toContain('scope="col"');
    expect(home).toContain('scope="row"');
  });

  it("keeps docs, login, pricing, account, profiles, and the open path reachable", () => {
    for (const href of ["/docs", "/login", "/pricing", "/account", "/profiles"]) {
      expect(layout).toContain(`href: "${href}"`);
    }
    expect(layout).toContain("href: LIVE_OPEN_PATH");
  });

  it("has explicit short-height and breakpoint rules for the release hero", () => {
    expect(css).toContain("@media (max-height: 720px) and (min-width: 1025px)");
    for (const width of [1024, 860, 620]) {
      expect(css).toContain(`@media (max-width: ${width}px)`);
    }
  });

  it("ships no em dash in the new launch surface", () => {
    for (const source of [
      home,
      read("src/app/_components/download-cta.tsx"),
      read("src/lib/download-platform.ts"),
      read("src/lib/launch-marketing.ts"),
    ]) {
      expect(source).not.toMatch(/[—–]/);
    }
  });
});
