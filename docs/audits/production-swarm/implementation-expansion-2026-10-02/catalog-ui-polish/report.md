# Game catalog UI implementation — SOURCE HANDED BACK / scoped PASS

Root: `/home/devuser/Documents/Projects/sceneaxi`. Ledger subjects: VS-05 / UI-001 / UI-002. Full browser/production acceptance remains **NOT READY**; historical failed visual passes are not relabeled.

## Implemented through existing seams

- `sites/catalog-game/src/app/page.tsx:43` — reusable semantic GET controls with safe scalar URL defaults, bounded search help and valid IDREFs. Invalid/duplicate queries still refuse, but now offer editable controls, preserving unaffected valid filters. Only the exact named invalid-query exception is recoverable; unexpected failures reach the existing redacted error boundary (`:64`).
- `page.tsx:68` — full-inventory facets stay stable across search/filter/sort and zero matches; rail explicitly labels their scope. Distinct empty-inventory/no-match copy (`:140`), polite atomic results counter (`:141`). No inventory mutation or new query policy implementation.
- `sites/catalog-game/src/app/_components/listing-card.tsx:60` — model-conditioned purchase-refusal explanation on both regular and compact detail links. No checkout/preview/delivery/entitlement invented.
- `sites/catalog-game/src/app/globals.css:193,699,866,1470` — forced-colors system focus outline; recovery-form styling; mobile-first full-width controls and separate title/price rows at 390px; wrapping prices; readable columns restored only at min-width breakpoints. Foundations tokens, text floors, contrast pairings, reduced motion and unmasked overflow preserved.
- `sites/catalog-game/test/catalog-ux-regression.test.ts:60` — 13 permanent executable source-backed tests: actual page/card/loading/error rendering, real public query model and URL helper, validated web-only/long-title fixture variants, hostile readonly/oversized query refusal, retained scalar controls, unexpected error, and live negative controls for previous empty/catch-all semantics. No casts, assertion suppression, skip or fake success.

Read AGENTS.md, owning layout, current independent-review/ledger and capacity-work catalog-query report/harness before edits. Existing readonly `isSearchText(SearchParams[string])` (`page.tsx:15`), canonical metadata, real GET query policy, busy loading, redacted errors and title wrapping were already correct and preserved. No stale query proposal applied.

## Executed proof and honest failures

1. Initial before runner: **2 pass / 7 fail**; retained `fail-before.log`. Two assertions had harness defects: React reordered form attributes; a legitimate digest tooltip was mistaken for title clipping. Both were narrowed to the actual control/title predicates before source edits, not by changing product requirements.
2. Corrected pre-edit run: **3 pass / 6 fail**, exit 1 (`fail-before-corrected.log`). Four are genuine rendered/source failures (facets, help, card explanation, narrow/forced-colors rules). The other two are **harness injection errors**, not valid product failure receipts: assigning to getter-only public barrel exports. Corrected by overriding the underlying exported catalog module; permanent empty/long-title coverage now uses schema-validated fixture variants. Empty and swallowed-error gaps were source-confirmed before edits and independently reproduced by live in-memory negative controls after edits; these are not misreported as fresh pre-edit executions.
3. Final `node --test sites/catalog-game/test/catalog-ux-regression.test.ts`: **13 pass / 0 fail / 0 skip**, exit 0, `pass-after.log`. Negative controls actually detect restored old empty/catch-all behavior.
4. Unchanged `pnpm exec vitest run tests/sites/catalog-storefronts.test.ts --reporter=dot`: **82 pass**, exit 0, `storefront-regression.log`. Web owner mirrored exact CSS suffix and entire card component using their exclusive paths. No root assertions changed. The existing mobile-first no-max-width oracle was respected by correcting the initial CSS approach before handback.
5. Focused ESLint of both owned TSX files and new test: exit 0 (`lint.log`); owned `git diff --check`: exit 0. Project-tool test autodetection found no command in this separate install root; explicit native/Vitest commands above are the actual proof.

## Final SHA-256 source handback

| Path | SHA-256 |
| --- | --- |
| `sites/catalog-game/src/app/page.tsx` | `952bc1d2f33ccbf48931561dfcb9652ac677f4acbeb3e9413f8b7615992c9150` |
| `sites/catalog-game/src/app/globals.css` | `ee98fef25a7ae0a2042e257da69e347177d9babd8350652de46b4af2dab998ec` |
| `sites/catalog-game/src/app/_components/listing-card.tsx` | `e2f52a6349e33e971d5f2e0e703c0fd94d0eca2d815a7b49c49655eb6019956e` |
| `sites/catalog-game/test/catalog-ux-regression.test.ts` | `c000ad7b6c1b0eb8a615be76041482e1cd238c6e6860d53806934c570aee238b` |

Evidence hashes are in report.json. No immutable integrated candidate is claimed.

## Deferred acceptance / integration requests

**NOT RUN:** full build/gate, site typecheck/build, rebuilt HTTP, browser/native, real 390px title/price/select geometry and clipping/occlusion/contrast/forced-colors Tab proof. Serial owner must run `pnpm --dir sites/catalog-game exec tsc --noEmit --incremental false`, fresh hashed catalog builds and `node sites/catalog-game/test/repair-accessibility-proof.mjs` on stable rebuilt sites, plus explicit browser predicates for search+price+sort URL preservation, clear recovery, safe refusal form, no-match stable rail and long valid title/dual price at 390px. Static CSS/SSR green does not certify geometry or resolve the prior 299-failure receipt.

Exact export requests: **none**. Registration request: root Vitest include excludes sites tests; serial acceptance/CI must explicitly execute `node --test sites/catalog-game/test/catalog-ux-regression.test.ts` (existing installed dependencies only). Dependencies: public site-kit/schema source contracts; web owner's completed exact shared-byte mirror; serial stable-source builds/browser/gate after all handbacks. Identity adapter remains another lane's responsibility.

**Source handback: COMPLETE. No further source writes planned.** Only the four authorized game paths were edited, plus this auxiliary report directory. No identity/manifests/root exports, staging/commits/push/deploy/provider/production data/secrets changed. Memory-only loaders/fixtures; foreground proof processes exited; no servers/ports/browser/container/temp resource to clean up.
