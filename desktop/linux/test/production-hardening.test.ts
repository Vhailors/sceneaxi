import { afterEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Window } from "happy-dom";
import { createDesktopOpenCodeLiveTransport, DESKTOP_DEEPSEEK_MODEL } from "../src/electron/live-transport.js";
import { createPrivilegedDesktopByoRuntime } from "../src/electron/provider-runtime.js";
import { createProviderKeyStore } from "../src/lib/provider-key-store.js";
import { desktopLinuxIndexHtml } from "../src/lib/chrome-document.js";
import { pruneDesktopCrashDumps } from "../src/lib/diagnostics.js";
import { installDesktopByoConfigurationSurface } from "../src/renderer/byo-configuration.js";

const roots: string[] = [];

const windows: Window[] = [];

afterEach(() => {
  vi.unstubAllGlobals();

  for (const window of windows.splice(0)) window.close();

  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

const scratch = () => { const root = mkdtempSync(join(tmpdir(), "sceneaxi-hardening-")); roots.push(root);

 return root; };

const model = DESKTOP_DEEPSEEK_MODEL;

const completion = () => new Response(JSON.stringify({ choices: [{ message: { content: '{"ok":true}' } }] }));

describe("desktop privileged transport production regressions", () => {
  it.each([
    "http://opencode.ai/zen/v1", "https://user:pass@opencode.ai/zen/v1",
    "https://opencode.ai:444/zen/v1", "https://api.deepseek.com/v1",
    "https://untrusted.example/v1", "https://untrusted.opencode.ai/v1",
  ])("refuses %s before any credential read or fetch", async (apiBase) => {
    const read = vi.fn(() => "synthetic-key");
    const fetchImpl = vi.fn<typeof fetch>(async () => completion());
    const transport = createDesktopOpenCodeLiveTransport({ credential: { read }, apiBase, fetchImpl });
    await expect(transport.complete("prompt", model)).rejects.toMatchObject({ reason: "DESKTOP_BYO_PROVIDER_SESSION_FAILED" });
    expect(read).not.toHaveBeenCalled();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it("allows exact HTTPS origin and explicitly refuses redirect following", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => completion());
    const transport = createDesktopOpenCodeLiveTransport({ credential: { read: () => "synthetic-key" }, fetchImpl });
    await expect(transport.complete("prompt", model)).resolves.toBe('{"ok":true}');
    expect(fetchImpl.mock.calls[0]?.[1]).toMatchObject({ redirect: "error" });
  });
  it("bounds streaming bodies even without content-length and cancels oversize", async () => {
    const cancel = vi.fn();

    const fetchImpl = vi.fn(async () => new Response(new ReadableStream({
      start(controller) { controller.enqueue(new Uint8Array(262145)); }, cancel,
    })));

    const transport = createDesktopOpenCodeLiveTransport({ credential: { read: () => "synthetic-key" }, fetchImpl });
    await expect(transport.complete("prompt", model)).rejects.toMatchObject({ reason: "DESKTOP_BYO_PROVIDER_SESSION_FAILED" });
    expect(cancel).toHaveBeenCalledOnce();
  });
  it("times out a stalled response body and never echoes provider-authored secrets", async () => {
    const cancel = vi.fn();

    const transport = createDesktopOpenCodeLiveTransport({
      credential: { read: () => "synthetic-key" }, timeoutMs: 20,
      fetchImpl: async () => new Response(new ReadableStream({ cancel })),
    });

    await expect(transport.complete("prompt", model)).rejects.toMatchObject({ message: expect.stringMatching(/did not finish in time/i) });
    expect(cancel).toHaveBeenCalledOnce();
    const malformed = createDesktopOpenCodeLiveTransport({ credential: { read: () => "synthetic-key" }, fetchImpl: async () => new Response("synthetic-key") });
    await expect(malformed.complete("prompt", model)).rejects.toMatchObject({ reason: "DESKTOP_BYO_PROVIDER_SESSION_FAILED", message: expect.not.stringContaining("synthetic-key") });
  });
});

describe("desktop readiness, offline route and document defense", () => {
  it("reports only the runner's provider ready, preserves storage/remove and Kids denial", async () => {
    const keyStore = createProviderKeyStore({ root: scratch(), platformStorage: {
      availability: () => ({ ok: true }), encrypt: (s) => Buffer.from(s).reverse(), decrypt: (b) => Buffer.from(b).reverse().toString(),
    } });

    const runtime = createPrivilegedDesktopByoRuntime({ keyStore, provider: "opencode", createProviderSession: () => ({ run: async () => { throw new Error("fixture unused"); }, close: () => {} }) });
    await keyStore.save("openrouter", "synthetic-openrouter");
    await expect(runtime.configuration.handle({ action: "status", provider: "openrouter", profile: "@sceneaxi/profile-game" })).resolves.toMatchObject({ runtimeStatus: "unavailable", keyStatus: "configured" });
    await expect(runtime.configuration.handle({ action: "status", provider: "opencode", profile: "@sceneaxi/profile-game" })).resolves.toMatchObject({ runtimeStatus: "ready" });
    await expect(runtime.configuration.handle({ action: "remove", provider: "openrouter", profile: "@sceneaxi/profile-game" })).resolves.toMatchObject({ operation: "removed" });
    await expect(runtime.configuration.handle({ action: "status", provider: "opencode", profile: "@sceneaxi/profile-kids" })).resolves.toMatchObject({ ok: false });
    const absent = createPrivilegedDesktopByoRuntime({ keyStore, provider: "opencode" });
    await expect(absent.configuration.handle({ action: "status", provider: "opencode", profile: "@sceneaxi/profile-game" })).resolves.toMatchObject({ runtimeStatus: "unavailable" });
  });
  it("does not silently replace a user's Local route with BYOK", async () => {
    const window = new Window(); windows.push(window);

    for (const key of ["document", "HTMLElement", "Element", "HTMLButtonElement", "HTMLSelectElement", "MutationObserver"] as const) vi.stubGlobal(key, window[key]);
    window.document.body.innerHTML = '<div class="shell" data-profile="game" data-assistant-route="local"><div class="assistant-routes"><button id="assistant-route-byo"></button></div></div>';
    expect(installDesktopByoConfigurationSurface({})).toBe(true);
    expect(window.document.querySelector(".shell")?.getAttribute("data-assistant-route")).toBe("local");
    expect(window.document.querySelector("#desktop-byo-configuration")?.hasAttribute("hidden")).toBe(true);
  });
  it("hashes every existing inline script deterministically without unsafe-eval", () => {
    const html = desktopLinuxIndexHtml();
    const policy = /<meta http-equiv="Content-Security-Policy" content="([^"]+)"/.exec(html)?.[1];
    expect(policy).toBeDefined();
    expect(policy).toContain("connect-src 'none'");
    expect(policy).toContain("frame-src 'none'");
    expect(policy).not.toContain("unsafe-eval");
    expect(policy?.split("script-src")[1]?.split(";")[0]).not.toContain("unsafe-inline");

    for (const match of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)) {
      expect(policy).toContain(`'sha256-${createHash("sha256").update(match[1] ?? "").digest("base64")}'`);
    }

    expect(desktopLinuxIndexHtml()).toBe(html);
  });
  it("explicit opt-out retention removes all synthetic raw minidumps, preserving logs", () => {
    const root = scratch();
    writeFileSync(join(root, "sensitive.dmp"), "synthetic-memory");
    writeFileSync(join(root, "diagnostics.log"), "RENDER_PROCESS_LOST");
    pruneDesktopCrashDumps(root, 0);
    expect(readdirSync(root)).toEqual(["diagnostics.log"]);
  });
});
