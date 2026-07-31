/**
 * Seam and configuration tests for the three deployable sites.
 *
 * These live under `tests/` rather than each site's own `test/` because the sites are
 * separate single-package workspaces outside the repository-root workspace, so
 * `@sceneaxi/site-umbrella` is not resolvable by public package name from the hermetic
 * root. The seams are imported by path instead; the rule they satisfy — every unit
 * exports a frozen typed seam with a covering test — is unchanged.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  EDITOR_VIEWPORT_COPY,
  LIVE_OPEN_COPY,
  LIVE_OPEN_INSTANCE_COUNT,
  LIVE_OPEN_PATH,
  LIVE_OPEN_PRESENTATION,
  UMBRELLA_BRAND,
  createUmbrellaIdentityPlane,
  describePlacement,
  resolveBillingMode,
  resolveFamilyLinks,
  resolveLiveOpenScene,
  resolveUmbrellaEditorAccess,
  seam as umbrellaSeam,
} from "../../sites/umbrella/src/index.ts";
import {
  CATALOG_SITE_BRAND as GAME_BRAND,
  CATALOG_SITE_SURFACE as GAME_SURFACE,
  editorLinkFor as gameEditorLink,
  resolveUmbrellaOrigin as gameUmbrellaOrigin,
  seam as gameSeam,
} from "../../sites/catalog-game/src/index.ts";
import {
  CATALOG_SITE_BRAND as WEB_BRAND,
  CATALOG_SITE_SURFACE as WEB_SURFACE,
  editorLinkFor as webEditorLink,
  seam as webSeam,
} from "../../sites/catalog-web/src/index.ts";

const REPO_ROOT = fileURLToPath(new URL("../..", import.meta.url));
const SITES_DIR = join(REPO_ROOT, "sites");
const UMBRELLA_ORIGIN = "https://sceneaxi-umbrella.vercel.app";

const SITE_SOURCE_SKIP = new Set(["node_modules", ".next", "dist", "coverage"]);

/**
 * Every committed TypeScript source under a site's `src`, discovered rather than listed.
 *
 * The copy scans below cover the whole tier, so a product surface added later is scanned
 * on the day it lands instead of on the day someone remembers to name it.
 */
function collectSiteSources(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir).sort()) {
    if (SITE_SOURCE_SKIP.has(entry)) continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      collectSiteSources(path, out);
    } else if (entry.endsWith(".ts") || entry.endsWith(".tsx")) {
      out.push(path);
    }
  }
  return out;
}

const SITE_SOURCE_FILES: readonly string[] = readdirSync(SITES_DIR)
  .sort()
  .map((entry) => join(SITES_DIR, entry, "src"))
  .filter((dir) => existsSync(dir) && statSync(dir).isDirectory())
  .flatMap((dir) => collectSiteSources(dir))
  .map((path) => relative(SITES_DIR, path).split(sep).join("/"));

describe("site seams", () => {
  it.each([
    ["@sceneaxi/site-umbrella", umbrellaSeam],
    ["@sceneaxi/site-catalog-game", gameSeam],
    ["@sceneaxi/site-catalog-web", webSeam],
  ])("%s exports a frozen seam in the sites release group", (name, seam) => {
    expect(seam.name).toBe(name);
    expect(seam.releaseGroup).toBe("sites");
    expect(Object.isFrozen(seam)).toBe(true);
  });

  it("matches each seam name to its manifest name", () => {
    for (const [dir, seam] of [
      ["umbrella", umbrellaSeam],
      ["catalog-game", gameSeam],
      ["catalog-web", webSeam],
    ] as const) {
      const manifest = JSON.parse(
        readFileSync(new URL(`../../sites/${dir}/package.json`, import.meta.url), "utf8"),
      ) as { readonly name: string };
      expect(manifest.name).toBe(seam.name);
    }
  });
});

describe("the two storefronts are distinct surfaces", () => {
  it("uses a different surface id, brand, tagline, and audience", () => {
    expect(GAME_SURFACE).toBe("catalog-game");
    expect(WEB_SURFACE).toBe("catalog-web");
    expect(GAME_BRAND.name).not.toBe(WEB_BRAND.name);
    expect(GAME_BRAND.tagline).not.toBe(WEB_BRAND.tagline);
    expect(GAME_BRAND.audience).not.toBe(WEB_BRAND.audience);
    expect(GAME_BRAND.name).not.toBe(UMBRELLA_BRAND.name);
  });
});

describe("catalog deep links to the umbrella", () => {
  it("builds a link that names its own source surface", () => {
    const env = { NEXT_PUBLIC_SCENEAXI_UMBRELLA_ORIGIN: UMBRELLA_ORIGIN };
    const game = gameEditorLink(env, "game-lantern-prop");
    const web = webEditorLink(env, "web-hero-diorama");
    expect(game.ok && game.value).toContain("source=catalog-game");
    expect(web.ok && web.value).toContain("source=catalog-web");
    expect(game.ok && game.value.startsWith(`${UMBRELLA_ORIGIN}/editor?`)).toBe(true);
  });

  it.each([
    ["missing", {}],
    ["empty", { NEXT_PUBLIC_SCENEAXI_UMBRELLA_ORIGIN: "" }],
    ["non-https", { NEXT_PUBLIC_SCENEAXI_UMBRELLA_ORIGIN: "http://evil.example" }],
    ["malformed", { NEXT_PUBLIC_SCENEAXI_UMBRELLA_ORIGIN: "not-a-url" }],
  ])("refuses to render a link when the origin is %s", (_label, env) => {
    const link = gameEditorLink(env, "game-lantern-prop");
    expect(link.ok).toBe(false);
    expect(link.ok === false && link.reason).toBe("DEEP_LINK_ORIGIN_INSECURE");
    expect(gameUmbrellaOrigin(env).ok).toBe(false);
  });

  it("accepts localhost so development needs no second code path", () => {
    expect(
      gameUmbrellaOrigin({ NEXT_PUBLIC_SCENEAXI_UMBRELLA_ORIGIN: "http://localhost:3000" }).ok,
    ).toBe(true);
  });
});

describe("umbrella family links never reach Kids", () => {
  it("resolves https origins and drops anything else", () => {
    const links = resolveFamilyLinks({
      NEXT_PUBLIC_SCENEAXI_GAME_CATALOG_ORIGIN: "https://game.vercel.app/some/path",
      NEXT_PUBLIC_SCENEAXI_WEB_CATALOG_ORIGIN: "http://insecure.example",
    });
    expect(links.gameCatalog).toBe("https://game.vercel.app");
    expect(links.webCatalog).toBeNull();
  });

  it("has no Kids link to resolve at all", () => {
    const links = resolveFamilyLinks({});
    expect(Object.keys(links).sort()).toEqual(["gameCatalog", "webCatalog"]);
    expect(JSON.stringify(links).toLowerCase()).not.toContain("kids");
  });
});

describe("umbrella identity plane refuses honestly without provider handles", () => {
  it("reports every plane as unwired with no adapters", () => {
    const plane = createUmbrellaIdentityPlane({});
    expect(plane.wired).toEqual({ identity: false, credits: false, billing: false });
    expect(plane.billingMode).toBe("test");
    expect(Object.isFrozen(plane)).toBe(true);
  });

  it("defaults billing to test and only reads an explicit live value", () => {
    expect(resolveBillingMode({})).toBe("test");
    expect(resolveBillingMode({ SCENEAXI_BILLING_MODE: "TEST" })).toBe("test");
    expect(resolveBillingMode({ SCENEAXI_BILLING_MODE: "production" })).toBe("test");
    expect(resolveBillingMode({ SCENEAXI_BILLING_MODE: " live " })).toBe("live");
  });

  it("still refuses live checkout even when the env asks for live mode", async () => {
    const plane = createUmbrellaIdentityPlane({ SCENEAXI_BILLING_MODE: "live" });
    expect(plane.billingMode).toBe("live");
    expect(await plane.billing.listCreditPacks()).toMatchObject({
      ok: false,
      reason: "BILLING_LIVE_MODE_NOT_AUTHORIZED",
    });
  });
});

describe("umbrella editor access", () => {
  it("refuses with the identity plane's own reason when unwired and preview is off", async () => {
    const resolved = await resolveUmbrellaEditorAccess({
      plane: createUmbrellaIdentityPlane({}),
      env: {},
    });
    expect(resolved.previewEnabled).toBe(false);
    expect(resolved.decision).toMatchObject({
      granted: false,
      reason: "IDENTITY_PLANE_NOT_WIRED",
    });
  });

  it("grants a banner-marked preview only when the server env sets the flag to 1", async () => {
    const granted = await resolveUmbrellaEditorAccess({
      plane: createUmbrellaIdentityPlane({}),
      env: { SCENEAXI_SITE_EDITOR_PREVIEW: "1" },
    });
    expect(granted.decision).toMatchObject({ granted: true, mode: "preview" });

    for (const value of ["", "0", "true", "yes"]) {
      const refused = await resolveUmbrellaEditorAccess({
        plane: createUmbrellaIdentityPlane({}),
        env: { SCENEAXI_SITE_EDITOR_PREVIEW: value },
      });
      expect(refused.decision.granted).toBe(false);
    }
  });
});


/**
 * The umbrella's two pixel-drawing surfaces, and the one client module both are built
 * from. Read once so every assertion below is about the shipped source.
 */
const readSite = (relativePath: string): string =>
  readFileSync(new URL(`../../sites/${relativePath}`, import.meta.url), "utf8");

const EDITOR_PAGE = "umbrella/src/app/editor/page.tsx";
const EDITOR_VIEWPORT = "umbrella/src/app/editor/_components/editor-viewport.tsx";
const LIVE_VIEWPORT = "umbrella/src/app/open/_components/live-viewport.tsx";
const SCULPT_VIEWPORT = "umbrella/src/app/_components/sculpt-viewport.tsx";

describe("the entitled editor draws through the same viewport boundary", () => {
  it("mounts the editor viewport on the entitled route", () => {
    const page = readSite(EDITOR_PAGE);
    expect(page).toContain("<EditorViewport");
    // The viewport is rendered from the session's own composed scene, so the canvas can
    // never draw something the editor did not compose.
    expect(page).toContain("scene={mountable}");
  });

  it("decides access before it decides anything about a viewport", () => {
    const page = readSite(EDITOR_PAGE);
    const accessAt = page.indexOf("resolveUmbrellaEditorAccess");
    const refusalAt = page.indexOf("resolved.decision.granted");
    const viewportAt = page.indexOf("<EditorViewport");
    expect(accessAt).toBeGreaterThan(-1);
    expect(refusalAt).toBeGreaterThan(accessAt);
    // An unentitled request returns at the refusal above, so it never reaches a canvas.
    expect(viewportAt).toBeGreaterThan(refusalAt);
  });

  it("keeps a refused composition from opening a canvas at all", () => {
    const page = readSite(EDITOR_PAGE);
    expect(page).toContain("mountable === null");
    expect(page).toContain("EDITOR_VIEWPORT_COPY.notComposable");
  });

  it("routes both surfaces through one renderer boundary and no other", () => {
    for (const surface of [EDITOR_VIEWPORT, LIVE_VIEWPORT]) {
      const source = readSite(surface);
      expect(source).toContain("useSculptViewport");
      // Only the shared boundary may name the presentation seam.
      expect(source).not.toContain("@sceneaxi/engine-presentation");
    }

    const boundary = readSite(SCULPT_VIEWPORT);
    expect(boundary).toContain("@sceneaxi/engine-presentation");
    // ADR 0002: no Three type crosses the seam into site code.
    expect(boundary).not.toMatch(/\bfrom\s+["']three["']/);
    expect(boundary).not.toMatch(/\bTHREE\./);
  });

  it("names exactly one renderer-owning module across the whole tier", () => {
    const owners = SITE_SOURCE_FILES.filter((relative) =>
      readSite(relative).includes("createThreeSculptPresentationBackend"),
    );
    expect(owners).toEqual([SCULPT_VIEWPORT]);
  });

  it("states that the viewport draws and never advances the session", () => {
    expect(EDITOR_VIEWPORT_COPY.honesty).toContain("never advances a kernel session");
    expect(EDITOR_VIEWPORT_COPY.honesty).toContain(
      "run on the server",
    );
    expect(EDITOR_VIEWPORT_COPY.lede).toContain(LIVE_OPEN_PRESENTATION.coreLabel);
    expect(Object.isFrozen(EDITOR_VIEWPORT_COPY)).toBe(true);
  });

  it("names the no-pixel panel the page actually renders", () => {
    // The page shows two frame reports with opposite `pixelsDrawn` values, so the copy
    // that explains the no-pixel one must name that panel's own heading — otherwise a
    // reader attaches it to the browser report directly above it, which does draw.
    const noPixelPanel = "Server session frame";
    expect(EDITOR_VIEWPORT_COPY.honesty).toContain(noPixelPanel);
    expect(readSite(EDITOR_PAGE)).toContain(`<h3>${noPixelPanel}</h3>`);
    // The report the browser surface publishes must not answer to that same name.
    expect(readSite(EDITOR_VIEWPORT)).toContain('heading="Browser session frame"');
  });

  it("does not turn the editor into the public path or the public path into an editor", () => {
    // The editor is entitled and the open path is public; neither borrows the other's
    // copy, so a reader is never told a page is open when it is gated, or vice versa.
    expect(readSite(EDITOR_PAGE)).not.toContain("LIVE_OPEN_COPY");
    expect(readSite("umbrella/src/app/open/page.tsx")).not.toContain("EDITOR_VIEWPORT_COPY");
  });
});

describe("umbrella live open path", () => {
  it("serves a composed scene the browser can mount", () => {
    const scene = resolveLiveOpenScene();
    expect(scene.ok).toBe(true);
    if (!scene.ok) return;
    expect(scene.value.instances.length).toBeGreaterThanOrEqual(2);
    for (const instance of scene.value.instances) {
      expect(scene.value.artifacts[instance.artifactId]).toBeDefined();
      expect(describePlacement(instance)).toMatch(/^world \[.*\] · depth \d+$/);
    }
  });

  it("is public: nothing about it reads identity, credits, or entitlement", () => {
    const source = readFileSync(
      new URL("../../sites/umbrella/src/app/open/page.tsx", import.meta.url),
      "utf8",
    );
    for (const forbidden of [
      "resolveUmbrellaEditorAccess",
      "createUmbrellaIdentityPlane",
      "readSessionToken",
      "SCENEAXI_SITE_EDITOR_PREVIEW",
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });

  it("routes the path site-kit publishes and links it from the overview", () => {
    expect(LIVE_OPEN_PATH).toBe("/open");
    const overview = readFileSync(
      new URL("../../sites/umbrella/src/app/page.tsx", import.meta.url),
      "utf8",
    );
    expect(overview).toContain("LIVE_OPEN_PATH");
    const layout = readFileSync(
      new URL("../../sites/umbrella/src/app/layout.tsx", import.meta.url),
      "utf8",
    );
    expect(layout).toContain("LIVE_OPEN_PATH");
  });

  it("declares its one engine edge in the manifest and the bundler config", () => {
    const manifest = JSON.parse(
      readFileSync(new URL("../../sites/umbrella/package.json", import.meta.url), "utf8"),
    ) as { readonly dependencies: Record<string, string> };
    expect(manifest.dependencies["@sceneaxi/engine-presentation"]).toBe(
      "link:../../packages/engine-presentation",
    );

    const config = readFileSync(
      new URL("../../sites/umbrella/next.config.ts", import.meta.url),
      "utf8",
    );
    expect(config).toContain("@sceneaxi/engine-presentation");
  });

  it.each(["catalog-game", "catalog-web"])(
    "keeps the presentation seam out of sites/%s, which draws nothing",
    (site) => {
      const manifest = JSON.parse(
        readFileSync(new URL(`../../sites/${site}/package.json`, import.meta.url), "utf8"),
      ) as { readonly dependencies: Record<string, string> };
      expect(manifest.dependencies["@sceneaxi/engine-presentation"]).toBeUndefined();
    },
  );
});

/**
 * A scene instance count written into prose instead of read from the placement list.
 *
 * `LIVE_OPEN_INSTANCE_COUNT` exists so shipped copy cannot miscount the served scene,
 * which only holds while no surface spells the number out; an interpolated count reads
 * as `} instances` in source and is deliberately not matched.
 */
const HARDCODED_INSTANCE_COUNT =
  /\b(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+instances\b/i;

describe("live open copy stays honest about the presentation core", () => {
  const RETIRED_FRAMING = [
    ...LIVE_OPEN_PRESENTATION.retiredLabels,
    "multi-renderer",
    "stage 1 has not run",
  ].map((label) => label.toLowerCase());

  it("reads its banned framing from the shipped registry", () => {
    expect(LIVE_OPEN_PRESENTATION.retiredLabels.length).toBeGreaterThan(0);
    for (const retired of LIVE_OPEN_PRESENTATION.retiredLabels) {
      expect(RETIRED_FRAMING).toContain(retired.toLowerCase());
    }
  });

  it("scans every committed site source, so a new surface cannot opt out", () => {
    expect(SITE_SOURCE_FILES.length).toBeGreaterThan(0);
    for (const covered of [
      "umbrella/src/app/open/page.tsx",
      LIVE_VIEWPORT,
      SCULPT_VIEWPORT,
      EDITOR_PAGE,
      EDITOR_VIEWPORT,
      "umbrella/src/app/page.tsx",
      "umbrella/src/lib/live-open.ts",
      "umbrella/src/lib/editor-viewport.ts",
      "catalog-game/src/app/page.tsx",
      "catalog-web/src/app/page.tsx",
    ]) {
      expect(SITE_SOURCE_FILES).toContain(covered);
    }
  });

  it("names the product presentation core the way ADR 0017 requires", () => {
    expect(LIVE_OPEN_PRESENTATION.coreLabel).toBe("Three presentation core");
    expect(LIVE_OPEN_COPY.lede).toContain("Three presentation core");
  });

  it("states an instance count the served scene actually has", () => {
    const opened = resolveLiveOpenScene();
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    expect(LIVE_OPEN_INSTANCE_COUNT).toBe(opened.value.instances.length);
    for (const sentence of [LIVE_OPEN_COPY.lede, LIVE_OPEN_COPY.teaser]) {
      expect(sentence).toContain(`places ${opened.value.instances.length} instances`);
    }
  });

  it("offers a teaser that claims no viewport and promises no gesture", () => {
    expect(LIVE_OPEN_COPY.teaser).toContain(LIVE_OPEN_PRESENTATION.coreLabel);
    expect(LIVE_OPEN_COPY.teaser).not.toContain("This page");
    expect(LIVE_OPEN_COPY.lede).toContain("Drag to orbit, scroll to zoom");
    for (const gesture of ["drag to orbit", "scroll to zoom"]) {
      expect(LIVE_OPEN_COPY.teaser.toLowerCase()).not.toContain(gesture);
    }
  });

  it("renders the first-person lede only where the viewport is actually mounted", () => {
    const rendersLede = SITE_SOURCE_FILES.filter((relative) =>
      readFileSync(new URL(`../../sites/${relative}`, import.meta.url), "utf8").includes(
        "LIVE_OPEN_COPY.lede",
      ),
    );
    expect(rendersLede.length).toBeGreaterThan(0);
    for (const relative of rendersLede) {
      const source = readFileSync(
        new URL(`../../sites/${relative}`, import.meta.url),
        "utf8",
      );
      expect(source).toContain("<LiveViewport");
    }
  });

  it.each(SITE_SOURCE_FILES)(
    "keeps a written-out instance count out of %s, so every count stays derived",
    (relative) => {
      const source = readFileSync(
        new URL(`../../sites/${relative}`, import.meta.url),
        "utf8",
      );
      expect(source).not.toMatch(HARDCODED_INSTANCE_COUNT);
    },
  );

  it("attributes runtime and scene evidence to their actual producers", () => {
    expect(LIVE_OPEN_COPY.honesty).toContain(
      "live frame report comes from the running presentation core",
    );
    expect(LIVE_OPEN_COPY.honesty).toContain(
      "composition pipeline supplies the scene digest, instance count, hierarchy, depths, and world transforms",
    );
    expect(LIVE_OPEN_COPY.honesty).toContain(
      "site-kit supplies the Role labels as placement annotations",
    );
    expect(LIVE_OPEN_COPY.honesty).toContain(
      "None of this evidence is page-authored",
    );
  });

  it.each(SITE_SOURCE_FILES)(
    "keeps the retired experimental framing out of %s",
    (relative) => {
      const source = readFileSync(
        new URL(`../../sites/${relative}`, import.meta.url),
        "utf8",
      ).toLowerCase();
      for (const retired of RETIRED_FRAMING) {
        expect(source).not.toContain(retired);
      }
    },
  );
});

describe("the sites tier keeps the hermetic root hermetic", () => {
  it("declares no framework dependency in the root manifest", () => {
    const manifest = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as {
      readonly dependencies?: Record<string, string>;
      readonly devDependencies?: Record<string, string>;
    };
    const declared = Object.keys({ ...manifest.dependencies, ...manifest.devDependencies });
    for (const framework of ["next", "react", "react-dom", "better-auth", "stripe"]) {
      expect(declared).not.toContain(framework);
    }
  });

  it("keeps sites/ out of the pnpm workspace, so the root lockfile never moves for a site", () => {
    const workspace = readFileSync(new URL("../../pnpm-workspace.yaml", import.meta.url), "utf8");
    expect(workspace).toContain("packages/*");
    expect(workspace).toContain("apps/*");
    expect(/^\s*-\s*["']?sites\//m.test(workspace)).toBe(false);
  });

  it("makes each site a valid standalone pnpm workspace rooted at itself", () => {
    for (const dir of ["umbrella", "catalog-game", "catalog-web"]) {
      const workspace = readFileSync(
        new URL(`../../sites/${dir}/pnpm-workspace.yaml`, import.meta.url),
        "utf8",
      );
      expect(workspace).toMatch(/^packages:\s*\n\s*-\s*["']?\.["']?\s*$/m);
    }
  });

  it("gives every site a link: dependency on site-kit rather than a workspace: one", () => {
    for (const dir of ["umbrella", "catalog-game", "catalog-web"]) {
      const manifest = JSON.parse(
        readFileSync(new URL(`../../sites/${dir}/package.json`, import.meta.url), "utf8"),
      ) as { readonly dependencies: Record<string, string> };
      expect(manifest.dependencies["@sceneaxi/site-kit"]).toBe("link:../../packages/site-kit");
    }
  });

  it("runs check:sites as a gate stage, with no stage removed", () => {
    const manifest = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as {
      readonly scripts: Record<string, string>;
    };
    const gate = manifest.scripts["gate"] ?? "";
    for (const stage of [
      "check:syntax",
      "check:boundaries",
      "check:contracts",
      "check:sites",
      "check:desktop",
      "build",
      "test",
      "lint",
    ]) {
      expect(gate).toContain(stage);
    }
    expect(gate).not.toContain("|| true");
    expect(gate).not.toContain("--no-verify");
  });

  it("does not reference the repo root path in any committed site file", () => {
    expect(REPO_ROOT.length).toBeGreaterThan(0);
    for (const dir of ["umbrella", "catalog-game", "catalog-web"]) {
      const env = readFileSync(new URL(`../../sites/${dir}/.env.example`, import.meta.url), "utf8");
      expect(env).not.toContain(REPO_ROOT);
      // Names only: no line assigns a value.
      for (const line of env.split("\n")) {
        const trimmed = line.trim();
        if (trimmed.length === 0 || trimmed.startsWith("#")) continue;
        expect(trimmed).toMatch(/^[A-Z0-9_]+=$/);
      }
    }
  });
});
