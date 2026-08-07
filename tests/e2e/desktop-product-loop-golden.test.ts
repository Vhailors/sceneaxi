/**
 * First-release desktop product loop (sceneaxi#196).
 *
 * This test crosses the actual seams the packaged app uses without editing the
 * Electron tier: desktop-shell chrome/model -> existing host bridge -> shared
 * authoring session and orchestrated composed-scene open path.
 */
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  Window as HappyWindow,
  type CustomEvent as HappyCustomEvent,
  type HTMLElement as HappyHTMLElement,
} from "happy-dom";
import { createDocument, writeDocumentFile } from "@sceneaxi/authoring-core";
import {
  DESKTOP_VIEWPORT_PLAY_EVENT,
  createDesktopVisualState,
  desktopVisualView,
  renderDesktopChrome,
} from "@sceneaxi/desktop-shell";
import { createDesktopBridge, desktopOpenScene } from "../../desktop/linux/src/index.ts";

const dirs: string[] = [];
const windows: HappyWindow[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  for (const window of windows.splice(0)) window.close();
});

function projectDir() {
  const dir = mkdtempSync(join(tmpdir(), "sceneaxi-product-loop-"));
  dirs.push(dir);
  const starter = desktopOpenScene();
  if (!starter.ok) throw new Error(`desktop scene refused: ${starter.reason}`);
  const result = writeDocumentFile(
    join(dir, "scene.json"),
    createDocument({
      id: "desktop-first-release",
      data: {
        ...starter.composed.document.data,
        title: "First release",
        entities: [{ id: "hero" }],
      },
    }),
    { cwd: dir },
  );
  if (!result.ok) throw new Error("desktop product-loop fixture refused");
  return dir;
}

/**
 * The tests project compiles without the DOM lib, so element types come from
 * happy-dom itself rather than from a global `HTMLElement`.
 */
function query(window: HappyWindow, selector: string) {
  return window.document.querySelector(selector) as HappyHTMLElement | null;
}

function queryAll(window: HappyWindow, selector: string) {
  return [...window.document.querySelectorAll(selector)] as HappyHTMLElement[];
}

async function click(window: HappyWindow, selector: string) {
  const element = query(window, selector);
  if (element === null) throw new Error(`missing product-loop control ${selector}`);
  element.click();
  for (let turn = 0; turn < 20; turn += 1) {
    await Promise.resolve();
    if (window.document.querySelector("[data-busy]") === null) return;
  }
  throw new Error(`product-loop control did not settle ${selector}`);
}

type ChromeHarnessPort = {
  readonly bridge: ReturnType<typeof createDesktopBridge>;
  readonly ipcClone: <T>(value: T) => T;
};

/**
 * Mount the emitted chrome over a real bridge the way the packaged app does:
 * the renderer only ever sees structured-cloned values, so every request and
 * response crosses `ipcClone` exactly as it would cross Electron IPC.
 *
 * `start()` is separate from mounting so a case can register its viewport-play
 * listener first — the script binds its handlers as it evaluates.
 */
function mountChrome(
  dir: string,
  intercept?: (port: ChromeHarnessPort) => (request: unknown) => Promise<unknown>,
) {
  const bridge = createDesktopBridge({ cwd: dir, nowMs: () => 1_753_920_000_000 });
  const window = new HappyWindow({ width: 1000, height: 700 });
  windows.push(window);
  const ipcClone = <T>(value: T): T => window.eval(`(${JSON.stringify(value)})`) as T;
  const request =
    intercept?.({ bridge, ipcClone }) ??
    (async (value: unknown) => ipcClone(bridge.handle(ipcClone(value))));
  Object.defineProperty(window, "structuredClone", { value: ipcClone });
  Object.defineProperty(window, "sceneaxiDesktop", { value: { request } });
  const html = renderDesktopChrome(
    desktopVisualView(
      createDesktopVisualState({
        profile: "game",
        window: { width: 1000, height: 700 },
      }),
    ),
  );
  const match = /<script>([\s\S]*?)<\/script>/.exec(html);
  if (match === null) throw new Error("desktop chrome lost its emitted script");
  const script = match[1];
  if (script === undefined) throw new Error("desktop chrome emitted an empty script");
  window.document.write(html.replace(match[0], ""));
  return {
    window,
    start: () => {
      window.eval(script);
    },
  };
}

describe("desktop first-release product loop", () => {
  it("drives profile switching, open, save recovery, and viewport play through the emitted UI", async () => {
    const dir = projectDir();
    const requests: Array<{ action?: unknown; payload?: { op?: unknown } }> = [];
    let deferredAcceptedSaves = 2;
    let reportMissingRecovery = true;
    let refuseNextPlay = false;
    const { window, start } = mountChrome(dir, ({ bridge, ipcClone }) => async (request) => {
      const typed = JSON.parse(JSON.stringify(request)) as {
        action?: unknown;
        payload?: { op?: unknown };
      };
      requests.push(typed);
      if (refuseNextPlay && typed.action === "open-path") {
        refuseNextPlay = false;
        return ipcClone({
          ok: false,
          reason: "DESKTOP_SCENE_NOT_COMPOSABLE",
          message: "The active composition is invalid.",
          detail: null,
        });
      }
      const response = bridge.handle(typed);
      if (
        deferredAcceptedSaves > 0 &&
        typed.action === "authoring" &&
        typed.payload?.op === "accept" &&
        response.ok
      ) {
        deferredAcceptedSaves -= 1;
        return ipcClone({
          ...response,
          data: {
            ...(response.data as Record<string, unknown>),
            phase: "pending",
            journalRecoveryPending: true,
            transactionId: "fixture-pending-apply",
          },
        });
      }
      if (
        reportMissingRecovery &&
        typed.action === "authoring" &&
        typed.payload?.op === "recover" &&
        response.ok
      ) {
        reportMissingRecovery = false;
        return ipcClone({
          ...response,
          data: {
            ...(response.data as Record<string, unknown>),
            phase: "pending",
            journalRecoveryPending: true,
            transactionId: "fixture-pending-apply",
            diagnostics: [
              {
                code: "journal-not-found",
                message: "The pending apply journal is missing.",
                reReadHint: "Re-read the document in a fresh session.",
              },
            ],
          },
        });
      }
      return ipcClone(response);
    });
    let playback: { closed?: unknown; tickDigests?: unknown } | null = null;
    window.document.addEventListener(DESKTOP_VIEWPORT_PLAY_EVENT, (event) => {
      const detail = (event as HappyCustomEvent).detail as {
        accepted: boolean;
        exercise: { closed?: unknown; tickDigests?: unknown };
      };
      playback = detail.exercise;
      detail.accepted = true;
      (detail as { frame?: number }).frame = 27;
    });
    start();

    const shell = query(window, ".shell");
    const status = () =>
      query(window, "[data-project-status]")?.textContent ?? "";
    expect(shell?.dataset.tier).toBe("narrow");
    expect(shell?.dataset.profile).toBe("game");
    expect(window.document.querySelectorAll("button")).toHaveLength(78);
    expect(window.document.querySelectorAll('button:not([tabindex="-1"])')).toHaveLength(
      73,
    );

    const refusalHelp = query(window, "#status-refusal-help");
    const refusalLegend = query(window, "#refusal-legend");
    expect(refusalLegend?.hidden).toBe(true);
    await click(window, "#status-refusal-help");
    expect(refusalHelp?.getAttribute("aria-expanded")).toBe("true");
    expect(refusalLegend?.hidden).toBe(false);
    await click(window, "#status-refusal-help");
    expect(refusalHelp?.getAttribute("aria-expanded")).toBe("false");
    expect(refusalLegend?.hidden).toBe(true);

    await click(window, "#profile-web");
    await click(window, "#project-open");
    expect(status()).toContain("open · desktop-first-release");

    const externalScene = desktopOpenScene();
    if (!externalScene.ok) {
      throw new Error(`desktop scene refused: ${externalScene.reason}`);
    }
    const changed = writeDocumentFile(
      join(dir, "scene.json"),
      createDocument({
        id: "desktop-first-release",
        data: {
          ...externalScene.composed.document.data,
          title: "External edit",
          entities: [{ id: "hero" }],
        },
      }),
      { cwd: dir },
    );
    if (!changed.ok) throw new Error("external edit fixture refused");
    await click(window, "#web-inject-asset");
    expect(status()).toContain("Stage refused · content-hash-conflict");
    expect(readFileSync(join(dir, "scene.json"), "utf8")).toContain(
      '"title": "External edit"',
    );
    expect(readFileSync(join(dir, "scene.json"), "utf8")).not.toContain(
      '"assets/hero.glb"',
    );

    await click(window, "#project-open");
    await click(window, "#web-inject-asset");
    expect(status()).toContain("staged · Save to apply");

    await click(window, "#profile-game");
    expect(shell?.dataset.profile).toBe("web");
    expect(status()).toContain("DESKTOP_PROFILE_SWITCH_DIRTY");

    await click(window, "#project-open");
    await click(window, "#profile-game");
    expect(shell?.dataset.profile).toBe("game");
    expect(readFileSync(join(dir, "scene.json"), "utf8")).not.toContain(
      '"assets/hero.glb"',
    );

    await click(window, "#profile-web");
    await click(window, "#project-open");
    await click(window, "#web-inject-asset");
    await click(window, "#project-save");
    expect(status()).toContain("recovery pending · Save to refresh");

    await click(window, "#profile-kids");
    expect(shell?.dataset.profile).toBe("web");
    expect(status()).toContain("DESKTOP_RECOVERY_PENDING");

    await click(window, "#project-open");
    expect(status()).toContain("re-opened after recovery-pending");

    const resetScene = desktopOpenScene();
    if (!resetScene.ok) throw new Error(`desktop scene refused: ${resetScene.reason}`);
    const reset = writeDocumentFile(
      join(dir, "scene.json"),
      createDocument({
        id: "desktop-first-release",
        data: {
          ...resetScene.composed.document.data,
          title: "First release",
          entities: [{ id: "hero" }],
        },
      }),
      { cwd: dir },
    );
    if (!reset.ok) throw new Error("desktop product-loop reset refused");
    await click(window, "#project-open");
    await click(window, "#web-inject-asset");
    await click(window, "#project-save");
    expect(status()).toContain("recovery pending · Save to refresh");

    await click(window, "#profile-kids");
    expect(shell?.dataset.profile).toBe("web");
    expect(status()).toContain("DESKTOP_RECOVERY_PENDING");

    await click(window, "#project-save");
    expect(status()).toContain("re-opened after journal-not-found");
    expect(readFileSync(join(dir, "scene.json"), "utf8")).toContain(
      '"assets/hero.glb"',
    );

    await click(window, "#scene-play");
    expect(shell?.dataset.mode).toBe("run");
    expect(status()).toContain("Played composed scene · 4 ticks · viewport frame 27");
    expect(
      query(window, "[data-run-session-report]")?.textContent,
    ).toContain("Completed closed session · 4 ticks · terminal digest");
    expect(
      query(window, "[data-run-live-report]")?.textContent,
    ).toContain("Viewport frame 27 acknowledged for desktop-linux-open-scene");
    expect(playback).toMatchObject({ closed: true });
    expect((playback as { tickDigests: string[] } | null)?.tickDigests).toHaveLength(4);

    refuseNextPlay = true;
    await click(window, "#scene-play");
    expect(status()).toContain("Play refused · DESKTOP_SCENE_NOT_COMPOSABLE");
    expect(
      query(window, "[data-run-session-report]")?.textContent,
    ).toContain("No completed session for the latest Play request");
    expect(
      query(window, "[data-run-live-report]")?.textContent,
    ).toBe("No viewport frame was acknowledged for the latest Play request.");

    await click(window, "#profile-kids");
    expect(shell?.dataset.profile).toBe("kids");
    expect(window.document.querySelector("#scene-play")?.getAttribute("aria-disabled")).toBe(
      "true",
    );
    expect(
      queryAll(window, 'button:not([data-kind="inert"])')
        .map((button) => button.id)
        .sort(),
    ).toEqual(
      [
        "overlay-close-conflict-discard",
        "overlay-close-conflict-review",
        "overlay-close-refused-edit-brief",
        "overlay-close-refused-keep-draft",
        "overlay-open-palette",
        "profile-game",
        "profile-kids",
        "profile-web",
        "status-overlay-conflict",
        "status-overlay-palette",
        "status-overlay-refused",
        "status-refusal-help",
      ].sort(),
    );

    expect(requests.map((request) => request.payload?.op ?? request.action)).toEqual([
      "status",
      "propose",
      "status",
      "propose",
      "reject",
      "status",
      "status",
      "propose",
      "accept",
      "restart",
      "status",
      "propose",
      "accept",
      "recover",
      "restart",
      "open-path",
      "open-path",
    ]);
  });

  it("selects, reviews, saves, reopens, and plays the starter entity translation", async () => {
    const dir = projectDir();
    const { window, start } = mountChrome(dir);
    let playedTranslation: number | null = null;
    window.document.addEventListener(DESKTOP_VIEWPORT_PLAY_EVENT, (event) => {
      const detail = (event as HappyCustomEvent).detail as {
        accepted: boolean;
        frame?: number;
        exercise: {
          mountable: {
            instances: Array<{
              instanceId: string;
              worldTransform: { translation: number[] };
            }>;
          };
        };
      };
      playedTranslation =
        detail.exercise.mountable.instances.find(
          (instance) => instance.instanceId === "desktop-crate-beside",
        )?.worldTransform.translation[0] ?? null;
      detail.accepted = true;
      detail.frame = 31;
    });
    start();

    await click(window, "#project-open");
    expect(query(window, "[data-scene-entities]")?.hidden).toBe(false);
    await click(window, "#scene-entity-desktop-crate-beside");
    const input = query(window, "#scene-property-translation-x") as
      | (HappyHTMLElement & { value: string })
      | null;
    expect(input?.value).toBe("-4.4");
    if (input === null) throw new Error("translation input is missing");
    input.value = "-3.25";
    const before = readFileSync(join(dir, "scene.json"), "utf8");

    await click(window, "#scene-property-stage");
    expect(readFileSync(join(dir, "scene.json"), "utf8")).toBe(before);
    expect(query(window, "[data-project-status]")?.textContent).toContain(
      "property staged · review before Save",
    );
    expect(query(window, "[data-scene-property-review]")?.textContent).toContain(
      "SceneAxi inspector — proposed change",
    );

    await click(window, "#project-save");
    const saved = readFileSync(join(dir, "scene.json"), "utf8");
    expect(saved).not.toBe(before);
    await click(window, "#project-open");
    await click(window, "#scene-entity-desktop-crate-beside");
    expect(
      (query(window, "#scene-property-translation-x") as
        | (HappyHTMLElement & { value: string })
        | null)?.value,
    ).toBe("-3.25");

    await click(window, "#scene-play");
    expect(playedTranslation).toBe(-3.25);
    expect(query(window, "[data-project-status]")?.textContent).toContain(
      "Played composed scene · 4 ticks · viewport frame 31",
    );
  });

  /**
   * The panel used to hold the inspection the last open produced, so a value it
   * displayed could be one the session had already moved past — and the next
   * edit re-opened, which dropped the selection and refused.
   */
  it("keeps the property panel on the staged then saved value without reopening or reselecting", async () => {
    const dir = projectDir();
    const { window, start } = mountChrome(dir);
    start();

    const translationInput = () =>
      query(window, "#scene-property-translation-x") as
        | (HappyHTMLElement & { value: string })
        | null;
    const savedTranslationX = () => {
      const document_ = JSON.parse(readFileSync(join(dir, "scene.json"), "utf8")) as {
        data: {
          composedScene: {
            instances: Array<{
              instanceId: string;
              localTransform: { translation: number[] };
            }>;
          };
        };
      };
      return document_.data.composedScene.instances.find(
        (instance) => instance.instanceId === "desktop-crate-beside",
      )?.localTransform.translation[0];
    };

    await click(window, "#project-open");
    await click(window, "#scene-entity-desktop-crate-beside");
    const input = translationInput();
    if (input === null) throw new Error("translation input is missing");
    expect(input.value).toBe("-4.4");
    input.value = "-3.25";

    const before = readFileSync(join(dir, "scene.json"), "utf8");
    await click(window, "#scene-property-stage");
    expect(readFileSync(join(dir, "scene.json"), "utf8")).toBe(before);
    // The staged value is the host's, echoed back — not the string left in the field.
    expect(translationInput()?.value).toBe("-3.25");
    await click(window, "#scene-entity-desktop-crate-beside");
    expect(translationInput()?.value).toBe("-3.25");

    await click(window, "#project-save");
    expect(query(window, "[data-project-status]")?.textContent).toContain("saved");
    expect(savedTranslationX()).toBe(-3.25);
    // The applied proposal is spent: its diff goes, the written value stays.
    expect(query(window, "[data-scene-property-review]")?.hidden).toBe(true);
    expect(query(window, "[data-scene-property-review]")?.textContent).toBe("");
    expect(query(window, "[data-scene-entities]")?.hidden).toBe(false);
    expect(translationInput()?.value).toBe("-3.25");
    await click(window, "#scene-entity-desktop-crate-beside");
    expect(translationInput()?.value).toBe("-3.25");

    // A second edit straight after Save: no reopen, no reselect, and the value
    // typed at click time is the one that stages.
    const staged = translationInput();
    if (staged === null) throw new Error("translation input is missing after save");
    staged.value = "-1.5";
    const beforeSecond = readFileSync(join(dir, "scene.json"), "utf8");
    await click(window, "#scene-property-stage");
    expect(query(window, "[data-project-status]")?.textContent).toContain(
      "property staged · review before Save",
    );
    expect(readFileSync(join(dir, "scene.json"), "utf8")).toBe(beforeSecond);
    expect(translationInput()?.value).toBe("-1.5");

    await click(window, "#project-save");
    expect(savedTranslationX()).toBe(-1.5);
    expect(translationInput()?.value).toBe("-1.5");
  });

  /**
   * A pending durable apply and a staged proposal are different states with
   * different next steps, so Stage used to hand the recovery case guidance for
   * the other one — under no named refusal the legend could explain.
   */
  it("names recovery and a staged proposal separately when Stage refuses", async () => {
    const dir = projectDir();
    let deferNextAccept = true;
    const { window, start } = mountChrome(dir, ({ bridge, ipcClone }) => async (request) => {
      const typed = JSON.parse(JSON.stringify(request)) as {
        action?: unknown;
        payload?: { op?: unknown };
      };
      const response = bridge.handle(typed);
      if (
        deferNextAccept &&
        typed.action === "authoring" &&
        typed.payload?.op === "accept" &&
        response.ok
      ) {
        deferNextAccept = false;
        return ipcClone({
          ...response,
          data: {
            ...(response.data as Record<string, unknown>),
            phase: "pending",
            journalRecoveryPending: true,
            transactionId: "fixture-pending-apply",
          },
        });
      }
      return ipcClone(response);
    });
    start();
    const status = () => query(window, "[data-project-status]")?.textContent ?? "";
    const legendFor = (code: string) =>
      query(window, `#refusal-legend #refusal-${code}`)?.textContent ?? "";

    await click(window, "#project-open");
    await click(window, "#scene-entity-desktop-crate-beside");
    await click(window, "#scene-property-stage");
    expect(status()).toContain("property staged · review before Save");
    const before = readFileSync(join(dir, "scene.json"), "utf8");

    await click(window, "#scene-property-stage");
    expect(status()).toContain("DESKTOP_PROFILE_SWITCH_DIRTY");
    expect(status()).not.toContain("DESKTOP_RECOVERY_PENDING");
    expect(readFileSync(join(dir, "scene.json"), "utf8")).toBe(before);

    await click(window, "#project-save");
    expect(status()).toContain("recovery pending · Save to refresh");
    await click(window, "#scene-property-stage");
    expect(status()).toContain("DESKTOP_RECOVERY_PENDING");
    expect(status()).not.toContain("DESKTOP_PROFILE_SWITCH_DIRTY");

    // Both states name a refusal the shipped legend can actually explain, and
    // neither sentence is written for profile switching alone any more.
    expect(legendFor("DESKTOP_RECOVERY_PENDING")).toContain("staging another edit");
    expect(legendFor("DESKTOP_PROFILE_SWITCH_DIRTY")).toContain("staging another edit");
  });

  /**
   * The entity list lives in the always-visible project panel, but the editor it
   * reveals is a Build-mode inspector panel. Selecting from another mode used to
   * report the control activated while its editor stayed inside a hidden section.
   */
  it("switches to Build when the entity is selected from another mode", async () => {
    const dir = projectDir();
    const { window, start } = mountChrome(dir);
    start();
    const shell = query(window, ".shell");

    await click(window, "#project-open");
    await click(window, "#mode-sculpt");
    expect(shell?.dataset.mode).toBe("sculpt");
    expect(query(window, '[data-mode-panel="build"]')?.hidden).toBe(true);

    await click(window, "#scene-entity-desktop-crate-beside");
    expect(shell?.dataset.mode).toBe("build");
    expect(query(window, '[data-mode-panel="build"]')?.hidden).toBe(false);
    expect(query(window, "[data-scene-property-editor]")?.hidden).toBe(false);
    expect(
      query(window, "#scene-entity-desktop-crate-beside")?.getAttribute("aria-pressed"),
    ).toBe("true");
    expect(
      (query(window, "#scene-property-translation-x") as
        | (HappyHTMLElement & { value: string })
        | null)?.value,
    ).toBe("-4.4");

    // Already in Build: selecting again leaves the mode and the operator's dock
    // tab alone rather than resetting the panel.
    await click(window, "#dock-console");
    await click(window, "#scene-entity-desktop-crate-beside");
    expect(shell?.dataset.mode).toBe("build");
    expect(query(window, "#dock-console")?.getAttribute("aria-selected")).toBe("true");
  });
});
