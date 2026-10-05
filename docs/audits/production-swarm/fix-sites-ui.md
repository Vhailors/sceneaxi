# Sites UI implementation retry — PARTIAL

Graph `sceneaxi-production-swarm`; node `fix-sites-ui`; role `code`. All commands used real cwd `/home/devuser/Documents/Projects/sceneaxi`. HEAD remains `4e532e2fbf43e9948741578ab6208a3277870405`. Node 24.21.0, pnpm 9.15.0, installed Chromium with ANGLE SwiftShader. Checkout already contained extensive concurrent work, including editor checkpoint/canonical changes. These were preserved; only the following retry deltas are attributed here.

## Implemented owned changes

- `sites/umbrella/src/app/editor/_components/editor-shell.tsx:393`, `localProjectAction`: refuse save/export when client-only profile chip differs from the profile whose URL/document digest the server reconstructed. Named `PROJECT_PROFILE_MISMATCH`; no checkpoint write on refusal. This fixes a source-confirmed mislabeling opportunity; actual browser negative acceptance remains pending.
- `sites/umbrella/src/app/engine/page.tsx:143`, `EnginePage`: replace “Linux available”/“Download the verified Linux bundle” with recorded-build/workflow-artifact presentation. CTA says “Open Linux download record”; historical record explicitly is not current public-release proof. No artifact/size/checksum/link invented.
- `sites/umbrella/src/app/docs/page.tsx:133`, `DocsPage`, and `SECTIONS`: linked service-status section says monitoring is unavailable, support contact unverified, reviewed legal policies unpublished. Not healthy-service or legal approval. This is a local section, **not** implementation of dedicated `/status` or legal routes.
- `sites/umbrella/src/app/layout.tsx:162`, `RootLayout`: friendly missing-catalog explanation, no broken fallback link.
- `sites/umbrella/src/app/globals.css:4421`, `.ed-local-project-panel`: nonexistent `--shadow-raised` replaced by existing overlay shadow expression using shared `--bg-base`; no copied/duplicated token definition.
- `sites/umbrella/test/docs-page.test.ts:7`: status anchor target, missing-status/support/legal truth, and no all-systems-operational assertion.
- `sites/umbrella/test/project-persistence.test.ts:44`: quota and competing-tab checksum/revision verification preserve prior stored bytes.

## Executed evidence

Exact commands, exits, assertion counts, source owners, and all assigned/audit task statuses are in `fix-sites-ui.json`.

1. Owning umbrella `typecheck` passes both production/test TS checks. Owning unchanged `vitest.config.ts`: **2 files / 7 tests pass**, no skips. Malformed/oversized/checksum/cross-owner/Kids/link/revision/conflict/quota assertions retained and extended.
2. `pnpm check:boundaries`: **27 packages pass**. `pnpm check:contracts`: existing authoring/plugin/catalog/entitlement/open-path checks pass. Kids refuse-only and shipping-claim false preserved.
3. Fresh umbrella `pnpm build`: **FAIL**, unchanged prebuild SDK surface assertion: eligible but unpinned `packages/engine-kernel/src/gameplay.ts` and `packages/engine-presentation/src/audio-playback.ts`. Integration owns `scripts/engine-sdk-files.json`; deliberately update eligible public surface, do not skip prebuild or weaken assertion. No fresh umbrella browser claim.
4. Fresh catalog-game and catalog-web production builds: **PASS** compile/types/prerender/traces and unchanged postbuild Vercel packaging. Warnings: existing Next ESLint-plugin configuration; absent metadataBase configured origin → localhost social-image fallback.
5. Actual production browser starts on 3591/3592: both root200/h1=1/first Tab skip link `#main`; widths360/390/620/860/1024/1440 no overflow; root relative links game7/web5 all return below400; unknown item404; page errors0. **Remaining** canonical count0 in unconfigured builds; both robots/sitemap404. These negatives are recorded gaps, not PASS. Browser and both child servers closed/terminated/awaited in finally.
6. Broad site-kit/catalog/sites tests initially **1145 pass / 6 fail**. Owned Linux CTA assertion and undefined CSS token failures reproduced and fixed without changing shared assertions. Focused existing desktop/visual tests then **85 pass / 2 fail**. Final broad run **1147 pass / 4 fail**:
   - `tests/sites/credit-pack-purchase-ux.test.ts:187`: missing expected account return-copy, billing-owned.
   - `tests/sites/site-response-hardening.test.ts:100`: checkout same-origin source-order index assertion (`-1 > 2613`), billing/identity-owned.
   - `tests/sites/umbrella-visual.test.ts:175`: whole-source `.exe` negative matches provider regex `.exec` at `src/provider/account-lifecycle.ts:77`; not a fabricated installer CTA.
   - `tests/sites/umbrella-visual.test.ts:726`: whole-source `Retry` negative matches actual HTTP `Retry-After` at `src/app/api/checkout/route.ts:32`; not invented retry UI.
   Keep security headers/protocol intact; integration must repair scoped or actual-front-door assertions, not disguise code strings, disable checks, or call red tests green.

## Routing errors retained

`project(typecheck, absolute umbrella)` reports no detected command; recovered with exact existing pnpm script. Root Vitest does not include owning umbrella tests: initial `PASS(0)FAIL(0)`, exit1; recovered via owning unchanged config, then seven tests pass. Orchestrator ASK timed out, exact new-path ownership request sent; no reply received. No ownership authorization invented.

## Remaining local/shared work — not external blockers

Assignment exact-path ownership reserves existing shared contracts/config/scripts/root tests and does not grant new legal/status/crawl route paths. Requests are explicit in JSON:

- Integration deliberately repair SDK allowlist and rebuild unchanged umbrella; then real checkpoint edit/save/reload/restart/reopen/export/import and same/different profile/owner/refusal/undo/review/Kids tests. Existing URL checkpoint is not full canonical durable project/proposal acceptance by inference.
- Grant/integrate umbrella exact `src/app/{terms,privacy,refund-policy,contact,status}/page.tsx`, and both catalogs exact `src/app/{robots,sitemap}.ts`. Truthful unreviewed shells; status unknown; validated configured origins and real listing inventory; no Host-derived absolute URLs. Footer/help links must resolve.
- Integration/identity authoritative `packages/site-kit/src/catalog-identity.ts` injected port/exchange contract, then local multi-origin hostile/absent/stale/cross-user tests and catalog site-config consumption. No second auth stack, URL credentials, or presumed cross-origin cookie authority.
- Compatible Next nonce/hash CSP across actual app/hydration/WebGL/checkout plus malicious script/connect negative tests; reserved config/middleware changes require serial integration. Existing minimal CSP is not full closure.
- Route-aware configured-origin canonical/social acceptance, including umbrella docs/routes; unconfigured build does not establish configured canonical correctness.
- Billing/identity regressions and integration-owned root substring assertions above. Full unchanged gate remains serial integration-owned; not rerun competitively here.

## Genuine missing external inputs

Reviewed legal entity/contact/support/terms/privacy/refund/cookie/imprint/licence/trademark provenance; genuine verified session/entitlement/provider/custom-host configuration and separately authorized activation; current release artifact/hash/native installation/accessibility evidence and separately authorized publication. No fabricated provider/legal/signing proof. No commits/push/deploy/publish/new spend/account creation/production data changes. No unrelated work removed.

## Per-item outcome

**No full production PASS.** Fourteen assignment task IDs and eight UI findings are explicitly tracked in JSON, with no acceptance-complete claim where checks/implementation remain open. Local copy/token fix assertions pass; persistence/status/coverage are partial; canonical inherited changes are preserved but acceptance incomplete; catalog identity/CSP/crawl/dedicated shells/shared SDK are local integration work; legal/provider/release authority gates are true external blockers. Parent owns `FINAL.md`/`FINAL.json` and independent three-pass integration.
