/** Default public-export consumer + actual item-page execution; no auxiliary aliases.
 * node --test sites/catalog-game/test/item-session-wiring.test.ts (fixture transport only). */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

const siteRoot = resolve(root, "sites/catalog-game");

const ts: typeof import("typescript") = createRequire(resolve(root, "package.json"))("typescript");

const { renderToStaticMarkup }: typeof import("react-dom/server") = createRequire(resolve(siteRoot, "package.json"))("react-dom/server");

const origin = "https://umbrella.example.invalid";

const principal = { user: { userId: "own-user", email: "own@example.invalid", emailVerified: true, disabled: false }, role: "user", session: { sessionId: "own-session", userId: "own-user", surface: "site", issuedAt: "2026-01-01T00:00:00.000Z", expiresAt: "2099-01-01T00:00:00.000Z" } };

const compiled = new Map<string, string>();

function fixture() {
  let reads = 0;
  const requests: { url: string; init: RequestInit | undefined }[] = [];
  const cache = new Map<string, { exports: ReturnType<NodeRequire> }>();

  function load(file: string): ReturnType<NodeRequire> {
    const cached = cache.get(file);

    if (cached) return cached.exports;
    const mod = { exports: {} };
    cache.set(file, mod);
    let code = compiled.get(file);

    if (code === undefined) {
      code = ts.transpileModule(readFileSync(file, "utf8"), { fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
      compiled.set(file, code);
    }

    const requireSource = (spec: string): ReturnType<NodeRequire> => {
      // Only framework request plumbing is a fixture; identity, export maps,
      // credential precedence, page and response validation remain actual source.
      if (spec === "next/headers") return {
        headers: async () => { reads++;

 return new Headers({ "x-sceneaxi-session": "own-session.secret", host: "hostile.example.invalid", "x-forwarded-host": "hostile.example.invalid" }); },
        cookies: async () => { reads++;

 return { get: () => undefined }; },
      };
      let target: string | undefined;

      if (spec.startsWith("@sceneaxi/")) {
        const parts = spec.split("/");
        const base = resolve(root, "packages", parts[1] ?? "");
        const manifest = JSON.parse(readFileSync(resolve(base, "package.json"), "utf8"));
        const exported = manifest.exports[parts.length === 2 ? "." : "./" + parts.slice(2).join("/")];
        const entry = isPackageEntry(exported) ? exported : exported?.node ?? exported?.import ?? exported?.default;
        assert.ok(isPackageEntry(entry), "actual package subpath must exist; no alias fallback");
        target = resolve(base, entry);
      } else if (spec.startsWith(".")) {
        const base = resolve(dirname(file), spec);
        target = [base.replace(/\.js$/, ".ts"), base.replace(/\.js$/, ".tsx"), base].find(existsSync);
      }

      return target && /\.tsx?$/.test(target) ? load(target) : createRequire(file)(spec);
    };

    new Function("require", "module", "exports", "__filename", "__dirname", code)(requireSource, mod, mod.exports, file, dirname(file));

    return mod.exports;
  }

  const transport: typeof fetch = async (url, init) => {
    requests.push({ url: String(url), init });

    return new Response(JSON.stringify({ version: 1, ok: true, value: principal }), { headers: { "content-type": "application/json", "cache-control": "no-store" } });
  };

  const page: typeof import("../src/app/item/[itemId]/page.js") = load(resolve(siteRoot, "src/app/item/[itemId]/page.tsx"));
  const api: typeof import("../../../packages/site-kit/src/index.js") = load(resolve(root, "packages/site-kit/src/index.ts"));
  const local: typeof import("../src/lib/identity-plane.js") = load(resolve(siteRoot, "src/lib/identity-plane.ts"));
  const item = api.listSiteCatalog("catalog-game")[0];
  assert.ok(item);

  return { transport, requests, local, readCount: () => reads, render: async () => renderToStaticMarkup(await page.default({ params: Promise.resolve({ itemId: item.itemId }) })) };
}

async function run(raw: string | undefined, approved: string | undefined, assertion: (f: ReturnType<typeof fixture>, html: string) => void) {
  const saved = { raw: process.env.NEXT_PUBLIC_SCENEAXI_UMBRELLA_ORIGIN, approved: process.env.SCENEAXI_CATALOG_OWN_SESSION_APPROVED, node: process.env.NODE_ENV, fetch: globalThis.fetch };

  try {
    if (raw === undefined) delete process.env.NEXT_PUBLIC_SCENEAXI_UMBRELLA_ORIGIN;
    else process.env.NEXT_PUBLIC_SCENEAXI_UMBRELLA_ORIGIN = raw;

    if (approved === undefined) delete process.env.SCENEAXI_CATALOG_OWN_SESSION_APPROVED;
    else process.env.SCENEAXI_CATALOG_OWN_SESSION_APPROVED = approved;
    process.env.NODE_ENV = "production";
    const f = fixture();
    globalThis.fetch = f.transport;
    assertion(f, await f.render());
  } finally {
    for (const [key, value] of [["NEXT_PUBLIC_SCENEAXI_UMBRELLA_ORIGIN", saved.raw], ["SCENEAXI_CATALOG_OWN_SESSION_APPROVED", saved.approved], ["NODE_ENV", saved.node]]) {
      if (value === undefined) Reflect.deleteProperty(process.env, key ?? "");
      else process.env[key ?? ""] = value;
    }

    globalThis.fetch = saved.fetch;
  }
}

test("default public consumer is honestly unwired", async () => {
  const f = fixture();
  assert.equal(f.local.createCatalogRequestIdentityPlane().wired, false);
  const result = await f.local.resolveCatalogViewer(f.local.createCatalogRequestIdentityPlane(), "own-session.secret");
  assert.equal(result.ok, false);

  if (!result.ok) assert.equal(result.reason, "IDENTITY_PLANE_NOT_WIRED");
});

test("actual page consumes approved public adapter and explicit carry, never unknown Host", async () => {
  await run(origin, "true", (f, html) => {
    assert.equal(f.requests.length, 1);
    const call = f.requests[0]; assert.ok(call);
    assert.equal(call.url, origin + "/api/auth/own-session");
    assert.equal(new Headers(call.init?.headers).get("x-sceneaxi-session"), "own-session.secret");
    assert.equal(call.init?.cache, "no-store");
    assert.equal(call.init?.credentials, "omit");
    assert.equal(call.init?.redirect, "error");
    assert.equal(f.readCount(), 2);
    assert.doesNotMatch(html, /IDENTITY_PLANE_NOT_WIRED|hostile\.example\.invalid/);
    // Actual identity success does not unlock fixture commerce or claim SSO.
    assert.match(html, /TEST/);
    assert.doesNotMatch(html, /purchase complete|Payment received/i);
  });
});

for (const raw of [undefined, "", origin + "/path", origin + "?query=x", origin + "#fragment", "https://user:pass@umbrella.example.invalid", " " + origin + " ", "https://127.0.0.1", "https://umbrella.local"]) {
  test("actual page unsafe/missing raw configuration skips credentials/network: " + String(raw), async () => {
    await run(raw, "true", (f, html) => {
      assert.equal(f.readCount(), 0);
      assert.equal(f.requests.length, 0);
      assert.match(html, /SITE_REQUEST_CROSS_ORIGIN|IDENTITY_PLANE_NOT_WIRED/);
      assert.doesNotMatch(html, /hostile\.example\.invalid/);
    });
  });
}

for (const approved of [undefined, "false", "1", "TRUE"]) {
  test("actual page requires exact server approval: " + String(approved), async () => {
    await run(origin, approved, (f, html) => {
      assert.equal(f.readCount(), 0);
      assert.equal(f.requests.length, 0);
      assert.match(html, /IDENTITY_PLANE_NOT_WIRED/);
    });
  });
}

function isPackageEntry<Value>(value: Value): value is Value & string {
  return typeof value === "string";
}
