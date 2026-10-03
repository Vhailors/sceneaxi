# 03 — Sites visual deep review: FAIL

Published PR #312: `346933c105305224d575bf9319256301c1eeabfa`; base `dd77cc9cb91d24091082e0c5bc20a130f0f51ffc`. Dirty application HEAD: `4e532e2fbf43e9948741578ab6208a3277870405` (not the PR artifact). Initial review timestamp: 2026-10-02T06:55:39.051329+00:00. Retry independently refreshed metadata/hash evidence at 2026-10-02T06:57:34Z.

**Narrow goal (PR then visual improvement included in PR): FAIL. Broader fully-production/all-locally-achievable goal: FAIL.** Bounded local visual improvement is real; it is not shipped by this PR and is not exhaustive acceptance.

## Top five findings

### VS-01 — P1 — FAIL: Post-PR sites improvement is not included in the published PR
- Evidence: `docs/audits/production-swarm/finish-visual-postpr-sites.json:13-14`; `sites/umbrella/src/app/globals.css:62,2675,3542,4594`; `sites/catalog-game/src/app/globals.css:1697`; `sites/catalog-web/src/app/globals.css:1697`; `sites/kids/src/app/globals.css:57`
- Expectation: Subsequent actual visual changes and their evidence are included at the current published PR head.
- Observed: All four published CSS blobs equal f4990b8; local current blobs differ and match reported after hashes. Both report files and entire postpr evidence directory are untracked and absent from exact PR tree. Published-to-local inserted/deleted lines: umbrella98/10, game102/1, web102/1, Kids29/2.
- Reproduced/refuted: REPRODUCED; included-in-PR claim REFUTED
- Precise fix/acceptance: Preserve untouched files while publishing the intended complete reviewed artifact under separate authority, include all four CSS changes and evidence, then verify exact new head tree/blobs and required checks. This review performs no push.

### VS-02 — P1 — FAIL: Current catalog source fails strict typechecking despite earlier build receipts
- Evidence: `sites/catalog-game/src/app/page.tsx:15,115,117,121`; `sites/catalog-web/src/app/page.tsx:15,115,117,121`; `sites/catalog-game/test/visual-evidence/postpr/catalog-game-types.log:1-9`; `docs/audits/production-swarm/finish-visual-postpr-sites.json:60-62`
- Expectation: Current complete source supports successful required catalog checks without weakening readonly inputs or skipping types.
- Observed: Fresh tsc --noEmit --incremental false returns2 in BOTH catalogs, six TS2345 diagnostics total. readonly string[] cannot be passed to isSearchText accepting mutable string[]. Historical successful build logs precede source drift and cannot override fresh failure.
- Reproduced/refuted: REPRODUCED_FRESH_CURRENT_WORKTREE; not attributed to PR execution
- Precise fix/acceptance: Allow readonly string arrays (or unknown with proper string narrowing) at the pure guard while preserving string-only admission; rerun both owning typechecks and complete build/browser checks on one stable artifact.

### VS-03 — P2 — FAIL: Published chronology incorrectly labels local UTC+02 commit time as UTC
- Evidence: `docs/audits/production-swarm/PR-EVIDENCE.md:38-42`; `docs/audits/production-swarm/finish-visual-postpr-sites.md:1,5`
- Expectation: UTC chronology must match gh dates and demonstrate all claimed follow-up changes are committed after the loop.
- Observed: gh createdAt21:40:09Z < sites loopStart21:46:40Z is valid. git346933c authored/committed23:53:32+02:00 =21:53:32Z, not23:53Z. f4990b8 is21:43:12Z, not21:44Z. sites loopEnd22:11:07Z is later than latest published commit; stylesheet diff f4990b8..346933c is empty.
- Reproduced/refuted: REPRODUCED; claimed UTC repair-before-commit chain REFUTED
- Precise fix/acceptance: Normalize all timestamps with their explicit offsets, distinguish declared report times from independently recorded commit times, and bind any eventual follow-up to its actual remote SHA.

### VS-04 — P1 — FAIL: Local screenshots and historical owning greens do not certify the PR runtime
- Evidence: `git:346933c105305224d575bf9319256301c1eeabfa:packages/site-kit/src/design-tokens.ts (ABSENT)`; `docs/audits/production-swarm/finish-visual-postpr-sites.json:31,48-64`; `sites/catalog-game/test/visual-evidence/postpr/verification-final.json:3-30`
- Expectation: Screenshots/tests must originate from a buildable complete exact artifact; local green cannot be transferred to published or later dirty source.
- Observed: All152 local PNG hashes/signatures/byte counts validate, but exact PR lacks packages/site-kit/src/design-tokens.ts; git show exits128. Captures were local Next builds, not exact PR checkout. No complete source/build fingerprint binds those captures to current changed TS source. Retained543/24/7/1 logs are historical local receipts only.
- Reproduced/refuted: REPRODUCED_PR_FILE_ABSENCE; cross-artifact certification REFUTED
- Precise fix/acceptance: Restore complete intended tree, record source/build fingerprint plus exact SHA and run required checks/captures from that artifact; keep dirty-worktree evidence separate.

### VS-05 — P2 — FAIL: Bounded focus/overflow/contrast samples leave full-goal accessibility gaps
- Evidence: `docs/audits/production-swarm/finish-visual-postpr-sites.json:58,74`; `sites/catalog-game/test/visual-evidence/postpr/after.json:45-55`; `sites/catalog-game/test/visual-evidence/postpr/audit.json (focusSamples ledger)`; `sites/umbrella/src/app/globals.css:4633-4647`
- Expectation: A 100% visual/production accessibility claim requires changed branches and actual readable/unobscured keyboard behavior, not repeated computed-style samples alone.
- Observed: 34 metric-bearing receipts per phase show no document overflow; after149 and audit562 focus samples show solid >=2px outlines. These do not prove every ring unobscured, every element unclipped, every state keyboard-operable, or all contrast pairings. Authenticated purchase history is explicitly not provider-browser attested. Raw page-error/status observations are not fields in the capture ledgers.
- Reproduced/refuted: COVERAGE_HOLE_CONFIRMED; exhaustive full-goal claim REFUTED, bounded results not refuted
- Precise fix/acceptance: Retain machine checks for foreground/background/effective contrast, clipped/occluded focus rings, element-level overflow and relevant keyboard states; capture authenticated own-user branch with approved nonproduction provider configuration; persist raw HTTP/page-error assertions and artifact identity.

## Retry live verification — 2026-10-02T06:57:34Z
- Fresh `gh pr view 312 --json url,createdAt,headRefOid,baseRefOid,commits,statusCheckRollup` confirms the exact published head/base and PR creation timestamp. All nine executed checks are FAILURE; two native checks are SKIPPED. This is published-artifact evidence, not a dirty-worktree test result. Examples: [gate](https://github.com/Vhailors/sceneaxi/actions/runs/36931652198/job/110602099368), [umbrella build](https://github.com/Vhailors/sceneaxi/actions/runs/36931652198/job/110602099454), [catalog-game build](https://github.com/Vhailors/sceneaxi/actions/runs/36931652198/job/110602099406), [catalog-web build](https://github.com/Vhailors/sceneaxi/actions/runs/36931652198/job/110602099285), [Kids build](https://github.com/Vhailors/sceneaxi/actions/runs/36931652198/job/110602099217). Failure conclusions alone do not establish individual CI root causes.
- Fresh `git diff --numstat 346933c105305224d575bf9319256301c1eeabfa -- <four CSS paths>` reproduces umbrella98/10, game102/1, web102/1, Kids29/2. `git diff --name-only f4990b8aac5f5af75a16fe3fbb55b74855f2b636 346933c105305224d575bf9319256301c1eeabfa -- <four CSS paths>` returns no paths. Exact-head `git ls-tree` returns no report pair, postpr evidence directory, or design-tokens.ts. Fresh status confirms the CSS is dirty and both reports/evidence directory are untracked.
- Fresh `sha256sum` and `file` reproduce all eight hashes and dimensions in the four representative pairs below; all four local CSS SHA256 values also match the retained JSON evidence. PNG identity/dimension checks are not new rendering or accessibility checks.
- Retry did not reread the previously inspected source/report/log files or rerun typechecks, builds, tests, browser drivers or pixel decoding. Detailed log/ledger/source and initial typecheck findings below remain the earlier lane evidence, not freshly executed retry results. No green is transferred between artifacts. Only this numbered report pair is edited.

## Independently verified bounded evidence
- Four current CSS SHA256 values match the report after-source receipts exactly; remote CSS equals initial loop head for all four. Every one of the 12 reported CSS change groups has concrete local differences (complete hashes/hunks and claim mapping in JSON).
- All 152 PNG signatures, IHDR dimensions, bytes and hashes pass: before42 + after42 + audit68; 36/42 paired hashes differ. These are historical local PNG files verified live now, not fresh browser runs.
- Existing installed sharp decoded all four representative pairs; common-area changed pixels: umbrella3294, Forge846064, Vitrine59801, Kids196330. Unequal heights are expected full-page screenshots, not claimed viewport heights.
- Local stale text changes from7A6448 to8A929C in raw computed-style ledgers; against local bg-panel0D0F12 independent WCAG ratio3.4217→6.0980. Actual local CSS retains strike-through. This is a concrete legibility improvement; token-provider absence prevents assigning local pixels/contrast to PR runtime.
- No document overflow in the34 metric-bearing receipts of each phase. After149 and extended562 computed-style focus samples have solid rings >=2px; 567 audit focusSamples entries include five non-focus diagnostics, so562 is the accurate focus count. Repeated focus samples/683 assertions are not683 independent requirements.

### Four representative pairs (SHA256 and dimensions independently verified)

**umbrella editor desktop**
- before: `sites/catalog-game/test/visual-evidence/postpr/before-umbrella-editor-desktop.png` — `cff403ecd542a7551c7245ef75c5def61403521e3d94323bed243e993118b804` — 1440×1000, 235868 bytes.
- after: `sites/catalog-game/test/visual-evidence/postpr/after-umbrella-editor-desktop.png` — `cda2472aa524a5d1a10b81b16ad21ed2e04763954505f1ba46665d3fb710dc44` — 1440×1000, 236704 bytes.

**Forge detail mobile**
- before: `sites/catalog-game/test/visual-evidence/postpr/before-catalog-game-detail-mobile.png` — `3dab55877694df9299a0faf1f2a78944328ff7d907c8c0ad81efc64df53d13c6` — 390×4233, 322535 bytes.
- after: `sites/catalog-game/test/visual-evidence/postpr/after-catalog-game-detail-mobile.png` — `eb73b71fda5613b7c48afb850ffabb611daac0dc2b40cb2464f55395b306c1fc` — 390×4453, 326092 bytes.

**Vitrine empty mobile**
- before: `sites/catalog-game/test/visual-evidence/postpr/before-catalog-web-empty-mobile.png` — `df32d3585e3601ace88482e6cb480a08bcc9791a2cb2f41505eb1c144c52f05e` — 390×2669, 219231 bytes.
- after: `sites/catalog-game/test/visual-evidence/postpr/after-catalog-web-empty-mobile.png` — `96c021a773b977b01c9301ad7e8442dbf2ed90569bc787903f674efa8aca346f` — 390×2674, 217870 bytes.

**Kids empty mobile**
- before: `sites/catalog-game/test/visual-evidence/postpr/before-kids-empty-mobile.png` — `86e0b3b7c43fa8649958420b8e2b30564c6ef000cdabd11fe7d090b12e5bbbce` — 390×1330, 109527 bytes.
- after: `sites/catalog-game/test/visual-evidence/postpr/after-kids-empty-mobile.png` — `f54beda2284c106d15fd52f3389c012f82342c3ce1f235b19bde84c5347d1be3` — 390×1402, 109054 bytes.

## All reported CSS differences assessed
| Group | Evidence locations | Local change / published status |
|---|---|---|
| 1: Consistent accent-hi focus rings; editor and table-scrollport rings inset | sites/umbrella/src/app/globals.css:62; sites/umbrella/src/app/globals.css:2675; sites/umbrella/src/app/globals.css:4650 | Concrete local difference; absent from follow-up PR CSS diff |
| 2: Named refusal/state containers shrink safely and wrap complete machine strings | sites/umbrella/src/app/globals.css:1350 | Concrete local difference; absent from follow-up PR CSS diff |
| 3: Tabular numeric tables, even dense-list padding, legible wrapping metadata, top-aligned evidence cells | sites/umbrella/src/app/globals.css:1557; sites/umbrella/src/app/globals.css:3111; sites/umbrella/src/app/globals.css:3124; sites/umbrella/src/app/globals.css:3471 | Concrete local difference; absent from follow-up PR CSS diff |
| 4: Previous diff values use fg-2 while retaining strike-through | sites/umbrella/src/app/globals.css:3542 | Concrete local difference; absent from follow-up PR CSS diff |
| 5: Quiet hover surface and inset pressed confirmation; nonshrinking inline SVGs | sites/umbrella/src/app/globals.css:4594; sites/umbrella/src/app/globals.css:4602 | Concrete local difference; absent from follow-up PR CSS diff |
| 6: Bounded checkpoint disclosure, framed disabled controls, stable pending/empty/refused message space | sites/umbrella/src/app/globals.css:4492; sites/umbrella/src/app/globals.css:4607; sites/umbrella/src/app/globals.css:4613; sites/umbrella/src/app/globals.css:4626 | Concrete local difference; absent from follow-up PR CSS diff |
| 7: Purchase-history IDs get their own full-width line and dates use tabular numerals | sites/umbrella/src/app/globals.css:4633; sites/umbrella/src/app/globals.css:4639 | Concrete local difference; absent from follow-up PR CSS diff |
| 8: Identical global keyboard rings and inset sticky-scrollport rings; dark scrollbar surfaces | sites/catalog-game/src/app/globals.css:1697; sites/catalog-web/src/app/globals.css:1697 | Concrete local difference; absent from follow-up PR CSS diff |
| 9: Left-aligned readable hash values, separated spec/list rows, aligned check icons | sites/catalog-game/src/app/globals.css:1711; sites/catalog-web/src/app/globals.css:1711; sites/catalog-game/src/app/globals.css:1730; sites/catalog-web/src/app/globals.css:1730; sites/catalog-game/src/app/globals.css:1747; sites/catalog-web/src/app/globals.css:1747 | Concrete local difference; absent from follow-up PR CSS diff |
| 10: Wrapping refusal states and a quiet solid empty-result frame with semantic accent edge | sites/catalog-game/src/app/globals.css:1756; sites/catalog-web/src/app/globals.css:1756; sites/catalog-game/src/app/globals.css:1762; sites/catalog-web/src/app/globals.css:1762 | Concrete local difference; absent from follow-up PR CSS diff |
| 11: Visible filter hover, card hover/focus boundary, inset action feedback instead of stacked outer glows | sites/catalog-game/src/app/globals.css:1772; sites/catalog-web/src/app/globals.css:1772; sites/catalog-game/src/app/globals.css:1789; sites/catalog-web/src/app/globals.css:1789 | Concrete local difference; absent from follow-up PR CSS diff |
| 12: Universal focus ring, stable live-message space, aligned emoji cells, tabular counts, 44px disclosure with quiet hover/open feedback | sites/kids/src/app/globals.css:57; sites/kids/src/app/globals.css:241; sites/kids/src/app/globals.css:297; sites/kids/src/app/globals.css:314; sites/kids/src/app/globals.css:339 | Concrete local difference; absent from follow-up PR CSS diff |

## Browser/test log audit and fresh checks
- Retained owning-tests-final.log:8files/543pass; provider.log:24pass; integration.log:7pass; corrected Kids Node log:1pass/no errors/no external requests/storage. These were not rerun by this reviewer and cannot certify current PR or later dirty source.
- kids-activity.log:1 contains `error: unknown command test`; verification-final.json:23-25 retains exit1. Corrected Node log proves recovery; finish report acknowledges it. No unreported browser failure identified in retained logs; capture browser stdout is not retained, so absence of hidden failures cannot be certified. Provider stderr messages belong to intentional negative tests and end24pass.
- Fresh current catalog checks: each `pnpm --dir /home/devuser/Documents/Projects/sceneaxi/sites/catalog-{game,web} exec tsc --noEmit --incremental false` exits2. Output: `src/app/page.tsx(115,106),(117,80),(121,78): error TS2345: Argument of type string | readonly string[] | undefined is not assignable to parameter of type string | string[] | undefined`; readonly array is not mutable. Six current diagnostics reproduce the retained typecheck logs.
- A source-context probe `git show 346933c105305224d575bf9319256301c1eeabfa:packages/site-kit/src/design-tokens.ts` exits128 (`path exists on disk, but not in commit`); its preceding PR CSS probe shows .ed-cr-current at3523-3525 still uses stale. The missing-file result is retained, not suppressed.

## Chronology and claim refutations
PR created21:40:09Z; f4990b8 commit21:43:12Z; sites declared loop start21:46:40Z; head346933c commit21:53:32Z; declared loop end22:11:07Z. Start-after-PR is supported as a declared timestamp consistent with gh; real execution start is not independently logged. The23:53 repair label mistakes UTC+02 for UTC and cannot prove repair preceded21:53Z commit. The actual remote only follow-up source repair does not include these four stylesheet changes. The report pair and all postpr PNGs are absent in exact head git tree; untracked local receipts are not published PR evidence.

## Coverage and mutation limits
EMPRYO.md is absent. Read AGENTS.md, layout42-160, FINAL.md and PR-EVIDENCE.md plus only this lane evidence. No historical4513/544 green is reused. No full source/build/browser/native/production certification. Full repository build/gate and fresh browser captures intentionally not rerun (assigned build reviewer owns whole-source activity); no server builds started. No product/config/source edits, commits, pushes, PR changes, installs, deploys, spend or accounts. Only these numbered report files are written. Final artifact-specific acceptance remains FAIL.
