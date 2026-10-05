2026-10-01T21:46:40Z — loopStartTimestamp

# Post-PR sites: pass two

loopEndTimestamp: **2026-10-01T22:11:07Z**. PR #312 created **21:40:09Z**. Visual/owning-test PASS; concurrent catalog typechecks remain red. No commit/push.

Downloaded CSS at initial PR head `f4990b8` and current head `346933c`: both match before sources byte-for-byte. Subsequent [patches](../../../sites/catalog-game/test/visual-evidence/postpr/) prove new work.

## Per-change improvements / reasons

- `sites/umbrella/src/app/globals.css:62,2675,4650`: consistent/inset keyboard rings survive clipped panels.
- Same file `:1350,3124,3471`: wrapping refusal keys/hashes/JSON, top-aligned dense rows and numeric rhythm preserve complete evidence.
- `:3542`: readable stale values retain strike-through; addresses QA’s 3.42:1 exception.
- `:4594,4602`: quiet enabled-only hover/press feedback; SVG alignment.
- `:4492,4607,4626`: bounded checkpoint disclosure, honest disabled feedback, stable pending/empty/refused message space.
- `:4633,4639`: separate full purchase IDs from receipt facts; authenticated branch not browser-attested.
- `sites/catalog-game/src/app/globals.css:1697` and `sites/catalog-web/src/app/globals.css:1697`: matching global/inset-scrollport rings.
- Both `:1711,1730,1747`: left-aligned hashes, separated dense rows, aligned checks improve scanning.
- Both `:1756,1762`: wrapping refusals; intentional solid empty-state frame.
- Both `:1772,1789`: clear field/card feedback; replace noisy stacked hover glows.
- `sites/kids/src/app/globals.css:57,241,297,339`: universal focus, stable activity messages, aligned symbols, 44px disclosure and quiet selected/pressed feedback.

## Screenshot proof

42 fresh before/after pairs; **36 differ**. Paths/SHA256 in [JSON](finish-visual-postpr-sites.json) and receipt ledgers; 68 additional audit frames.

| Example | Before SHA256 | After SHA256 |
|---|---|---|
| Umbrella editor desktop | `cff403ecd542a7551c7245ef75c5def61403521e3d94323bed243e993118b804` | `cda2472aa524a5d1a10b81b16ad21ed2e04763954505f1ba46665d3fb710dc44` |
| Forge detail mobile | `3dab55877694df9299a0faf1f2a78944328ff7d907c8c0ad81efc64df53d13c6` | `eb73b71fda5613b7c48afb850ffabb611daac0dc2b40cb2464f55395b306c1fc` |
| Vitrine empty mobile | `df32d3585e3601ace88482e6cb480a08bcc9791a2cb2f41505eb1c144c52f05e` | `96c021a773b977b01c9301ad7e8442dbf2ed90569bc787903f674efa8aca346f` |
| Kids empty mobile | `86e0b3b7c43fa8649958420b8e2b30564c6ef000cdabd11fe7d090b12e5bbbce` | `f54beda2284c106d15fd52f3389c012f82342c3ce1f235b19bde84c5347d1be3` |

## Verification

**575 tests pass**: owning543/provider24/integration7/Kids1. Browser112 before/261 after/683 extended assertions; 562 focus samples; 384-character catalog hashes unclipped. Four production builds pass. Umbrella/Kids typechecks pass; catalogs fail TS2345 at `page.tsx:115,117,121` after concurrent readonly-prop edits; parent notified. Harness mistakes recovered, recorded in JSON. Scoped diff check passes; full gate skipped. CSS-only anti-slop: no new palette/dependencies/assertions/disables/behavior changes; parent’s `editor-shell.tsx` untouched. No production/manual aesthetic certification.
