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
  DESKTOP_SCENE_HIERARCHY_REFUSALS,
  EDITOR_COMMAND_REGISTRY,
  type JsonValue,
} from "@sceneaxi/schemas";
import {
  DESKTOP_PRODUCT_REFUSALS,
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
  for (let turn = 0; turn < 60; turn += 1) {
    await Promise.resolve();
    if (window.document.querySelector("[data-busy]") === null) return;
  }
  throw new Error(`product-loop control did not settle ${selector}`);
}

type ChromeHarnessPort = {
  readonly bridge: ReturnType<typeof createDesktopBridge>;
  readonly ipcClone: <T>(value: T) => T;
};

function requestOperation(request: unknown): string | null {
  const typed = request as {
    action?: unknown;
    payload?: { op?: unknown; commandId?: unknown };
  };
  if (typed.action === "authoring" && typeof typed.payload?.op === "string") {
    return typed.payload.op;
  }
  if (typed.action !== "command") return null;
  switch (typed.payload?.commandId) {
    case "project-save":
    case "change-review-accept":
      return "accept";
    case "change-review-reject":
      return "reject";
    case "edit-undo":
      return "undo";
    case "run-play":
      return "open-path";
    default:
      return typeof typed.payload?.commandId === "string" ? typed.payload.commandId : null;
  }
}

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
  const bridge = createDesktopBridge({
    cwd: dir,
    nowMs: () => 1_753_920_000_000,
    commandCapabilities: [...new Set(
      EDITOR_COMMAND_REGISTRY.map((command) => command.capability.id),
    )],
  });
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
  it("executes the emitted Web asset-path decision in the mounted chrome", async () => {
    const mountWebExperience = (webExperience: JsonValue) => {
      const dir = projectDir();
      const scene = desktopOpenScene();
      if (!scene.ok) throw new Error(`desktop scene refused: ${scene.reason}`);
      const written = writeDocumentFile(
        join(dir, "scene.json"),
        createDocument({
          id: "desktop-web-paths",
          data: {
            ...scene.composed.document.data,
            title: "Web paths",
            webExperience,
          },
        }),
        { cwd: dir },
      );
      if (!written.ok) throw new Error("desktop Web path fixture refused");
      const requests: Array<{
        action?: unknown;
        payload?: { op?: unknown; newValue?: unknown };
      }> = [];
      const mounted = mountChrome(dir, ({ bridge, ipcClone }) => async (request) => {
        const typed = ipcClone(request) as {
          action?: unknown;
          payload?: { op?: unknown; newValue?: unknown };
        };
        requests.push(typed);
        return ipcClone(bridge.handle(typed));
      });
      mounted.start();
      return { ...mounted, requests };
    };

    const accepted = mountWebExperience({
      html: "<main>Existing</main>",
      assets: ["assets/models/hero-1.glb"],
    });
    await click(accepted.window, "#profile-web");
    await click(accepted.window, "#web-stage-html");
    expect(
      accepted.requests.find((request) => request.payload?.op === "propose")?.payload
        ?.newValue,
    ).toEqual({
      html: '<main id="sceneaxi-mount"></main>',
      assets: ["assets/models/hero-1.glb"],
    });

    for (const webExperience of [
      { html: "<main></main>", assets: ["assets/models/../../secret.glb"] },
      { html: "<main></main>", assets: [4] },
    ]) {
      const refused = mountWebExperience(webExperience);
      await click(refused.window, "#profile-web");
      await click(refused.window, "#web-stage-html");
      expect(
        query(refused.window, "[data-project-status]")?.textContent,
      ).toContain(`Stage refused · ${DESKTOP_PRODUCT_REFUSALS.documentDataInvalid}`);
      expect(
        refused.requests.some((request) => request.payload?.op === "propose"),
      ).toBe(false);
    }
  });

  it("renders the active proposal and atomically accepts, rejects, and refuses stale hashes", async () => {
    const dir = projectDir();
    const bridge = createDesktopBridge({ cwd: dir });
    const requests: Array<{ action?: unknown; payload?: { op?: unknown } }> = [];
    const refuseNextAuthoring = new Set<string>();
    const window = new HappyWindow({ width: 1000, height: 700 });
    const ipcClone = <T>(value: T): T =>
      window.eval(`(${JSON.stringify(value)})`) as T;
    windows.push(window);
    Object.defineProperty(window, "structuredClone", { value: ipcClone });
    Object.defineProperty(window, "sceneaxiDesktop", {
      value: {
        request: async (request: unknown) => {
          const typed = JSON.parse(JSON.stringify(request)) as {
            action?: unknown;
            payload?: { op?: unknown };
          };
          requests.push(typed);
          if (
            requestOperation(typed) !== null &&
            refuseNextAuthoring.delete(requestOperation(typed) as string)
          ) {
            return ipcClone({
              ok: false,
              reason: "DESKTOP_RUNTIME_UNAVAILABLE",
              message: "The authoring host is unavailable.",
              detail: null,
            });
          }
          return ipcClone(bridge.handle(typed));
        },
      },
    });

    const html = renderDesktopChrome(
      desktopVisualView(
        createDesktopVisualState({
          profile: "game",
          window: { width: 1000, height: 700 },
        }),
      ),
    );
    const match = /<script>([\s\S]*?)<\/script>/.exec(html);
    if (match?.[1] === undefined) throw new Error("desktop chrome lost its emitted script");
    window.document.write(html.replace(match[0], ""));
    window.eval(match[1]);

    const documentText = () => readFileSync(join(dir, "scene.json"), "utf8");
    const status = () => query(window, "[data-project-status]")?.textContent ?? "";
    const badge = () => query(window, "[data-change-badge]")?.textContent ?? "";
    const proposal = () => query(window, "[data-change-proposal]");
    // The outcome dialog starts empty: it prints a refusal a response reported,
    // never a standing sentence about what a conflict generally is.
    expect(query(window, "[data-outcome-code]")?.textContent).toBe("");

    // Reject with nothing under review must not reach the host at all.
    await click(window, "#change-review-reject");
    expect(requests).toHaveLength(0);
    expect(status()).toContain("nothing under review · DESKTOP_PROPOSAL_NOT_REVIEWING");

    // Accept is the same decision from the other side and answers the same way:
    // no validated review means the named refusal, not the document action
    // underneath it.
    await click(window, "#change-review-accept");
    expect(requests).toHaveLength(0);
    expect(status()).toContain("nothing under review · DESKTOP_PROPOSAL_NOT_REVIEWING");

    await click(window, "#profile-web");
    await click(window, "#project-open");
    const beforeReject = documentText();
    await click(window, "#web-inject-asset");

    expect(proposal()?.hidden).toBe(false);
    expect(query(window, "[data-change-document]")?.textContent).toBe("scene.json");
    expect(query(window, "[data-change-content-hash]")?.textContent).toMatch(
      /^sha256:[0-9a-f]{64}$/,
    );
    expect(query(window, "[data-change-diff]")?.textContent).toContain(
      "=== SceneAxi inspector — proposed change",
    );
    expect(query(window, "[data-change-diff]")?.textContent).toContain(
      '"assets/hero.glb"',
    );
    expect(badge()).toBe("1");
    expect(status()).toContain("staged");
    expect(query(window, "[data-project-state]")?.dataset.projectState).toBe("dirty");
    expect(documentText()).toBe(beforeReject);

    const stagedDiff = query(window, "[data-change-diff]")?.textContent;
    refuseNextAuthoring.add("propose");
    await click(window, "#web-stage-html");
    expect(proposal()?.hidden).toBe(false);
    expect(badge()).toBe("1");
    expect(query(window, "[data-change-diff]")?.textContent).toBe(stagedDiff);
    expect(status()).toContain("Stage refused · DESKTOP_RUNTIME_UNAVAILABLE");

    refuseNextAuthoring.add("reject");
    await click(window, "#change-review-reject");
    expect(documentText()).toBe(beforeReject);
    expect(proposal()?.hidden).toBe(false);
    expect(badge()).toBe("1");
    expect(query(window, "[data-change-diff]")?.textContent).toBe(stagedDiff);
    expect(status()).toContain("Reject refused · DESKTOP_RUNTIME_UNAVAILABLE");

    await click(window, "#change-review-reject");
    expect(documentText()).toBe(beforeReject);
    expect(proposal()?.hidden).toBe(true);
    expect(badge()).toBe("0");
    expect(status()).toContain("rejected · no document written");
    expect(query(window, "[data-project-state]")?.dataset.projectState).toBe("open");

    await click(window, "#web-inject-asset");
    await click(window, "#change-review-accept");
    expect(documentText()).toContain('"assets/hero.glb"');
    expect(proposal()?.hidden).toBe(true);
    expect(badge()).toBe("0");
    expect(status()).toContain("saved");
    expect(query(window, "[data-project-state]")?.dataset.projectState).toBe("saved");

    const resetScene = desktopOpenScene();
    if (!resetScene.ok) throw new Error(`desktop scene refused: ${resetScene.reason}`);
    expect(
      writeDocumentFile(
        join(dir, "scene.json"),
        createDocument({
          id: "desktop-first-release",
          data: { ...resetScene.composed.document.data, title: "Reset" },
        }),
        { cwd: dir },
      ).ok,
    ).toBe(true);
    await click(window, "#project-open");
    await click(window, "#web-inject-asset");

    expect(
      writeDocumentFile(
        join(dir, "scene.json"),
        createDocument({
          id: "desktop-first-release",
          data: { ...resetScene.composed.document.data, title: "External after review" },
        }),
        { cwd: dir },
      ).ok,
    ).toBe(true);
    await click(window, "#change-review-accept");

    expect(documentText()).toContain('"title": "External after review"');
    expect(documentText()).not.toContain('"assets/hero.glb"');
    expect(proposal()?.hidden).toBe(false);
    expect(badge()).toBe("1");
    // The refusal reaches the operator through the one outcome dialog, carrying
    // the host's own diagnostic rather than a sentence about conflicts.
    expect(query(window, '[data-overlay="outcome"]')?.hidden).toBe(false);
    expect(query(window, "[data-outcome-code]")?.textContent).toBe(
      "content-hash-conflict",
    );
    expect(query(window, "[data-outcome-message]")?.textContent).not.toBe("");

    await click(window, "#overlay-close-outcome-dismiss");
    expect(query(window, '[data-overlay="outcome"]')?.hidden).toBe(true);
    // Dismissing decides nothing: the proposal the host still holds is still on
    // the surface, and discarding it is the same all-or-nothing Reject.
    expect(proposal()?.hidden).toBe(false);
    expect(badge()).toBe("1");
    // A refused host response leaves the last validated review projected rather
    // than clearing the panel over an answer that decided nothing.
    refuseNextAuthoring.add("reject");
    await click(window, "#change-review-reject");
    expect(status()).toContain("Reject refused · DESKTOP_RUNTIME_UNAVAILABLE");
    expect(proposal()?.hidden).toBe(false);
    expect(badge()).toBe("1");
    expect(documentText()).toContain('"title": "External after review"');

    await click(window, "#change-review-reject");
    expect(proposal()?.hidden).toBe(true);
    expect(badge()).toBe("0");
    expect(status()).toContain("rejected · no document written");
    expect(documentText()).toContain('"title": "External after review"');

    await click(window, "#web-inject-asset");
    expect(proposal()?.hidden).toBe(false);
    expect(
      writeDocumentFile(
        join(dir, "scene.json"),
        createDocument({
          id: "desktop-first-release",
          data: { ...resetScene.composed.document.data, title: "External after second review" },
        }),
        { cwd: dir },
      ).ok,
    ).toBe(true);
    await click(window, "#web-stage-html");
    expect(documentText()).toContain('"title": "External after second review"');
    expect(proposal()?.hidden).toBe(true);
    expect(badge()).toBe("0");
    expect(status()).toContain("Stage refused · content-hash-conflict");
    expect(query(window, "[data-project-state]")?.dataset.projectState).toBe("refused");
    // The host cleared the stale proposal, so Reject has nothing to decide — but
    // the conflict it just reported is still the truth about this document, and
    // must not be replaced by a status that only says nothing is under review.
    const stageConflictStatus = status();
    const stageConflictRequests = requests.length;
    await click(window, "#overlay-close-outcome-dismiss");
    await click(window, "#change-review-reject");
    const unavailableConflictStatus = status();
    expect(unavailableConflictStatus).toContain(
      "Decision refused · DESKTOP_PROPOSAL_NOT_REVIEWING · content-hash-conflict",
    );
    expect(query(window, "[data-project-state]")?.dataset.projectState).toBe("refused");
    expect(requests).toHaveLength(stageConflictRequests);
    // Repeating an unavailable decision answers the same way rather than
    // accumulating the previous answer as detail.
    await click(window, "#change-review-reject");
    expect(status()).toBe(unavailableConflictStatus);
    // Accept carries the recorded conflict too rather than reporting the
    // document as having nothing staged, and reaches the host no more than
    // Reject does.
    await click(window, "#change-review-accept");
    expect(status()).toBe(unavailableConflictStatus);
    expect(requests).toHaveLength(stageConflictRequests);
    // A newer, unrelated status owns the status line: the blocked decision must
    // report what the operator just clicked, not replay the earlier stage
    // refusal as if it had happened again.
    await click(window, "#project-save");
    const noStagedChangesStatus = status();
    expect(noStagedChangesStatus).toContain("no staged changes");
    await click(window, "#change-review-reject");
    expect(status()).not.toBe(stageConflictStatus);
    expect(status()).not.toBe(noStagedChangesStatus);
    expect(status()).toBe(unavailableConflictStatus);
    expect(requests).toHaveLength(stageConflictRequests);
    // Re-reading the document is that resolution.
    await click(window, "#project-open");
    expect(requests).toHaveLength(stageConflictRequests + 2);
    await click(window, "#change-review-reject");
    expect(status()).toContain("nothing under review · DESKTOP_PROPOSAL_NOT_REVIEWING");
    expect(requests).toHaveLength(stageConflictRequests + 2);

    expect(requests.map((request) => requestOperation(request) ?? request.action)).toEqual([
      "status",
      "scene-hierarchy-inspect",
      "propose",
      "propose",
      "reject",
      "reject",
      "status",
      "scene-hierarchy-inspect",
      "propose",
      "accept",
      "scene-hierarchy-inspect",
      "status",
      "scene-hierarchy-inspect",
      "propose",
      "accept",
      "reject",
      "reject",
      "status",
      "scene-hierarchy-inspect",
      "propose",
      "propose",
      "status",
      "scene-hierarchy-inspect",
    ]);
  });

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
      if (refuseNextPlay && requestOperation(typed) === "open-path") {
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
        requestOperation(typed) === "accept" &&
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
        requestOperation(typed) === "recover" &&
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
    expect(window.document.querySelectorAll("button")).toHaveLength(75);
    expect(window.document.querySelectorAll('button:not([tabindex="-1"])')).toHaveLength(
      70,
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
    expect(status()).toContain("recovery pending · transaction fixture-pending-apply");

    // An indeterminate apply is not a decidable review. Offering Accept/Reject
    // here would offer two buttons that do something other than what they say:
    // Reject comes back `apply-in-progress`, and Accept issues `recover`.
    expect(query(window, "[data-change-proposal]")?.hidden).toBe(true);
    expect(query(window, "[data-change-empty]")?.hidden).toBe(false);
    expect(query(window, "[data-change-badge]")?.textContent).toBe("0");

    // Pending recovery is not a decidable review, so Reject must not reach the
    // host and must leave the recovery the operator still has to resolve.
    const recoveryStatus = status();
    const recoveryRequests = requests.length;
    expect(query(window, "[data-project-state]")?.dataset.projectState).toBe("recovering");
    await click(window, "#web-stage-html");
    expect(status()).toContain("Stage refused · DESKTOP_RECOVERY_PENDING");
    expect(status()).toContain(recoveryStatus);
    expect(query(window, "[data-project-state]")?.dataset.projectState).toBe("recovering");
    expect(requests).toHaveLength(recoveryRequests);
    await click(window, "#change-review-reject");
    expect(status()).toContain("Decision refused · DESKTOP_RECOVERY_PENDING");
    expect(status()).toContain(recoveryStatus);
    expect(query(window, "[data-project-state]")?.dataset.projectState).toBe("recovering");
    // Announced once: a second blocked decision must not stack another prefix
    // over the recovery instructions the operator still has to follow.
    const announcedRecoveryStatus = status();
    await click(window, "#change-review-reject");
    expect(status()).toBe(announcedRecoveryStatus);
    expect(query(window, "[data-project-state]")?.dataset.projectState).toBe("recovering");
    expect(requests).toHaveLength(recoveryRequests);

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
    expect(status()).toContain("recovery pending · transaction fixture-pending-apply");

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
        "overlay-close-outcome-dismiss",
        "overlay-open-palette",
        "profile-game",
        "profile-kids",
        "profile-web",
        "status-overlay-palette",
        "status-refusal-help",
      ].sort(),
    );

    // Change Review's two decisions reach the authoring session, so the
    // refuse-only profile must not be able to drive them.
    const requestsBeforeKidsReview = requests.length;
    for (const id of ["change-review-accept", "change-review-reject"]) {
      const control = query(window, `#${id}`);
      expect(control?.dataset.kind).toBe("inert");
      expect(control?.getAttribute("aria-disabled")).toBe("true");
      control?.click();
    }
    await Promise.resolve();
    expect(requests.length).toBe(requestsBeforeKidsReview);
    expect(shell?.dataset.profile).toBe("kids");
    expect(shell?.dataset.mode).toBe("run");

    expect(requests.map((request) => requestOperation(request) ?? request.action)).toEqual([
      "status",
      "scene-hierarchy-inspect",
      "propose",
      "status",
      "scene-hierarchy-inspect",
      "propose",
      "reject",
      "status",
      "scene-hierarchy-inspect",
      "status",
      "scene-hierarchy-inspect",
      "propose",
      "accept",
      "restart",
      "scene-hierarchy-inspect",
      "status",
      "scene-hierarchy-inspect",
      "propose",
      "accept",
      "recover",
      "restart",
      "scene-hierarchy-inspect",
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

    // Nothing staged yet, so Change Review shows the honest empty state.
    expect(query(window, "[data-change-proposal]")?.hidden).toBe(true);
    expect(query(window, "[data-change-empty]")?.hidden).toBe(false);
    expect(query(window, "[data-change-badge]")?.textContent).toBe("0");

    await click(window, "#scene-property-stage");
    expect(readFileSync(join(dir, "scene.json"), "utf8")).toBe(before);
    expect(query(window, "[data-project-status]")?.textContent).toContain(
      "property staged · review before Save",
    );
    expect(query(window, "[data-scene-property-review]")?.textContent).toContain(
      "SceneAxi inspector — proposed change",
    );
    // The typed edit is the same E1 proposal Change Review decides, so the
    // returned snapshot drives the badge and the panel — the host's own
    // document path, base content hash, and rendered diff, nothing invented.
    expect(query(window, "[data-change-proposal]")?.hidden).toBe(false);
    expect(query(window, "[data-change-empty]")?.hidden).toBe(true);
    expect(query(window, "[data-change-badge]")?.textContent).toBe("1");
    expect(query(window, "[data-change-document]")?.textContent).toBe("scene.json");
    expect(query(window, "[data-change-content-hash]")?.textContent).toMatch(
      /^sha256:[0-9a-f]{64}$/,
    );
    expect(query(window, "[data-change-diff]")?.textContent).toContain(
      "=== SceneAxi inspector — proposed change",
    );
    expect(query(window, "[data-change-diff]")?.textContent).toContain("-3.25");

    await click(window, "#project-save");
    const saved = readFileSync(join(dir, "scene.json"), "utf8");
    expect(saved).not.toBe(before);
    // The applied proposal is spent: the panel goes back to the empty state
    // rather than keeping a diff of a change already on disk.
    expect(query(window, "[data-change-proposal]")?.hidden).toBe(true);
    expect(query(window, "[data-change-empty]")?.hidden).toBe(false);
    expect(query(window, "[data-change-badge]")?.textContent).toBe("0");
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
   * The typed edit parks the one E1 proposal Change Review decides, so the
   * all-or-nothing Reject reaches it on the default Game profile — the only
   * staging path that profile has.
   */
  it("rejects a staged Translation X edit without writing the document", async () => {
    const dir = projectDir();
    const { window, start } = mountChrome(dir);
    start();

    await click(window, "#project-open");
    await click(window, "#scene-entity-desktop-crate-beside");
    const input = query(window, "#scene-property-translation-x") as
      | (HappyHTMLElement & { value: string })
      | null;
    if (input === null) throw new Error("translation input is missing");
    input.value = "-3.25";
    const before = readFileSync(join(dir, "scene.json"), "utf8");

    await click(window, "#scene-property-stage");
    expect(query(window, "[data-change-proposal]")?.hidden).toBe(false);
    expect(query(window, "[data-change-badge]")?.textContent).toBe("1");

    await click(window, "#change-review-reject");
    expect(readFileSync(join(dir, "scene.json"), "utf8")).toBe(before);
    expect(query(window, "[data-change-proposal]")?.hidden).toBe(true);
    expect(query(window, "[data-change-empty]")?.hidden).toBe(false);
    expect(query(window, "[data-change-badge]")?.textContent).toBe("0");
    expect(query(window, "[data-project-status]")?.textContent).toContain(
      "rejected · no document written",
    );
  });

  /**
   * A document can open cleanly and still carry a composition the property
   * inspection refuses. The panel used to answer that by vanishing, leaving the
   * operator to discover it later when Play refused.
   */
  it("names the host's inspection refusal instead of hiding the entity panel", async () => {
    const dir = projectDir();
    const starter = desktopOpenScene();
    if (!starter.ok) throw new Error(`desktop scene refused: ${starter.reason}`);
    const writeScene = (composedScene: JsonValue) => {
      const written = writeDocumentFile(
        join(dir, "scene.json"),
        createDocument({
          id: "desktop-first-release",
          data: {
            ...starter.composed.document.data,
            composedScene,
            title: "First release",
            entities: [{ id: "hero" }],
          },
        }),
        { cwd: dir },
      );
      if (!written.ok) throw new Error("composition fixture refused");
    };
    writeScene({
      ...(starter.composed.document.data as { composedScene: Record<string, JsonValue> })
        .composedScene,
      instances: "not-a-list",
    });

    const { window, start } = mountChrome(dir);
    start();
    const shell = query(window, ".shell");
    const refusal = () => query(window, "[data-scene-entities-refusal]");
    // The left dock is a drawer below the compact tier and starts closed, so a
    // reason that lives only in it is unreadable at the tier this window is at.
    const readableStatus = () =>
      queryAll(window, "[data-project-status]")
        .filter((el) => el.closest(".left-dock") === null)
        .map((el) => el.textContent ?? "");

    expect(shell?.dataset.tier).toBe("narrow");
    expect(shell?.dataset.drawerLeft).toBe("closed");

    await click(window, "#project-open");
    expect(query(window, "[data-scene-entities]")?.hidden).toBe(true);
    expect(refusal()?.hidden).toBe(false);
    expect(refusal()?.textContent).toContain("Scene entities unavailable");
    expect(refusal()?.textContent).toContain("validation-failed");
    expect(readableStatus().length).toBeGreaterThan(0);
    for (const text of readableStatus()) {
      expect(text).toContain("open · ");
      expect(text).toContain("Scene entities unavailable");
      expect(text).toContain("validation-failed");
    }

    // A composition the inspection accepts takes the refusal back down, in the
    // panel and in the status alike.
    writeScene((starter.composed.document.data as { composedScene: JsonValue }).composedScene);
    await click(window, "#project-open");
    expect(query(window, "[data-scene-entities]")?.hidden).toBe(false);
    expect(refusal()?.hidden).toBe(true);
    expect(refusal()?.textContent).toBe("");
    for (const text of readableStatus()) {
      expect(text).toContain("open · ");
      expect(text).not.toContain("Scene entities unavailable");
    }
  });

  /**
   * A refused re-open leaves no document behind it, so the panel must not keep
   * presenting the last one's entity and typed value as if they were current.
   */
  it("clears the entity panel when a re-open is refused", async () => {
    const dir = projectDir();
    const { window, start } = mountChrome(dir);
    start();
    const status = () => query(window, "[data-project-status]")?.textContent ?? "";
    const translationInput = () =>
      query(window, "#scene-property-translation-x") as
        | (HappyHTMLElement & { value: string })
        | null;

    await click(window, "#project-open");
    await click(window, "#scene-entity-desktop-crate-beside");
    expect(translationInput()?.value).toBe("-4.4");
    expect(query(window, "[data-scene-entities]")?.hidden).toBe(false);

    rmSync(join(dir, "scene.json"));
    await click(window, "#project-open");
    expect(status()).toContain("Open refused · document-not-found");
    expect(query(window, "[data-scene-entities]")?.hidden).toBe(true);
    expect(query(window, "[data-scene-property-editor]")?.hidden).toBe(true);
    expect(
      (query(window, "#scene-entity-desktop-crate-beside") as
        | (HappyHTMLElement & { value: string })
        | null)?.value,
    ).toBe("");

    // Nothing to stage against a document that is gone, and it says so.
    await click(window, "#scene-property-stage");
    expect(status()).toContain("refused");
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
        requestOperation(typed) === "accept" &&
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
    expect(status()).toContain("recovery pending · transaction fixture-pending-apply");
    expect(status()).toContain("Save to refresh");
    await click(window, "#scene-property-stage");
    expect(status()).toContain("DESKTOP_RECOVERY_PENDING");
    expect(status()).not.toContain("DESKTOP_PROFILE_SWITCH_DIRTY");
    // Recovery is still the truth about this document, so the refusal names
    // itself and keeps the transaction and the two instructions that resolve
    // it rather than replacing them with a bare code.
    expect(status()).toContain("Edit refused · DESKTOP_RECOVERY_PENDING");
    expect(status()).toContain("transaction fixture-pending-apply");
    expect(status()).toContain("Save to refresh or Open to re-read");
    expect(query(window, "[data-project-state]")?.dataset.projectState).toBe(
      "recovering",
    );

    // Changing the project root is blocked by the same recovery and answers the
    // same way: it names its own action and keeps the transaction and the two
    // instructions, and repeating it does not accumulate its own answer.
    await click(window, "#project-open-recent");
    const projectRefusal = status();
    expect(projectRefusal).toContain(
      "Project change refused · DESKTOP_RECOVERY_PENDING",
    );
    expect(projectRefusal).toContain("transaction fixture-pending-apply");
    expect(projectRefusal).toContain("Save to refresh or Open to re-read");
    expect(projectRefusal).not.toContain("Edit refused");
    expect(query(window, "[data-project-state]")?.dataset.projectState).toBe(
      "recovering",
    );
    await click(window, "#project-open-recent");
    expect(status()).toBe(projectRefusal);

    // So is switching profile, which must not leave the surface reporting the
    // previous action either.
    await click(window, "#overlay-close-outcome-dismiss");
    await click(window, "#profile-web");
    const profileRefusal = status();
    expect(profileRefusal).toContain(
      "Profile switch refused · DESKTOP_RECOVERY_PENDING",
    );
    expect(profileRefusal).toContain("transaction fixture-pending-apply");
    expect(profileRefusal).toContain("Save to refresh or Open to re-read");
    expect(profileRefusal).not.toContain("Project change refused");
    expect(query(window, "[data-project-state]")?.dataset.projectState).toBe(
      "recovering",
    );
    expect(query(window, ".shell")?.dataset.profile).toBe("game");
    await click(window, "#profile-web");
    expect(status()).toBe(profileRefusal);

    // Both states name a refusal the shipped legend can actually explain, and
    // neither sentence is written for profile switching alone any more.
    expect(legendFor("DESKTOP_RECOVERY_PENDING")).toContain("staging another edit");
    expect(legendFor("DESKTOP_PROFILE_SWITCH_DIRTY")).toContain("staging another edit");
  });

  /**
   * The Game profile's only staging path can lose the content-hash race too, so
   * the conflict it reports is recorded the way Web staging and Save record
   * theirs: the host's own diagnostic in the one outcome dialog, and a decision
   * that still names it once the host has cleared the stale proposal.
   */
  it("raises and records the real conflict when a typed edit stages against a moved document", async () => {
    const dir = projectDir();
    const { window, start } = mountChrome(dir);
    start();
    const status = () => query(window, "[data-project-status]")?.textContent ?? "";

    await click(window, "#project-open");
    await click(window, "#scene-entity-desktop-crate-beside");
    const input = query(window, "#scene-property-translation-x") as
      | (HappyHTMLElement & { value: string })
      | null;
    if (input === null) throw new Error("translation input is missing");
    input.value = "-3.25";

    const starter = desktopOpenScene();
    if (!starter.ok) throw new Error(`desktop scene refused: ${starter.reason}`);
    expect(
      writeDocumentFile(
        join(dir, "scene.json"),
        createDocument({
          id: "desktop-first-release",
          data: {
            ...starter.composed.document.data,
            title: "External before stage",
            entities: [{ id: "hero" }],
          },
        }),
        { cwd: dir },
      ).ok,
    ).toBe(true);
    const moved = readFileSync(join(dir, "scene.json"), "utf8");

    await click(window, "#scene-property-stage");
    expect(readFileSync(join(dir, "scene.json"), "utf8")).toBe(moved);
    expect(status()).toContain("Edit refused · content-hash-conflict");
    expect(query(window, "[data-change-proposal]")?.hidden).toBe(true);
    expect(query(window, "[data-change-badge]")?.textContent).toBe("0");
    expect(query(window, '[data-overlay="outcome"]')?.hidden).toBe(false);
    expect(query(window, "[data-outcome-title]")?.textContent).toBe("Edit refused");
    expect(query(window, "[data-outcome-code]")?.textContent).toBe(
      "content-hash-conflict",
    );
    expect(query(window, "[data-outcome-message]")?.textContent).not.toBe("");

    // The host cleared the stale proposal, so Reject has nothing to decide —
    // but the conflict it just reported is still the truth about this document
    // and is what the blocked decision carries.
    await click(window, "#overlay-close-outcome-dismiss");
    await click(window, "#change-review-reject");
    expect(status()).toContain(
      "Decision refused · DESKTOP_PROPOSAL_NOT_REVIEWING · content-hash-conflict",
    );
    expect(readFileSync(join(dir, "scene.json"), "utf8")).toBe(moved);
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
      (query(window, "#scene-entity-desktop-crate-beside") as
        | (HappyHTMLElement & { value: string })
        | null)?.value,
    ).toBe("desktop-crate-beside");
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

  it("selects any composed instance and redraws accepted transforms and add/remove settlement", async () => {
    const dir = projectDir();
    const { window, start } = mountChrome(dir);
    let played: Array<{
      instanceId: string;
      worldTransform: { rotationEulerDegrees: number[]; scale: number[] };
    }> = [];
    window.document.addEventListener(DESKTOP_VIEWPORT_PLAY_EVENT, (event) => {
      const detail = (event as HappyCustomEvent).detail as {
        accepted: boolean;
        frame?: number;
        exercise: { mountable: { instances: typeof played } };
      };
      played = detail.exercise.mountable.instances;
      detail.accepted = true;
      detail.frame = 44;
    });
    start();
    await click(window, "#project-open");

    const selection = query(window, "#scene-entity-desktop-crate-beside") as
      | (HappyHTMLElement & { value: string })
      | null;
    if (selection === null) throw new Error("composed-instance selector missing");
    selection.value = "desktop-crate-stacked";
    selection.dispatchEvent(new window.Event("change", { bubbles: true }));
    expect(query(window, "[data-scene-property-entity-id]")?.textContent)
      .toBe("desktop-crate-stacked");

    const settleTransform = async (selector: string, value: string) => {
      const input = query(window, selector) as (HappyHTMLElement & { value: string }) | null;
      if (input === null) throw new Error(`missing transform input ${selector}`);
      input.value = value;
      await click(window, "#scene-property-stage");
      expect(query(window, "[data-change-proposal]")?.hidden).toBe(false);
      await click(window, "#change-review-accept");
      expect(query(window, "[data-change-proposal]")?.hidden).toBe(true);
    };
    await settleTransform("#scene-property-rotation-y", "45");
    await settleTransform("#scene-property-scale-x", "1.25");

    await click(window, "#scene-instance-add");
    expect(
      query(window, "[data-change-proposal]")?.hidden,
      query(window, "[data-project-status]")?.textContent ?? "missing product status",
    ).toBe(false);
    selection.value = "desktop-crate-stacked-copy-1";
    selection.dispatchEvent(new window.Event("change", { bubbles: true }));
    expect(query(window, "[data-scene-property-entity-id]")?.textContent)
      .toBe("desktop-crate-stacked-copy-1");
    await click(window, "#change-review-accept");
    const afterAdd = readFileSync(join(dir, "scene.json"), "utf8");

    await click(window, "#scene-instance-remove");
    await click(window, "#change-review-reject");
    expect(readFileSync(join(dir, "scene.json"), "utf8")).toBe(afterAdd);
    selection.value = "desktop-crate-stacked-copy-1";
    selection.dispatchEvent(new window.Event("change", { bubbles: true }));
    expect(query(window, "[data-scene-property-entity-id]")?.textContent)
      .toBe("desktop-crate-stacked-copy-1");
    await click(window, "#scene-instance-remove");
    expect(query(window, "[data-change-proposal]")?.hidden).toBe(false);
    await click(window, "#change-review-accept");
    expect(query(window, "[data-project-status]")?.textContent).toContain("saved");
    expect(readFileSync(join(dir, "scene.json"), "utf8")).not.toBe(afterAdd);
    await click(window, '[data-command="edit-undo"]');
    expect(readFileSync(join(dir, "scene.json"), "utf8")).toBe(afterAdd);

    await click(window, "#scene-play");
    expect(played.find((instance) => instance.instanceId === "desktop-crate-stacked")?.worldTransform)
      .toMatchObject({ rotationEulerDegrees: [0, 45, 0], scale: [1.25, 1, 1] });
    expect(played.some((instance) => instance.instanceId === "desktop-crate-stacked-copy-1"))
      .toBe(true);
    expect(query(window, "[data-project-status]")?.textContent)
      .toContain("viewport frame 44");
  });

  it("keeps staged create review visible through dirty browser Open", async () => {
    const dir = projectDir();
    const { window, start } = mountChrome(dir);
    start();
    await click(window, "#project-open");
    await click(window, "#scene-entity-desktop-crate-beside");
    await click(window, "#scene-instance-add");

    const proposal = query(window, "[data-change-proposal]");
    const diff = query(window, "[data-change-diff]")?.textContent;
    expect(proposal?.hidden).toBe(false);
    expect(diff).toContain("desktop-crate-beside-copy-1");

    await click(window, "#project-browser-open");
    expect(query(window, "[data-change-proposal]")?.hidden).toBe(false);
    expect(query(window, "[data-change-diff]")?.textContent).toBe(diff);

    await click(window, "#change-review-accept");
    expect(query(window, "[data-change-proposal]")?.hidden).toBe(true);
    expect(query(window, "[data-project-status]")?.textContent)
      .not.toContain(DESKTOP_SCENE_HIERARCHY_REFUSALS.selectionStale);
    const hierarchy = query(window, "#scene-entity-desktop-crate-beside") as
      | (HappyHTMLElement & {
          options: ArrayLike<HappyHTMLElement & { value: string }>;
        })
      | null;
    expect(Array.from(hierarchy?.options ?? []).some(
      (option) => option.value === "desktop-crate-beside-copy-1",
    )).toBe(true);
  });

  it("keeps click and keyboard multi-selection in canonical hierarchy order", async () => {
    const { window, start } = mountChrome(projectDir());
    start();
    await click(window, "#project-open");

    const selection = query(window, "#scene-entity-desktop-crate-beside") as
      | (HappyHTMLElement & {
          multiple: boolean;
          options: ArrayLike<HappyHTMLElement & { selected: boolean; value: string }>;
          dataset: Record<string, string | undefined>;
        })
      | null;
    if (selection === null) throw new Error("hierarchy multi-selector missing");
    expect(selection.multiple).toBe(true);
    for (const option of Array.from(selection.options)) {
      option.selected = option.value === "desktop-crate-stacked" ||
        option.value === "desktop-crate-beside";
    }
    selection.dispatchEvent(new window.Event("change", { bubbles: true }));

    expect(selection.dataset.value).toBe(
      "desktop-crate-beside,desktop-crate-stacked",
    );
    expect(query(window, "[data-scene-property-entity-id]")?.textContent).toBe(
      "desktop-crate-beside",
    );
  });

  it("settles queued and in-flight selection before profile change", async () => {
    let releaseSelection = () => {};
    const selectionGate = new Promise<void>((resolve) => {
      releaseSelection = resolve;
    });
    let markSelectionResponded = () => {};
    const selectionResponded = new Promise<void>((resolve) => {
      markSelectionResponded = resolve;
    });
    let markSelectionStarted = () => {};
    const selectionStarted = new Promise<void>((resolve) => {
      markSelectionStarted = resolve;
    });
    let selectionRequests = 0;
    const { window, start } = mountChrome(projectDir(), ({ bridge, ipcClone }) =>
      async (request) => {
        const typed = ipcClone(request) as {
          action?: unknown;
          payload?: { commandId?: unknown; input?: Record<string, unknown> };
        };
        if (typed.action === "command" && typed.payload?.commandId === "scene-selection-set") {
          selectionRequests += 1;
          markSelectionStarted();
          await selectionGate;
          const input = typed.payload.input ?? {};
          const response = ipcClone(bridge.handle({
            ...typed,
            payload: {
              ...typed.payload,
              input: { ...input, instanceIds: ["desktop-crate-root"] },
            },
          }));
          markSelectionResponded();
          return response;
        }
        return ipcClone(bridge.handle(typed));
      });
    start();
    await click(window, "#project-open");
    const selection = query(window, "#scene-entity-desktop-crate-beside") as
      | (HappyHTMLElement & { value: string })
      | null;
    if (selection === null) throw new Error("hierarchy multi-selector missing");
    selection.value = "desktop-crate-stacked";
    selection.dispatchEvent(new window.Event("change", { bubbles: true }));
    await selectionStarted;
    selection.value = "desktop-crate-beside";
    selection.dispatchEvent(new window.Event("change", { bubbles: true }));
    query(window, "#profile-web")?.click();
    for (let turn = 0; turn < 5; turn += 1) await Promise.resolve();
    expect(selectionRequests).toBe(1);
    expect(query(window, ".shell")?.dataset.profile).toBe("game");
    releaseSelection();
    await selectionResponded;
    for (let turn = 0; turn < 60; turn += 1) {
      await Promise.resolve();
      if (query(window, ".shell")?.dataset.profile === "web") break;
    }
    expect(selectionRequests).toBe(2);
    expect(query(window, ".shell")?.dataset.profile).toBe("web");
    expect(query(window, "[data-scene-property-entity-id]")?.textContent)
      .toBe("desktop-crate-root");
  });

  it("renders object identity and current parentage after reparent and reopen", async () => {
    const { window, start } = mountChrome(projectDir());
    start();
    await click(window, "#project-open");

    const hierarchy = query(window, "#scene-entity-desktop-crate-beside") as
      | (HappyHTMLElement & {
          value: string;
          options: ArrayLike<HappyHTMLElement & { value: string }>;
        })
      | null;
    if (hierarchy === null) throw new Error("hierarchy selector missing");
    const optionText = (instanceId: string) =>
      Array.from(hierarchy.options).find((option) => option.value === instanceId)?.textContent;
    const initialText = optionText("desktop-crate-beside");
    expect(initialText).toContain(
      " · instance desktop-crate-beside · parent desktop-crate-root",
    );
    expect(initialText).not.toContain("Placed beside the root");
    const objectIdentity = initialText?.split(" · instance ")[0];
    expect(objectIdentity).toMatch(/^\s*Object [a-z0-9-]+$/);

    hierarchy.value = "desktop-crate-beside";
    hierarchy.dispatchEvent(new window.Event("change", { bubbles: true }));
    const parent = query(window, "#scene-instance-parent") as
      | (HappyHTMLElement & { value: string })
      | null;
    const policy = query(window, "#scene-instance-policy") as
      | (HappyHTMLElement & { value: string })
      | null;
    if (parent === null || policy === null) throw new Error("reparent controls missing");
    parent.value = "desktop-crate-stacked";
    policy.value = "preserve-local";
    await click(window, "#scene-instance-reparent");
    await click(window, "#change-review-accept");
    await click(window, "#project-open");

    expect(optionText("desktop-crate-beside")).toContain(
      `${objectIdentity} · instance desktop-crate-beside · parent desktop-crate-stacked`,
    );
    expect(optionText("desktop-crate-beside")).not.toContain("Placed beside the root");
  });

  it("names the diagnostic the conflict dialog is actually reporting", async () => {
    const dir = projectDir();
    const bridge = createDesktopBridge({ cwd: dir });
    let deferAcceptedSave = true;
    let reportStaleRecovery = true;
    const window = new HappyWindow({ width: 1000, height: 700 });
    const ipcClone = <T>(value: T): T =>
      window.eval(`(${JSON.stringify(value)})`) as T;
    windows.push(window);
    Object.defineProperty(window, "structuredClone", { value: ipcClone });
    Object.defineProperty(window, "sceneaxiDesktop", {
      value: {
        request: async (request: unknown) => {
          const typed = JSON.parse(JSON.stringify(request)) as {
            action?: unknown;
            payload?: { op?: unknown };
          };
          const response = bridge.handle(typed);
          if (!response.ok || requestOperation(typed) === null) return ipcClone(response);
          const data = response.data as Record<string, unknown>;
          if (deferAcceptedSave && requestOperation(typed) === "accept") {
            deferAcceptedSave = false;
            return ipcClone({
              ...response,
              data: {
                ...data,
                phase: "pending",
                journalRecoveryPending: true,
                transactionId: "fixture-pending-apply",
              },
            });
          }
          // The one recovery outcome that is a real authoring diagnostic but not
          // a moved content hash: the durable transaction resolved stale.
          if (reportStaleRecovery && requestOperation(typed) === "recover") {
            reportStaleRecovery = false;
            return ipcClone({
              ...response,
              data: {
                ...data,
                phase: "reviewing",
                journalRecoveryPending: false,
                transactionId: null,
                diagnostics: [
                  {
                    code: "journal-conflict",
                    message: "Pending transaction fixture-pending-apply is stale.",
                    reReadHint:
                      "Re-read the affected documents before accepting another proposal.",
                  },
                ],
              },
            });
          }
          return ipcClone(response);
        },
      },
    });

    const html = renderDesktopChrome(
      desktopVisualView(
        createDesktopVisualState({
          profile: "web",
          window: { width: 1000, height: 700 },
        }),
      ),
    );
    const match = /<script>([\s\S]*?)<\/script>/.exec(html);
    if (match?.[1] === undefined) throw new Error("desktop chrome lost its emitted script");
    window.document.write(html.replace(match[0], ""));
    window.eval(match[1]);

    const status = () => query(window, "[data-project-status]")?.textContent ?? "";
    const title = () => query(window, "[data-outcome-title]")?.textContent ?? "";
    const code = () => query(window, "[data-outcome-code]")?.textContent ?? "";
    const message = () => query(window, "[data-outcome-message]")?.textContent ?? "";
    // Nothing standing: the dialog is empty until a response fills it, so no
    // sentence about conflicts in general can be read as the current one.
    expect(title()).toBe("");
    expect(code()).toBe("");

    await click(window, "#project-open");
    await click(window, "#web-inject-asset");
    await click(window, "#project-save");
    expect(status()).toContain("recovery pending · transaction fixture-pending-apply");

    await click(window, "#project-save");
    expect(status()).toContain("Save refused · journal-conflict");
    expect(query(window, '[data-overlay="outcome"]')?.hidden).toBe(false);
    // The heading names the action that refused and the body carries the host's
    // own diagnostic, so a stale transaction is never announced as a moved
    // document. The heading is the dialog's `aria-labelledby`.
    expect(title()).toBe("Save refused");
    expect(code()).toBe("journal-conflict");
    expect(message()).toContain("is stale");
    expect(message()).toContain("Re-read the affected documents");

    await click(window, "#overlay-close-outcome-dismiss");
    await click(window, "#project-open");
    expect(status()).toContain("open · desktop-first-release");

    const externalScene = desktopOpenScene();
    if (!externalScene.ok) {
      throw new Error(`desktop scene refused: ${externalScene.reason}`);
    }
    expect(
      writeDocumentFile(
        join(dir, "scene.json"),
        createDocument({
          id: "desktop-first-release",
          data: { ...externalScene.composed.document.data, title: "External edit" },
        }),
        { cwd: dir },
      ).ok,
    ).toBe(true);
    await click(window, "#web-stage-html");
    expect(status()).toContain("Stage refused · content-hash-conflict");
    expect(query(window, '[data-overlay="outcome"]')?.hidden).toBe(false);
    expect(title()).toBe("Stage refused");
    expect(code()).toBe("content-hash-conflict");
  });
});
