# endpoint-inventory — source proof complete, runtime acceptance partial

Task ID: `endpoint-inventory`. Actual root `/home/devuser/Documents/Projects/sceneaxi`; source/config/test product tree unchanged. This is a bounded supplementary inventory, not a duplicate full review, PR certification or proof that a product fix landed.

## Artifact and command

Run from the actual root:

```sh
python3 docs/audits/production-swarm/capacity-work-2026-10-02/endpoint-inventory/inventory.py --strict
```

Executable checker uses the existing TypeScript compiler for AST reads and in-memory transpilation, Python standard library, and read-only Git HEAD. No dependency installation, provider SDK evaluation, dist, credentials, socket, browser, build or DB operation. Command budget 90 seconds; internal Node timeout 45 seconds. stdout is reusable JSON; `--strict` exits nonzero for detected literal-target/method gaps. JSON records every source SHA-256, handler symbol/line, delegated source snippets, caller, exact-path ledger match and probe response.

HEAD `4e532e2fbf43e9948741578ab6208a3277870405`; scanned-source fingerprint `e27dd7d0f884ef14b279bf48766cbab6c6b4a97a7118e6656ce3692d5ca45a76`. This is not the published PR or a build fingerprint. Ledger SHA-256 `8b21183bb55cf95100def45d467081add749612614901e94bffd167f22905844`: **355 rows / 113 original IDs**.

## Actual routes and source facts

Paths below are relative to `sites/umbrella/src/app/api/`. Cache/limit absence means absent in the named handler, not proven absent in deployment middleware.

| Route file : exported symbol/line | Authority / origin / cache / body / status |
|---|---|
| `admin/ledger/route.ts:10 POST` | Origin before body; session and support lookup before parsing; current-password adjustment; explicit no-store/noindex; `formData()` at 34 has no local byte bound; 403/400/303. |
| `auth/[...all]/route.ts:6 GET, :7 POST` | Delegates `betterAuthProviderHandler`; configured provider lifecycle/stock dispatch; no-store at provider boundary; unsupported path/method 404, unavailable runtime 503. |
| `checkout/route.ts:19 POST` | Delegates source-backed `checkout-handler.ts` through injected authority/session/signals; inventory follows this dependency rather than falsely requiring guards in the thin route. Bounded parser/origin/status evidence retained in JSON; owning checkout harness supplies behavioral coverage. |
| `editor/catalog-intake/route.ts:46 POST` | Origin before `formData()` at 59; own-session entitlement, reconstructed editor state/render; no explicit no-store header in route; no local raw-body bound; 403/400/409/303. |
| `editor/export/route.ts:7 GET` | Own-session entitlement before query processing; web-only export and state validation; no-store/nosniff; 403/400, successful ZIP 200. |
| `health/route.ts:10 GET` | Configuration-only health; no session; no-store; response 200 even when JSON `ok` is false. |
| `login/route.ts:28 POST` | Configured-origin guard before `formData()` at 43; provider login; secure-cookie policy; force-dynamic, no explicit no-store header; all branches 303; no local raw-body bound. |
| `logout/route.ts:28 POST` | Origin before own-session read; provider/local revocation via plane; force-dynamic, no explicit no-store header; 303. |
| `stripe/webhook/route.ts:45 POST` | Raw `request.text()` before signature-capability call; no browser-origin requirement inferred; delegated outcome status; no local raw-body bound or explicit no-store header. |

This security inventory is **source evidence**, not a claim that all effective limits/cache/error policies are acceptable. Regex-selected snippets are labeled as evidence, not flow analysis.

## Actual callers and missing-target crosswalk

**Nine Next API route files, 154 AST public-link/form/fetch records: 117 resolved, 37 external or dynamic unresolved; zero missing resolved literal targets and zero detected method mismatches.** Counts are source occurrences, not unique user flows. All API string literals are recorded separately, including non-callers, without treating comments, robots exclusions or path prefixes as endpoints.

Actual form callers: `sites/umbrella/src/app/admin/ledger/page.tsx:84` → POST `/api/admin/ledger`; `editor/page.tsx:269` via `UMBRELLA_CATALOG_INTAKE_ACTION` (`src/lib/catalog-submission.ts:85`) → POST `/api/editor/catalog-intake`; `login/page.tsx:80,89,95,157` → logout, account/export, account/disable, login; `pricing/page.tsx:140` → checkout. Editor export template is recorded at `editor/_components/editor-shell.tsx:555`; its dynamic query expression is not claimed statically resolved. `editor/_components/web-experience-editor.tsx:53` `view.form.action` remains explicitly unresolved.

**Refuted:** account export/disable are not missing endpoints merely because standalone `route.ts` files do not exist. `src/provider/better-auth-provider.ts:633` admits those exact paths through the catch-all; `src/provider/account-lifecycle.ts:145-157` enforces POST/origin and discriminates configured/unconfigured actions. Delete/MFA/recovery have named unconfigured refusals, not invented successful capabilities. GET `/api/auth/get-session` is explicitly supported at provider line 637; no speculative `/own-session` path was added or required.

Exact-path ledger crosswalks: auth delegate → original `IDENTITY-02`, `IDENTITY-03`, `IDENTITY-05`, `IDENTITY-ADMIN-HARDENING`; checkout → original `BD-002`, `BD-004`, plus overlapping `PR-002`, `05-002`, `08-02`; intake → original `CAT-DURABLE-INTAKE`, plus `REQ-PROOF-CAT-002`, `REQ-PROOF-IDENT-003`; login/logout → `IDENTITY-05`, `REQ-PROOF-IDENT-003`. JSON marks original membership individually and preserves ownerLane/title/matchedPaths. Empty matches for other route files are **not** invented missing ledger requirements. There are no actual missing-route rows to map; catalog adapter/contract gaps remain separately owned, not reclassified as absent API routes.

## Executed proof and negative controls

The harness AST-extracts the **actual unchanged** `refusal:618`, `requiredEndpoint:630`, and public `createBetterAuthProviderHandler:652` declarations from `src/provider/better-auth-provider.ts`, transpiles them in memory, and injects an unavailable runtime. It does not copy dispatch logic or load the production runtime. Subject hash is in `report.json.liveProbe.sourceSha256`.

- `GET http://inventory.invalid/api/auth/get-session` → **503**, exact `{"code":"IDENTITY_PLANE_NOT_WIRED"}`, `cache-control: no-store`, runtime loader called once.
- Negative control `GET http://inventory.invalid/api/auth/__endpoint_inventory_negative_control__` → **404**, exact `{"code":"NOT_FOUND"}`, no-store, **zero** runtime calls.
- Wrong-method control `POST http://inventory.invalid/api/auth/get-session` → **404**, same body/no-store, **zero** runtime calls.
- Inventory control removes the real login route from its in-memory target set; its real UI caller becomes missing. No source fixture or endpoint is written.

First harness attempt failed `MODULE_NOT_FOUND /home/devuser/Documents/Projects/node_modules/typescript` because root traversal used one excess parent; corrected to the actual root and reran successfully. This was a harness failure, not a product failure. Executed source extraction/dispatch is not an HTTP socket test and does not prove authenticated success.

## Integrator handoff and deferred acceptance

Accept the auxiliary checker/report only after explicit serial handoff. **No source patch proposed:** current evidence does not justify creating missing routes. Preserve/include the actual checkout delegate in the complete intended artifact; source presence here cannot refute the historical missing-PR-file finding. Identity owner retains `SITE-CATALOG-IDENTITY`/`IDENTITY-05` configured-origin own-session adapter and carried-credential acceptance; do not invent cross-origin SSO or infer a second endpoint from a filename count. Raw-body bounds/cache policy observations need owning contract/behavioral review before being promoted to defects.

NOT RUN: production Next routing, authenticated/provider/DB paths, dynamic-link browser resolution, heavy builds/full suites, PR publication checks. Preconditions: stable source/build fingerprint and explicit serial runtime authority; only then run owning browser/HTTP acceptance. No server or deferred heavy command is automatically launched by this artifact. No temporary fixtures, ports, processes, database resources or dependencies were allocated; nothing required cleanup. Only this exclusive auxiliary directory was written.
