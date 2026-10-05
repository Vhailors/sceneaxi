# Serial integration proposal — do not apply during frozen review

No newly reproduced CSS defect warrants changing the reviewed source. Preserve current `sites/umbrella/src/app/globals.css:3541-3545` verbatim in the intended complete artifact:

```css
/* Strike-through, not low contrast, distinguishes the previous value. */
.ed-cr-current {
  color: var(--fg-2);
  text-decoration: line-through;
}
```

Baseline DOM foreground `rgb(122, 100, 72)` / `#7A6448` on declared `#0D0F12`: 3.421712:1. Local after DOM `rgb(138, 146, 156)` / `#8A929C`: 6.097978:1. The exact historical paired PNGs and DOM ledger hashes are in receipt-validation.json. Current four CSS hashes equal the historical after-source hashes, but this proves only CSS equality, not current build equality. Preserve catalog wrapping/focus rules and Kids CSS too; do not manufacture a second contrast fix.

Integrate the validator and immutable intended-spec.json as auxiliary acceptance artifacts after Astra's explicit handoff. Run `python3 docs/audits/production-swarm/capacity-work-2026-10-02/responsive-ux/validate_receipts.py`. Its altered expected digest is rejected without modifying PNGs. For real browser acceptance run browser_edges.py without arguments for exact deferred command/preconditions, then supply an approved loopback config in this directory. Missing edge states must block admission rather than be skipped. Existing source-owned `sites/catalog-game/test/repair-accessibility-proof.mjs:37-69` additionally implements effective contrast and ring ancestor checks; this driver supplements it, not duplicates its complete scope.

Desktop compact/tab/modal full acceptance remains with keyboard-ux and owning desktop integrator; authenticated account history requires approved source-backed nonproduction authority, never production credentials. A 390px editor minimum-width refusal is not positive editing coverage. Long hashes/errors/diffs must be obtained through actual fixtures/public actions, not rewritten DOM text. Current browser run is NOT RUN. No source patch is claimed landed.
