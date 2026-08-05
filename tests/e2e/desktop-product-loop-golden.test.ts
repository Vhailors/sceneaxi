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
import { Window as HappyWindow } from "happy-dom";
import { createDocument, writeDocumentFile } from "@sceneaxi/authoring-core";
import {
  DESKTOP_VIEWPORT_PLAY_EVENT,
  createDesktopVisualState,
  desktopVisualView,
  renderDesktopChrome,
} from "@sceneaxi/desktop-shell";
import { createDesktopBridge } from "../../desktop/linux/src/index.ts";

const dirs: string[] = [];
const windows: HappyWindow[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  for (const window of windows.splice(0)) window.close();
});

function projectDir() {
  const dir = mkdtempSync(join(tmpdir(), "sceneaxi-product-loop-"));
  dirs.push(dir);
  const result = writeDocumentFile(
    join(dir, "scene.json"),
    createDocument({
      id: "desktop-first-release",
      data: { title: "First release", entities: [{ id: "hero" }] },
    }),
    { cwd: dir },
  );
  if (!result.ok) throw new Error("desktop product-loop fixture refused");
  return dir;
}

async function click(window: HappyWindow, selector: string) {
  const element = window.document.querySelector<HTMLElement>(selector);
  if (element === null) throw new Error(`missing product-loop control ${selector}`);
  element.click();
  for (let turn = 0; turn < 20; turn += 1) {
    await Promise.resolve();
    if (window.document.querySelector("[data-busy]") === null) return;
  }
  throw new Error(`product-loop control did not settle ${selector}`);
}

describe("desktop first-release product loop", () => {
  it("drives profile switching, open, save recovery, and viewport play through the emitted UI", async () => {
    const dir = projectDir();
    const bridge = createDesktopBridge({ cwd: dir, nowMs: () => 1_753_920_000_000 });
    const requests: Array<{ action?: unknown; payload?: { op?: unknown } }> = [];
    let deferredAcceptedSaves = 2;
    let reportMissingRecovery = true;
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
    if (match === null) throw new Error("desktop chrome lost its emitted script");
    window.document.write(html.replace(match[0], ""));
    let playback: { closed?: unknown; tickDigests?: unknown } | null = null;
    window.document.addEventListener(DESKTOP_VIEWPORT_PLAY_EVENT, (event) => {
      const detail = (event as CustomEvent<{
        accepted: boolean;
        exercise: { closed?: unknown; tickDigests?: unknown };
      }>).detail;
      playback = detail.exercise;
      detail.accepted = true;
    });
    window.eval(match[1]);

    const shell = window.document.querySelector<HTMLElement>(".shell");
    const status = () =>
      window.document.querySelector<HTMLElement>("[data-project-status]")?.textContent ?? "";
    expect(shell?.dataset.tier).toBe("narrow");
    expect(shell?.dataset.profile).toBe("game");

    await click(window, "#profile-web");
    await click(window, "#project-open");
    expect(status()).toContain("open · desktop-first-release");
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

    const reset = writeDocumentFile(
      join(dir, "scene.json"),
      createDocument({
        id: "desktop-first-release",
        data: { title: "First release", entities: [{ id: "hero" }] },
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
    expect(status()).toContain("Played composed scene · 4 ticks");
    expect(playback).toMatchObject({ closed: true });
    expect((playback as { tickDigests: string[] } | null)?.tickDigests).toHaveLength(4);

    await click(window, "#profile-kids");
    expect(shell?.dataset.profile).toBe("kids");
    expect(window.document.querySelector("#scene-play")?.getAttribute("aria-disabled")).toBe(
      "true",
    );

    expect(requests.map((request) => request.payload?.op ?? request.action)).toEqual([
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
    ]);
  });
});
