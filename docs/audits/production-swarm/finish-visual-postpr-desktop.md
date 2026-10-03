loopStartTimestamp: 2026-10-01T22:08:21Z
loopEndTimestamp: 2026-10-01T22:20:45Z

# Post-PR desktop retry — additional implemented polish

PR #312 creation: **2026-10-01T21:40:09Z**. This retry made actual additional CSS/test edits after the earlier pass; it does not claim that earlier work was absent. Before captures use the newly fetched PR head **346933c105305224d575bf9319256301c1eeabfa**; after captures use current owned files. No dependencies, behavior/contract changes, commits or pushes. Cached first-loop inputs were not reread; one failed literal test replacement required a surgical reread of that test region.

## Retry changes — file:line / improvement / reason

- `apps/desktop-shell/src/chrome.ts:1154`: Include every explicit tabindex in focus scroll spacing and add system Highlight outlines/selected borders under forced colors. Keep programmatically focused controls and high-contrast keyboard states legible.
- `apps/desktop-shell/src/chrome.ts:1254`: Frame panel empty guidance with a dashed dark well; give existing live-status wells a solid rail. Distinguish idle guidance from status without manufacturing content or success.
- `desktop/linux/src/renderer/byo-configuration.ts:42`: Match the shell's focus halo/scroll spacing; add enabled-field hover and native invalid-state borders. Keep BYOK inputs consistent with adjacent controls without changing validation.
- `desktop/linux/src/renderer/byo-configuration.ts:53`: Make status text selectable, suppress an actually empty message well and style existing alert semantics with a refusal rail. Avoid a blank decorative block; retain complete diagnostic text. Alert/native-invalid styles are conditional; fixtures do not certify a real provider error.
- `apps/web-shell/src/inspector-app.ts:810`: Extend focus styling to selects, textareas, summary and explicit tabindex; use system Highlight in forced colors and native invalid-state borders on light/dark surfaces. Cover all interactive control categories rather than buttons/inputs alone.
- `apps/web-shell/src/inspector-app.ts:816`: Add empty diff-well framing, conditional busy rail, 1.65 line-height, two-column tab stops and tabular wrapping code. Improve empty/loading and dense long-ID evidence readability without changing payloads or requests. The busy rail only applies when aria-busy is already set.
- `apps/desktop-shell/test/visual-refinement.test.ts:84`: Extend existing invariants for tabindex/forced-colors rings and empty/live/BYOK status wells.
- `apps/web-shell/test/visual-postpr.test.ts:15`: Extend focus coverage and add one empty/dense-diff/native-invalid invariant.

Earlier dense-list rhythm, aligned glyph boxes, inert-safe pressed feedback and wrapped dark refusal surfaces remain intact and are still guarded by owning tests; their historical attribution is below.

## Retry before/after proof

Evidence directory: `apps/desktop-shell/test/visual-postpr-evidence/retry/`. Chromium rendered **14 desktop states and six inspector light/dark cases**, plus six inspector focus frames. All **26 before/after pairs with SHA-256** are in `summary.json`; representative pairs follow. PNG names below are relative to that directory.

| Case | Before PNG · SHA-256 | After PNG · SHA-256 |
|---|---|---|
| Empty desktop | `before-empty.png` · `da35923ea169bf55978df4b6821de41986a83bcbf8d9ad27284cbba6419df335` | `after-empty.png` · `fdcfdd0a25a42e295b2c857db705e799313a0ecd1090aa2b6a1840ed3712f39e` |
| Forced-colors keyboard focus | `before-forced-focus.png` · `ebea96764fa9fa6c9ec94a31a198e70eb47637240a839766ee852b7bb2c2234a` | `after-forced-focus.png` · `ecbb2f5e4cd0d6eb7a545046f5ae8195c0800fb9f531b02bc26712f586482a98` |
| Narrow BYOK | `before-byok-narrow.png` · `5ce6282b30b45eacf0cb519d927e8bd245ae8bc11053d6277c950bd2cc18e784` | `after-byok-narrow.png` · `6aeec7f72ab5189e882c31647d96e6a64bf4620428bf1ae3ebc73a9a353e02d4` |
| Empty inspector/light | `before-inspector-idle-light.png` · `6371c84c7266f190f725431da1681f8060a7248316f2493cf414ec9593f8ac72` | `after-inspector-idle-light.png` · `e84bad504b221fb03d5e5347c01d7ee6d050c9740c894f0851add99be33987bd` |
| Dense long diff/dark | `before-inspector-long-diff-dark.png` · `b4f99b36af82f75ad3334b27790390695a46b0b205b21473bef8f52c36a9a841` | `after-inspector-long-diff-dark.png` · `9fe66f3e9deb4fdaf7e74c4663b4c5c4deab26bb8b138d5c08baed93c46d29a3` |
| Long refusal/dark | `before-inspector-refusal-dark.png` · `bd79093c44a8b065df0ac1b4fbef638c7aa0886615313d77a23161f1c8235358` | `after-inspector-refusal-dark.png` · `198996b1b0416cc173c0d462fe86c39c89e6e0cdb4f57edad84951a9936aeaf2` |

`source-vs-pr.patch` SHA-256: `069cfb0e024e50164b7a2b8e2cad2e66d5ccc968db58393e4c347e894c75f282`. This is the raw source diff against the latest PR head, including pre-existing inspector typing changes; only the CSS/test changes listed above are attributable to this retry. Previous evidence files were not overwritten. Reproducible capture harnesses are `apps/desktop-shell/test/visual-postpr-evidence/retry/capture{,-web}.mjs`, pinned to the new head; invoke each with `before` and `after`. An accidental no-argument debug capture was moved out of the repository into `/tmp/sceneaxi-postpr-desktop/discarded-debug/`; it is not evidence.

## Retry verification

- **438 tests pass / 0 failures / 0 pending / 26 files**: desktop-shell 224, web-shell 186, Linux 28. Receipt: `retry/tests.json`. Initial retry run was 435 pass/2 fail because two presentation assertions still contained the narrower focus selectors; updated those assertions and added the empty-diff invariant, then reran all owning suites.
- **1795 browser predicates pass**, including **581 enabled-control focus samples** with solid rings at least 2px. Zero page errors, document overflow or inspector diff overflow across all 20 after cases.
- Five touched TS files: **ESLint/Oxlint pass, zero warnings/errors**. Renderer graph check passes with **94 inputs**. Owned source whitespace check passes.
- **Linux typecheck fails (exit 2)** outside edited files: `src/lib/desktop-scene.ts(297,57): TS2345 unknown → JsonValue`; `packages/engine-presentation/src/three-sculpt.ts(241,202),(241,473),(534,417): TS2345 unknown → number`; `(518,27),(518,69): TS2556 spread requires tuple/rest parameter`. No foreign fix made. Full repository gate/native/GPU/provider acceptance and manual image-review certification were not run or claimed.

## Retained earlier pass — historical evidence, not retry verification

priorLoopStartTimestamp: 2026-10-01T21:46:40Z
priorLoopEndTimestamp: 2026-10-01T22:06:58Z

# Earlier second post-PR desktop visual pass

**Owning tests PASS; Linux typecheck blocked.** PR #312 was created 2026-10-01T21:40:09Z. Before rasterization uses pinned current PR head `f4990b8` (fetched read-only); after uses owned source. All desktop application edits are CSS-only. Earlier inspector typing edits are preserved and excluded from this loop's attribution diffs. No dependencies, contracts, commands, minimum-window changes, commits or pushes.

## Changes — file:line / improvement / reason

- `apps/desktop-shell/src/chrome.ts:1153`: Inset keyboard rings for clipped menus/listboxes/routes; scroll targets clear container edges. Make focus as legible in dense popovers as on the main toolbar.
- `apps/desktop-shell/src/chrome.ts:1155`: Inert-safe hover and pressed feedback, without animations or displacement. Confirm input without making unavailable actions look active.
- `apps/desktop-shell/src/chrome.ts:1158`: Stable scrollbar gutters and scroll padding across scrollable panels. Avoid dense rows and composer fields shifting when evidence grows.
- `apps/desktop-shell/src/chrome.ts:1286`: 10px tabular, selectable metadata; existing complete hashes wrap. Asset evidence previously remained 8px after the first loop.
- `apps/desktop-shell/src/chrome.ts:1299`: Separated evidence rows with full selectable tabular identities. Scan dense labels/values without truncating identifiers.
- `apps/desktop-shell/src/chrome.ts:1330`: Alternating quiet pass surfaces and bounded wrapping. Keep dense pass sequences readable without card noise.
- `apps/desktop-shell/src/chrome.ts:1470`: Fixed nonshrinking, centered glyph boxes; palette shortcut chips never wrap. Align icons and shortcuts despite longer labels.
- `apps/desktop-shell/src/chrome.ts:1477`: Distinct neutral empty well, stable wrapping status block, selectable returned-evidence well. Separate guidance, work status and output without implying progress or success.
- `apps/desktop-shell/src/chrome.ts:1557`: Wrapped diagnostic body with restrained refusal rail. Keep long machine keys/messages inside the error dialog.
- `desktop/linux/src/renderer/byo-configuration.ts:50`: Grouped BYOK status/error explanation; inert-safe press feedback; reduced-motion transitions off. Give the real unavailable state a readable place without asserting configuration success.
- `apps/web-shell/src/inspector-app.ts:799`: System light/dark surfaces, uniform focus/hover/press states, readable dashed disabled controls. Remove opacity-based unreadable labels while retaining native disabled behavior.
- `apps/web-shell/src/inspector-app.ts:813`: Wrapped full diff/path/hash evidence and bounded mobile controls. Eliminate actual long-refusal document overflow and long-diff inner overflow.
- `apps/web-shell/src/inspector-app.ts:815`: Distinct wrapping refusal explanation; existing Foundations danger paint on dark Canvas. Dark refusal text improves 2.87:1 to 5.78:1; light refusal stays 6.54:1.
- `apps/desktop-shell/test/visual-refinement.test.ts:81`: Five added desktop/BYOK presentation invariants. Guard the second-loop styling while retaining all six first-loop tests.
- `apps/web-shell/test/visual-postpr.test.ts:6`: Three added inspector presentation invariants. Guard full evidence, disabled paint and dark refusal framing.

## Before / after screenshots and SHA-256

Existing Playwright drove actual Chromium: 13 desktop states and six inspector state/color-preference cases, plus inspector focus frames. Every pair below has full SHA-256; JSON includes byte lengths, viewports, source hashes, attributable unified diffs and reproducible capture harnesses. Unchanged pairs are retained honestly.

| Case | Before PNG · SHA-256 | After PNG · SHA-256 | Changed |
|---|---|---|---|
| desktop-chrome · empty | [PNG](../../../apps/desktop-shell/test/visual-postpr-evidence/before-empty.png) · `da35923ea169bf55978df4b6821de41986a83bcbf8d9ad27284cbba6419df335` | [PNG](../../../apps/desktop-shell/test/visual-postpr-evidence/after-empty.png) · `dd54e6b2517029a18a98401bbf2b354a8eac9f85229b2fb31395f345fb8129e0` | yes |
| desktop-chrome · long-evidence | [PNG](../../../apps/desktop-shell/test/visual-postpr-evidence/before-long-evidence.png) · `c2117216a0b15f5e3130ed2241fc8be4558dc1081e5b32034380fed8f889e5d2` | [PNG](../../../apps/desktop-shell/test/visual-postpr-evidence/after-long-evidence.png) · `5aefa4f2831cb28632dff58f026a86c7215d337a8fe19b44c38c872c4d786e75` | yes |
| desktop-chrome · selected | [PNG](../../../apps/desktop-shell/test/visual-postpr-evidence/before-selected.png) · `189dfd833b084b4331366ae246015c54a2ffaff18341a92b19ad04f112f8dd86` | [PNG](../../../apps/desktop-shell/test/visual-postpr-evidence/after-selected.png) · `ddb17e3e7ccff1376860fee4342eb84ae5ceb8180dc93a4e85ee2da34be84001` | yes |
| desktop-chrome · byok | [PNG](../../../apps/desktop-shell/test/visual-postpr-evidence/before-byok.png) · `6530d46e7839387f09f0097b0f8338dd756de21c174ee21f382c841e53ade698` | [PNG](../../../apps/desktop-shell/test/visual-postpr-evidence/after-byok.png) · `14134b3d78b1687331c52dd09e842a7758edde2ad50273584acffdeb7c50e752` | yes |
| desktop-chrome · narrow | [PNG](../../../apps/desktop-shell/test/visual-postpr-evidence/before-narrow.png) · `7b1aeb6b695431b555ffbd90318addc18beda310c59776f75b33f13e380b24d9` | [PNG](../../../apps/desktop-shell/test/visual-postpr-evidence/after-narrow.png) · `7281e0098e44307d4bcf657b15214c65a1f1a5e51bf39639dc64fbda3835ada4` | yes |
| desktop-chrome · byok-narrow | [PNG](../../../apps/desktop-shell/test/visual-postpr-evidence/before-byok-narrow.png) · `5ce6282b30b45eacf0cb519d927e8bd245ae8bc11053d6277c950bd2cc18e784` | [PNG](../../../apps/desktop-shell/test/visual-postpr-evidence/after-byok-narrow.png) · `6aeec7f72ab5189e882c31647d96e6a64bf4620428bf1ae3ebc73a9a353e02d4` | yes |
| desktop-chrome · palette | [PNG](../../../apps/desktop-shell/test/visual-postpr-evidence/before-palette.png) · `7655fd5ec213563395f6271ac48ca5d7e4f7b269f18ace124b0e0f8c77d51777` | [PNG](../../../apps/desktop-shell/test/visual-postpr-evidence/after-palette.png) · `f2195a90562a0a71b61cfedcf8c87adc2b63c33c743bf94302b3b452882432c5` | yes |
| desktop-chrome · refused | [PNG](../../../apps/desktop-shell/test/visual-postpr-evidence/before-refused.png) · `9ca518ad54a088a1f189afe27c53c2d6d2d0773f4a4e99faca94e81d410fa67e` | [PNG](../../../apps/desktop-shell/test/visual-postpr-evidence/after-refused.png) · `9ca518ad54a088a1f189afe27c53c2d6d2d0773f4a4e99faca94e81d410fa67e` | no |
| desktop-chrome · menu-pressed | [PNG](../../../apps/desktop-shell/test/visual-postpr-evidence/before-menu-pressed.png) · `e5c5722f67e9730abb3e2310a128de283ea5aa3efb5b9703cf17b33f0e2b7250` | [PNG](../../../apps/desktop-shell/test/visual-postpr-evidence/after-menu-pressed.png) · `f7b15fe88045eb9ab3c23b83781d8e1a7b95ddaeb613015a68cb7bbf194b6de6` | yes |
| desktop-chrome · mobile-refusal | [PNG](../../../apps/desktop-shell/test/visual-postpr-evidence/before-mobile-refusal.png) · `880266fa3f6ca1660da3c37b7189adae065fb507a0e60704fe2153cdc0b96b32` | [PNG](../../../apps/desktop-shell/test/visual-postpr-evidence/after-mobile-refusal.png) · `880266fa3f6ca1660da3c37b7189adae065fb507a0e60704fe2153cdc0b96b32` | no |
| desktop-chrome · busy | [PNG](../../../apps/desktop-shell/test/visual-postpr-evidence/before-busy.png) · `e7456e1952a73a9ead9140f86d335bb6a0b7672d67b157c8367a8db132f133ca` | [PNG](../../../apps/desktop-shell/test/visual-postpr-evidence/after-busy.png) · `dec77b1687a288a7f780f0113fa1e4aee50c3936cd0a51f01e350d470ba1a84d` | yes |
| desktop-chrome · web | [PNG](../../../apps/desktop-shell/test/visual-postpr-evidence/before-web.png) · `01d87acc68149d5570003757d118df10d6926a89f660fa9d6d3e422602b5e63f` | [PNG](../../../apps/desktop-shell/test/visual-postpr-evidence/after-web.png) · `273622d0b0dab908e360f083fa3cbdc8ac9837365b964610fadfda6509100f93` | yes |
| desktop-chrome · kids | [PNG](../../../apps/desktop-shell/test/visual-postpr-evidence/before-kids.png) · `7c5fae57dd20576b943efeccf17518611e9e0b7449560be8e91da70c76bd0790` | [PNG](../../../apps/desktop-shell/test/visual-postpr-evidence/after-kids.png) · `7c5fae57dd20576b943efeccf17518611e9e0b7449560be8e91da70c76bd0790` | no |
| web-shell-inspector · idle · light | [PNG](../../../apps/desktop-shell/test/visual-postpr-evidence/before-inspector-idle-light.png) · `6371c84c7266f190f725431da1681f8060a7248316f2493cf414ec9593f8ac72` | [PNG](../../../apps/desktop-shell/test/visual-postpr-evidence/after-inspector-idle-light.png) · `a7f70d4759170fa8aa6e0fd807f88b1572c6fab470f8bae911c588cb1e57ea12` | yes |
| web-shell-inspector · idle-focus · light | [PNG](../../../apps/desktop-shell/test/visual-postpr-evidence/before-inspector-idle-light-focus.png) · `5aafe99ec46f1568ed8c9cb15f76e4c867d1c4449c0d248bab6dd89e1b73eb5a` | [PNG](../../../apps/desktop-shell/test/visual-postpr-evidence/after-inspector-idle-light-focus.png) · `c0c25a909991445b6a3404e60c18849233a2632090ffb6e91463b5de5be6d2a3` | yes |
| web-shell-inspector · long-diff · light | [PNG](../../../apps/desktop-shell/test/visual-postpr-evidence/before-inspector-long-diff-light.png) · `1416cda826e6418a5db51b4b42203108d9bb087cd5cfd36c4deac6b8207d79b6` | [PNG](../../../apps/desktop-shell/test/visual-postpr-evidence/after-inspector-long-diff-light.png) · `d1b6e8c5a4f14d7ad5355bf89244006900d5aef3fada729613fe299841da2255` | yes |
| web-shell-inspector · long-diff-focus · light | [PNG](../../../apps/desktop-shell/test/visual-postpr-evidence/before-inspector-long-diff-light-focus.png) · `c1d6e990af186ab4cf4f5ede58342338bc2a229210f15c2cb505bf9ea4d64648` | [PNG](../../../apps/desktop-shell/test/visual-postpr-evidence/after-inspector-long-diff-light-focus.png) · `1dda553c537b6aa80bd5a2481ebb16e1c298f47b516d713dae7caff56185f6fd` | yes |
| web-shell-inspector · refusal · light | [PNG](../../../apps/desktop-shell/test/visual-postpr-evidence/before-inspector-refusal-light.png) · `4bdd9ea170a236f56173a07613491fcdde779b4bfda8c7d48dd101b5b0c654ae` | [PNG](../../../apps/desktop-shell/test/visual-postpr-evidence/after-inspector-refusal-light.png) · `9be78c2a10464a947c28a5ef8f2355f4bae0115e4f12ffbf0219c8f43eb849d8` | yes |
| web-shell-inspector · refusal-focus · light | [PNG](../../../apps/desktop-shell/test/visual-postpr-evidence/before-inspector-refusal-light-focus.png) · `1d0cacb0e032f3c3fd2161ae9bb1b25deeabdd03e8d3a939e888c4d3b25672b9` | [PNG](../../../apps/desktop-shell/test/visual-postpr-evidence/after-inspector-refusal-light-focus.png) · `f194bc787287976f2ea8c9379618e375b0c94c7c38f94c1a5319fcf5db217506` | yes |
| web-shell-inspector · idle · dark | [PNG](../../../apps/desktop-shell/test/visual-postpr-evidence/before-inspector-idle-dark.png) · `b24ea318e955c5748ba627c9dc053aaa4b8f7dee26727751e5517296a9eea738` | [PNG](../../../apps/desktop-shell/test/visual-postpr-evidence/after-inspector-idle-dark.png) · `a6accd146cca216cc85bb06fab437490e953ff346e317de50030fe4c9ca17086` | yes |
| web-shell-inspector · idle-focus · dark | [PNG](../../../apps/desktop-shell/test/visual-postpr-evidence/before-inspector-idle-dark-focus.png) · `e0409379bf3fc0a8e056d2debd0ae4e119a4e2b5981dfccf4965c5eb32996ba0` | [PNG](../../../apps/desktop-shell/test/visual-postpr-evidence/after-inspector-idle-dark-focus.png) · `b339f3cfbc4176d6833bb6b7d01f8901c07e12fc52779f59c36e7f3b2a52f14d` | yes |
| web-shell-inspector · long-diff · dark | [PNG](../../../apps/desktop-shell/test/visual-postpr-evidence/before-inspector-long-diff-dark.png) · `b4f99b36af82f75ad3334b27790390695a46b0b205b21473bef8f52c36a9a841` | [PNG](../../../apps/desktop-shell/test/visual-postpr-evidence/after-inspector-long-diff-dark.png) · `450e0755e5aa8cee63dbca3d93f0843842a631686bd81815bc2ff5cbe3031ebc` | yes |
| web-shell-inspector · long-diff-focus · dark | [PNG](../../../apps/desktop-shell/test/visual-postpr-evidence/before-inspector-long-diff-dark-focus.png) · `2d66c20a500631f0387743df341d34236ec7365d97c63f53cfc802f709645888` | [PNG](../../../apps/desktop-shell/test/visual-postpr-evidence/after-inspector-long-diff-dark-focus.png) · `8c44381a4d146b78cac0936e4ae64646c2245f56ec17a2ff4079bc620acbcb2b` | yes |
| web-shell-inspector · refusal · dark | [PNG](../../../apps/desktop-shell/test/visual-postpr-evidence/before-inspector-refusal-dark.png) · `bd79093c44a8b065df0ac1b4fbef638c7aa0886615313d77a23161f1c8235358` | [PNG](../../../apps/desktop-shell/test/visual-postpr-evidence/after-inspector-refusal-dark.png) · `f44e20ececce31d21bf87c3350491963abe7c72ebf1e27e2d4a8f6ff63a3c74b` | yes |
| web-shell-inspector · refusal-focus · dark | [PNG](../../../apps/desktop-shell/test/visual-postpr-evidence/before-inspector-refusal-dark-focus.png) · `acd579c1f817fbb32e084b321ecd0abc13dab5ade3d4fbf149256bc8583e828d` | [PNG](../../../apps/desktop-shell/test/visual-postpr-evidence/after-inspector-refusal-dark-focus.png) · `e7dc0158a42b8402cbb8d5bb6fae84c900c8e6294ec9fdd9b22c00cb0d72c09f` | yes |

## Verification

- **29 files / 563 tests pass**, zero failures/pending; eight new visual invariants. Desktop-shell224, web-shell185, Linux28, relevant goldens126. Existing assertions unchanged. Raw receipt: `apps/desktop-shell/test/visual-postpr-evidence/tests.json`.
- **1599 browser predicates pass**, including 510 repeated enabled-control samples with solid ≥2px focus-visible rings. Zero after page errors/document overflow. Inspector long-refusal document overflow: two cases → zero; long-diff inner overflow: four → zero. Disabled opacity .45 →1; dark refusal contrast **2.87:1 →5.78:1**, light6.54:1.
- Targeted desktop/web TypeScript build, 94-input renderer graph, five touched-file ESLint/Oxlint anti-slop checks (zero warnings/errors), owned whitespace checks pass.
- **Linux typecheck exits2:** `src/lib/desktop-scene.ts(297,57): TS2345 unknown → JsonValue`. Existing first-loop nonvisual error, outside renderer scope; reported to parent, no foreign edit. No full repository gate rerun. Dedicated project tool detected no test command; real-root pnpm suites were executed.

## Honest fixture and recovery limits

Seeded hierarchy uses the actual native bridge; BYOK unavailable is genuine with no privileged port. Busy, dense/long evidence, refusal-dialog and inspector refusal/diff captures are explicitly marked visual fixtures, not provider or write acceptance. Native/GPU, authenticated-provider, exhaustive accessibility and manual image-review certification are not claimed. Original QA measured visuals already passed; no refuted overlap was presented as a new defect.

Initial expanded test run was561pass/2fail: the CSS replacement omitted the closing style tag (caught by unchanged interaction tests) and a new helper selected a grouped rule. Corrected both; final563pass. An inert-palette capture timed out because inert clicks do not create runtime outcomes; replaced that assumption with an honestly labelled visual fixture. Complete failures and receipts remain in JSON.
