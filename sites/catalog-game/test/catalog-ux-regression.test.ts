/** Source-backed render/control proof. Run: node --test sites/catalog-game/test/catalog-ux-regression.test.ts
 * Uses installed React, TS 5.9 transpilation and actual source package export maps; no browser/network. */
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import type { SearchParams } from "../../../packages/site-kit/src/index.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

const ts: typeof import("typescript") = createRequire(resolve(root, "package.json"))("typescript");

const React: typeof import("react") = createRequire(resolve(root, "sites/catalog-game/package.json"))("react");

const { renderToStaticMarkup }: typeof import("react-dom/server") = createRequire(resolve(root, "sites/catalog-game/package.json"))("react-dom/server");

const publicFile = resolve(root, "packages/site-kit/src/index.ts");

const pageFile = resolve(root, "sites/catalog-game/src/app/page.tsx");

const fixtureFile = resolve(root, "packages/schemas/src/catalog-listings.data.ts");

/** Same source resolution as the bounded catalog-query proof, without writing auxiliary evidence. */
function sourceLoader(overrides = new Map<string, object>(), sources = new Map<string, string>()) {
  const cache = new Map<string, { exports: ReturnType<NodeRequire> }>();

  function load(file: string): ReturnType<NodeRequire> {
    const cached = cache.get(file);

    if (cached) return cached.exports;
    const mod = { exports: {} };
    cache.set(file, mod);

    const code = ts.transpileModule(sources.get(file) ?? readFileSync(file, "utf8"), { fileName: file, compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
    } }).outputText;

    const requireSource = (spec: string): ReturnType<NodeRequire> => {
      let target: string | undefined;

      if (spec.startsWith("@sceneaxi/")) {
        const parts = spec.split("/");
        const base = resolve(root, "packages", parts[1] ?? "");
        const manifest = JSON.parse(readFileSync(resolve(base, "package.json"), "utf8"));
        const entry = manifest.exports[parts.length === 2 ? "." : "./" + parts.slice(2).join("/")];
        target = resolve(base, isPackageEntry(entry) ? entry : entry.import ?? entry.default);
      } else if (spec.startsWith(".")) {
        const base = resolve(dirname(file), spec);
        target = [base.replace(/\.js$/, ".ts"), base.replace(/\.js$/, ".tsx"), base].find(existsSync);
      }

      return target && /\.tsx?$/.test(target) ? load(target) : createRequire(file)(spec);
    };

    new Function("require", "module", "exports", "__filename", "__dirname", code)(requireSource, mod, mod.exports, file, dirname(file));
    Object.assign(mod.exports, overrides.get(file));

    return mod.exports;
  }

  return load;
}

const load = sourceLoader();

const api: typeof import("../../../packages/site-kit/src/index.js") = load(publicFile);

const page: typeof import("../src/app/page.js") = load(pageFile);

const schemas: typeof import("../../../packages/schemas/src/index.js") = load(resolve(root, "packages/schemas/src/index.ts"));

const validatedFixture = schemas.validateCatalogListingSet(schemas.CATALOG_LISTINGS_DATA);

assert.ok(validatedFixture.ok);

const fixture = validatedFixture.value;

const render = async (params: SearchParams = {}) => renderToStaticMarkup(await page.default({ searchParams: Promise.resolve(params) }));

const rail = (html: string) => html.match(/<aside[^>]*>[\s\S]*?<\/aside>/)?.[0];

test("inventory facets stay visible and stable across search, price and sort", async () => {
  const baseline = rail(await render());
  assert.ok(baseline);

  for (const params of [{ q: "lantern" }, { q: "no-match-catalog-ux" }, { price: "credits-and-money", sort: "newest" }]) {
    assert.equal(rail(await render(params)), baseline);
  }

  assert.match(baseline, /All inventory/);
});

test("GET controls retain URL scalars and associate help and current results", async () => {
  const params = Object.freeze({ q: "odd", price: "credits-and-money", sort: "newest" });
  const html = await render(params);
  assert.match(html, /<form[^>]*method="get"/);
  assert.match(html, /<form[^>]*action="\/"/);
  assert.match(html, /id="catalog-search"[^>]*aria-describedby="catalog-search-help"[^>]*value="odd"/);
  assert.match(html, /id="catalog-search-help"/);
  assert.match(html, /value="credits-and-money" selected=""/);
  assert.match(html, /value="newest" selected=""/);
  assert.match(html, /aria-controls="catalogue"/);
  assert.match(html, /id="catalogue"[^>]*role="status"[^>]*aria-live="polite"/);
  const tree = await page.default({ searchParams: Promise.resolve(params) });
  assert.ok(tree);
  assert.deepEqual(api.browseSiteCatalog("catalog-game", params).map(x => x.itemId), ["odd-price-charm"]);
});

test("no-match is not sold out and offers same-origin recovery", async () => {
  const html = await render({ q: "no-match-catalog-ux" });
  assert.match(html, /No matching listings/);
  assert.match(html, /Try a different title, item ID, creator or price mode/);
  assert.match(html, /href="\/">Clear filters/);
  assert.doesNotMatch(html, /<li class="card"|sold out|purchase complete/i);
  assert.match(html, /TEST catalog · purchases refuse here/);
});

test("empty inventory is distinguished from an unsuccessful search", async () => {
  // The public schema requires a nonempty set, but allows one surface to have no records.
  const webOnly = { ...fixture, listings: fixture.listings.filter(x => x.catalog === "web") };
  assert.ok(schemas.validateCatalogListingSet(webOnly).ok);
  const emptyLoad = sourceLoader(new Map([[fixtureFile, { CATALOG_LISTINGS_DATA: webOnly }]]));
  const emptyPage: typeof page = emptyLoad(pageFile);
  const html = renderToStaticMarkup(await emptyPage.default({ searchParams: Promise.resolve({}) }));
  assert.match(html, /No listings in this catalogue yet/);
  assert.doesNotMatch(html, /No matching listings|sold out/i);
});

test("readonly duplicate and hostile queries remain named refusals without echo", async () => {
  for (const params of [{ q: Object.freeze(["lantern", "market"]) }, { q: "x".repeat(101) }, { sort: "unsupported" }, { extra: "PRIVATE_QUERY_MARKER" }]) {
    assert.throws(() => api.browseSiteCatalog("catalog-game", params), /CATALOG_BROWSE_QUERY_INVALID/);
    const html = await render(params);
    assert.match(html, /Browse query refused/);
    assert.match(html, /CATALOG_BROWSE_QUERY_INVALID/);
    assert.match(html, /href="\/">Clear filters/);
    assert.doesNotMatch(html, /PRIVATE_QUERY_MARKER|<li class="card"/);
  }
});

test("unexpected catalog failure reaches error boundary instead of blaming query", async () => {
  const failure = new Error("PRIVATE_CATALOG_FAILURE");
  const failingLoad = sourceLoader(new Map([[resolve(root, "packages/site-kit/src/catalog.ts"), { browseSiteCatalog: () => { throw failure; } }]]));
  const failingPage: typeof page = failingLoad(pageFile);
  await assert.rejects(failingPage.default({ searchParams: Promise.resolve({}) }), failure);
});

test("actual cards explicitly distinguish details from unavailable purchase, including compact variant", () => {
  const cards: typeof import("../src/app/_components/listing-card.js") = load(resolve(root, "sites/catalog-game/src/app/_components/listing-card.tsx"));

  for (const listing of api.listSiteCatalog("catalog-game")) {
    const html = renderToStaticMarkup(React.createElement(cards.ListingCard, { listing }));
    assert.match(html, /View details · purchases unavailable/);
    assert.match(html, new RegExp('href="/item/' + listing.itemId + '"'));
    assert.match(html, /metadata-only/);
    assert.doesNotMatch(html, /<button|<form|Buy now|Download/i);
    const compact = renderToStaticMarkup(React.createElement(cards.ListingCard, { listing, compact: true }));
    assert.match(compact, /View details · purchases unavailable/);
  }
});

test("long-title and price metadata remain fully rendered without clipping or invented previews", () => {
  const longTitle = "LongTitle".repeat(12);
  const longFixture = { ...fixture, listings: fixture.listings.map(x => ({ ...x, title: longTitle })) };
  assert.ok(schemas.validateCatalogListingSet(longFixture).ok);
  const longLoad = sourceLoader(new Map([[fixtureFile, { CATALOG_LISTINGS_DATA: longFixture }]]));
  const longApi: typeof api = longLoad(publicFile);
  const cards: typeof import("../src/app/_components/listing-card.js") = longLoad(resolve(root, "sites/catalog-game/src/app/_components/listing-card.tsx"));
  const listing = longApi.listSiteCatalog("catalog-game").find(x => x.priceMode === "credits-and-money");
  assert.ok(listing);
  const html = renderToStaticMarkup(React.createElement(cards.ListingCard, { listing }));
  assert.ok(html.includes(longTitle));
  const price = api.describeListingPrice(listing.price);
  assert.ok(price.ok);
  assert.ok(html.includes(price.value.label));
  assert.doesNotMatch(html, /<img|text-overflow/);
  assert.match(html, new RegExp('<span class="card-name">' + longTitle + '</span>'));
});

test("narrow controls and forced-colors focus have explicit unmasked layout rules", () => {
  const css = readFileSync(resolve(root, "sites/catalog-game/src/app/globals.css"), "utf8");
  assert.match(css, /@media \(min-width: 30rem\)/);
  assert.doesNotMatch(css, /@media[^{}]*max-width/);
  assert.match(css, /"search-label"\s+"search"\s+"search-help"\s+"price-label"\s+"price"\s+"sort-label"\s+"sort"\s+"apply"\s+"clear"/);
  assert.match(css, /@media \(forced-colors: active\)\s*\{\s*:focus-visible\s*\{\s*outline-color: Highlight;/);
  assert.match(css, /\.card-price\s*\{[^}]*overflow-wrap: anywhere;/);
});


test("invalid queries keep an editable safe GET form and unaffected scalar filters", async () => {
  const html = await render({ q: Object.freeze(["lantern", "market"]), price: "credits", sort: "newest" });
  assert.match(html, /CATALOG_BROWSE_QUERY_INVALID/);
  assert.match(html, /class="catalog-controls"/);
  assert.match(html, /<form[^>]*method="get"/);
  assert.match(html, /value="credits" selected=""/);
  assert.match(html, /value="newest" selected=""/);
  assert.match(html, /id="catalog-search"[^>]*value=""/);
  assert.doesNotMatch(html, /aria-controls="catalogue"|name="account|name="role/);
  const oversized = await render({ q: "x".repeat(101), price: "unsupported", sort: "unsupported" });
  assert.match(oversized, /value="inventory" selected=""/);
  assert.doesNotMatch(oversized, /x{101}|value="unsupported"/);
});

test("public URL helper preserves encoded scalars and duplicates for explicit refusal", () => {
  const params = Object.freeze({ q: "a & b <c>", price: "credits", sort: "newest" });
  const url = new URL(api.sitePathWithSearchParams("/", params), "https://catalog.invalid");
  assert.equal(url.pathname, "/");

  for (const [key, value] of Object.entries(params)) assert.equal(url.searchParams.get(key), value);
  const duplicate = new URL(api.sitePathWithSearchParams("/", { q: Object.freeze(["one", "two"]) }), url);
  assert.deepEqual(duplicate.searchParams.getAll("q"), ["one", "two"]);
});

test("existing loading and error renders remain busy, redacted and same-origin recoverable", () => {
  const loading: typeof import("../src/app/loading.js") = load(resolve(root, "sites/catalog-game/src/app/loading.tsx"));
  const pending = renderToStaticMarkup(React.createElement(loading.default));
  assert.match(pending, /role="status"/);
  assert.match(pending, /aria-busy="true"/);
  assert.match(pending, /No purchase is being made/);
  assert.doesNotMatch(pending, /<form|<button|<li class="card"/);
  const errorPage: typeof import("../src/app/error.js") = load(resolve(root, "sites/catalog-game/src/app/error.tsx"));
  const failure = renderToStaticMarkup(React.createElement(errorPage.default, { error: Object.assign(new Error("PRIVATE_CATALOG_FAILURE"), { digest: "public-reference" }) }));
  assert.match(failure, /This page could not be rendered/);
  assert.match(failure, /public-reference/);
  assert.match(failure, /href="\/"/);
  assert.doesNotMatch(failure, /PRIVATE_CATALOG_FAILURE|https?:/);
});


test("live negative controls detect the prior empty-state and catch-all error semantics", async () => {
  const current = readFileSync(pageFile, "utf8");
  const emptyPredicate = 'inventory.length === 0 ? "No listings in this catalogue yet" : "No matching listings"';
  assert.ok(current.includes(emptyPredicate));
  const webOnly = { ...fixture, listings: fixture.listings.filter(x => x.catalog === "web") };
  const priorEmptyLoad = sourceLoader(new Map([[fixtureFile, { CATALOG_LISTINGS_DATA: webOnly }]]), new Map([[pageFile, current.replace(emptyPredicate, '"No matching listings"')]]));
  const priorEmptyPage: typeof page = priorEmptyLoad(pageFile);
  const html = renderToStaticMarkup(await priorEmptyPage.default({ searchParams: Promise.resolve({}) }));
  assert.throws(() => assert.match(html, /No listings in this catalogue yet/), assert.AssertionError);

  const guard = '    if (!(error instanceof Error) || error.message !== "CATALOG_BROWSE_QUERY_INVALID") throw error;';
  assert.ok(current.includes(guard));
  const failure = new Error("PRIVATE_NEGATIVE_CONTROL_FAILURE");
  const priorCatchLoad = sourceLoader(new Map([[resolve(root, "packages/site-kit/src/catalog.ts"), { browseSiteCatalog: () => { throw failure; } }]]), new Map([[pageFile, current.replace(guard, "")]]));
  const priorCatchPage: typeof page = priorCatchLoad(pageFile);
  await assert.rejects(assert.rejects(priorCatchPage.default({ searchParams: Promise.resolve({}) }), failure), /Missing expected rejection/);
});

function isPackageEntry<Value>(value: Value): value is Value & string {
  return typeof value === "string";
}
