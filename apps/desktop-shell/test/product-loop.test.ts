import { describe, expect, it } from "vitest";
import { OPEN_PATH_REFUSE_CODES } from "@sceneaxi/schemas";
import {
  desktopProductSurface,
  createDesktopVisualState,
  desktopVisualView,
  renderDesktopChrome,
  stageWebAssetInjection,
  stageWebHtml,
} from "@sceneaxi/desktop-shell";

describe("desktop product loop", () => {
  it("projects one active project file through policy-correct profile surfaces", () => {
    const game = desktopProductSurface("game");
    const web = desktopProductSurface("web");
    const kids = desktopProductSurface("kids");

    expect(game.project).toMatchObject({
      name: "SceneAxi Project",
      activeFile: "scene.json",
      files: [{ path: "scene.json", active: true }],
    });
    expect(game.capabilities.map((capability) => capability.id)).toEqual([
      "scene-authoring",
      "composed-scene-play",
      "freejs",
    ]);
    expect(web.capabilities.map((capability) => capability.id)).toEqual([
      "html",
      "site-canvas",
      "asset-injection",
      "composed-scene-play",
    ]);
    expect(kids.capabilities).toEqual([]);
    expect(kids.refusal?.code).toBe(OPEN_PATH_REFUSE_CODES.kidsRefused);
  });

  it("stages a project-relative Web asset as one reviewable document proposal", () => {
    const current = { title: "Landing", entities: [{ id: "hero" }] };
    const staged = stageWebAssetInjection({
      profile: "web",
      documentData: current,
      assetPath: "assets/hero.glb",
    });

    expect(staged).toEqual({
      ok: true,
      request: {
        action: "authoring",
        payload: {
          op: "propose",
          documentPath: "scene.json",
          jsonPointer: "/data",
          newValue: {
            title: "Landing",
            entities: [{ id: "hero" }],
            webExperience: {
              html: "<main id=\"sceneaxi-mount\"></main>",
              assets: ["assets/hero.glb"],
            },
          },
        },
      },
    });
    expect(current).toEqual({ title: "Landing", entities: [{ id: "hero" }] });

    expect(
      stageWebAssetInjection({
        profile: "game",
        documentData: current,
        assetPath: "assets/hero.glb",
      }),
    ).toMatchObject({ ok: false, reason: "DESKTOP_WEB_CAPABILITY_REQUIRED" });
    expect(
      stageWebAssetInjection({
        profile: "web",
        documentData: current,
        assetPath: "../outside.glb",
      }),
    ).toMatchObject({ ok: false, reason: "DESKTOP_WEB_ASSET_PATH_INVALID" });
  });

  it("stages Web HTML as inert document data while preserving injected assets", () => {
    const staged = stageWebHtml({
      profile: "web",
      documentData: {
        title: "Landing",
        webExperience: {
          html: '<main id="sceneaxi-mount"></main>',
          assets: ["assets/hero.glb"],
        },
      },
      html: '<main id="sceneaxi-mount"><h1>Launch</h1></main>',
    });

    expect(staged).toMatchObject({
      ok: true,
      request: {
        action: "authoring",
        payload: {
          op: "propose",
          documentPath: "scene.json",
          jsonPointer: "/data",
          newValue: {
            title: "Landing",
            webExperience: {
              html: '<main id="sceneaxi-mount"><h1>Launch</h1></main>',
              assets: ["assets/hero.glb"],
            },
          },
        },
      },
    });
    expect(
      stageWebHtml({ profile: "game", documentData: {}, html: "<main></main>" }),
    ).toMatchObject({ ok: false, reason: "DESKTOP_WEB_CAPABILITY_REQUIRED" });
  });

  it("renders the open, play, stage, and save loop against the existing desktop host bridge", () => {
    const game = renderDesktopChrome(
      desktopVisualView(createDesktopVisualState({ profile: "game" })),
    );
    const web = renderDesktopChrome(
      desktopVisualView(createDesktopVisualState({ profile: "web" })),
    );
    const kids = renderDesktopChrome(
      desktopVisualView(createDesktopVisualState({ profile: "kids" })),
    );

    expect(game).toContain('class="project-file is-active" aria-current="page"');
    expect(game).toContain('data-project-file="scene.json"');
    expect(game).toContain('id="project-open" data-kind="live" data-action="project-open"');
    expect(game).toContain('id="project-save" data-kind="live" data-action="project-save"');
    expect(game).toContain('id="scene-play" data-kind="live" data-action="scene-play"');
    expect(game).toContain('data-profile-surface="game"');
    expect(game).toContain("FreeJS behavior");

    expect(web).toContain('data-profile-surface="web"');
    expect(web).toContain('id="web-stage-html" data-kind="live"');
    expect(web).toContain('id="web-inject-asset" data-kind="live"');
    expect(web).toContain("assets/hero.glb");
    expect(web).toContain("Stored HTML is data, never executed by this chrome");

    expect(kids).toContain(
      'id="project-open" data-kind="inert" aria-disabled="true" data-refusal="OPEN_PATH_KIDS_REFUSED"',
    );
    expect(kids).toContain("No editor on the Kids profile");

    expect(game).toContain("sceneaxiDesktopLinux");
    expect(game).toContain("action: 'open-path'");
    expect(game).toContain("op: 'status'");
    expect(game).toContain("op: 'accept'");
    expect(game).toContain("op: 'propose'");
  });
});
