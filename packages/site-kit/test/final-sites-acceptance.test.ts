import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { readEditorState, renderEditorState, buildOfflineWebExport, browseSiteCatalog, listSiteCatalog, verifySiteAdminReauthentication } from "@sceneaxi/site-kit";

describe("canonical editor export acceptance", () => {
  it("exposes exact saved canonical bytes with their persisted digest", () => {
    const state = readEditorState({ objects: "3", "tx-object-1": "5,0,0" });
    expect(state.ok).toBe(true);

    if (!state.ok) throw new Error(state.reason);
    const render = renderEditorState(state.value);
    expect(render.ok).toBe(true);

    if (!render.ok) throw new Error(render.reason);
    const bytes = (render.value as typeof render.value & { documentBytes?: string }).documentBytes;
    expect(typeof bytes).toBe("string");
    expect(`sha256:${createHash("sha256").update(bytes ?? "").digest("hex")}`).toBe(render.value.documentDigest);
    expect(JSON.parse(bytes ?? "{}").kind).toBe("sceneaxi.document");
  });
});

describe("contained offline HTML PWA export", () => {
  const state = { title: "Offline fixture", html: "<main><p>Offline retained</p></main>", layout: "hero" as const, embedThree: false, injectStarterAsset: false };
  it("has only fixed relative paths, stable archive bytes and matching canonical document digest", () => {
    const exportA = buildOfflineWebExport(state); const exportB = buildOfflineWebExport(state);
    expect(exportA.archive).toEqual(exportB.archive);
    expect(Object.keys(exportA.files).sort()).toEqual(["README.txt", "app.css", "app.js", "document.json", "index.html", "manifest.webmanifest", "sw.js"]);
    expect(exportA.documentDigest).toBe(`sha256:${createHash("sha256").update(exportA.files["document.json"] ?? "").digest("hex")}`);
    expect(JSON.parse(exportA.files["manifest.webmanifest"] ?? "{}")).toMatchObject({ start_url: "./index.html", scope: "./" });
    expect(exportA.files["sw.js"]).toContain("FILES.includes(e.request.url)");
    expect(exportA.files["index.html"]).toContain('sandbox=""');
  });
  it.each(["embedThree", "injectStarterAsset"] as const)("refuses unsupported %s instead of shipping a broken canvas", key => {
    expect(() => buildOfflineWebExport({ ...state, [key]: true })).toThrow("WEB_EXPORT_EXTERNAL_ASSET_UNSUPPORTED");
  });
  it("enforces canonical input budgets before allocation", () => {
    expect(() => buildOfflineWebExport({ ...state, html: "x".repeat(2001) })).toThrow();
  });
});

describe("committed catalog search filter sort", () => {
  it.each(["catalog-game", "catalog-web"] as const)("queries real %s inventory and preserves immutable records", surface => {
    const all = listSiteCatalog(surface); expect(all.length).toBeGreaterThan(0); const first = all[0];

 if (first === undefined) throw new Error("fixture inventory missing");
    expect(browseSiteCatalog(surface, { q: first.itemId })).toEqual([first]);
    expect(browseSiteCatalog(surface, { q: "no-such-committed-listing" })).toEqual([]);
    expect(browseSiteCatalog(surface, { price: first.priceMode }).every(item => item.priceMode === first.priceMode)).toBe(true);
    expect(browseSiteCatalog(surface, { sort: "title" }).map(item => item.title)).toEqual(all.map(item => item.title).sort());
    expect(listSiteCatalog(surface)).toEqual(all);
  });
  it.each([{ q: ["a", "b"] }, { q: "x".repeat(101) }, { price: "free" }, { sort: "popularity" }, { token: "credential" }])("refuses unsupported query %j", params => {
    expect(() => browseSiteCatalog("catalog-game", params)).toThrow("CATALOG_BROWSE_QUERY_INVALID");
  });
});

describe("admin per-action password reauthentication contract", () => {
  it.each([undefined, "", "x".repeat(129), { role: "admin", issuedAt: Date.now() }])("refuses invalid password proof %j before dispatch", async password => {
    let calls = 0; const outcome = await verifySiteAdminReauthentication({ credential: "fixture.token", password, verify: async () => { calls++;

 return true; } });
    expect(outcome).toMatchObject({ ok: false, reason: "ADMIN_REAUTHENTICATION_REQUIRED" }); expect(calls).toBe(0);
  });
  it("fails closed for absent, rejecting and throwing provider capabilities", async () => {
    for (const verify of [undefined, async () => false, async () => { throw new Error("fixture transport failure"); }]) {
      expect(await verifySiteAdminReauthentication({ credential: "fixture.token", password: "fixture", verify })).toMatchObject({ ok: false, reason: "ADMIN_REAUTHENTICATION_REQUIRED" });
    }
  });
  it("passes only a bounded carried credential and password to the trusted verifier", async () => {
    const calls: unknown[] = [];
    expect(await verifySiteAdminReauthentication({ credential: "fixture.token", password: "fixture", verify: async (...args) => { calls.push(args);

 return true; } })).toEqual({ ok: true, value: true });
    expect(calls).toEqual([["fixture.token", "fixture"]]);
  });
});
