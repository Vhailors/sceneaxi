import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

// Real-source loader used by capacity-work/catalog-query/probe.cjs, with no
// evidence writes or dependency mocks. React stays in this site's install root.
const root = fileURLToPath(new URL("../../../", import.meta.url));

const rootRequire = createRequire(path.join(root, "package.json"));

const siteRequire = createRequire(path.join(root, "sites/catalog-web/package.json"));

const ts = rootRequire("typescript");

const { renderToStaticMarkup } = siteRequire("react-dom/server");

const packages = new Map(readdirSync(path.join(root, "packages")).map((name) => {
  const base = path.join(root, "packages", name);
  const manifest = JSON.parse(readFileSync(path.join(base, "package.json"), "utf8"));

  return [manifest.name, { base, manifest }];
}));

function sourceLoader(overrides = new Map<string, string>()) {
  const cache = new Map();

  function load(file: string) {
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} };
    cache.set(file, module);
    const source = overrides.get(file) ?? readFileSync(file, "utf8");

    const code = ts.transpileModule(source, { fileName: file, compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
    } }).outputText;

    function resolve(spec: string) {
      let target: string | undefined;

      if (spec.startsWith("@sceneaxi/")) {
        const parts = spec.split("/");
        const pkg = packages.get(parts.slice(0, 2).join("/"));
        assert.ok(pkg, `Source package missing: ${spec}`);
        const entry = pkg.manifest.exports[parts.length === 2 ? "." : "./" + parts.slice(2).join("/")];
        target = path.resolve(pkg.base, isPackageEntry(entry) ? entry : entry.import ?? entry.default);
      } else if (spec.startsWith(".")) {
        const base = path.resolve(path.dirname(file), spec);
        target = [base.replace(/\.js$/, ".ts"), base.replace(/\.js$/, ".tsx"), base].find(existsSync);
      }

      return target && /\.tsx?$/.test(target) ? load(target) : createRequire(file)(spec);
    }

    new Function("require", "module", "exports", code)(resolve, module, module.exports);

    return module.exports;
  }

  return load;
}

const pagePath = path.join(root, "sites/catalog-web/src/app/page.tsx");

const apiPath = path.join(root, "packages/site-kit/src/index.ts");

const load = sourceLoader();

const page = load(pagePath);

const api = load(apiPath);

const css = readFileSync(path.join(root, "sites/catalog-web/src/app/globals.css"), "utf8");

async function markup(params = {}, loader = load) {
  return renderToStaticMarkup(await loader(pagePath).default({ searchParams: Promise.resolve(params) }));
}

function tag(html: string, id: string) {
  const found = html.match(new RegExp(`<[^>]+\\bid="${id}"[^>]*>`));
  assert.ok(found, `Missing control ${id}`);

  return found[0];
}

function rail(html: string) {
  const found = html.match(/<aside\b[^>]*>[\s\S]*?<\/aside>/);
  assert.ok(found, "Inventory context missing");

  return found[0];
}

function describedByResolves(html: string, id: string) {
  const control = tag(html, id);
  const match = control.match(/aria-describedby="([^"]+)"/);
  assert.ok(match, `${id} has no description`);

  for (const reference of match[1].split(/\s+/)) {
    assert.equal(html.split(`id="${reference}"`).length - 1, 1, `IDREF ${reference} must be unique`);
    assert.match(html, new RegExp(`id="${reference}"[^>]*>[^<]+`));
  }
}

test("source-backed GET controls preserve scalar query, price and sort without mutation", async () => {
  const params = Object.freeze({ q: " harbour ", price: "money", sort: "title" });
  const html = await markup(params);
  assert.match(html, /<form(?=[^>]*method="get")(?=[^>]*action="\/")[^>]*>/);
  assert.match(tag(html, "catalog-search"), /name="q"/);
  assert.match(tag(html, "catalog-search"), /maxLength="100"/);
  assert.match(tag(html, "catalog-search"), /value=" harbour "/);
  assert.match(html, /<option value="money" selected="">Money<\/option>/);
  assert.match(html, /<option value="title" selected="">Title<\/option>/);
  assert.match(html, /href="\/item\/harbour-diorama"/);
  assert.equal(params.q, " harbour ");
});

test("no-match retains full inventory context and offers real query recovery", async () => {
  const all = await markup();
  const empty = await markup({ q: "no-such-web-scene" });
  assert.equal(rail(empty), rail(all));
  assert.match(rail(empty), /All inventory/);
  assert.match(empty, /No matching listings/);
  assert.match(empty, /href="\/">Clear filters/);
  assert.doesNotMatch(empty, /href="\/item\//);
});

test("empty Web inventory differs from no-match and still explains preview/intake status", async () => {
  const fixturePath = path.join(root, "packages/schemas/src/catalog-listings.data.ts");
  const original = load(fixturePath).CATALOG_LISTINGS_DATA;
  const fixture = { ...original, listings: original.listings.filter((row: { catalog: string }) => row.catalog !== "web") };
  const emptyLoader = sourceLoader(new Map([[fixturePath, "export const CATALOG_LISTINGS_DATA: unknown = " + JSON.stringify(fixture) + ";"]]));
  const html = await markup({}, emptyLoader);
  assert.match(html, /No listings in this showroom yet/);
  assert.doesNotMatch(html, /No matching listings/);
  assert.match(html, /href="\/publish#requirements"/);
  assert.match(html, /no upload or production publishing/);
});

for (const [label, params, invalidField] of [
  ["readonly duplicate", Object.freeze({ q: Object.freeze(["one", "two"]) }), "catalog-search"],
  ["long URL", { q: "x".repeat(4096) }, "catalog-search"],
  ["unsupported price", { q: "harbour", price: "free" }, "catalog-price"],
  ["unsupported sort", { sort: "random" }, "catalog-sort"],
  ["unknown URL key", { extra: "<unsafe>" }, null],
] as const) {
  test(`refused ${label} keeps editable GET controls, named reason and bounded safe defaults`, async () => {
    const html = await markup(params);
    assert.match(html, /CATALOG_BROWSE_QUERY_INVALID/);
    assert.match(html, /<form(?=[^>]*method="get")(?=[^>]*action="\/")[^>]*>/);
    assert.match(html, /type="submit">Apply filters/);
    assert.match(html, /href="\/">Clear filters/);
    assert.doesNotMatch(html, /href="\/item\//);
    assert.doesNotMatch(html, /value="free" selected|value="random" selected|&lt;unsafe&gt;|x{101}/);

    if (invalidField) assert.match(tag(html, invalidField), /aria-invalid="true"/);

    for (const id of ["catalog-search", "catalog-price", "catalog-sort"]) describedByResolves(html, id);

    if ("q" in params && params.q === "harbour") assert.match(tag(html, "catalog-search"), /value="harbour"/);
  });
}

test("search help and named result count resolve to accessible descriptions", async () => {
  const html = await markup();
  describedByResolves(html, "catalog-search");
  assert.match(tag(html, "catalog-results"), /role="status"/);
  assert.match(html, /Search accepts up to 100 characters/);
});

test("public helper remains fail-closed for arrays/oversize, preserves duplicate URL encoding", () => {
  const params = Object.freeze({ q: Object.freeze(["harbour", "other"]) });
  assert.throws(() => api.browseSiteCatalog("catalog-web", params), /CATALOG_BROWSE_QUERY_INVALID/);
  assert.throws(() => api.browseSiteCatalog("catalog-web", { q: "x".repeat(101) }), /CATALOG_BROWSE_QUERY_INVALID/);
  const url = new URL(api.sitePathWithSearchParams("/", params), "https://web.example");
  assert.deepEqual(url.searchParams.getAll("q"), ["harbour", "other"]);
  assert.deepEqual(api.browseSiteCatalog("catalog-web", { price: "money" }).map((row: { itemId: string }) => row.itemId), ["harbour-diorama"]);
});

test("actual card/detail help states metadata-only preview and unavailable purchases, never fake entitlement", async () => {
  const html = await markup();
  assert.match(html, /View details · purchases unavailable/);
  assert.match(html, /Preview and publishing status/);
  assert.match(html, /href="\/publish#requirements"/);
  assert.match(html, /record mark, not an interactive preview/);
  assert.match(html, /asset delivery and payment completion are not/);
  assert.doesNotMatch(html, /Download now|Add to cart|Purchase complete|Preview ready|Access granted/);
  assert.doesNotMatch(html, /<input[^>]*type="file"|<form[^>]*method="post"/);
});

test("canonical origin remains configured-only", () => {
  const before = process.env.NEXT_PUBLIC_SCENEAXI_WEB_CATALOG_ORIGIN;

  try {
    process.env.NEXT_PUBLIC_SCENEAXI_WEB_CATALOG_ORIGIN = "https://web.example";
    assert.deepEqual(page.generateMetadata(), { alternates: { canonical: "https://web.example/" } });
    process.env.NEXT_PUBLIC_SCENEAXI_WEB_CATALOG_ORIGIN = "http://untrusted.example";
    assert.deepEqual(page.generateMetadata(), {});
  } finally {
    if (before === undefined) delete process.env.NEXT_PUBLIC_SCENEAXI_WEB_CATALOG_ORIGIN;
    else process.env.NEXT_PUBLIC_SCENEAXI_WEB_CATALOG_ORIGIN = before;
  }
});

test("mobile controls follow DOM order, prices wrap, forced-colors focus is explicit", () => {
  assert.match(css, /\.catalog-controls\s*\{[^}]*grid-template-columns: minmax\(0, 1fr\);[^}]*"search-label"\s*"search"\s*"search-help"\s*"price-label"\s*"price"\s*"sort-label"\s*"sort"\s*"apply"\s*"clear"/);
  assert.match(css, /@media \(min-width: 30rem\)\s*\{[\s\S]*?\.catalog-controls\s*\{/);
  assert.doesNotMatch(css, /@media[^{}]*max-width/);
  assert.match(css, /\.card-price\s*\{[^}]*overflow-wrap: anywhere;/);
  assert.match(css, /@media \(forced-colors: active\)\s*\{\s*:focus-visible\s*\{\s*outline-color: Highlight;/);
  assert.doesNotMatch(css, /overflow-x:\s*hidden\s*;/);
});

test("100-character query is accepted; duplicate price/sort arrays are refused without being reinterpreted", async () => {
  const accepted = await markup({ q: "x".repeat(100), sort: "newest" });
  assert.doesNotMatch(accepted, /CATALOG_BROWSE_QUERY_INVALID/);
  assert.match(tag(accepted, "catalog-search"), new RegExp(`value="${"x".repeat(100)}"`));

  for (const params of [Object.freeze({ price: Object.freeze(["money"]) }), Object.freeze({ sort: Object.freeze(["title"]) })]) {
    const html = await markup(params);
    assert.match(html, /CATALOG_BROWSE_QUERY_INVALID/);
    assert.doesNotMatch(tag(html, "catalog-search"), /aria-controls=/);
    assert.match(html, /<option value="inventory" selected="">Inventory order/);
    assert.match(html, /<option value="" selected="">All price modes/);
  }
});

test("unexpected browse failures reach existing error handling instead of blaming the query", async () => {
  const catalogPath = path.join(root, "packages/site-kit/src/catalog.ts");
  const source = readFileSync(catalogPath, "utf8");
  const anchor = 'const allowed = ["q", "price", "sort"];';
  assert.equal(source.split(anchor).length - 1, 1);
  const brokenCatalog = source.replace(anchor, 'throw new Error("CATALOG_BACKEND_UNAVAILABLE"); ' + anchor);
  const faultLoader = sourceLoader(new Map([[catalogPath, brokenCatalog]]));
  await assert.rejects(markup({}, faultLoader), /CATALOG_BACKEND_UNAVAILABLE/);
  // Live negative control: restoring the swallowed-error catch fails the same oracle.
  const pageSource = readFileSync(pagePath, "utf8");
  const guard = 'if (!(error instanceof Error) || error.message !== "CATALOG_BROWSE_QUERY_INVALID") throw error;';
  assert.equal(pageSource.split(guard).length - 1, 1);
  const swallowedLoader = sourceLoader(new Map([[catalogPath, brokenCatalog], [pagePath, pageSource.replace(guard, "")]]));
  await assert.rejects(assert.rejects(markup({}, swallowedLoader), /CATALOG_BACKEND_UNAVAILABLE/), /Missing expected rejection/);
});

test("compact and full real cards keep refused availability clear, including long titles", () => {
  const { createElement } = siteRequire("react");
  const Card = load(path.join(root, "sites/catalog-web/src/app/_components/listing-card.tsx")).ListingCard;
  const original = api.listSiteCatalog("catalog-web")[0];
  assert.equal(original.availability.purchase, "refused");
  const listing = Object.freeze({ ...original, title: "web-experience-".repeat(8) + "<&>" });

  for (const compact of [false, true]) {
    const html = renderToStaticMarkup(createElement(Card, { listing, compact }));
    assert.match(html, /View details · purchases unavailable/);
    assert.match(html, /&lt;&amp;&gt;/);
    assert.match(html, /href="\/item\/harbour-diorama"/);
    assert.doesNotMatch(html, /Download now|Access granted|Purchase complete|<button/);
  }
});

test("existing real loading/error routes are honest and recoverable without exposing server errors", () => {
  const Loading = load(path.join(root, "sites/catalog-web/src/app/loading.tsx")).default;
  const ErrorView = load(path.join(root, "sites/catalog-web/src/app/error.tsx")).default;
  const pending = renderToStaticMarkup(Loading());
  assert.match(pending, /role="status"/);
  assert.match(pending, /aria-busy="true"/);
  assert.match(pending, /No purchase is being made/);
  assert.doesNotMatch(pending, /href="\/item\//);
  const failure = renderToStaticMarkup(ErrorView({ error: Object.assign(new Error("PRIVATE_SERVER_DETAIL_SENTINEL"), { digest: "ref<&>" }) }));
  assert.match(failure, /href="\/"/);
  assert.match(failure, /Back to the catalogue/);
  assert.match(failure, /ref&lt;&amp;&gt;/);
  assert.doesNotMatch(failure, /PRIVATE_SERVER_DETAIL_SENTINEL|Purchase complete|Access granted/);
});

function isPackageEntry<Value>(value: Value): value is Value & string {
  return typeof value === "string";
}
