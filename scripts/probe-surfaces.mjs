#!/usr/bin/env node
/**
 * Surface probe — drive every site route and CLI verb for real and record what happened.
 *
 * This is the evidence half of the go-live graphmap (`scripts/surface-map.mjs` renders
 * it). It is deliberately outside `pnpm gate`: it needs each site's own install root and a
 * production `next build`, like the umbrella's `test:provider`.
 *
 * For each site with an install root it starts `next start` as a child of this process
 * (so the probe shares its network namespace), requests every route enumerated from
 * `src/app`, and classifies the response:
 *
 * - `working`     — a 2xx/3xx answer with no named refusal
 * - `unconfigured`— a named refusal that means a provider/config is absent in this run
 * - `refused`     — any other named refusal (a by-design boundary)
 * - `broken`      — a 5xx, a network failure, or an unclassifiable 4xx
 *
 * CLI verbs from `docs/audits/initiation/runtime-surfaces.json` each run `--help --json`
 * through the real binary. Output: `docs/audits/surface-probe.json`.
 *
 * Usage: `node scripts/probe-surfaces.mjs [--build] [--site <name>]...`
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const args = process.argv.slice(2);

const forceBuild = args.includes("--build");

const onlySites = args.flatMap((arg, index) => (arg === "--site" ? [args[index + 1]] : []));

/** Refusals that only mean "this run has no provider configuration", not a defect. */
const UNCONFIGURED = new Set([
  "IDENTITY_PLANE_NOT_WIRED",
  "CREDITS_PLANE_NOT_WIRED",
  "BILLING_PLANE_NOT_WIRED",
  "IDENTITY_SESSION_ABSENT",
  "CATALOG_INTAKE_STORAGE_UNAVAILABLE",
  "SITE_UMBRELLA_ORIGIN_UNSET",
  "DEEP_LINK_ORIGIN_INSECURE",
  "BETTER_AUTH_PROVIDER_CONFIGURATION_ABSENT",
]);

const refusalNames = new Set(
  [...readFileSync(join(root, "packages/site-kit/src/refusals.ts"), "utf8").matchAll(/^\s+([A-Z][A-Z0-9_]{5,}):/gm)]
    .map((match) => match[1]),
);

/** Every `page`, `route`, `robots`, `sitemap` module under a site's `src/app`, as a URL path. */
function siteRoutes(site) {
  const appDir = join(root, "sites", site, "src/app");
  const routes = [];

  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);

      if (entry.isDirectory()) {
        walk(full);
        continue;
      }

      const kind = entry.name.match(/^(page|route|robots|sitemap)\.tsx?$/)?.[1];

      if (!kind) continue;
      const segments = relative(appDir, dir).split("/").filter((s) => s && !s.startsWith("("));
      let path = "/" + segments.join("/");

      if (kind === "robots") path = "/robots.txt";

      if (kind === "sitemap") path = "/sitemap.xml";
      routes.push({ path, kind: kind === "route" ? "api" : kind === "page" ? "page" : "meta", file: relative(root, full) });
    }
  };

  walk(appDir);

  return routes.sort((a, b) => a.path.localeCompare(b.path));
}

const firstListingId = (() => {
  const fixtures = JSON.parse(readFileSync(join(root, "packages/schemas/contracts/catalog-listings.fixtures.json"), "utf8"));
  const listings = fixtures.listings ?? fixtures.items ?? fixtures;
  const first = Array.isArray(listings) ? listings[0] : Object.values(listings)[0];

  return first?.itemId ?? first?.id ?? "lantern-prop";
})();

/** Concrete requests for one route: dynamic segments filled, API routes posted same-origin. */
function requestsFor(route, origin) {
  const path = route.path
    .replace("[itemId]", firstListingId)
    .replace("[...all]", "get-session");

  if (route.kind !== "api" || path.endsWith("/get-session")) return [{ method: "GET", path }];
  const form = { "content-type": "application/x-www-form-urlencoded", origin };

  if (path === "/api/stripe/webhook") {
    return [{ method: "POST", path, headers: { "content-type": "application/json" }, body: "{}", label: "unsigned event" }];
  }

  const body = path === "/api/login" ? "email=probe%40example.com&password=probe-password" : "probe=1";

  return [
    { method: "POST", path, headers: form, body, label: "same-origin form" },
    { method: "POST", path, headers: { ...form, origin: "https://cross-site.example" }, body, label: "cross-origin form" },
  ];
}

function classify(status, body, location) {
  const named = [...new Set([...`${body}\n${location ?? ""}`.matchAll(/\b([A-Z][A-Z0-9]*(?:_[A-Z0-9]+){2,})\b/g)].map((m) => m[1]))]
    .filter((name) => refusalNames.has(name) || /^(SITE|IDENTITY|BILLING|CREDITS|CATALOG|LOGIN|STRIPE|BETTER_AUTH|DEEP_LINK)_/.test(name));

  const reason = new URL(location ?? "http://x/", "http://x/").searchParams.get("reason");
  const reasons = reason ? [...new Set([reason, ...named])] : named;
  const allUnconfigured = reasons.length > 0 && reasons.every((r) => UNCONFIGURED.has(r));

  // A 5xx is broken unless it names only "no provider in this run" — the webhook's
  // documented 503 for an unconfigured deployment is that, not a defect.
  if (status >= 500) return { state: allUnconfigured ? "unconfigured" : "broken", reasons };

  if (reasons.length > 0) {
    // A page that renders only unconfigured states does not work in this run; one that
    // shows a by-design boundary (commerce inert, cross-origin) is a refusal, not a bug.
    if (allUnconfigured) return { state: "unconfigured", reasons };

    if (status >= 400 || reason || reasons.some((r) => !UNCONFIGURED.has(r))) return { state: "refused", reasons };
  }

  if (status >= 400) return { state: status === 404 || status === 405 ? "refused" : "broken", reasons };

  return { state: "working", reasons };
}

async function waitFor(url, child, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`server exited ${child.exitCode}`);

    try {
      await fetch(url, { redirect: "manual" });

      return;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  throw new Error(`server at ${url} did not answer within ${timeoutMs}ms`);
}

async function probeSite(site, port) {
  const siteDir = join(root, "sites", site);
  const result = { site, port, routes: [], skipped: null };

  if (!existsSync(join(siteDir, "node_modules"))) {
    result.skipped = "no install root (run `pnpm install --frozen-lockfile` in the site)";

    return result;
  }

  const env = { ...process.env, NEXT_TELEMETRY_DISABLED: "1", PORT: String(port) };

  if (forceBuild || !existsSync(join(siteDir, ".next/BUILD_ID"))) {
    const build = spawnSync("pnpm", ["build"], { cwd: siteDir, env, encoding: "utf8" });

    if (build.status !== 0) {
      result.skipped = `next build failed: ${(build.stderr || build.stdout).slice(-400)}`;

      return result;
    }
  }

  const child = spawn("pnpm", ["exec", "next", "start", "-p", String(port)], { cwd: siteDir, env, stdio: "ignore", detached: true });
  const origin = `http://localhost:${port}`;

  try {
    await waitFor(origin + "/", child);

    for (const route of siteRoutes(site)) {
      for (const request of requestsFor(route, origin)) {
        let status = 0;
        let body = "";
        let location = null;

        try {
          const response = await fetch(origin + request.path, {
            method: request.method,
            headers: request.headers,
            body: request.body,
            redirect: "manual",
          });

          status = response.status;
          location = response.headers.get("location");
          body = await response.text();
        } catch (error) {
          body = String(error);
        }

        const verdict = status === 0 ? { state: "broken", reasons: [] } : classify(status, body, location);
        result.routes.push({
          path: route.path,
          kind: route.kind,
          file: route.file,
          request: `${request.method} ${request.path}${request.label ? ` (${request.label})` : ""}`,
          status,
          ...verdict,
        });
      }
    }
  } finally {
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {
      // already gone
    }
  }

  return result;
}

function probeCli() {
  const surfaces = JSON.parse(readFileSync(join(root, "docs/audits/initiation/runtime-surfaces.json"), "utf8"));
  const bin = join(root, "packages/cli/bin/sceneaxi.mjs");

  return surfaces.cliVerbs.map((verb) => {
    const run = spawnSync(process.execPath, [bin, ...verb.split(" "), "--help", "--json"], { cwd: root, encoding: "utf8" });
    let ok;

    try {
      ok = JSON.parse(run.stdout).ok === true;
    } catch {
      ok = false;
    }

    return { verb, exitCode: run.status, state: run.status === 0 && ok ? "working" : "broken" };
  });
}

const sites = readdirSync(join(root, "sites"), { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && existsSync(join(root, "sites", entry.name, "src/app")))
  .map((entry) => entry.name)
  .filter((site) => onlySites.length === 0 || onlySites.includes(site));

const siteResults = [];

for (const [index, site] of sites.entries()) {
  siteResults.push(await probeSite(site, 3940 + index));
}

const head = spawnSync("git", ["rev-parse", "--short", "HEAD"], { cwd: root, encoding: "utf8" }).stdout.trim();

const output = {
  schemaVersion: 1,
  probedAt: new Date().toISOString(),
  commit: head,
  configuration: "no provider environment (every provider-backed plane is expected to report unconfigured)",
  sites: siteResults,
  cli: probeCli(),
};

writeFileSync(join(root, "docs/audits/surface-probe.json"), JSON.stringify(output, null, 2) + "\n");

const counts = {};

for (const node of [...siteResults.flatMap((s) => s.routes), ...output.cli]) {
  counts[node.state] = (counts[node.state] ?? 0) + 1;
}

const skipped = siteResults.filter((s) => s.skipped).map((s) => `${s.site}: ${s.skipped}`);

process.stdout.write(`surface probe ${head} — ${JSON.stringify(counts)}${skipped.length ? `\nskipped: ${skipped.join("; ")}` : ""}\n`);

process.exitCode = counts.broken ? 1 : 0;
