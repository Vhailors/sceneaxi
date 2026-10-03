# Catalog protocol fix — SOURCE_VERIFIED / HANDED_BACK

Owned root: `/tmp/sceneaxi-comprehensive-owned-xd4gdfl1`.

## Reproduction and repair

Unchanged public rendered-control golden reproduced **26 pass / 5 fail** (animation/effect/environment/material/physics apply). Invocations validated, but domain parsers refused renderer-realm objects because `snapshotPlainRecord` compares its own `Object.prototype`. Baseline evidence: `/home/devuser/.local/share/empryo/tee/2026-10-03T14-52-50-333Z_shell-full.txt`.

- `desktop/linux/src/lib/bridge/catalog-authoring.ts:1`: bounded descriptor-only translation of ordinary renderer protocol containers into host-realm containers. Rejects accessors, proxy values/prototypes, exotic/prototype-carrying records, cycles, sparse/extended arrays, symbols, executable values and over-budget trees without hooks/coercion. Preserves scalar values for existing domain range/canonical validation; no unchecked cast or JSON coercion.
- `desktop/linux/src/lib/bridge.ts:2595`: only five catalog apply cases plus helper import changed. Existing domain parsers still produce the real catalog mutation; shared authoring session stages the real proposal. Require an actual diagnostic-free reviewing proposal. Project its real phase/evidence into transaction progress rather than incorrectly reporting completed; stale proposals now return registered stale-base refusals instead of wrapping an idle refusal as success.
- `desktop/linux/test/catalog-authoring-protocol.test.ts:1`: 14 focused tests: all five foreign-realm mutations stage, do not write, then genuinely persist only after acceptance; malformed/range/nonfinite/getter/proxy/cycle/stale negatives remain zero-write; nested v2 environment, collider/shape preservation and bounded translation covered.

`desktop-scene.ts`, schemas, public index, chrome/harness, manifests, audio and the original golden's assertions are **unchanged**. Original read fingerprints remain identical. Existing domain accessor/range/canonical/alias guards remain in place.

## Final verification

- `focused-final.log`: **14 files / 150 tests pass**, including original GUI golden **31/31**, new protocol **14/14**, all five existing public mutation consumers, all five schema mutation suites, and original animation/physics public goldens.
- `lint-final.log`: explicit ESLint on all three changed files, exit 0.
- `typecheck-final.log`: `pnpm exec tsc --project desktop/linux/tsconfig.json --noEmit`, exit 0.

New stale oracle initially exposed ok:true/idle; repaired actual routes. Development test expectation mistakes (transaction progress nesting/refusal constant) and sparse-array lint were corrected in new tests, never in original assertions. Existing unused bridge boundary alias is now genuinely used for the translated mutation. No full gate/build/install/browser/native/Docker/Git executed; no production/pixel claims.

## Source SHA-256 handoff

| Path | SHA-256 |
|---|---|
| `desktop/linux/src/lib/bridge.ts` | `2747f9ce773b4df482ff9e40fc696eb66d7da0a092e6da7d6d978445aba75417` |
| `desktop/linux/src/lib/bridge/catalog-authoring.ts` | `cd31f2ac542c79a7a88b1e476ee648f7485fe40fd997918f72121bc08f79a43b` |
| `desktop/linux/test/catalog-authoring-protocol.test.ts` | `2e53aae3eb38ea357e8c212a5d7551d7cc212c12652164a02ce3303ec0b93127` |
| Unchanged `tests/e2e/desktop-control-dispatch-real-bridge-golden.test.ts` | `ff312c9ff97138325aae5444c501eb7a28354e878273506019af6fda5e84fe69` |
| Unchanged `desktop/linux/src/lib/desktop-scene.ts` | `97f9f507197494179799e4baf52160ccf245f5c02d744f43c87bbbf6c8fb4bd5` |

Ownership handed back for the three changed files; no remaining scoped source defect or shared-file request.
