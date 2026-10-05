# Web catalog UI — IMPLEMENTED / SCOPED PROOF PASS

**SOURCE HANDED BACK to parent/bg-109; no further source edits.** Root `/home/devuser/Documents/Projects/sceneaxi`. Exact scope and SHA256 in `report.json`; no identity, manifests, exports or dependencies changed. Read AGENTS/layout:137-160, README, independent-review/ledger VS-05 and capacity catalog-query/responsive report+harness.

## Confirmed gaps and implementation
- `sites/catalog-web/src/app/page.tsx:20` `renderSearchControls`: real editable GET recovery on named invalid queries, bounded scalar defaults, field-specific invalid state and unique help/error IDREFs; duplicate arrays never become scalars. `ShowroomPage:69` propagates unexpected failures to the existing error route instead of blaming filters.
- Full-inventory facets survive no-match; distinct inventory-empty status, named results count and search description. Web-specific preview/intake status links real `/publish#requirements`, never claims preview, uploads, licence entitlement or commerce availability.
- `globals.css`: single-column base controls/card prices, min-width regrouping, wrapping and forced-colors Highlight focus. `_components/listing-card.tsx:60`: conditional unavailable-purchase explanation in regular/compact cards. Exact Game CSS suffix/card parity verified; Web identity prefix preserved.
- New `sites/catalog-web/test/catalog-ux-regression.test.ts`: actual source/React SSR and public helpers, real empty fixture, 4096-character URL, arrays/100-boundary, escaped long titles, compact cards, existing loading/error recovery, configured canonical and live swallowed-error negative control.

## Executed vs deferred
`node --test sites/catalog-web/test/catalog-ux-regression.test.ts`: corrected baseline **3 pass/10 fail** (`before-corrected.log`); final expanded **17 pass/0 fail/0 skip** (`after-final.log`). Initial harness attribute-order/canonical expectations and later CSS declaration-order predicate were corrected, logs retained. CSS acceptance uses mobile-first/min-width per unchanged gate, not obsolete max-width proposal. Owned `git diff --check` and exact shared parity PASS.

Full builds/gate/typecheck/browser **NOT RUN**, delegated to bg-109. Register this Node test explicitly: root Vitest currently excludes sites tests. Fresh 390px/long-title/refused-URL Tab geometry, select readability, unclipped visible focus/forced colors and real GET recovery remain required. VS-05 remains partial; UI-001 preservation tested, UI-002 CSP untouched. Prior failed visual pass remains failed.

Exports requested: none. No servers, browsers, providers, ports or temporary resources created; only owned evidence logs remain.
