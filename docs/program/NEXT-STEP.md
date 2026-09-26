# Program next-step brief

**What this document is:** an evidence-based snapshot of where the SceneAxi
program actually stands, and the options that are *available* to consider next.
Every claim below cites a merged PR, an issue, an ADR, or a doc that already owns
the fact. Maintain the Position block against `origin/main` when refreshing this
brief, and record every first-parent merge since its prior pin in the table below.

**What it is not — and this is normative:** this document **authorizes nothing**.
It grants no authority to publish a package, run a proof stage, spend money,
create an account, enable Stripe live mode, open a Kids surface, or deploy
anything. Each of those is a separate authority under
[`bootstrap.md`](../bootstrap.md), and none of them is implied by a passing gate,
a merged PR, or an option listed here. Nothing here re-decides a captain
decision, and nothing here closes an open issue.

Ladder Step 15, [sceneaxi#141](https://github.com/Vhailors/sceneaxi/issues/141).
Product parent: [sceneaxi#1](https://github.com/Vhailors/sceneaxi/issues/1) — on
disagreement, #1 wins.

## Position

| | |
|---|---|
| Branch | `main` |
| SHA | `f42f09aa1bd337191453d8d8b0f46034b412a50b` (`f42f09a`) |
| Head commit | `chore: slim agents md (#306)`, merged 2026-09-26 |
| Repository checks | The required repository gate is recorded at the pinned `main` head; the repository gate remains hermetic: no network, no `DATABASE_URL`, no Stripe key |
| Registry publications | none, ever; no registry credential exists in this repository ([`publish-readiness.md`](../publish-readiness.md)) |
| Proof stages executed | none; Stage 1 remains double-gated ([`spec-41.md`](spec-41.md)) |

The ladder program is `sceneaxi-full-ladder-20260726` (named in
[#131](https://github.com/Vhailors/sceneaxi/issues/131)). Its issue-tracked steps
are 2, 3, 5–11, 14, and 15. Steps 1 and 4 carry no ladder issue and are tracked by
their PRs, as cross-referenced from #131 and
[#133](https://github.com/Vhailors/sceneaxi/issues/133). **The canonical issue
graph contains no Ladder Step 12 or 13**; the numbering gap is recorded here as an
observation, not as missing work to be invented.

## Landed ladder work

All merged into `main`; all reachable from `f42f09a`.

| Step | Issue | PR | Merged |
|---|---|---|---|
| 1 — identity + credit-metered billing planes | epic [#90](https://github.com/Vhailors/sceneaxi/issues/90) | [#129](https://github.com/Vhailors/sceneaxi/pull/129) | 2026-07-25 |
| 2 — sites wired to identity/credits/billing | [#131](https://github.com/Vhailors/sceneaxi/issues/131) | [#145](https://github.com/Vhailors/sceneaxi/pull/145) | 2026-07-26 |
| 3 — entitled Minimum E2 editor on live credits | [#132](https://github.com/Vhailors/sceneaxi/issues/132) | closed against #145 plus the Step 5 entitlement coverage, per the closing comment on #132 — no separate PR |
| 4 — public umbrella live open path (`/open`) | — | [#130](https://github.com/Vhailors/sceneaxi/pull/130) | 2026-07-25 |
| 5 — editor live Three viewport | [#133](https://github.com/Vhailors/sceneaxi/issues/133) | [#147](https://github.com/Vhailors/sceneaxi/pull/147) | 2026-07-26 |
| 6 — real open-path orchestrator (reverses the #60 stub) | [#134](https://github.com/Vhailors/sceneaxi/issues/134) | [#142](https://github.com/Vhailors/sceneaxi/pull/142) | 2026-07-26 |
| 7 — first registered plugin capability load path | [#135](https://github.com/Vhailors/sceneaxi/issues/135) | [#143](https://github.com/Vhailors/sceneaxi/pull/143) | 2026-07-26 |
| 8 — publish-ready library story (no live npm) | [#136](https://github.com/Vhailors/sceneaxi/issues/136) | [#146](https://github.com/Vhailors/sceneaxi/pull/146) | 2026-07-26 |
| 9 — one open-path policy across profiles/CLI/shells | [#137](https://github.com/Vhailors/sceneaxi/issues/137) | [#144](https://github.com/Vhailors/sceneaxi/pull/144) | 2026-07-26 |
| 10 — catalog fixture commerce, dual price, Stripe TEST | [#138](https://github.com/Vhailors/sceneaxi/issues/138) | [#149](https://github.com/Vhailors/sceneaxi/pull/149) | 2026-07-26 |
| 11 — hosted AI credit metering path | [#139](https://github.com/Vhailors/sceneaxi/issues/139) | [#148](https://github.com/Vhailors/sceneaxi/pull/148) | 2026-07-26 |
| 14 — doc/code hygiene pass | [#140](https://github.com/Vhailors/sceneaxi/issues/140) | [#150](https://github.com/Vhailors/sceneaxi/pull/150) | 2026-07-27 |
| 15 — this brief | [#141](https://github.com/Vhailors/sceneaxi/issues/141) | [#151](https://github.com/Vhailors/sceneaxi/pull/151) | 2026-07-27 |

The foundation the ladder was built on, also merged:

| Work | PR | Merged |
|---|---|---|
| Deterministic multi-object scene composition | [#113](https://github.com/Vhailors/sceneaxi/pull/113) | 2026-07-25 |
| Browser-runnable kernel sessions | [#122](https://github.com/Vhailors/sceneaxi/pull/122) | 2026-07-25 |
| Three.js as product presentation core | [#123](https://github.com/Vhailors/sceneaxi/pull/123) | 2026-07-25 |
| Runnable surfaces v1 | [#124](https://github.com/Vhailors/sceneaxi/pull/124) | 2026-07-25 |
| Deployable sites + public engine SDK archive | [#125](https://github.com/Vhailors/sceneaxi/pull/125) | 2026-07-25 |

The position moved materially after the original Step 15 snapshot. Every first-parent
merge between that snapshot and this one is recorded here so this document's pin and its
account of landed work cannot disagree:

| Work | Issue | PR | Merged |
|---|---|---|---|
| Evidence-based Step 15 brief | [#141](https://github.com/Vhailors/sceneaxi/issues/141) | [#151](https://github.com/Vhailors/sceneaxi/pull/151) | 2026-07-27 |
| B1 runtime provenance for admin and checkout evidence | [#126](https://github.com/Vhailors/sceneaxi/issues/126) | [#152](https://github.com/Vhailors/sceneaxi/pull/152) | 2026-07-27 |
| In-app AI assistant composition seam | [#121](https://github.com/Vhailors/sceneaxi/issues/121) | [#153](https://github.com/Vhailors/sceneaxi/pull/153) | 2026-07-27 |
| Assistant resolves the identity port's admin instead of constructing one | [#159](https://github.com/Vhailors/sceneaxi/issues/159) | [#160](https://github.com/Vhailors/sceneaxi/pull/160) | 2026-07-27 |
| Startable authoring inspector | [#120](https://github.com/Vhailors/sceneaxi/issues/120) | [#154](https://github.com/Vhailors/sceneaxi/pull/154) | 2026-07-27 |
| Foundations v2 tokens and Change Review primitive | [#155](https://github.com/Vhailors/sceneaxi/issues/155) | [#161](https://github.com/Vhailors/sceneaxi/pull/161) | 2026-07-27 |
| Responsive umbrella and live marketing hero | [#157](https://github.com/Vhailors/sceneaxi/issues/157) | [#163](https://github.com/Vhailors/sceneaxi/pull/163) | 2026-07-28 |
| Engine Desktop visual surface | [#158](https://github.com/Vhailors/sceneaxi/issues/158) | [#164](https://github.com/Vhailors/sceneaxi/pull/164) | 2026-07-28 |
| Asset Storefronts on Foundations v2 | [#156](https://github.com/Vhailors/sceneaxi/issues/156) | [#166](https://github.com/Vhailors/sceneaxi/pull/166) | 2026-07-28 |
| B2 exact Checkout Session binding and evidence-built money bookkeeping | [#127](https://github.com/Vhailors/sceneaxi/issues/127) | [#167](https://github.com/Vhailors/sceneaxi/pull/167) | 2026-07-28 |
| B3 credit commit boundary plus captain decisions D4/D5 | [#128](https://github.com/Vhailors/sceneaxi/issues/128) | [#168](https://github.com/Vhailors/sceneaxi/pull/168) | 2026-07-29 |
| Shared site-kit component collapse | [#162](https://github.com/Vhailors/sceneaxi/issues/162) | [#169](https://github.com/Vhailors/sceneaxi/pull/169) | 2026-07-29 |

### Merged after the pinned SHA

The Position block above pins `origin/main` at `f42f09a`. Every first-parent merge
between the prior pin `203eb53` and this snapshot is recorded here. These changes are
reachable from the current pin; sections below that cite a merge describe work landed on
`main`, not necessarily work included in the prior snapshot:

| Work | Issue | PR | Merged |
|---|---|---|---|
| refresh next-step brief against current main | — | [#170](https://github.com/Vhailors/sceneaxi/pull/170) | 2026-07-29 |
| route umbrella /profiles through shared profile contracts | — | [#171](https://github.com/Vhailors/sceneaxi/pull/171) | 2026-07-29 |
| enforce checkout intent price immutability | — | [#172](https://github.com/Vhailors/sceneaxi/pull/172) | 2026-07-30 |
| archive and version the credit-pack catalog | — | [#173](https://github.com/Vhailors/sceneaxi/pull/173) | 2026-07-30 |
| require identity-port-witnessed principals at every guard | — | [#174](https://github.com/Vhailors/sceneaxi/pull/174) | 2026-07-30 |
| define the deployment-owned issuance authority contract | — | [#175](https://github.com/Vhailors/sceneaxi/pull/175) | 2026-07-30 |
| serve the assistant panel over the loopback surface | — | [#178](https://github.com/Vhailors/sceneaxi/pull/178) | 2026-07-31 |
| anchor checkout credit grants to the committed pack archive | — | [#179](https://github.com/Vhailors/sceneaxi/pull/179) | 2026-07-31 |
| wire Neon-backed auth and credits TEST provider plane | — | [#186](https://github.com/Vhailors/sceneaxi/pull/186) | 2026-07-31 |
| ship the packaged Linux desktop application over the real engine stack | — | [#188](https://github.com/Vhailors/sceneaxi/pull/188) | 2026-07-31 |
| design-faithful Engine Desktop editor shell over the live engine | — | [#189](https://github.com/Vhailors/sceneaxi/pull/189) | 2026-07-31 |
| hosted login path from the umbrella into the entitled editor | — | [#187](https://github.com/Vhailors/sceneaxi/pull/187) | 2026-08-01 |
| reconcile TEST deployment readiness | — | [#190](https://github.com/Vhailors/sceneaxi/pull/190) | 2026-08-01 |
| bind umbrella deployment authority behind a request facade | — | [#191](https://github.com/Vhailors/sceneaxi/pull/191) | 2026-08-02 |
| ship verified Linux desktop download on /engine | — | [#205](https://github.com/Vhailors/sceneaxi/pull/205) | 2026-08-05 |
| ship the first-release landing with detected download and profile matrix | — | [#206](https://github.com/Vhailors/sceneaxi/pull/206) | 2026-08-05 |
| add fail-closed Windows packaging path | — | [#207](https://github.com/Vhailors/sceneaxi/pull/207) | 2026-08-05 |
| add fail-closed macOS packaging path | — | [#208](https://github.com/Vhailors/sceneaxi/pull/208) | 2026-08-05 |
| ship the simplified Web Experience editor on the entitled umbrella /editor | — | [#209](https://github.com/Vhailors/sceneaxi/pull/209) | 2026-08-05 |
| land assistant sculpt output in the live desktop viewport | — | [#210](https://github.com/Vhailors/sceneaxi/pull/210) | 2026-08-05 |
| unify the Engine Desktop project loop with real open, save, and play | — | [#211](https://github.com/Vhailors/sceneaxi/pull/211) | 2026-08-05 |
| attach the CLI to a versioned Engine Desktop local bridge | — | [#212](https://github.com/Vhailors/sceneaxi/pull/212) | 2026-08-05 |
| ship fixture-backed catalog storefronts for Game and Web | — | [#213](https://github.com/Vhailors/sceneaxi/pull/213) | 2026-08-06 |
| reconcile full credit-pack refunds and gate TEST checkout UX | — | [#214](https://github.com/Vhailors/sceneaxi/pull/214) | 2026-08-06 |
| add TEST-only Stripe Connect creator onboarding and payouts | — | [#215](https://github.com/Vhailors/sceneaxi/pull/215) | 2026-08-06 |
| ship the simplified Kids activity surface on an isolated origin | — | [#216](https://github.com/Vhailors/sceneaxi/pull/216) | 2026-08-06 |
| add production activation runbook and required-check recovery contract | — | [#217](https://github.com/Vhailors/sceneaxi/pull/217) | 2026-08-07 |
| connect the entitled Web editor to TEST-only catalog intake | — | [#219](https://github.com/Vhailors/sceneaxi/pull/219) | 2026-08-07 |
| add BYOK key configuration backed by OS secure storage | — | [#221](https://github.com/Vhailors/sceneaxi/pull/221) | 2026-08-07 |
| add production-capable Better Auth provider behind the identity seam | — | [#223](https://github.com/Vhailors/sceneaxi/pull/223) | 2026-08-07 |
| add contained New, Open, and Recent project lifecycle | — | [#228](https://github.com/Vhailors/sceneaxi/pull/228) | 2026-08-07 |
| add typed scene property editing | — | [#229](https://github.com/Vhailors/sceneaxi/pull/229) | 2026-08-07 |
| make Vercel serverless function packages symlink-safe | — | [#230](https://github.com/Vhailors/sceneaxi/pull/230) | 2026-08-07 |
| wire real File/Edit/Run commands, palette rows, and accelerators | — | [#231](https://github.com/Vhailors/sceneaxi/pull/231) | 2026-08-08 |
| render active proposals in Change Review | — | [#232](https://github.com/Vhailors/sceneaxi/pull/232) | 2026-08-08 |
| wire the privileged OpenRouter provider host | — | [#238](https://github.com/Vhailors/sceneaxi/pull/238) | 2026-08-09 |
| add deterministic rarity domain and kernel roll contract | — | [#242](https://github.com/Vhailors/sceneaxi/pull/242) | 2026-08-09 |
| integrate Wayfinder rarity authoring | — | [#243](https://github.com/Vhailors/sceneaxi/pull/243) | 2026-08-10 |
| replace dead controls with honest refusals | — | [#244](https://github.com/Vhailors/sceneaxi/pull/244) | 2026-08-10 |
| expand selected-instance scene editing | — | [#245](https://github.com/Vhailors/sceneaxi/pull/245) | 2026-08-10 |
| add contained GLB/glTF asset ingestion | — | [#246](https://github.com/Vhailors/sceneaxi/pull/246) | 2026-08-10 |
| add deterministic static Web export | — | [#247](https://github.com/Vhailors/sceneaxi/pull/247) | 2026-08-11 |
| add contained project and asset browser | — | [#248](https://github.com/Vhailors/sceneaxi/pull/248) | 2026-08-11 |
| inventory full editor v1 | — | [#271](https://github.com/Vhailors/sceneaxi/pull/271) | 2026-08-12 |
| register full editor command slice | — | [#272](https://github.com/Vhailors/sceneaxi/pull/272) | 2026-08-12 |
| add versioned native project model | — | [#273](https://github.com/Vhailors/sceneaxi/pull/273) | 2026-08-12 |
| add transactional command redo | — | [#275](https://github.com/Vhailors/sceneaxi/pull/275) | 2026-08-12 |
| add hierarchy, multi-select, and parenting | — | [#279](https://github.com/Vhailors/sceneaxi/pull/279) | 2026-08-12 |
| refresh Linux beta artifact evidence | — | [#280](https://github.com/Vhailors/sceneaxi/pull/280) | 2026-08-12 |
| add contained project Git workflow | — | [#282](https://github.com/Vhailors/sceneaxi/pull/282) | 2026-08-13 |
| add transform gizmos, snapping, and inspector | — | [#284](https://github.com/Vhailors/sceneaxi/pull/284) | 2026-08-13 |
| add first-class asset pipeline | — | [#283](https://github.com/Vhailors/sceneaxi/pull/283) | 2026-08-13 |
| add unified input actions | — | [#285](https://github.com/Vhailors/sceneaxi/pull/285) | 2026-08-13 |
| add reusable scene content and overrides | — | [#286](https://github.com/Vhailors/sceneaxi/pull/286) | 2026-08-13 |
| add isolated Play mode and viewport sources | — | [#287](https://github.com/Vhailors/sceneaxi/pull/287) | 2026-08-13 |
| add animation authoring and deterministic replay | — | [#288](https://github.com/Vhailors/sceneaxi/pull/288) | 2026-08-13 |
| add physics authoring and deterministic replay | — | [#289](https://github.com/Vhailors/sceneaxi/pull/289) | 2026-08-13 |
| add assistant inspect, propose, approve, apply | — | [#290](https://github.com/Vhailors/sceneaxi/pull/290) | 2026-08-13 |
| add package manager and plugin room lock | — | [#291](https://github.com/Vhailors/sceneaxi/pull/291) | 2026-08-13 |
| add Play-backed profiling evidence | — | [#292](https://github.com/Vhailors/sceneaxi/pull/292) | 2026-08-13 |
| add persistent dockable workspace layouts | — | [#293](https://github.com/Vhailors/sceneaxi/pull/293) | 2026-08-13 |
| add honest advanced extension seams | — | [#294](https://github.com/Vhailors/sceneaxi/pull/294) | 2026-08-13 |
| add fail-closed macos/windows project build targets | — | [#295](https://github.com/Vhailors/sceneaxi/pull/295) | 2026-08-13 |
| add capability-matrix evidence audit | — | [#296](https://github.com/Vhailors/sceneaxi/pull/296) | 2026-08-13 |
| add provider-desktop chain evidence and module coverage | — | [#297](https://github.com/Vhailors/sceneaxi/pull/297) | 2026-08-13 |
| place assistant Builds into the scene and wire DeepSeek BYOK | — | [#298](https://github.com/Vhailors/sceneaxi/pull/298) | 2026-08-14 |
| request gnome-libsecret so Linux BYOK can save keys | — | [#299](https://github.com/Vhailors/sceneaxi/pull/299) | 2026-08-14 |
| persist assistant Builds into the scene and pin Flash | — | [#300](https://github.com/Vhailors/sceneaxi/pull/300) | 2026-08-14 |
| Cinematic Pro desktop, Flash assistant, and Engine/Website/Kids split | — | [#301](https://github.com/Vhailors/sceneaxi/pull/301) | 2026-08-14 |
| complete SceneAxi initiation traceability | — | [#302](https://github.com/Vhailors/sceneaxi/pull/302) | 2026-08-26 |
| run contract regressions and omitted goldens | — | [#303](https://github.com/Vhailors/sceneaxi/pull/303) | 2026-09-23 |
| Merge pull request #304 from Vhailors/bb/verify-skill-sceneaxi-thr_68nhy34kir | — | [#304](https://github.com/Vhailors/sceneaxi/pull/304) | 2026-09-25 |
| Merge pull request #305 from Vhailors/bb/ab-scene-on-thr_mt7iid8u28 | — | [#305](https://github.com/Vhailors/sceneaxi/pull/305) | 2026-09-25 |
| Merge pull request #306 from Vhailors/chore/slim-agents-md | — | [#306](https://github.com/Vhailors/sceneaxi/pull/306) | 2026-09-26 |

Surface-by-surface runnable levels and their proofs are owned by
[`runnable-surfaces.md`](../runnable-surfaces.md); how far each profile's open
path may be *demonstrated* is owned by
[`open-path-policy.md`](../open-path-policy.md). Neither is a shipping claim —
`shippingClaim` is structurally `false`.

## Visual gate outcome

The captain-accepted `SceneAxi Design System.zip` is visual authority, but the archive
itself remains outside this repository; its digest and implemented members are recorded
in [`design-foundations.md`](../design-foundations.md), the site READMEs, and
[`engine-desktop-surface.md`](../engine-desktop-surface.md). Node gates cannot produce
browser evidence: WebGL does not run in node, so `pnpm gate` exercises the deterministic
headless surface, which reports `pixelsDrawn: false` and captures nothing. A frame counter
is deliberately never allowed to imply pixels
([ADR 0017](../adr/0017-three-product-presentation-core.md)).

The pixel claim therefore rests on the existing evidence record, not on a gate
inference: [`three-presentation-core.md` § "What is verified
where"](../three-presentation-core.md#what-is-verified-where). That record holds
manual Chrome observations at several levels. The standalone snippets were
verified on 2026-07-25 against a committed fixture artifact served through Vite,
with a frame report and a `capture()` PNG byte count. The two shipped surfaces
were verified against the production build (`next build && next start`) — `/open`
on 2026-07-25, and `/editor` plus a re-verification of `/open` on 2026-07-26 —
and those two each carry the frame report, `toDataURL` byte counts,
distinct-colour and non-background pixel counts, and the byte-identical **Reset
view** capture. The responsive umbrella's marketing hero was separately verified in
Chrome on 2026-07-28; its record is owned by
[`sites/umbrella/VISUAL-EVIDENCE.md`](../../sites/umbrella/VISUAL-EVIDENCE.md). Read
those owners for the figures; they are not duplicated here.

Two facts from it are load-bearing for anything downstream: with the editor
preview flag unset the same build serves **no canvas at all** and refuses
`IDENTITY_PLANE_NOT_WIRED`, and the shared viewport boundary left `/open`
unmoved. The corresponding node-gate coverage is
`tests/e2e/umbrella-live-open-golden.test.ts` and
`tests/e2e/umbrella-editor-viewport-golden.test.ts`, both headless and both
making no pixel claim.

The rest of the visual work is likewise an implementation record, not new product
authority: Foundations v2 and Change Review landed in
[PR #161](https://github.com/Vhailors/sceneaxi/pull/161), the umbrella in
[#163](https://github.com/Vhailors/sceneaxi/pull/163), Engine Desktop in
[#164](https://github.com/Vhailors/sceneaxi/pull/164), both storefronts in
[#166](https://github.com/Vhailors/sceneaxi/pull/166), and their framework-free shared
component models in [#169](https://github.com/Vhailors/sceneaxi/pull/169). The owning
docs above record what each surface implements and where it deliberately differs from the
archive.

## Landed review follow-ups and recorded next steps

### Auth-credits siblings B1–B3

All three siblings deferred from the auth-credits v1 review gate are now closed under
epic [#90](https://github.com/Vhailors/sceneaxi/issues/90). Their present limits matter as
much as what landed:

| Issue | Landed state on `203eb53` | Limit that remains |
|---|---|---|
| [B1 — #126](https://github.com/Vhailors/sceneaxi/issues/126), [PR #152](https://github.com/Vhailors/sceneaxi/pull/152) | Runtime object-identity witnesses now protect `AdminIdentity`, `VerifiedWebhook`, and `VerifiedCheckoutCompletion`; structural copies and hand-built look-alikes refuse before their contents are trusted | This did **not** witness every `Principal`; that separate captain decision is D1 below |
| [B2 — #127](https://github.com/Vhailors/sceneaxi/issues/127), [PR #167](https://github.com/Vhailors/sceneaxi/pull/167) | Settlement is bound to the exact Checkout Session id, and `recordMoneySale()` derives its facts from witnessed completion evidence plus the persisted intent | `MoneySplitRecord` is still bookkeeping-only and unpersisted; there is no Connect payout path |
| [B3 — #128](https://github.com/Vhailors/sceneaxi/issues/128), [PR #168](https://github.com/Vhailors/sceneaxi/pull/168) | `createCreditStore()` is the shared persistence boundary; credits sales settle atomically, `meterCredits()` commits through append-or-replay, and `persistCheckoutCompletedGrant()` reports success only after commit. Under D4, the umbrella webhook uses that same grant boundary | Provider-backed adapters remain deployment-owned under [ADR 0021](../adr/0021-identity-credits-injected-adapters.md); this repository still ships only the in-memory reference adapter, and money-split persistence was not added |

The pure `applyCheckoutCompletedGrant()` still decides without committing; that is why the
supported webhook flow ends at `persistCheckoutCompletedGrant()`. `meterCredits()` is no
longer a returned-state-only operation either: it loads persistence, commits, and reports a
replay when the same debit already landed. The detailed contracts are owned by
[`auth-credits.md`](../auth-credits.md#the-credit-persistence-boundary-sceneaxi128).

The historical #128 body contains a dead inline link to
`docs/adr/0016-identity-credits-injected-adapters.md`. The injected-adapters decision is
[ADR 0021](../adr/0021-identity-credits-injected-adapters.md); ADR 0016 is the portable
kernel digest and [ADR 0017](../adr/0017-three-product-presentation-core.md) is the Three
presentation core.

### Captain authority decisions D1–D5

Five authority choices are decided. Each disposition is recorded in its own **out-of-tree**
FirstMate operational record, all headed *recorded 2026-07-28*:

- `data/sceneaxi-authority-decision-d1-principal-provenance.md`
- `data/sceneaxi-authority-decision-d2-intent-credit-anchor.md`
- `data/sceneaxi-authority-decision-d3-intent-ddl-immutability.md`
- `data/sceneaxi-authority-decision-d4-commit-boundary-sequencing.md`
- `data/sceneaxi-authority-decision-d5-live-mode-authorization-source.md`

The earlier record `data/sceneaxi-issuance-authority-scout/report.md` of **2026-07-28**
(written against `origin/main` at `569a12c`) is the **prior investigation** that framed
these five then-open questions. It decided none of them and says so, so it is not a
decision source — cite the five decision records for any disposition. The captain also
departed from it on D5: the scout argued against configuration and recommended a
code-literal-only rule, while the captain instead chose the named
`SCENEAXI_STRIPE_LIVE_AUTHORIZED` configuration value with an evidence mitigation.

The table below records disposition and sequencing only; **it is not an implementation
authority**. All five now have landed implementation work: D1 in PR #174, D2 here, D3's
migration in PR #172, and D4/D5 in PR #168. Only #168 is reachable from the SHA pinned in
Position; #172 and #174 merged after it, as recorded in [Merged after the pinned
SHA](#merged-after-the-pinned-sha). D3 is the one still carrying an unfinished
prerequisite, and it is out-of-tree — see its row.

Note the difference in where these decisions are *owned*. Each landed implementation
brought its in-tree owner with it: [`auth-credits.md`](../auth-credits.md) owns D1's
principal provenance, D2's grant-time anchor, and D4 and D5, with
[`packages/auth/README.md`](../../packages/auth/README.md) beside it for D1 and
[`websites-deploy.md`](../websites-deploy.md) for D4's webhook path; D3's migration is
owned by `db/migrations` and asserted by `tests/db/schema-lockstep.test.ts`. This brief
owns none of them, and the disposition column below remains a restatement of the external
records rather than a fact this repository holds.

| Decision | Recorded disposition | Status / binding prerequisite |
|---|---|---|
| **D1 — `principal-provenance`** | Witness every `Principal` the identity port issues; guards accept only values actually issued by `createIdentityPort`, with a test-only issuance seam | **Landed in [PR #174](https://github.com/Vhailors/sceneaxi/pull/174).** `packages/auth/src/principal-provenance.ts` witnesses every issued `Principal`, the guards in `roles.ts` refuse an unwitnessed one and return the exact witnessed object, and the test-only seam is `@sceneaxi/auth/testing/principal-issuance`. Provenance deliberately does not survive serialization, so the umbrella re-verifies its carried session per request |
| **D2 — `intent-credit-anchor`** | At grant time, cross-check persisted intent credits against the committed pack catalog by `(itemId, stripePriceId, unitAmount)` | **Implemented in #177.** `applyCheckoutCompletedGrant` resolves the archived tuple before append/commit, refuses unknown or mismatched credit amounts, and grants retained revision credits; D3 remains separate |
| **D3 — `intent-ddl-immutability`** | Add a forward-only trigger protecting only `credits`, `unit_amount`, `currency`, and `stripe_price_id`; operational columns stay writable | **Migration landed in [PR #172](https://github.com/Vhailors/sceneaxi/pull/172).** `db/migrations/0003_checkout_session_intent_price_immutability.sql` refuses an `UPDATE` to exactly those four columns; `tests/db/schema-lockstep.test.ts` asserts the field scope. Not discharged: the deployment's own writes are still unaudited — the repository cannot see them — and executing the migration needs its separate deploy authority |
| **D4 — `commit-boundary-sequencing`** | Move the umbrella webhook onto `persistCheckoutCompletedGrant()` in the same ship as #128, preserving one credit-grant commit boundary | **Landed in [PR #168](https://github.com/Vhailors/sceneaxi/pull/168).** Atomic persistence for `MoneySplitRecord` was not selected and remained an unauthorized gap before any Connect work; the captain **superseded** that prohibition for the accepted SA-CON-1 package ([#199](https://github.com/Vhailors/sceneaxi/issues/199)) at exactly one width — `ConnectStore.commitPayoutIntent` atomically appends one validated split with the creator-leg payout intent bound to it, from the authenticated TEST-only Connect seam. No general money-settlement store was authorized, and [`auth-credits.md`](../auth-credits.md) owns that boundary |
| **D5 — `live-mode-authorization-source`** | Permit one named configuration value, `SCENEAXI_STRIPE_LIVE_AUTHORIZED`, with an auditable affirmative; no alias, mode, price, adapter, or production-correlated value may imply authorization | **Landed in [PR #168](https://github.com/Vhailors/sceneaxi/pull/168).** Absent or malformed still refuses `STRIPE_LIVE_MODE_NOT_AUTHORIZED` at intent creation and grant. No shipped call site activates live mode; ADR 0021's separate go-live hold remains |

### Open trackers

- [#114](https://github.com/Vhailors/sceneaxi/issues/114) — the runnable-surfaces
  epic; its issue graph owns the remaining closure dependencies. Its former #120 and
  #121 gaps are closed by PRs #154 and #153 respectively; the precise runnable levels
  remain owned by [`runnable-surfaces.md`](../runnable-surfaces.md).
- [#1](https://github.com/Vhailors/sceneaxi/issues/1) — the canonical product
  spec, a standing issue rather than a work item.

One tracker this brief previously listed as open has since closed:
[#165](https://github.com/Vhailors/sceneaxi/issues/165) — move the `/profiles` contract
mirror onto the shared site-kit layer — landed in
[PR #171](https://github.com/Vhailors/sceneaxi/pull/171) on 2026-07-29, after the SHA
pinned in Position. Its recorded blocker had been `packages/site-kit` being deliberately
held read-only while three concurrent visual lanes ran so their PRs stayed independently
mergeable; that hold ended when [#163](https://github.com/Vhailors/sceneaxi/pull/163),
[#164](https://github.com/Vhailors/sceneaxi/pull/164), and
[#166](https://github.com/Vhailors/sceneaxi/pull/166) landed, and
[#162](https://github.com/Vhailors/sceneaxi/issues/162) — which #165 records as *distinct*
work that merely touches the same package — landed in
[PR #169](https://github.com/Vhailors/sceneaxi/pull/169), removing the concurrent-mutation
conflict as well.

### Production deployment evidence and limits

[`websites-deploy.md`](../websites-deploy.md) lists three deployed production URLs — the
umbrella, the game-asset catalog, and the website-asset catalog (`sceneaxi-catalog-web`).
The deployment wave recorded below covered only the first two, per captain scope; the
website-asset catalog was outside this wave and so is outside the evidence table, and Kids
is not deployed at all and is refuse-only by contract. The website-asset catalog was
nonetheless separately verified reachable on 2026-07-29, returning `200` and serving real
SceneAxi Vitrine content at <https://sceneaxi-catalog-web.vercel.app>.

The reachability statements here are **dated external observations, not gate-produced
facts**: the two in-scope URLs were opened in Chrome on 2026-07-29 and served the
surfaces described. [`websites-deploy.md`](../websites-deploy.md#verified-test-readiness)
owns the newer 2026-08-01 readiness result and its exact external activation blocker.
[`production-activation.md`](../production-activation.md) owns the operator authorization,
ordered execution/rollback, refusal, and evidence checklist; it authorizes no action.

| Surface | Production URL | Honest limit |
|---|---|---|
| Umbrella | <https://sceneaxi-umbrella.vercel.app> | Public/product routes and the live hero were served in the dated observation above. The site-tier adapters construct the Better Auth/Neon/Stripe TEST handles when configured, provision one credit account per authenticated user, and keep account/balance/checkout/grant paths fail-closed when provider configuration is missing or unusable. The [sceneaxi#185](https://github.com/Vhailors/sceneaxi/issues/185) HTTP/UI layer and [sceneaxi#222](https://github.com/Vhailors/sceneaxi/issues/222) Better Auth provider are in tree; this is implementation status, not deployment evidence. Current deployment readiness and its blocker are owned by [`websites-deploy.md`](../websites-deploy.md#verified-test-readiness) |
| Game-asset catalog | <https://sceneaxi-catalog-game.vercel.app> | Browse/detail is served as an evaluation-only catalog. Buying remains inactive; the storefront collects no payment details |

[`websites-deploy.md`](../websites-deploy.md) owns the topology, environment names,
web wiring mechanics, and exact refusal table. In particular, the umbrella Stripe endpoint
and provider-backed store/evidence handles now share the deployment adapter path; missing
configuration still refuses rather than claiming a grant.

### Known automated-coverage gap

No automated repository step runs `next build` for `sites/umbrella`,
`sites/catalog-game`, or `sites/catalog-web`. Root `pnpm build` is the TypeScript project
build, `check:sites` validates site structure and manifests, and the three GitHub
workflows run `pnpm gate`, the engine-SDK builder, and the Linux desktop packaging +
packaged smoke (`desktop-linux`, ADR 0024) — none of which is a site's Next build. Consequently the gate can be green while a
site's production Next build is broken. This is a recorded verification gap only: this
brief neither changes the gate nor authorizes work to close it.

### Captain-held items with no issue

- **Licence** — `UNLICENSED` may be replaced only after the licence captain
  decision (open tier-5 hold, [`bootstrap.md`](../bootstrap.md)). The engine SDK
  archive is source-available for evaluation, not open-source.
- **Tier-6b marketplace activation** — still an open captain decision, so
  catalog purchase and publish refuse `CATALOG_COMMERCE_INERT` on every
  storefront listing, the Step 10 fixture SKU included
  ([`websites-deploy.md`](../websites-deploy.md)). Step 10 opened exactly one
  fixture SKU by closed enumeration in `packages/billing`, which no storefront
  imports; being listed is not being for sale.
- **Stage 1 renderer adjudication** — held. [ADR
  0017](../adr/0017-three-product-presentation-core.md) is a captain *product*
  decision and is explicitly not a Stage 1 result or a renderer winner.

## Options — none of these is authorized here

Listed so the next decision is made with the evidence in view. Each requires its
own separate authority before any action; reading this section grants none.

| Option | What it would take | What it must not be confused with |
|---|---|---|
| **Live npm publication** | A captain publish decision plus authority 11 in [`bootstrap.md`](../bootstrap.md), then the coordinated version change described in [`publish-readiness.md`](../publish-readiness.md): the plan value in `scripts/check-publish-ready.mjs`, every manifest version, and each profile's `sceneaxi.corePin` together | Publish *readiness* is already proven structurally on disk and is not a publish authorization. `0.0.0` everywhere is the honest statement that nothing is released |
| **Stage 6 — editor-need proof on E1/E2** | The double gate: recorded tier-3 captain decisions **and** a separate explicit run authorization ([`spec-41.md`](spec-41.md), authority 9). Stages are separately authorized with budget caps and kill criteria; the default cash budget is $0 | The shipped Minimum E2 editor is the bounded [ADR 0003](../adr/0003-editor-sequencing-e1-first-e2-specified.md) vertical exception, not general E2 and not Stage 6 evidence. General E2 remains specified-not-built |
| **Stripe LIVE mode** | D5's one permitted source is `SCENEAXI_STRIPE_LIVE_AUTHORIZED`, resolved to runtime-witnessed audit evidence. Unset, malformed, aliased, or merely correlated configuration still refuses `STRIPE_LIVE_MODE_NOT_AUTHORIZED` at both intent creation and grant. Activation additionally needs ADR 0021's separate captain go-live decision and authority 10 (spend/accounts) | Landing the mechanism in PR #168 did **not** activate it: no shipped call site passes the result. Test mode is structural on fixture commerce, and the SA-CON-1 Connect seam is TEST-only: a LIVE provider or LIVE money split refuses `STRIPE_CONNECT_LIVE_UNAVAILABLE`, so no real payout exists. Money splits stay bookkeeping-only except at D4's one superseded width above |
| **Kids work, later** | An explicit Kids safety decision. Kids is refuse-only (R0) by contract: nothing may depend on `@sceneaxi/profile-kids`, Kids identity and Kids commerce are refused by name on every path that can reach them, and Kids is not deployed | A passing gate is not Kids safety. This brief proposes no Kids surface and no timing |

## Explicit OUTs

Out of scope for this document, and not changed by it:

- Implementation changes of any kind; this documentation refresh closes no issue.
- Any captain decision — settled ones stand, open ones stay open.
- Live npm publication; Stage 1 or Stage 6 proof execution; Stripe LIVE; LIVE
  Connect onboarding and payout activation; Kids launch; deployment changes;
  account creation; spend.
- Aspirational framing. No engine readiness, production game-shipping readiness,
  commercial validation, Kids safety, marketplace readiness, renderer winner, or
  Stage 1 adjudication is claimed anywhere above. Evidence never rounds up.
- Duplicating mutable implementation detail. Where this brief and an owning doc,
  ADR, issue, or PR disagree, **the owner wins** and this file is the thing to
  fix.

## Maintaining this file

Rewrite it when the program position materially moves — a ladder step lands, a
deferred follow-up closes, or a held decision resolves. Keep it a set of pointers
with dates and SHAs; the moment it starts restating what an ADR or a doc already
owns, it has become a second source of truth and drifts.
