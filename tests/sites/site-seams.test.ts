/**
 * Seam and configuration tests for the three deployable sites.
 *
 * These live under `tests/` rather than each site's own `test/` because the sites are
 * separate single-package workspaces outside the repository-root workspace, so
 * `@sceneaxi/site-umbrella` is not resolvable by public package name from the hermetic
 * root. The seams are imported by path instead; the rule they satisfy — every unit
 * exports a frozen typed seam with a covering test — is unchanged.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  LIVE_OPEN_COPY,
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
const UMBRELLA_ORIGIN = "https://sceneaxi-umbrella.vercel.app";

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

describe("umbrella identity plane is unwired and honest about it", () => {
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

describe("live open copy stays honest about the presentation core", () => {
  const SITE_SOURCE_FILES = [
    "umbrella/src/app/open/page.tsx",
    "umbrella/src/app/open/_components/live-viewport.tsx",
    "umbrella/src/app/page.tsx",
    "umbrella/src/lib/live-open.ts",
  ] as const;

  it("names the product presentation core the way ADR 0017 requires", () => {
    expect(LIVE_OPEN_PRESENTATION.coreLabel).toBe("Three presentation core");
    expect(LIVE_OPEN_COPY.lede).toContain("Three presentation core");
  });

  it.each(SITE_SOURCE_FILES)(
    "keeps the retired experimental framing out of %s",
    (relative) => {
      const source = readFileSync(
        new URL(`../../sites/${relative}`, import.meta.url),
        "utf8",
      ).toLowerCase();
      for (const retired of [
        "experimental three preview",
        "non-decision",
        "multi-renderer",
        "stage 1 has not run",
      ]) {
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
