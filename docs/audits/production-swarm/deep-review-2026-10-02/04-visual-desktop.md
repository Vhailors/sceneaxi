# 04 — Desktop and inspector visual deep review — FAIL

## Artifact identity and goal verdict

- Published OPEN PR #312: `346933c105305224d575bf9319256301c1eeabfa`, base `dd77cc9cb91d24091082e0c5bc20a130f0f51ffc`; created21:40:09Z. Commit23:53:32+02:00 =21:53:32Z, not23:53Z.
- Dirty application worktree HEAD `4e532e2fbf43e9948741578ab6208a3277870405`. No source/config/product/PR changes by reviewer.
- Narrow PR-then-subsequent-visual-improvement INCLUDED-in-PR: **FAIL** for reviewed surfaces. Full-production/all-locally-achievable assurance: **FAIL**. Local actual sampled improvements are real but not published or full-product certification.

## Numbered findings

### 1. VD-01 — P1 — FAIL
- Artifact: PR and worktree distinction.
- Evidence: `git tree 346933c105305224d575bf9319256301c1eeabfa`; `docs/audits/production-swarm/finish-visual-postpr-desktop.md:6`; `docs/audits/production-swarm/finish-visual-postpr-desktop.json:11-15`; `docs/audits/production-swarm/PR-EVIDENCE.md:38-42`.
- Expectation: Genuine subsequent visual improvement included in current PR with its owning regression/evidence.
- Observed: All four reviewed source hashes identical at creation a2e41fed, evidence f4990b8, and current PR346933c. Retry changes three source files locally, but both visual tests, retry summary/screenshots and retry report absent in current PR. Token source unchanged vs PR.
- Reproduced/refuted: git show/hash comparison and cat-file existence checks; current gh PR head confirmed.
- Precise fix/acceptance: Publish intended complete artifact under separate authority; include these actual subsequent visual diffs, owning tests and genuine captures; rerun required checks on that exact new SHA. No publish action performed here.

### 2. VD-02 — P1 — FAIL
- Artifact: PR source; worktree narrowly repaired.
- Evidence: `apps/web-shell/src/inspector-app.ts:816-825`; `apps/desktop-shell/test/visual-postpr-evidence/retry/capture-web.mjs:17-25`; `apps/desktop-shell/test/visual-postpr-evidence/retry/summary.json:2-10`.
- Expectation: Readable >=4.5:1 normal refusal text and complete wrapped evidence without horizontal document/diff overflow.
- Observed: PR390px long evidence/refusal light and dark live probes overflow document/diff. PR dark refusal rgb179,38,30 ratio2.866:1 on dark18; worktree rgb255,77,94 ratio5.776:1 and no sampled overflow. Light6.536:1 unchanged. Historical ledger before2 document/4 diff cases; after0.
- Reproduced/refuted: Fresh Chromium probes from PR/current source in memory; raw ledger independently inspected. Before transparent canvas requires browser dark canvas assumption, separately declared.
- Precise fix/acceptance: Include local wrapping/dark paint fix in intended PR artifact; assert >=4.5 contrast on resolved background and overflow at relevant widths/state fixtures on exact artifact.

### 3. VD-03 — P1 — FAIL
- Artifact: worktree capture evidence and PR source fixture.
- Evidence: `apps/desktop-shell/test/visual-postpr-evidence/retry/capture.mjs:77-95`; `apps/desktop-shell/test/visual-postpr-evidence/retry/after.json`; `apps/desktop-shell/test/visual-postpr-evidence/retry/summary.json:131-140`.
- Expectation: Refusal screenshot displays actual readable diagnostic and reachable dismissal/return controls.
- Observed: Refused before/after PNG identical5292bytes1280x900. Ledger all measured regions visiblefalse, zero focusSamples. Independently replaying fixture on PR/current yields body.innerText empty and zero visible enabled controls. No-errors/no-overflow are vacuous for this state.
- Reproduced/refuted: Fresh in-memory Chromium reproduction of capture fixture plus PNG and ledger inspection.
- Precise fix/acceptance: Enter refusal through actual renderer action/state; assert visible dialog, diagnostic text, nonzero geometry, and accessible dismissal before capture; replace invalid captures without relabeling blank screen as successful refusal coverage.

### 4. VD-04 — P2 — FAIL
- Artifact: PR source focus geometry; worktree bounded repair.
- Evidence: `apps/desktop-shell/src/chrome.ts:1147-1159`; `apps/desktop-shell/test/visual-postpr-evidence/retry/capture.mjs:87-95`.
- Expectation: Focused controls/rings remain visible and unoccluded, not merely styled.
- Observed: At1280x900 PR default and palette effect-mutation focuses with solid2px outline yet rectangle [1048.609375,853.421875,182,51] extends to904.421875; documentOverflowfalse. Current sampled control rectangle remains inside viewport. Capture checks no geometry, clipping ancestry, occlusion, or actual keyboard traversal.
- Reproduced/refuted: Fresh Chromium both renderers; programmatic focus loop with bounding boxes. Full ring pixels not independently certified.
- Precise fix/acceptance: Commit local scroll/focus repair and add real Tab traversal with focus geometry, ancestor clipping and occlusion checks at minimum/compact/window sizes; retain assertion that unavailable controls keep explanatory stops.

### 5. VD-05 — P2 — FAIL
- Artifact: worktree assurance metric; full-production goal.
- Evidence: `docs/audits/production-swarm/finish-visual-postpr-desktop.md:39-41`; `apps/desktop-shell/test/visual-postpr-evidence/retry/capture.mjs:94`; `apps/desktop-shell/test/visual-postpr-evidence/retry/capture-web.mjs:25`; `apps/desktop-shell/test/visual-refinement.test.ts:81-105`; `apps/web-shell/test/visual-postpr.test.ts:15-35`.
- Expectation: Coverage figures distinguish repeated measurements from independent behavior coverage and include intended inert focus/descriptions.
- Observed: 1795 reconstructs exactly as581 focus samples*3(style/pseudo/width)+52 case predicates.557 desktop samples span142 tag/id/class combinations;24 inspector samples four IDs. isEnabled excludes aria-disabled controls; programmatic focus does not establish sequential keyboard stops/describedby resolution/modal trapping. Unit invariants mostly CSS-string assertions. Native provider/error/forced-colors full traversal and screen reader assurance absent.
- Reproduced/refuted: Independent ledger recount1795 all pass; harness source inspections prove omissions.
- Precise fix/acceptance: Report3 focus-style predicates across repeated samples plus52 state checks, not1795 independent requirements. Add inert Tab/activation/description resolution, modal containment/dismissal and visible focus probes; explicitly retain untested native/hardware/provider/assistive-tech goals.

## Independently verified positive predicates and refutations

- All26 before/after pairs:52 PNG signatures, SHA256, byte lengths and IHDR dimensions verified.23 changed,3 unchanged. Complete numbered pair receipts below and JSON; changed pixels alone do not prove better design.
- `summary.json:23-35` source hashes for chrome/BYOK/inspector exactly match current files; source-vs-pr.patch recorded hash verified. `visual-tokens.ts` equals PR. Same four source hashes across creation a2e41fed, evidence f4990b8 and published346933c demonstrate no subsequent shipped polish on these surfaces.
- Independent ReactDOM static rendering of extracted actual `ShellButton` establishes runtime use of literal aria-disabled=true, preserved focusability (no disabled/tabIndex=-1), stable describedby construction and inert click-handler suppression. `editor-shell.tsx:35-36,212-246`; `umbrella-visual.test.ts:1182-1191` old expected-source oracle is intact in base/PR/current. This is meaningful preservation, not merely adding an unused literal. Full legend/keyboard/screen-reader behavior remains unverified.
- Current source dark inspector refusal5.776:1 vs exact PR2.866:1; light6.536:1 unchanged. Current390px sampled long refusal/diff contain all horizontal evidence. Raw historical ledgers agree: before2 document/4 diff overflow, after0. No transfer of current green to PR.
- Retry report explicitly admits Linux typecheck FAIL and no full gate/native/provider/manual image certification (`finish-visual-postpr-desktop.md:41,109-111`); those disclosures are correct limits, not production PASS. Reported438-suite pass not independently rerun by this reviewer.

## Live-check method and scope

- Read AGENTS.md, relevant layout ownership, FINAL.md, PR-EVIDENCE.md and own visual report/evidence. Local EMPRYO.md absent. Root explicitly set to actual application on every shell command.
- Read-only git show/diff/cat-file and gh pr view confirmed artifact/head/time/source equality and missing remote visual evidence/tests. No fetch/reset/checkout/stash/clean/commit/push.
- Existing Chromium/Playwright plus in-memory esbuild(write:false) loaded PR/current renderer source for default/palette/refused desktop1280x900 and light/dark inspector390x844. No builds or capture writes. PR source probes share current model/dependency inputs, as the archived harness does; they do not certify the incomplete remote checkout.
- Actual ShellButton source extracted/transpiled in memory and rendered with existing ReactDOM server. Static attributes and source handler conditional verified; no claim of full application click/Tab/legend acceptance.
- Independently counted1795 current ledger predicates:557 desktop+24 inspector focus samples, three focus-style predicates each,28 desktop state checks+24 inspector state checks. All1795 pass their narrow predicates, including vacuous empty refusal checks.
- Whole-repo build/gate and focused owning suites NOT rerun; assigned build reviewer owns those. Historical4513/544 or438 tests do not certify current remote artifact. No native Electron/provider/GPU/assistive technology or manual-image certification.
- Seven bounded shell checks preceded report write; every timeout<=120s. Only04 report pair written.

## 26 numbered PNG pair integrity receipts

| # | Scenario | Before dimensions / SHA256 | After dimensions / SHA256 | Changed |
|---:|---|---|---|---|
| 1 | empty | 1680×1000 / `da35923ea169bf55978df4b6821de41986a83bcbf8d9ad27284cbba6419df335` | 1680×1000 / `fdcfdd0a25a42e295b2c857db705e799313a0ecd1090aa2b6a1840ed3712f39e` | yes |
| 2 | forced-focus | 1280×900 / `ebea96764fa9fa6c9ec94a31a198e70eb47637240a839766ee852b7bb2c2234a` | 1280×900 / `ecbb2f5e4cd0d6eb7a545046f5ae8195c0800fb9f531b02bc26712f586482a98` | yes |
| 3 | long-evidence | 1680×1000 / `c2117216a0b15f5e3130ed2241fc8be4558dc1081e5b32034380fed8f889e5d2` | 1680×1000 / `f5c1d6d5e2075f1515bd59b8a64089de6f736d260d15da4ba3ce65e2ee43a392` | yes |
| 4 | selected | 1680×1000 / `189dfd833b084b4331366ae246015c54a2ffaff18341a92b19ad04f112f8dd86` | 1680×1000 / `5654be546639ec8d79a2296fc8819cf8279a917638fb9b0476a2fb11624b4d59` | yes |
| 5 | byok | 1680×1000 / `6530d46e7839387f09f0097b0f8338dd756de21c174ee21f382c841e53ade698` | 1680×1000 / `db15d6fb20d94975e9fae1a990ef66f0ba32dd4f2b8688cf1c22c6b680d914fd` | yes |
| 6 | narrow | 900×640 / `7b1aeb6b695431b555ffbd90318addc18beda310c59776f75b33f13e380b24d9` | 900×640 / `a9ff312025dacd1d3958e8f391f18b9625f06b0ba663a140affe0a83614104c2` | yes |
| 7 | byok-narrow | 900×640 / `5ce6282b30b45eacf0cb519d927e8bd245ae8bc11053d6277c950bd2cc18e784` | 900×640 / `6aeec7f72ab5189e882c31647d96e6a64bf4620428bf1ae3ebc73a9a353e02d4` | yes |
| 8 | palette | 1280×900 / `54050f7fff6ca3643f2d5df22e1d1b84c9e7379547fa33fd7ae68a8fb115a87a` | 1280×900 / `9f9817efc2fdf069474328cc853efb183e29b1f9e603d14f3069c198b85a7829` | yes |
| 9 | refused | 1280×900 / `9ca518ad54a088a1f189afe27c53c2d6d2d0773f4a4e99faca94e81d410fa67e` | 1280×900 / `9ca518ad54a088a1f189afe27c53c2d6d2d0773f4a4e99faca94e81d410fa67e` | no |
| 10 | menu-pressed | 1280×900 / `e5c5722f67e9730abb3e2310a128de283ea5aa3efb5b9703cf17b33f0e2b7250` | 1280×900 / `f5aa8287be92830692f1ac2cd7301912215dd08f0185c5c9642e7405a7fd5ad5` | yes |
| 11 | mobile-refusal | 375×812 / `880266fa3f6ca1660da3c37b7189adae065fb507a0e60704fe2153cdc0b96b32` | 375×812 / `880266fa3f6ca1660da3c37b7189adae065fb507a0e60704fe2153cdc0b96b32` | no |
| 12 | busy | 1680×1000 / `e7456e1952a73a9ead9140f86d335bb6a0b7672d67b157c8367a8db132f133ca` | 1680×1000 / `78f3edbe01fc43fbcfffa0da35b9c11d546d9527d0e3663b048422490b514377` | yes |
| 13 | web | 1680×1000 / `01d87acc68149d5570003757d118df10d6926a89f660fa9d6d3e422602b5e63f` | 1680×1000 / `664b4eff207d8e84f25138161c62d29f2018a00a624a7a8160ea85848073716f` | yes |
| 14 | kids | 900×640 / `7c5fae57dd20576b943efeccf17518611e9e0b7449560be8e91da70c76bd0790` | 900×640 / `7c5fae57dd20576b943efeccf17518611e9e0b7449560be8e91da70c76bd0790` | no |
| 15 | inspector-idle-light | 1440×1000 / `6371c84c7266f190f725431da1681f8060a7248316f2493cf414ec9593f8ac72` | 1440×1000 / `e84bad504b221fb03d5e5347c01d7ee6d050c9740c894f0851add99be33987bd` | yes |
| 16 | inspector-idle-light-focus | 1440×1000 / `5aafe99ec46f1568ed8c9cb15f76e4c867d1c4449c0d248bab6dd89e1b73eb5a` | 1440×1000 / `5de4270b7f4e7ab4cbf445711bbfc9d8f13f997f358eb3f5985ece4f2092c4f4` | yes |
| 17 | inspector-long-diff-light | 390×844 / `1416cda826e6418a5db51b4b42203108d9bb087cd5cfd36c4deac6b8207d79b6` | 390×1229 / `5c0fc91015fa706bcedd5362b676d5cb41eea2fce800d673a576d5e2fa82292d` | yes |
| 18 | inspector-long-diff-light-focus | 390×844 / `c1d6e990af186ab4cf4f5ede58342338bc2a229210f15c2cb505bf9ea4d64648` | 390×1229 / `bc9c54e88b78b86c9308454155ad11a790c75aca0aefb9ee44c51b1d96a7b280` | yes |
| 19 | inspector-refusal-light | 1103×844 / `4bdd9ea170a236f56173a07613491fcdde779b4bfda8c7d48dd101b5b0c654ae` | 390×1008 / `42169708aab4142fa6379006c145dd4d2eb6bc00d42b1fbd2b68d0bb29e13782` | yes |
| 20 | inspector-refusal-light-focus | 1103×844 / `1d0cacb0e032f3c3fd2161ae9bb1b25deeabdd03e8d3a939e888c4d3b25672b9` | 390×1008 / `c67d999efb080ceb8d5c48711a12c1fb31bdd2d25016315558ef064c20dccb80` | yes |
| 21 | inspector-idle-dark | 1440×1000 / `b24ea318e955c5748ba627c9dc053aaa4b8f7dee26727751e5517296a9eea738` | 1440×1000 / `cbbb13e26d9968794108743467c5ee2d4db9a9d6fcc89ab48ca4b33ea4fa0fb6` | yes |
| 22 | inspector-idle-dark-focus | 1440×1000 / `e0409379bf3fc0a8e056d2debd0ae4e119a4e2b5981dfccf4965c5eb32996ba0` | 1440×1000 / `d26ffa2d949eb3dbbd8022d25b341bc64bd2cb936df2a7793883cbc698c28463` | yes |
| 23 | inspector-long-diff-dark | 390×844 / `b4f99b36af82f75ad3334b27790390695a46b0b205b21473bef8f52c36a9a841` | 390×1229 / `9fe66f3e9deb4fdaf7e74c4663b4c5c4deab26bb8b138d5c08baed93c46d29a3` | yes |
| 24 | inspector-long-diff-dark-focus | 390×844 / `2d66c20a500631f0387743df341d34236ec7365d97c63f53cfc802f709645888` | 390×1229 / `288c3e686da29d29b5ac9159ff2e3aaa2f71fe2411b6556a61dc1ef13a4899d4` | yes |
| 25 | inspector-refusal-dark | 1103×844 / `bd79093c44a8b065df0ac1b4fbef638c7aa0886615313d77a23161f1c8235358` | 390×1008 / `198996b1b0416cc173c0d462fe86c39c89e6e0cdb4f57edad84951a9936aeaf2` | yes |
| 26 | inspector-refusal-dark-focus | 1103×844 / `acd579c1f817fbb32e084b321ecd0abc13dab5ade3d4fbf149256bc8583e828d` | 390×1008 / `fbf11b95f2cf7aaa85bf34b5ecc08486377c247f9c01bf088e867715654d3db6` | yes |
