# Sites/accessibility repair — implementation ready, verification incomplete

Root and command cwd: `/home/devuser/Documents/Projects/sceneaxi`. Repair pass 1 of at most 3. Independent Astra approval is pending. Local status **NEEDS_LOCAL_FIX**; published status **NOT_VERIFIED**; full-production status **BLOCKED**. No historical/local green is assigned to PR #312. No staging, commits, pushes, publication, deployment, spend, accounts, production DB or held-proof actions occurred.

## Actual repairs and oracles

- `sites/catalog-game/src/app/page.tsx:15` and `sites/catalog-web/src/app/page.tsx:15`: use the actual `SearchParams[string]` readonly union in the non-mutating string guard. Both owning `pnpm --dir sites/catalog-{game,web} exec tsc --noEmit --incremental false` commands reproduced exit 2, six TS2345 diagnostics at lines 115/117/121, then passed exit 0 unchanged. No cast, mutable copy or permissive repeated-query admission.
- `tests/sites/kids-surface.test.ts:210`: requests use the public action parameter type instead of `unknown[]`. TypeScript reproduced TS2345 at line 214; current strict target-test diagnostics are zero using existing root compiler options and workspace source paths. Kids owning typecheck and 10 tests pass, including byte parity, closed refusal table, isolation and measured 4.5 contrast. The first root-install TS invocation hit a CSS declaration mismatch; the correct Kids install-root invocation passed. That harness failure is retained in JSON.
- `tests/sites/umbrella-visual.test.ts`: added a real edit/save/reopen oracle using the existing canonical renderer and browser checkpoint helper. Exact document bytes/digests survive reopen; a second edit changes the digest; increasing revision succeeds; stale save and foreign-owner read refuse without altering stored bytes. Suite 81 passes. Existing literal `"aria-disabled": true` and ShellButton behavior/oracles remain unchanged.
- Added truthful loading states in both catalog `src/app/loading.tsx`, Kids `src/app/loading.tsx`, and umbrella `src/app/{editor,docs}/loading.tsx`. Catalog copies are byte-identical. Added complete root-error documents in both catalog `src/app/global-error.tsx` and Kids `src/app/global-error.tsx`; exception details never reach the copy and Kids has no outbound control.
- `sites/catalog-game/test/rendered-route-states.test.mjs`: four actual-source component SSR tests pass for loading announcements, message/stack redaction, undecided editor access, child-safe/no-capability Kids fallbacks, and root-error documents. These are component SSR observations, **not forced production route/layout failures**.
- Existing canonical persistence source was preserved: `sites/umbrella/src/app/editor/_components/project-persistence.ts`. Its owning five tests pass from the umbrella install root: owner/profile keys, malformed/oversized/tamper/foreign records, atomic revision and corrupt-prior refusal, quota/concurrent-write rollback. Checksum is integrity, not authority; actual entitled reconstruction remains a separate browser predicate.

Exact changed-path/source SHA-256, preserved four CSS hashes, command exits, log hashes and assertions are in `fix-sites-accessibility.json`. No inherited CSS or reducer bytes were rewritten. Existing post-PR CSS/evidence remains local; no publication claim.

## Current matching verification and failures

1. Expanded current focused Vitest run: **240 pass / 1 fail**, eight actual files. Failure: `tests/sites/site-response-hardening.test.ts:103`, `expected -1 to be greater than -1`; its lexical oracle reads the thin checkout route rather than delegated `checkout-handler.ts`. No test weakening or out-of-lane edit. Two guessed site-kit filenames matched no files; corrected owning identity/intake suites were then executed explicitly and passed.
2. `tests/sites/identity-plane-wiring.test.ts` plus `tests/e2e/editor-catalog-intake-golden.test.ts`: exit 0, current injected site-principal/foreign-surface/client-role/Kids/unwired contracts and real digest-bound intake, retry/conflict rollback, human approval and refusal-before-write assertions. This does **not** prove an actual deployed catalog identity adapter.
3. Boundaries: exit 0, 27 packages. Current sites check: exit 1, 11 false positives from eight retained Kids PNGs and three retained build/browser logs scanned as runtime text. All evidence was preserved; repair belongs to the shared checker owner, with forbidden runtime injections retained.
4. Current umbrella owning typecheck: exit 2 at shared `packages/schemas/src/physics-world-host.ts:51,52,66,69,77,81,82`, undeclared `live`, `steps`, `disposed`. Engine/serial owner was notified; no cross-owner source change. Final whole-source/type success cannot be borrowed from earlier catalog checks.
5. New browser proof passes syntax/lint only. No full gate, site build, server or browser was started by this lane.

Logs: `sites/catalog-game/test/visual-evidence/repair/{focused-tests,catalog-identity-intake-tests,persistence-tests,route-states-tests,kids-boundary-types,sites-check}.log`.

## Assigned task outcomes

| ID | Current classification and exact outstanding predicate |
|---|---|
| GATE-LEGAL-PAGES | EXTERNAL_BLOCKER: reviewed terms/privacy/refund/cookie/imprint text, actual entity/contact/support, licence/trademark rights are not supplied. |
| LOCAL-PROOF-039 | NEEDS_LOCAL_FIX: current header-policy assertions pass; actual rebuilt HTTP headers remain serial browser verification. |
| LOCAL-PROOF-042 | NEEDS_LOCAL_FIX: configured-origin sitemap/robots structure assertions pass; current HTTP crawl receipts remain unexecuted. |
| LOCAL-043 | NEEDS_LOCAL_FIX: owned loading/root-error component SSR passes; umbrella root loading/global-error is outside exact write grant and actual browser states remain. |
| LOCAL-044 | NEEDS_LOCAL_FIX: actual error component message/stack redaction passes; full current user-copy/front-door proof remains serial. |
| LOCAL-PROOF-045 | NEEDS_LOCAL_FIX: shared checkout source oracle needs handler-aware repair plus unchanged behavioral origin/body-budget negatives. |
| LOCAL-047 | NEEDS_LOCAL_FIX: four source-backed guide/routes assertions pass; current built help-route HTTP proof remains. |
| REQ-PROOF-SURFACE-011 | NEEDS_LOCAL_FIX: headless positive/negative open golden passes without pixel claims; actual current `/open` canvas/input proof remains. |
| REQ-PROOF-SURFACE-012 | NEEDS_LOCAL_FIX: editor access-before-composition and malformed/negative goldens pass; actual entitled browser/reconstruction proof remains. |
| VS-01 | NEEDS_LOCAL_FIX: serial publication must include preserved CSS and genuine evidence in complete intended artifact and judge exact current SHA/CI. |
| VS-02 | NEEDS_LOCAL_FIX: readonly defect is repaired and both owning tsc checks passed; stable final build/browser predicate remains. |
| VS-03 | NEEDS_LOCAL_FIX: serial owner must correct historical UTC receipt and bind eventual follow-up to its real published SHA. `23:53:32+02:00` equals `21:53:32Z`. |
| VS-04 | NEEDS_LOCAL_FIX: stable source/build fingerprint and exact published artifact/captures/mandatory CI remain serial-owned. |
| VS-05 | NEEDS_LOCAL_FIX: permanent strengthened browser oracle is ready but unexecuted; authenticated own-user provider branch remains separate from preview. |

## Executable serial handoff

Run `node sites/catalog-game/test/repair-accessibility-proof.mjs` from the actual root, timeout 300 seconds, **only with exclusive browser token and stable rebuilt all four sites**. The script does not build or publish. It records complete source hashes/fingerprint, build IDs, HTTP status/page errors, PNG hashes, effective normal-text contrast with explicit unsupported image/group-opacity counts, actual Tab focus clipping/occlusion/describedby and forced colors at 390/1440, real catalog submit/clear/repeated/long-query refusals, Kids play/network-API/cookie/storage isolation, real Web canonical export/save/reopen and hostile-import no-partial-change, and public canvas mount/reset transitions. It rejects source drift and owns process-group/browser cleanup. Preview is explicitly **not** authenticated provider evidence.

Shared requests are enumerated as SITE-REQ-01..08 in JSON: stable builds/token; handler-aware root test; Kids evidence-aware runtime checker; umbrella root fallbacks plus exact client-graph fixture update; real catalog own-session adapter; approved nonproduction own-user browser input; exact current PR tree/UTC/CI; shared physics type repair. Missing local adapters/builds are **not external-only blockers**. Genuine legal/provider/ops inputs do not authorize new actions.

No delegated children or heavy process is active. Reports and owned path changes are ready for explicit serial-integration handoff; independent Astra review has not occurred.
