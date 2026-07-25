/**
 * Tests for the site configuration behaviour that lives in `@sceneaxi/site-kit`:
 * family cross-links, catalog → umbrella editor deep-link resolution, and the umbrella
 * editor-session orchestration. The sites re-export these; the logic and its coverage
 * live here so it is gate-tested with no browser and no network.
 */
import { describe, expect, it } from "vitest";
import {
  createCreditsPlane,
  createIdentityPlane,
  resolveEditorLinkFromEnv,
  resolveEditorSession,
  resolveFamilyLinks,
  resolveUmbrellaEditorOrigin,
} from "@sceneaxi/site-kit";

const NOW = "2026-07-25T12:00:00.000Z";

describe("umbrella family links", () => {
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

  it("allows localhost so development needs no second code path", () => {
    expect(
      resolveFamilyLinks({ NEXT_PUBLIC_SCENEAXI_GAME_CATALOG_ORIGIN: "http://localhost:3000" })
        .gameCatalog,
    ).toBe("http://localhost:3000");
  });
});

describe("catalog umbrella origin resolution", () => {
  it.each([
    ["missing", {}],
    ["empty", { NEXT_PUBLIC_SCENEAXI_UMBRELLA_ORIGIN: "" }],
    ["non-https", { NEXT_PUBLIC_SCENEAXI_UMBRELLA_ORIGIN: "http://evil.example" }],
    ["malformed", { NEXT_PUBLIC_SCENEAXI_UMBRELLA_ORIGIN: "not-a-url" }],
  ])("refuses when the origin is %s", (_label, env) => {
    expect(resolveUmbrellaEditorOrigin(env).ok).toBe(false);
  });

  it("accepts https and localhost", () => {
    expect(
      resolveUmbrellaEditorOrigin({
        NEXT_PUBLIC_SCENEAXI_UMBRELLA_ORIGIN: "https://umbrella.vercel.app",
      }).ok,
    ).toBe(true);
    expect(
      resolveUmbrellaEditorOrigin({
        NEXT_PUBLIC_SCENEAXI_UMBRELLA_ORIGIN: "http://localhost:3000",
      }).ok,
    ).toBe(true);
  });

  it("builds a deep link that names its own source surface", () => {
    const env = { NEXT_PUBLIC_SCENEAXI_UMBRELLA_ORIGIN: "https://umbrella.vercel.app" };
    const game = resolveEditorLinkFromEnv(env, "catalog-game", "game-lantern-prop");
    const web = resolveEditorLinkFromEnv(env, "catalog-web", "web-hero-diorama");
    expect(game.ok && game.value).toContain("source=catalog-game");
    expect(web.ok && web.value).toContain("source=catalog-web");
    expect(game.ok && game.value.startsWith("https://umbrella.vercel.app/editor?")).toBe(true);
  });

  it("refuses to build a link when the origin refuses", () => {
    const link = resolveEditorLinkFromEnv({}, "catalog-game", "game-lantern-prop");
    expect(link.ok).toBe(false);
  });
});

describe("umbrella editor session access", () => {
  it("refuses with the identity plane's own reason when unwired and preview is off", async () => {
    const resolved = await resolveEditorSession({
      identity: createIdentityPlane({ now: () => NOW }),
      credits: createCreditsPlane(),
      env: {},
    });
    expect(resolved.previewEnabled).toBe(false);
    expect(resolved.decision).toMatchObject({
      granted: false,
      reason: "IDENTITY_PLANE_NOT_WIRED",
    });
  });

  it("grants a banner-marked preview only when the server env sets the flag to 1", async () => {
    const granted = await resolveEditorSession({
      identity: createIdentityPlane({ now: () => NOW }),
      credits: createCreditsPlane(),
      env: { SCENEAXI_SITE_EDITOR_PREVIEW: "1" },
    });
    expect(granted.decision).toMatchObject({ granted: true, mode: "preview" });

    for (const value of ["", "0", "true", "yes"]) {
      const refused = await resolveEditorSession({
        identity: createIdentityPlane({ now: () => NOW }),
        credits: createCreditsPlane(),
        env: { SCENEAXI_SITE_EDITOR_PREVIEW: value },
      });
      expect(refused.decision.granted).toBe(false);
    }
  });
});
