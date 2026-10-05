# Delivery / operations independent audit

Graph `sceneaxi-production-swarm`; node `audit-delivery-ops`; real root `/home/devuser/Documents/Projects/sceneaxi`; baseline HEAD `4e532e2fbf43e9948741578ab6208a3277870405`. Observed 2026-10-01 on Linux x86_64, Node 24.21.0 / pnpm 9.15.0.

**Audit: PARTIAL. Production: PARTIAL.** Declared source seams were examined and substantial positive/negative evidence executed; remaining coverage holes are explicit. Dependency safety and deterministic fixture replay fail. Neither local check exit 0 nor audit coverage is production PASS. Source remained read-only; only this report and `audit-delivery-ops.json` were created. No deploy, signing, publication, provider calls, money movement, production changes, new accounts, commits or pushes. Registry advisory lookup is read-only and uses no application/provider secrets.

## Prioritized local task list / attempted refutations

All tasks below belong to builders/integration, not this read-only auditor. Exact ownership must be reconciled before shared files are changed.

### DOPS-001 — CRITICAL dependency safety: patch and triage all eight install roots

- **Source/symbol:** `sites/umbrella/package.json:30` Next pin; `pnpm-lock.yaml:762` brace-expansion5.0.7; `pnpm-lock.yaml:870` fast-uri3.1.4; `desktop/linux/package.json:36` Electron range. Separate site and platform lockfiles are independently exposed.
- **Public reproduction:** exact `pnpm audit --json` in each root; repeated lookup returns exit **1** with no registry/API errors. Counts below are advisories, not eight demonstrated exploitation paths.
- **Refutation:** frozen installs, hermetic gate and negative tests pass. Those prove reproducibility/behavior, not security of pinned dependencies. Windows-specific Next RCE does **not** establish an exploit on Linux/Vercel; AVIF optimization and compromised-renderer prerequisites still need actual configuration/input-path triage. No attack was performed against a live host.
- **Impact:** release/runtime and build/test dependencies carry current critical/high advisories. Do not call this an external blocker or an exploit proven solely from advisory severity.
- **Owner/dependencies:** delivery builder plus one serial dependency owner; sites-ui, profiles-kids, desktop-linux and desktop-release.
- **Files/fix:** root `package.json`, `pnpm-lock.yaml`; each `sites/{umbrella,catalog-game,catalog-web,kids}/{package.json,pnpm-lock.yaml}` and `desktop/{linux,macos,windows}/{package.json,pnpm-lock.yaml}`. Triage all live advisories; verify upstream security/API documentation, then patch compatible supported versions. Preserve TS5.9, package matrix, held-key/Kids/LIVE controls and all assertions. No blanket suppression or dependency-matrix widening.
- **Acceptance:** fresh audit inventory with no unresolved release-blocking vulnerability; all frozen installs; `pnpm gate`; each site `pnpm typecheck && pnpm build` plus HTTP/browser proof; Linux `pnpm typecheck`, `pnpm dist`, `xvfb-run -a pnpm smoke --packaged`; macOS/Windows preflight while actual native signing holes stay visible.

| Exact audit cwd (relative to real root) | Exit | Critical | High | Moderate | Low |
|---|---:|---:|---:|---:|---:|
| root | 1 | 0 | 11 | 5 | 0 |
| sites/umbrella | 1 | 2 | 6 | 4 | 0 |
| sites/catalog-game | 1 | 2 | 5 | 2 | 0 |
| sites/catalog-web | 1 | 2 | 5 | 2 | 0 |
| sites/kids | 1 | 2 | 5 | 2 | 0 |
| desktop/linux | 1 | 0 | 29 | 12 | 4 |
| desktop/macos | 1 | 0 | 27 | 12 | 4 |
| desktop/windows | 1 | 0 | 27 | 12 | 4 |

All site locks flag Next `GHSA-p293-qw3h-jr36` (Windows-hosted RCE) and `GHSA-2xp9-vwfh-vxw4` (AVIF optimization RCE), patched **>=15.5.24**. Desktop Electron includes `GHSA-qmv3-fv6v-rmhq`, patched **>=43.5.0**. Additional affected modules: root vitest/@vitest/mocker, fast-uri, brace-expansion, nanoid, postcss; sites sharp/postcss/nanoid; desktop xmldom/js-yaml/undici/fast-uri/brace-expansion. Full compact inventory and representative exact advisory URLs are in JSON. Version examples are advisory minima, not permission to skip remaining advisories.

### DOPS-002 — HIGH CI provenance / least privilege hardening

- **Source/symbol:** `.github/workflows/gate.yml:13`, `engine-sdk.yml:13`, `desktop-linux.yml:13`, `desktop-macos.yml:26`: mutable `uses: ...@v4`; workflows other than `desktop-artifact-expiry.yml:8` omit explicit permissions.
- **Reproduction/refutation:** all five workflow files inspected. Frozen pnpm locks and deterministic zip SHA256 do not pin downloaded Actions code. Repository default token scope was not observed, so no claim that current tokens have write access.
- **Impact/fix/owner:** delivery builder pins verified upstream Action commit identities, records version comments and minimal explicit token permissions. Record dependency inventory/SBOM and build provenance without invented signed attestations. Existing SHA256 proves bytes, not release authenticity.
- **Acceptance/files:** all five `.github/workflows/*.yml` reviewed/parsed; every `uses` immutable and upstream-verified; traceability/injected suites + gate pass. Actual hosted CI/provenance signature evidence remains external until genuinely run.

### DOPS-003 — MEDIUM deterministic fixture replay defect, confirmed public oracle

- **Source/symbol:** `packages/provider-openrouter/src/index.ts:382 createFixtureTransport`, shallow response freeze at `:386`; contract reiterated `README.md:31`.
- **Reproduction:** register existing shipped `workspace-dist-resolver` with Node `registerHooks`, import **public** `@sceneaxi/provider-openrouter`, create fixture with completion content `before`, call adapter; mutate original `response.choices[0].message.content='after'`; identical request now returns `after`. No source edits or network.
- **Refutation:** top-level model/response map freezing, exact-model checks and missing-operation refusal all work. They do not snapshot/protect nested fixture payloads. Existing adapter regressions passed but did not refute this oracle.
- **Impact:** fixture evidence/replay changes after construction, contrary to documented deterministic replay. This is not claimed as a live provider exploit.
- **Owner/files/fix:** delivery builder owns `packages/provider-openrouter/src/index.ts`, `test/adapter.test.ts`, `README.md`; snapshot admitted fixture JSON and prevent caller/returned-result nested mutation. No credentials/live transport or Kids bypass.
- **Acceptance:** retain this failing-before oracle; both original-input and returned-response mutations cannot change later outputs after fix. Missing operation must still throw `OPENROUTER_FIXTURE_NOT_RECORDED`; model/tool/strict-JSON/schema negative controls and gate remain green.

### DOPS-004 — MEDIUM missing Kids production-build CI coverage

`gate.yml:45 sites-build` includes only umbrella/game/web. Kids intentionally remains **undeployed**, but root structural/parity checks do not compile isolated Next TSX. Delivery builder + profiles-kids add an isolated frozen-install/typecheck/build job in `.github/workflows/gate.yml`, not an environment/deploy/provider path. Acceptance: actual Kids scripts pass, root injected isolation tests remain strict, no shared SceneAxi import or runtime external-data edge.

### DOPS-005 — MEDIUM deployment package-manager reproducibility

`docs/websites-deploy.md:82` and `scripts/check-sites.mjs:422` explicitly document absent site `packageManager` pins: CI inherits root pnpm9.15.0 while Vercel infers from lockfile format. Two hoisted-linker declarations correctly mitigate linker divergence but do not fix tool version. Delivery builder + site-manifest owner should validate the existing supported9.15.0 policy for each isolated root/deploy install, then enforce/document it without widening dependencies. Files: site manifests, `docs/websites-deploy.md`, checker and its injected tests. Record Node patch and actual selected pnpm in evidence. Acceptance: actual clean frozen installs/typechecks/builds use the chosen version; maintain hoisted settings and Kids build-approval policy.

### DOPS-006 — MEDIUM API-reference completeness / real generation oracle

`scripts/docs-api.mjs:13 packages` and served `docs/api/index.html:1` cover only schemas, profile-web and authoring-core. Old #81 “no generated reference” is false; current all-public-engine API coverage remains incomplete. Existing generator **recursively replaces** output at `:48`; failed generation can leave partial docs. Delivery builder extends existing generator to supported kernel/presentation/orchestrator/Game/provider exports, validates links/package coverage, stages output until success, and creates real `tests/docs/api-reference.test.ts`. Coordinate schemas/internal authority and Kids exclusions rather than publicly exposing protected seams. Acceptance: `pnpm docs:api` plus an actually present named suite proving missing-page failure, full gate. No new skipErrorChecking, lint disable or weakened assertion. Auditor did not regenerate because that writes outside report ownership.

## Executed proof, scope and truthful failure classification

Exact commands, time bounds/results and all39 assigned requirements are in JSON. All commands used the real root/cwd, never the demo workspace.

- **Baseline inherited, not rerun by this node:** actual `pnpm gate` exit0, 272 files/4140 Vitest tests +40 Node contract tests, no skips, in baseline log. Serial integration must rerun after builders.
- **Independent existing suites:** 342 publish/SDK/traceability/boundary/binary/provider/platform-preflight tests; 333 tests in24 additional public golden/seam/parity/owner suites; 6 syntax/expiry tests;36 provider/logging tests;2 Stripe LIVE-doc tests. **719 observed passing tests**, not full-production proof. Expected Node WebGL refusal stderr in bridge golden is not a renderer failure or pixel evidence.
- **Independent checkers:** syntax0 (362 source files), boundaries0 (27 packages), contracts0, traceability0 (109 rows), sites0 (4 roots), desktop0 (3 roots), publish-ready0 (**17** CHECK_IDS). `PUBLISH_PLAN` is frozen `0.0.0`, `registryPublishAuthorized:false`; `guard` at `check-publish-ready.mjs:149` attributes thrown failures and continues checks. Injected suites prove negative rejection rather than exit0 alone.
- **SDK independently decoded:** existing builder twice in memory; equal SHA256; Python zipfile CRC+hash verification;159 entries,418677 bytes,7 packages, no Kids. Snapshot hash `c4ffbbda108651153b785e8ccc093d85087c22019ae273e52b003067d0c4d0be`. No archive files/publication generated by auditor. Source-evaluation archive is intentionally not npm-installable or legally licensed for redistribution.
- **Shipped resolver:** `workspace-dist-resolver.mjs:35` matrix-derived roots; `:67` manifest-derived TS subpaths; `:88 resolve`; JSON/non-workspace paths delegated to Node. Actual public adapter import works; nonexistent public subpath rejects `ERR_PACKAGE_PATH_NOT_EXPORTED`; existing spawned-bin/missing-build tests pass. Resolver is launcher plumbing, **not a runtime security sandbox**: matrix authorization is enforced statically. `bin/` lies outside syntax/src-boundary scan, so spawned-bin negatives remain important.
- **Expiry:** real checker exit0,40 days until2026-11-10; weekly schedule and21-day threshold exist;2 function regressions pass. Actual Actions notification receipt/operator response is not evidenced.
- **Logging/health:** `sites/umbrella/src/lib/server-logger.ts:1` field allowlist, `:2` redaction regex, `:23 serverLog`;36 adapter tests include logging/config evidence. Real owned loopback Next process **GET /api/health →200**, `Cache-Control:no-store`, `{ok:true,planes:{identity:'absent',credits:'absent',billing:'absent'},commit:'unknown'}`. Asserted safe field set/planes/header, then terminated owned process. **Absent-plane health is liveness, not production readiness.** No actual provider secrets/configuration were supplied, and a health200 must not satisfy go-live.
- **Coverage trap explicitly surfaced:** requested `tests/docs/api-reference.test.ts` did not exist; Vitest matched only syntax/expiry tests and still exited0. This is a harness-selection limitation, **not API proof**. DOPS-006 creates the real suite. No nonexistent-test pass claimed.

## Revalidated dated backlog — complete delivery routing

| Ids | Current evidence/outcome |
|---|---|
| 1,2 | UNLICENSED/no grant remains; genuine legal licence/trademark clearance required. No fake legal proof. |
| 5 | Ordered production preflight/rollback exists; action-specific external authority and real evidence absent. |
| 6,7,9,10 | Marketplace/proof/publication/hosted-provider gates remain intentionally held/default-off. Adapter fixture plumbing is not live provider readiness. |
| 34 | Old “no observability” refuted locally: logger + health exist. Real monitoring destination, alerts/response and production readiness still unproved. |
| 41 | Old “no automated Next builds” refuted: three-site matrix exists. Kids CI gap DOPS-004 remains; fresh all-site builds/probes assigned builders/integration. |
| 65 | Static Web viewer/Delivery Handoff remains bounded; native/mobile/PWA/compiler/CLI target completeness not evidenced. Target contract/Stage4&5 boundaries cannot be silently bypassed. |
| 71 | Delayed compiler/platform-host/evidence modules remain predeclared, not shipped. F1/Asset Package/Evidence Packet/Ship Event shared schemas need contract-owner/program work. |
| 80,83 | Getting-started and examples exist; no claim entire tutorial was freshly executed by auditor. Out-of-tree canonical spec/archive dependency stays visible. |
| 81 | Generator/output exists; whole-public API gaps and missing output regression DOPS-006 remain. |
| 82,85 | CHANGELOG/CONTRIBUTING/SECURITY/CODE_OF_CONDUCT and useful provider README now exist. SECURITY has no promised response-time SLA; provider replay contract defect DOPS-003. |
| 84 | Old categorical stale-doc claims cannot be copied: NEXT-STEP uses203eb53 as prior history; deploy observations remain explicitly dated2026-08-01 and require actual re-observation, not invented timestamps. |
| 86 | Weekly expiry guard exists and passes today. Actual workflow notification/operator delivery not proved. |
| 87,88 | Current GitHub budget/required checks/issues unobserved. Local90-item backlog+swarm tracking exists; no issue creation performed/authorized. |

Requirement coverage: all **39** delivery assignments accounted for. TOPO001–006 and BOUNDARY001–026 validated as their bounded local declarations through checker/injected/public proofs; dormant/partial classification not upgraded. TOPO007 stays delayed. SURFACE005/006/007/010 golden paths pass; SURFACE013/014 stay release/native-proof-limited. BOUNDARY008/010 stage/preflight only; BOUNDARY019 fixture adapter remains partial and has DOPS-003. Complete id list and baseline statements/proof-path pointer in JSON.

## Exact genuine external gates / remaining production list

1. **Legal/captain:** actual reviewed licence choice/text, SceneAxi trademark clearance, entity/contact/terms/privacy/tax/refund/retention policies. Engineering scaffolds never legal clearance.
2. **Deployment/provider/operator:** action-specific target/mode/commit/operator/window/evidence/rollback authorization; actual Production-scope name-only configuration for `BETTER_AUTH_ORIGIN`, `BETTER_AUTH_SECRET`, `DATABASE_URL`, `SCENEAXI_ADMIN_EMAIL`, `SCENEAXI_ADMIN_BOOTSTRAP_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`; genuine HTTPS authenticated session and provider/DB proof. Dated Vercel/Neon observations were not freshly attested.
3. **Stripe/operator:** real TEST subscriptions to completion/refund/dispute-created/dispute-closed; signed event delivery, persisted intent, exact settlement, one grant, replay/refund/dispute records. LIVE/Connect require their separate authorization and full PRE-AUTH/POST-AUTH prerequisites; never fix by accepting LIVE keys or self-issuing witness.
4. **Data/ops:** real observed Neon PITR retention, explicitly authorized isolated timestamp restore branch, comparison counts/append-only trigger/unchanged-production evidence; known-good alias/deployment/config mappings; monitoring sink/operator/response window and alert-delivery drill. Runbook at `production-activation.md:242` now has restore checklist: old “no policy” is false, **drill evidence absent** remains true. Rollback at`:386` preserves existing webhook settlement access and never deletes grants or removes shared provider handle; real execution not authorized here.
5. **Native release/operator:** actual macOS/Windows hosts/tools, genuine signing/notary certificate credentials, platform-bound candidate authorization, independent hash/signature/packaged launch evidence; later distinct publication/update authority. Linux preflight is not macOS/Windows signed proof. Exact secret/tool names remain owned by `production-activation.md:191`/platform docs.
6. **Held-key/program:** real structured epoch/currency/marketplace/proof/Kids decisions where required; preserve empty Kids dependents/shared refusal, default-off hosted AI and no Stage1/6 fake proof. New hosted live use needs real operator credentials/action-specific spending authority.
7. **Repository operator:** current required-check registration/budget/default-token scope, real expiry alert recipient and response; external issue creation only if separately authorized. Local backlog tracking does not need issue creation.

## Cross-lane / shared changes and coverage holes

Delivery audit edits **none** of these: schemas contracts/public exports; root manifests/locks; site/desktop manifests/locks; deployment/activation/LIVE/publish owner docs; `packages/site-kit/src/desktop-app-offer.ts` + `docs/desktop-linux.md` real release records; umbrella logger/health/readiness behavior. Builders must reconcile exact single-path ownership. If an admitted SDK contract/export is added, schema owner, publish docs, SDK pin list and archive coverage tests change atomically—not via matrix widening.

Fresh post-builder full gate/all-site builds/browser/native Linux proofs are integration responsibilities. No complete SBOM/signed provenance, provider activation, real restore/rollback/alert drill, native macOS/Windows launch or current authenticated GitHub/Vercel/Stripe/Neon observation was established here. No per-advisory exploit/latency/load benchmark claimed. API generation was not run because it rewrites unowned output. These are visible holes, not skipped checks quietly reported as PASS. Local DOPS001–006 tasks were reported upstream and must not be parked as human-preference blockers; external gates remain genuinely external. Serial integration owns failing-before/passing-after evidence, three-pass FAIL routing and FINAL.md/FINAL.json.
