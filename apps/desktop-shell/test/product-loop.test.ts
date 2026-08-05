import { describe, expect, it } from "vitest";
import { OPEN_PATH_REFUSE_CODES } from "@sceneaxi/schemas";
import {
  DESKTOP_PRODUCT_REFUSAL_MESSAGES,
  DESKTOP_PRODUCT_REFUSALS,
  DESKTOP_VIEWPORT_PLAY_EVENT,
  DESKTOP_WEB_ASSET_MAX_COUNT,
  DESKTOP_WEB_ASSET_PATH_MAX_LENGTH,
  DESKTOP_WEB_HTML_MAX_LENGTH,
  DESKTOP_WEB_STAGE_CONFIG,
  desktopProductSurface,
  desktopWebStageDecision,
  createDesktopVisualState,
  desktopVisualView,
  kidsProfileRefusal,
  renderDesktopChrome,
  stageWebAssetInjection,
  stageWebHtml,
} from "@sceneaxi/desktop-shell";

const CONTENT_HASH = `sha256:${"a".repeat(64)}`;

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
    expect(kidsProfileRefusal()).toMatchObject({
      code: kids.refusal?.code,
      summary: kids.refusal?.message,
    });
  });

  it("stages a project-relative Web asset as one reviewable document proposal", () => {
    const current = { title: "Landing", entities: [{ id: "hero" }] };
    const staged = stageWebAssetInjection({
      profile: "web",
      documentData: current,
      contentHash: CONTENT_HASH,
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
          expectedContentHash: CONTENT_HASH,
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
        contentHash: CONTENT_HASH,
        assetPath: "assets/hero.glb",
      }),
    ).toMatchObject({ ok: false, reason: "DESKTOP_WEB_CAPABILITY_REQUIRED" });
    expect(
      stageWebAssetInjection({
        profile: "web",
        documentData: current,
        contentHash: CONTENT_HASH,
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
      contentHash: CONTENT_HASH,
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
          expectedContentHash: CONTENT_HASH,
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
      stageWebHtml({
        profile: "game",
        documentData: {},
        contentHash: CONTENT_HASH,
        html: "<main></main>",
      }),
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
    expect(game).toContain(
      'id="project-open" data-kind="live" data-product-action data-action="project-open"',
    );
    expect(game).toContain(
      'id="project-save" data-kind="live" data-product-action data-action="project-save"',
    );
    expect(game).toContain(
      'id="scene-play" data-kind="live" data-product-action data-action="scene-play"',
    );
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
    expect(game).toContain("payload: { documentPath: T.product.documentPath }");
    expect(game).toContain("data-run-session-report");
    expect(game).toContain("data-run-live-report");
    expect(game).toContain("op: 'status'");
    expect(game).toContain("op: 'reject'");
    expect(game).toContain("op: recovering ? 'recover' : 'accept'");
    expect(game).toContain("op: 'restart'");
    expect(game).toContain(DESKTOP_VIEWPORT_PLAY_EVENT);
  });

  it("ships the model's own staging decision instead of a browser paraphrase of it", () => {
    // The shipped browser path used to hand-copy the asset-path guard and the
    // proposal build. That copy is what drifts — it had already lost the markup
    // bounds. The emitted script now carries this exact function, so the tests
    // above and the document a visitor loads cannot answer differently.
    const web = renderDesktopChrome(
      desktopVisualView(createDesktopVisualState({ profile: "web" })),
    );
    expect(web).toContain(String(desktopWebStageDecision));
    expect(web).not.toContain("validAssetPath");

    // Embedding a compiled function is only safe if the document it lands in is
    // still parseable JavaScript, so the emitted script is compiled here rather
    // than trusted to be well-formed.
    const script = /<script>([\s\S]*?)<\/script>/.exec(web)?.[1] ?? "";
    expect(script.length).toBeGreaterThan(0);
    expect(() => new Function(script)).not.toThrow();

    // And its configuration travels as data, so the browser reads the same
    // document path, starter markup, bounds, and refusal names the model uses.
    expect(JSON.parse(JSON.stringify(DESKTOP_WEB_STAGE_CONFIG))).toEqual({
      documentPath: "scene.json",
      starterHtml: '<main id="sceneaxi-mount"></main>',
      htmlMaxLength: DESKTOP_WEB_HTML_MAX_LENGTH,
      assetPathMaxLength: DESKTOP_WEB_ASSET_PATH_MAX_LENGTH,
      assetMaxCount: DESKTOP_WEB_ASSET_MAX_COUNT,
      refusals: { ...DESKTOP_PRODUCT_REFUSALS },
    });
  });

  it("refuses oversized and null-bearing markup through the one decision", () => {
    const documentData = { title: "Landing" };
    expect(
      desktopWebStageDecision(
        {
          profile: "web",
          documentData,
          contentHash: CONTENT_HASH,
          kind: "html",
          html: "x".repeat(DESKTOP_WEB_HTML_MAX_LENGTH + 1),
          assetPath: "assets/hero.glb",
        },
        DESKTOP_WEB_STAGE_CONFIG,
      ),
    ).toMatchObject({ ok: false, reason: DESKTOP_PRODUCT_REFUSALS.webHtmlInvalid });

    expect(
      stageWebHtml({
        profile: "web",
        documentData,
        contentHash: CONTENT_HASH,
        html: `<main>${String.fromCharCode(0)}</main>`,
      }),
    ).toMatchObject({ ok: false, reason: DESKTOP_PRODUCT_REFUSALS.webHtmlInvalid });

    // A traversal that a prefix check alone would let through.
    expect(
      stageWebAssetInjection({
        profile: "web",
        documentData,
        contentHash: CONTENT_HASH,
        assetPath: "assets/../../etc/passwd",
      }),
    ).toMatchObject({
      ok: false,
      reason: DESKTOP_PRODUCT_REFUSALS.webAssetPathInvalid,
    });

    // Stored data the model cannot read is never replaced implicitly.
    expect(
      stageWebAssetInjection({
        profile: "web",
        documentData: { webExperience: { html: 4, assets: [] } },
        contentHash: CONTENT_HASH,
        assetPath: "assets/hero.glb",
      }),
    ).toMatchObject({
      ok: false,
      reason: DESKTOP_PRODUCT_REFUSALS.documentDataInvalid,
    });

    expect(
      stageWebAssetInjection({
        profile: "web",
        documentData: {
          webExperience: {
            html: "x".repeat(DESKTOP_WEB_HTML_MAX_LENGTH + 1),
            assets: [],
          },
        },
        contentHash: CONTENT_HASH,
        assetPath: "assets/hero.glb",
      }),
    ).toMatchObject({
      ok: false,
      reason: DESKTOP_PRODUCT_REFUSALS.webHtmlInvalid,
    });

    expect(
      stageWebAssetInjection({
        profile: "web",
        documentData,
        contentHash: CONTENT_HASH,
        assetPath: `assets/${"x".repeat(DESKTOP_WEB_ASSET_PATH_MAX_LENGTH)}.glb`,
      }),
    ).toMatchObject({
      ok: false,
      reason: DESKTOP_PRODUCT_REFUSALS.webAssetPathInvalid,
    });

    expect(
      stageWebAssetInjection({
        profile: "web",
        documentData: {
          webExperience: {
            html: "<main></main>",
            assets: Array.from(
              { length: DESKTOP_WEB_ASSET_MAX_COUNT + 1 },
              (_, index) => `assets/item-${index}.glb`,
            ),
          },
        },
        contentHash: CONTENT_HASH,
        assetPath: "assets/hero.glb",
      }),
    ).toMatchObject({
      ok: false,
      reason: DESKTOP_PRODUCT_REFUSALS.documentDataInvalid,
    });

    expect(
      stageWebHtml({
        profile: "web",
        documentData: {
          webExperience: {
            html: `<main>${String.fromCharCode(0)}</main>`,
            assets: [],
          },
        },
        contentHash: CONTENT_HASH,
        html: "<main>replacement</main>",
      }),
    ).toMatchObject({
      ok: false,
      reason: DESKTOP_PRODUCT_REFUSALS.webHtmlInvalid,
    });

    // Non-finite numbers are not JSON, and the in-process form still says so.
    expect(
      stageWebHtml({
        profile: "web",
        documentData: { ratio: Number.POSITIVE_INFINITY },
        contentHash: CONTENT_HASH,
        html: "<main></main>",
      }),
    ).toMatchObject({
      ok: false,
      reason: DESKTOP_PRODUCT_REFUSALS.documentDataInvalid,
    });

    expect(
      stageWebHtml({
        profile: "web",
        documentData: { onLoad: () => undefined },
        contentHash: CONTENT_HASH,
        html: "<main></main>",
      }),
    ).toMatchObject({
      ok: false,
      reason: DESKTOP_PRODUCT_REFUSALS.documentDataInvalid,
    });
  });

  it("names the transient refusal while a project request is in flight", () => {
    const html = renderDesktopChrome(
      desktopVisualView(createDesktopVisualState({ profile: "web" })),
    );
    const script = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1] ?? "";

    expect(script).toContain(
      "el.dataset.busy = 'true';\n      setRefusal(el, T.product.refusals.requestInFlight);",
    );
  });

  it("distinguishes an absent runtime from a failed runtime request", async () => {
    const html = renderDesktopChrome(
      desktopVisualView(createDesktopVisualState({ profile: "game" })),
    );
    const script = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1] ?? "";
    const source =
      /const runtimeRequest = (async \(request\) => \{[\s\S]*?\n {2}\});/.exec(
        script,
      )?.[1];
    expect(source).toBeTruthy();

    const createRequest = new Function(
      "desktopPort",
      "T",
      `return ${source ?? "null"};`,
    ) as (
      desktopPort: () => unknown,
      tables: unknown,
    ) => (request: unknown) => Promise<unknown>;
    const tables = {
      product: { refusals: DESKTOP_PRODUCT_REFUSALS },
    };

    await expect(
      createRequest(() => null, tables)({ action: "open-path" }),
    ).resolves.toBeNull();
    await expect(
      createRequest(
        () => ({
          request: async () => {
            throw new Error("ipc channel closed");
          },
        }),
        tables,
      )({ action: "open-path" }),
    ).resolves.toEqual({
      ok: false,
      reason: DESKTOP_PRODUCT_REFUSALS.runtimeRequestFailed,
      message: "ipc channel closed",
      detail: "ipc channel closed",
    });
  });

  it("stops the active action when a fresh-session re-read refuses", async () => {
    const html = renderDesktopChrome(
      desktopVisualView(createDesktopVisualState({ profile: "web" })),
    );
    const script = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1] ?? "";
    const source =
      /const restartProject = (async \(diagnostic\) => \{[\s\S]*?\n {2}\});/.exec(
        script,
      )?.[1];
    expect(source).toBeTruthy();

    const statuses: string[] = [];
    const createRestart = new Function(
      "productStatus",
      "T",
      "runtimeRequest",
      "responseReason",
      `let projectData = {}; let projectDirty = true; let projectRecovering = true; return ${source ?? "null"};`,
    ) as (
      productStatus: (state: string, text: string) => void,
      tables: unknown,
      runtimeRequest: (request: unknown) => Promise<unknown>,
      responseReason: (response: unknown) => string | null,
    ) => (diagnostic: string) => Promise<boolean>;
    const restart = createRestart(
      (_state, text) => statuses.push(text),
      {
        product: {
          documentPath: "scene.json",
          refusals: DESKTOP_PRODUCT_REFUSALS,
        },
      },
      async () => ({
        ok: true,
        data: {
          ok: false,
          diagnostics: [{ code: "document-not-found" }],
        },
      }),
      () => "document-not-found",
    );

    await expect(restart("recovery-pending")).resolves.toBe(false);
    expect(statuses.at(-1)).toContain(
      "Recovery reset · recovery-pending · document-not-found",
    );
  });

  it("explains every refusal name the surface can print", () => {
    const html = renderDesktopChrome(
      desktopVisualView(createDesktopVisualState({ profile: "web" })),
    );
    for (const code of Object.values(DESKTOP_PRODUCT_REFUSALS)) {
      expect(DESKTOP_PRODUCT_REFUSAL_MESSAGES[code], code).toBeTruthy();
      expect(html, code).toContain(`id="refusal-${code}"`);
    }
    // One code, one row: the visual registry re-exports the Web capability
    // refusal rather than declaring a second owner for it.
    const rows = [
      ...html.matchAll(
        new RegExp(`id="refusal-${DESKTOP_PRODUCT_REFUSALS.webCapabilityRequired}"`, "g"),
      ),
    ];
    expect(rows).toHaveLength(1);
  });
});
