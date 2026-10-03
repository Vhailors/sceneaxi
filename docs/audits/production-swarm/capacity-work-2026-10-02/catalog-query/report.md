# Catalog query auxiliary proof

Task ID: catalog-query. Scope: auxiliary artifacts in this directory only; product source remains frozen. This is not a duplicate full review or a claim that a product fix landed.

## Executed proof: PASS_SCOPED

Run `node docs/audits/production-swarm/capacity-work-2026-10-02/catalog-query/probe.cjs` from the repository root. The retry returned exit 0: **50 table-driven cases, 231 successful assertions, three deterministic tie-fixture cases, two exact AST-derived compile consumers**. `evidence.json` stores exact inputs, expected/observed IDs or `CATALOG_BROWSE_QUERY_INVALID` refusals, input hashes, assertions, virtual consumer source and source fingerprints. `run.log` records this execution; artifact SHA-256 values are in `report.json`.

Subject: actual public site-kit barrel/helpers plus async default page exports, TypeScript-transpiled in memory using the installed React JSX runtime. This is source-backed execution, **not Next HTTP/browser acceptance or a whole-page typecheck**. No dist artifact used. Source fingerprint: `79d001afd1784d37946cd1214594e708f2c1c0205730ace7016d2b57c99eba02`; HEAD: `4e532e2fbf43e9948741578ab6208a3277870405`. The probe verifies loaded source remains unchanged throughout execution.

Coverage: missing/undefined/empty/scalar queries; frozen readonly singleton/duplicate/empty arrays; scalar title/ID/creator search; credit/money/dual filters; combined search/filter; inventory/title/newest sorts; 100/101/4096-character bounds; invalid/unknown parameters; immutable input/inventory/results; exact page cards, controls and empty state; public URL duplicate preservation; deterministic equal-title/date tie semantics using a schema-validated in-memory source fixture.

## Live negative controls

- Runtime: changing only the in-memory query bound from 100 to 100000 makes the refusal oracle fail with **Missing expected exception.** Control PASS.
- Compile: restoring the mutable-array guard produces exactly three **TS2345** diagnostics per catalog (six total); unmodified consumers have zero diagnostics. Control PASS.
- Deferred runner: `sh -n` succeeds. Without `CATALOG_SERIAL_HANDOFF`, execution exits **78** with **REFUSED: stable source, fresh hashed catalog builds, existing dependencies and exclusive browser token required**. No heavy command executed.

## Integration handoff

`sites/catalog-game/src/app/page.tsx:15:isSearchText` and `sites/catalog-web/src/app/page.tsx:15:isSearchText` already use `isSearchText(value: SearchParams[string]): value is string`. The prior readonly-array gap is **refuted on this fingerprint**, reproduced only by the controlled mutation. Preserve that guard; no new product patch is justified. The consumer extraction also uses the real page parameter declaration, not an invented SearchProps substitute. Runtime target: `packages/site-kit/src/catalog.ts:browseSiteCatalog`, via its public barrel; query encoding: `packages/site-kit/src/site-search-params.ts:sitePathWithSearchParams`. See `probe.cjs:44-121` for exact load targets and assertions.

Integrate the reusable auxiliary probe only at the explicit serial handoff. `deferred-acceptance.sh` now revalidates source proof before its owning-site typechecks and existing accessibility acceptance command. Full site typechecks, fresh builds/hash capture, rebuilt Next HTTP/browser query parsing and clear-filter acceptance are **NOT RUN**, requiring approved stable rebuilt sites, existing dependencies and an exclusive browser token. Do not infer these from PASS_SCOPED.

No ports, temporary files, subprocess services or persistent fixtures were created; consumers and mutations were memory-only. No source writes, dependencies, credentials, production access, staging, commits or deployment. Earlier auxiliary root-path failure and correction remain recorded in `report.json`.
