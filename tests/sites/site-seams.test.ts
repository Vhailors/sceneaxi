/**
 * Seam and configuration tests for the three deployable sites.
 *
 * These live under `tests/` rather than each site's own `test/` because the sites are
 * separate install roots, not `pnpm-workspace` members, so `@sceneaxi/site-umbrella`
 * is not resolvable by public package name from the hermetic root. The seams are
 * imported by path instead; the rule they satisfy — every unit exports a frozen typed
 * seam with a covering test — is unchanged.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  UMBRELLA_BRAND,
  createUmbrellaIdentityPlane,
  resolveBillingMode,
  resolveFamilyLinks,
  resolveUmbrellaEditorAccess,
  seam as umbrellaSeam,
} from "../../sites/umbrella/src/index.ts";
import { readEditorState } from "../../sites/umbrella/src/lib/editor-state.ts";
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

describe("umbrella editor URL state", () => {
  it.each(["1junk,2,3", "1,,3", "0x10,2,3"])(
    "refuses a partially parsed translation component in %s",
    (tx) => {
      expect(readEditorState({ tx })).toMatchObject({
        ok: false,
        reason: "SITE_REQUEST_MALFORMED",
      });
    },
  );

  it("accepts complete decimal and exponent translation components", () => {
    const result = readEditorState({ tx: "-1.5,2e1,.25" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.instances[0]?.transform.translation).toEqual([-1.5, 20, 0.25]);
  });
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
