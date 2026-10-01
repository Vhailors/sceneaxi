# Sites/UI independent audit

Task **audit-sites-ui**, graph `sceneaxi-production-swarm`. Audit completed within bounded scope; coverage and full production **PARTIAL**, not launch authorization. Real root `/home/devuser/Documents/Projects/sceneaxi`, HEAD `4e532e2fbf43e9948741578ab6208a3277870405`. Only `docs/audits/production-swarm/audit-sites-ui.md` and `.json` written; all application source read-only. No source/manifest fixes, install, commit, push, deploy, spend, account creation or alternate harness. Builds generated their normal ignored outputs. Pre-final integrity check had empty tracked diff; final validation detected concurrent builder changes (listed below), none written by this audit. Evidence is the before-builder snapshot, not proof of subsequently modified sources.

## Recovery and scope

Read AGENTS.md, relevant ownership layout, baseline/decision-log, dated gap list, report schema and recovered bg-11 report. Root EMPRYO.md does not exist; baseline also records checked ancestors absent. bg-11's initial observations are preserved with attribution, **not** converted into successful planned build/browser evidence. Catalog-web is currently already installed, superseding baseline's earlier missing-install observation; this repair performed no installation. Audited `packages/site-kit`, `apps/catalog-game`, `apps/catalog-web`, actual `sites/catalog-game`, `sites/catalog-web`, and umbrella marketing/docs/editor/download/UI. Auth/provider/billing transport remains other owners' responsibility.

## Executed evidence

All shell cwd values were explicit real app root; each site command's child cwd was the named actual install root. Node v24.21.0 / pnpm9.15.0 / Next15.5.21, Linux x86_64. JSON E1–E10 records bounds, exits, assertions, warnings, hashes, reproduction algorithms and failures.

| Evidence | Exact command/front door | Exit / assertions / limit |
|---|---|---|
| E2 | `pnpm build`, cwd `/home/devuser/Documents/Projects/sceneaxi/sites/umbrella`, 210s child bound | **0**,70.641s; prebuild SDK418677bytes/159entries, fresh optimized Next build and postbuild packaging check |
| E3 | `pnpm build`, cwd `/home/devuser/Documents/Projects/sceneaxi/sites/catalog-game`,210s | **0**,42.673s; fresh Next build/postbuild |
| E4 | `pnpm build`, cwd `/home/devuser/Documents/Projects/sceneaxi/sites/catalog-web`,210s | **0**,41.730s; fresh Next build/postbuild |
| E5 | `pnpm exec vitest run packages/site-kit/test apps/catalog-game/test apps/catalog-web/test tests/sites --reporter=json`,110s child bound | **0**,1147tests passed,0failed/0pending. Reporter169 suites includes nested suites; NOT claimed169 files. Hermetic only |
| E6–E8 | `node --input-type=module` stdin; installed umbrella Playwright API; production server child `node node_modules/next/dist/bin/next start -p <port> -H 127.0.0.1` in each site | **0**,180s/150s/120s enclosing bounds. Ports3481–3483,3491–3493,3501–3503. All3 roots200/security headers/first-Tab skip link2px outline; selected routes have one main/h1. Normal production editor refused before canvas; explicit preview only on local umbrella child |
| E6/E7/E8 responsive | DOM `scrollWidth <= clientWidth`; widths360/390/620/860/1024/1440 | 72 reported observations: umbrella root/engine/docs/refused editor24; catalog root/publish/first item36; explicit preview Game/Web12. **Zero sideways overflow**. Does not assert every control usable at every width |
| E8 a11y | Actual computed text color + ancestor-background alpha compositing; normal threshold4.5/large3 | 91 simple root text samples, minimum5.9,0failures.16gradient/opacity cases excluded. Keyboard Ctrl+K labelled palette/focused command input; Escape removes dialog. Not full WCAG/axe/screen-reader certification |
| E9 | Actual local preview `/editor` input `tx-object-1` filled`3,0,0`, ancestor form Apply clicked, waited for returned URL/input | **0**,100s bound; returned3,0,0 and canvas1; Kids button withdraws canvas0, reports`OPEN_PATH_KIDS_REFUSED`,Ctrl+K cannot open palette. Separate preview-off server rejects query-flag attempt with`IDENTITY_PLANE_NOT_WIRED`,canvas absent. **Not real entitlement/credit proof** |
| E9 links | Five docs pages' main relative links and local anchors; root links separately checked | Docs37checks,0HTTP/anchor failures; root internal umbrella9/game7/web5checks,0failures. External links/custom-host/authenticated destinations not validated |
| E9 cross-owner negative | `POST /api/checkout`, `Origin: https://untrusted.example`, `Accept: application/json`, local configured origin`https://sceneaxi.example` | **402**,JSON`ok:false,reason:SITE_REQUEST_CROSS_ORIGIN`. No provider/checkout created. Old403 assertion is outdated; origin absence claim refuted |
| E10 | Fresh production `/open`3521; click`Reset view`,then`Mount the root instance only`; actual canvas2D drawImage/getImageData | **0**,60s bound; canvas1 after each action,1214×628buffer,206sampled distinct RGBA. Real local SwiftShader pixels, not physical GPU/context-restoration proof |
| Integrity | `git diff --stat && git status --short`; scoped `git ls-files` routes; Node install/provider-name inventory | **0** at pre-final check; then no tracked changes,only audit directory untracked;3Next installs present;matching provider credential env names empty. Final check saw concurrent changes described below; full gate/current dirty sources not retested |

All builds warned Next ESLint plugin not detected and metadataBase unset with `http://localhost:3000` fallback. No warning is treated as build failure. Browser launch used `/usr/bin/chromium`,headless,`--no-sandbox --use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader`; local audit's software-GPU/container evidence is not production/hardware evidence. All child servers terminated in finally; no browser artifacts/harness files written outside owned reports.

### Download and visual evidence

Actual SDK GET`/engine-sdk/sceneaxi-engine-sdk-0.0.0.zip`:200,418677bytes,ZIP magic`504b0304`,SHA256`c4ffbbda108651153b785e8ccc093d85087c22019ae273e52b003067d0c4d0be`,matches fresh build. This is an SDK ZIP, not npm publication, native release or a new licence grant. Root PNGs inspected as actual browser byte buffers, not stored artifacts: umbrella163073bytes/hash`5655c249454a0bbfd5b74b8b302435ca3332b34d71af866d59e074d113766a55`; game279721/hash`4b459d4aecc069d515f0e71af9add2635f7de3fdcf35ca4936e5c7bc9f5aac9b`; web284055/hash`dd71be44268cc63c99505a90393f75ea69dc4530e2b2bab2f5a76524a67e77f2`. Screenshots alone are not a full visual-conformance assertion.

### Failed probes and correction

E9 attempt1 exited1: `TimeoutError: locator.fill: Timeout30000ms exceeded` waiting `input[name=tx-object-1]` on`/editor?mode=run`. Run shows frozen facts rather than edit form; corrected to default Build before actual Apply. Attempt2 exited1: `TypeError: refused.status is not a function`; native fetch uses `.status` property, corrected without source edits. Attempt3 exited0 with complete results above. E6/E7 output hit tool16384-byte cap; catalog/preview/contrast/editor details were recaptured concisely, not silently inferred from truncated output. These harness failures are retained; neither is asserted as application defect.

## Findings and fix acceptance

Every finding's taskId is`audit-sites-ui`; full structured reproduction/impact/owner/dependencies in JSON. No finding has been fixed by this audit.

### UI-001 — medium — missing canonical / localhost social images

**Source:** `sites/umbrella/src/app/layout.tsx:35 metadata`; `sites/catalog-game/src/app/layout.tsx:37 metadata`; `sites/catalog-web/src/app/layout.tsx:37 metadata`; `sites/catalog-game/src/app/item/[itemId]/page.tsx:39 generateMetadata`. **Repro:** fresh build,inspect root`link[rel=canonical]`/`meta[property="og:image"]`:canonical absent on all3,OG image localhost3000; catalog item titles exist but canonical absent. **Owner:** sites-ui; deployment supplies validated build origins. **Fix/acceptance:** route-aware canonical+metadataBase using validated configured origin,never request Host; fresh configured roots/items/docs emit correct unique URLs and nonlocalhost images; missing/invalid origin must not invent production URL. OG route/icon existence already refutes the old categorical absence.

### UI-002 — medium — intentional CSP residual, not demonstrated XSS

**Source:** `sites/umbrella/security-headers.json:5 Content-Security-Policy` (same observed policy all3). **Repro:** HTTP contains only`base-uri 'self'; frame-ancestors 'none'; object-src 'none'`. **Owner:** sites-ui+security,dependent Next/provider/editor browser consumers. **Impact:** no script/default/connect mitigation if injection occurs; no XSS demonstrated. **Fix/acceptance:** tested compatible nonce/hash/default/connect policy or explicit risk disposition. Preserve real renderer/provider flows; test negative script/connect fixture. Other headers present and poweredBy absent: old no-headers allegation false.

### UI-003 — blocker — legal/contact presentation and reviewed content absent

**Source:** `sites/umbrella/src/app/layout.tsx:126 RootLayout footer`; historical requirement`docs/audits/go-live-gaps-2026-09-26.md:72 backlog38`. **Repro:** fresh `/terms`,`/privacy`,`/contact`,`/refund-policy` all404;footer no links. **Owner:** sites-ui shells; human/legal reviewed entity/contact/jurisdiction/retention/privacy/terms; billing-data refund policy. **Fix/acceptance:** honest clearly draft/unavailable accessible shells can be built locally now; real production reviewed content must be supplied and provenance recorded. Do not invent support address/legal entity/policies or label draft as cleared.200and discoverable links plus approved text required for full production closure.

### UI-004 — medium — URL replay is not owned durable project persistence

**Source:** `packages/site-kit/src/editor-state.ts:1 URL-carried state`; `sites/umbrella/src/app/editor/_components/editor-shell.tsx:14 EditorShell`; `web-experience-editor.tsx:38 persistence row` in same component directory. **Repro:** explicit local preview transform2,0,0 survives same-URL reload;clean`/editor` returns0,0,0;localStorage empty/no Save controls. Actual form Apply3,0,0 works but changes query state only. **Owner:** sites-ui/site-kit;coordinate authoring-core canonical seam. **Fix/acceptance:** local owned Save/Open/export/recovery,versioned canonical document+digest,through existing authoring rather than second engine. Actual browser save,clean navigation/restart/open restore;quota/malformed/version refusal preserves previous work. DEC11 chooses local persistence: not parked merely for storage preference.

### UI-005 — low — catalog crawl endpoints absent

**Source:** both catalog`layout.tsx:37 metadata`; reference`sites/umbrella/src/app/robots.ts:10 robots`. **Repro:** both catalogs`/robots.txt`,`/sitemap.xml`404;umbrella200. **Owner:** sites-ui;configured origins/listing inventory. **Fix/acceptance:** origin-validated sitemap of actual public listings and safe robots policy200;no request Host derivation;no private/API links. This is crawler completeness,not access control.

### UI-006 — high — historical workflow download marketed as available

**Source:** `sites/umbrella/src/app/engine/page.tsx:143 EnginePage Linux available tag`,`:153 desktopApp.downloadHref`; compare`sites/umbrella/src/lib/download-platform.ts:7 recorded-build vocabulary`. **Repro:** `/engine` says`LINUX AVAILABLE`,`Download the verified Linux bundle` against source`364b66632b15`,workflow`31629556282`,verified2026-08-12,expiry2026-11-10; overview deliberately says Recorded build. **Owner:** sites-ui copy;desktop-release artifact record;delivery-ops publication. **Fix/acceptance:** consistently disclose historical/workflow-only availability;release owner independently validates current accessible artifact/hash/native launch before current release claims. Expiry is future at audit time,NOT claimed expired. No external GitHub artifact downloaded; SDK correctness is separate.

### UI-007 — low — operator configuration prose remains in public refusal journey

**Source:** `sites/umbrella/src/app/layout.tsx:157 missing-origin footer`; `sites/umbrella/src/app/editor/page.tsx:73 refusal panel`. **Repro:** footer deployment-origin prose;editor/login/account named`IDENTITY_PLANE_NOT_WIRED` and diagnostic messages. **Owner:** sites-ui copy;identity/billing own protocol codes. **Fix/acceptance:** friendly primary action/explanation plus expandable diagnostic reference;preserve honest named refusal,no fake success. No secret leakage proven;this is polish,not security vulnerability.

### UI-008 — low — status page still absent although docs improved

**Source:** `sites/umbrella/src/lib/help-docs.ts:10 HELP_DOCS`; `sites/umbrella/src/app/docs/page.tsx:100 DocsPage`. **Repro:** docs+4help routes200,37internal/anchor links valid,`/status`404. **Owner:** sites-ui+delivery-ops for actual operational facts. **Fix/acceptance:** linked honest status/support shell200;missing monitoring data must not render healthy. Deployment health evidence remains separately required.

## Exhaustive old owned-backlog mapping

| Id / old status | Current evidence / remaining owner |
|---|---|
|17 parked|Local preview explicit server-only; query cannot grant access. Deployed preview flag and real entitled login unobserved. Identity+ops must prove session then separately authorize deployed preview removal|
|38 parked|Confirmed missing legal/contact/refund routes;UI003. Local truthful shells achievable;actual reviewed policy external|
|39 done|No-headers claim refuted:3built servers ship policy,COOP,nosniff,referrer,permissions,DENY;no poweredBy. UI002 residual|
|40 parked|`packages/site-kit/src/catalog-identity.ts:45 createCatalogIdentityPlane` wired iff adapter;catalog-game item`:77` creates without adapter. Shared cookie/domain alone does not install adapter. Identity owns transport/topology;site UI only. No custom-host/session proof|
|42 done|Umbrella robots/sitemap200;noindex login/account/editor;OG/icon/item titles exist. Catalog crawler routes404;all3canonical absent/sociallocalhost:UI001/005|
|43 done|All3tracked error.tsx/not-found.tsx;custom404 exercised. `error.tsx` exposes digest not raw message (`umbrella:12 RouteError`,catalogs`:10 RouteError`). No tracked global-error/loading in audited3;root-layout fallback/injected error redaction/loading browser acceptance still uncovered|
|44 done|Honest refusal presentation exists,but config prose remains:UI007;no secret leak demonstrated|
|45 done|Old origin absence refuted: `sites/umbrella/src/app/api/checkout/route.ts:41 POST` checks origin before form;real negative JSON402`SITE_REQUEST_CROSS_ORIGIN` (not old403). Identity/billing own actual configured checkout/session|
|46 parked|URL-only persistence confirmed,actual bounded edit+reload passes:UI004 local work remains|
|47 done|Docs single-page claim refuted:docs/getting-started/cli/faq/credits-and-pricing200and37links good;status404:UI008|

Cross-lane #41 site build coverage now actually executed locally;CI workflow invocation/deployment remains delivery-ops. #48–50catalog commerce/intake/curation and #28–30hosted assistant remain assets/billing/provider-owned,not completed by render tests. #52/#86release artifact/current access/expiry:UI006 desktop-release+ops. bg-4 ENG006 default-texture retained-canvas lifecycle defect remains engine-owned evidence,NOT re-reproduced here;site lifecycle/restoration acceptance must coordinate that owner.

## Routed requirements

- **SURFACE-011:** public`/open` driveability and honest headless reporting:1147targeted hermetic assertions plus actual fresh browser reset/root-mount/canvas206sampled colors. Bounded PASS;not hardware/restoration/full production.
- **SURFACE-012:** editor only after access decision: unconfigured/query-injected preview cannot mount;local explicit preview actual Apply and Kids/palette refusal pass. Real production entitlement/session not configured or tested. URL-only project persistence remains gap. Preview success is NEVER authenticated/credit/launch evidence.

## Real remaining coverage / external inputs

1. Genuine verified user/session/entitlement/credits/provider/email/Stripe/custom-domain identity absent;matching credential process env names empty. No auth/provider/billing transport ownership taken.
2. No deployed host/CDN/cookie/HSTS/custom-domain/browser production preview observation;configured-origin fresh rebuild still needed to validate metadata correction. No deploy authorized.
3. No Firefox/Safari/WebKit/mobile hardware,screen reader,physical GPU;91simple contrast samples only,16complex cases excluded;no full WCAG/axe certification.
4. No actual context lost/restored,retained-canvas resource plateau,long-session or feature-specific editor pixel diffs;engine lifecycle report remains separate.
5. No forced segment/root-error redaction/loading fallback browser proof;global-error/loading files absent from tracked audited3.
6. No genuine external workflow artifact/native download/install/hash/launch or current public release. Local SDK ZIP independently verified only.
7. Legal reviewed entity/contact/terms/privacy/refund/retention/jurisdiction inputs required;draft shells still locally missing. Owned durable Save/Open/recovery and catalog crawl/metadata fixes remain local tasks,NOT external blockers.
8. Full unchanged root gate not rerun by repair;baseline green hermetic gate is not production PASS. Integration must independently rerun fresh builds/browser/provider/native front doors plus final gate,route failures within bounded three-pass policy,and keep full-production **PARTIAL** until all gaps close.

## Report validation

Final `node --input-type=module` JSON.parse/assert invariants exited0 (10evidence entries,8complete finding records,10exact owned backlog ids,2requirements,2retained failed harness attempts); report source paths exist. Final git check exited0 but now reports concurrent edits in web-shell,authoring test,CLI,kernel,Kid activity,provider-openrouter,umbrella account and checkout,plus a new desktop test. Earlier integrity check was clean; this audit wrote none of those. In particular checkout/account/kernel changes landed after recorded test/build/browser evidence,so integration MUST rebuild and repeat affected probes. Source path:line references and JSON outcomes are timestamp-relative audit observations,not final-builder acceptance. Reports are repaired deliverables,not application fixes or publication approval.
