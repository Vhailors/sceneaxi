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
import { createDocument, writeDocumentFile } from "@sceneaxi/authoring-core";
import {
  createDesktopVisualState,
  desktopVisualView,
  renderDesktopChrome,
  stageWebAssetInjection,
} from "@sceneaxi/desktop-shell";
import { createDesktopBridge } from "../../desktop/linux/src/index.ts";

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
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

describe("desktop first-release product loop", () => {
  it("navigates profiles, opens, stages a Web asset, saves, and plays the composed scene", () => {
    const gameHtml = renderDesktopChrome(
      desktopVisualView(createDesktopVisualState({ profile: "game" })),
    );
    const webHtml = renderDesktopChrome(
      desktopVisualView(createDesktopVisualState({ profile: "web" })),
    );
    const kidsHtml = renderDesktopChrome(
      desktopVisualView(createDesktopVisualState({ profile: "kids" })),
    );

    expect(gameHtml).toContain('aria-label="Profile"');
    expect(gameHtml).toContain('data-profile-surface="game"');
    expect(webHtml).toContain('data-profile-surface="web"');
    expect(kidsHtml).toContain("OPEN_PATH_KIDS_REFUSED");
    expect(kidsHtml).toContain('id="scene-play" data-kind="inert"');

    const dir = projectDir();
    const bridge = createDesktopBridge({ cwd: dir, nowMs: () => 1_753_920_000_000 });
    const opened = bridge.handle({
      action: "authoring",
      payload: { op: "status", documentPath: "scene.json" },
    });
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    const status = opened.data as {
      ok: boolean;
      documentId: string;
      data: unknown;
    };
    expect(status).toMatchObject({ ok: true, documentId: "desktop-first-release" });

    const staged = stageWebAssetInjection({
      profile: "web",
      documentData: status.data,
      assetPath: "assets/hero.glb",
    });
    expect(staged.ok).toBe(true);
    if (!staged.ok) return;
    const proposed = bridge.handle(staged.request);
    expect(proposed.ok).toBe(true);
    if (!proposed.ok) return;
    expect((proposed.data as { phase: string }).phase).toBe("reviewing");

    const saved = bridge.handle({ action: "authoring", payload: { op: "accept" } });
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    expect((saved.data as { phase: string }).phase).toBe("applied");
    expect(readFileSync(join(dir, "scene.json"), "utf8")).toContain(
      '"assets/hero.glb"',
    );

    const played = bridge.handle({ action: "open-path" });
    expect(played.ok).toBe(true);
    if (!played.ok) return;
    expect(played.data).toMatchObject({
      instanceCount: 3,
      closed: true,
    });
    expect((played.data as { tickDigests: string[] }).tickDigests).toHaveLength(4);
  });
});
