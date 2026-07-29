# Program next-step brief

**What this document is:** an evidence-based snapshot of where the SceneAxi
program actually stands, and the options that are *available* to consider next.
Every claim below cites a merged PR, an issue, an ADR, or a doc that already owns
the fact.

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
| SHA | `203eb53c3fa2501bfbc620668e90dba6e03d1a0b` (`203eb53`) |
| Head commit | `refactor(site-kit): collapse duplicated site components onto shared seams (#169)`, merged 2026-07-29 |
| Repository checks | `gate` and `engine-sdk` green on the merged [PR #169](https://github.com/Vhailors/sceneaxi/pull/169) head; the repository gate remains hermetic: no network, no `DATABASE_URL`, no Stripe key |
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

All merged into `main`; all reachable from `203eb53`.

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

The five choices raised by the FirstMate evidence record
`data/sceneaxi-issuance-authority-scout/report.md` are decided. This table records their
disposition and sequencing only; **it is not an implementation authority**. D1–D3 remain
unimplemented and unauthorized.

Note the difference in where these decisions are *owned*. D4 and D5 landed with their
implementation, so each is now owned by an in-tree document —
[`auth-credits.md`](../auth-credits.md) for both, plus
[`websites-deploy.md`](../websites-deploy.md) for D4's webhook path. D1–D3 are recorded
**only** in the dated FirstMate operational record above, which lives outside this
repository; no in-tree document owns them yet, and this brief does not become their owner.
Their in-tree owner lands with their implementation. Until then they are decided and
unimplemented, and the disposition text below is a restatement of that external record
rather than a fact this repository holds.

| Decision | Recorded disposition | Status / binding prerequisite |
|---|---|---|
| **D1 — `principal-provenance`** | Witness every `Principal` the identity port issues; guards accept only values actually issued by `createIdentityPort`, with a test-only issuance seam | **Decided, unimplemented.** First confirm the deployment re-verifies each request instead of rehydrating a cached principal; then ship the test seam before flipping guards |
| **D2 — `intent-credit-anchor`** | At grant time, cross-check persisted intent credits against the committed pack catalog by `(itemId, stripePriceId, unitAmount)` | **Decided, unimplemented.** An archived/versioned pack catalog (or the recorded `intent.createdAt` grace window) is a binding prerequisite, or a reprice can leave a paid in-flight checkout permanently ungranted |
| **D3 — `intent-ddl-immutability`** | Add a forward-only trigger protecting only `credits`, `unit_amount`, `currency`, and `stripe_price_id`; operational columns stay writable | **Decided, unimplemented.** Audit the deployment's own writes first; the repository cannot see them. Migration execution also needs its separate deploy authority |
| **D4 — `commit-boundary-sequencing`** | Move the umbrella webhook onto `persistCheckoutCompletedGrant()` in the same ship as #128, preserving one credit-grant commit boundary | **Landed in [PR #168](https://github.com/Vhailors/sceneaxi/pull/168).** Atomic persistence for `MoneySplitRecord` was not selected and remains an unauthorized gap before any Connect work |
| **D5 — `live-mode-authorization-source`** | Permit one named configuration value, `SCENEAXI_STRIPE_LIVE_AUTHORIZED`, with an auditable affirmative; no alias, mode, price, adapter, or production-correlated value may imply authorization | **Landed in [PR #168](https://github.com/Vhailors/sceneaxi/pull/168).** Absent or malformed still refuses `STRIPE_LIVE_MODE_NOT_AUTHORIZED` at intent creation and grant. No shipped call site activates live mode; ADR 0021's separate go-live hold remains |

### Open trackers

- [#165](https://github.com/Vhailors/sceneaxi/issues/165) — move the `/profiles`
  contract mirror onto the shared site-kit layer. It is now unblocked, for two
  separate reasons. Its own blocker, as [#165](https://github.com/Vhailors/sceneaxi/issues/165)
  states it, was that `packages/site-kit` was deliberately held read-only while three
  concurrent visual lanes ran so their PRs stayed independently mergeable; that hold ended
  when [#163](https://github.com/Vhailors/sceneaxi/pull/163),
  [#164](https://github.com/Vhailors/sceneaxi/pull/164), and
  [#166](https://github.com/Vhailors/sceneaxi/pull/166) landed. Separately,
  [#162](https://github.com/Vhailors/sceneaxi/issues/162) — which #165 records as
  *distinct* work that merely touches the same package — has since landed in
  [PR #169](https://github.com/Vhailors/sceneaxi/pull/169), removing the
  concurrent-mutation conflict as well. Unblocked is not authorized: #165 remains
  **unauthorized**, and this brief does not start it.
- [#114](https://github.com/Vhailors/sceneaxi/issues/114) — the runnable-surfaces
  epic; its issue graph owns the remaining closure dependencies. Its former #120 and
  #121 gaps are closed by PRs #154 and #153 respectively; the precise runnable levels
  remain owned by [`runnable-surfaces.md`](../runnable-surfaces.md).
- [#1](https://github.com/Vhailors/sceneaxi/issues/1) — the canonical product
  spec, a standing issue rather than a work item.

### Production deployment evidence and limits

[`websites-deploy.md`](../websites-deploy.md) names three planned production sites, but the
captain-scoped deployment wave covered only two of them — the umbrella and the game-asset
catalog — deliberately excluding the website-asset catalog (`sceneaxi-catalog-web`) and
Kids. The website-asset catalog was therefore neither deployed nor checked; its absence
below is scope, not a failed or skipped check, and Kids is refuse-only by contract.

The reachability statement that follows is a **dated external observation, not an in-tree
fact**: the two deployed URLs were opened in Chrome on 2026-07-29 and served the surfaces
described. No in-tree document owns that observation, and no gate produces it.

| Surface | Production URL | Honest limit |
|---|---|---|
| Umbrella | <https://sceneaxi-umbrella.vercel.app> | Public/product routes and the live hero are served. Admin sign-in is deferred because `SCENEAXI_ADMIN_BOOTSTRAP_SECRET` is not provisioned. The provider handles for Better Auth, Neon credits, and the Stripe API are still absent, so account, balance, checkout, and credit-grant paths refuse by name rather than inventing state or granting credits |
| Game-asset catalog | <https://sceneaxi-catalog-game.vercel.app> | Browse/detail is served as an evaluation-only catalog. Buying remains inactive; the storefront collects no payment details |

[`websites-deploy.md`](../websites-deploy.md) owns the topology, environment names,
activation sequence, and exact refusal table. In particular, the umbrella Stripe endpoint
exists but the credits provider plane is unwired: without the provider-backed store and
evidence handles it refuses rather than claiming a grant.

### Known automated-coverage gap

No automated repository step runs `next build` for `sites/umbrella`,
`sites/catalog-game`, or `sites/catalog-web`. Root `pnpm build` is the TypeScript project
build, `check:sites` validates site structure and manifests, and the two GitHub workflows
run `pnpm gate` and the engine-SDK builder. Consequently the gate can be green while a
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
- **Three absent captain-held secrets** — `STRIPE_SECRET_KEY` (test),
  `STRIPE_WEBHOOK_SECRET`, `SCENEAXI_ADMIN_BOOTSTRAP_SECRET`. None blocks
  anything shipped: the dependent surfaces refuse by name today and would refuse
  identically with the keys present while `umbrellaPlaneHandles()` returns no
  provider handles.
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
| **Stripe LIVE mode** | D5's one permitted source is `SCENEAXI_STRIPE_LIVE_AUTHORIZED`, resolved to runtime-witnessed audit evidence. Unset, malformed, aliased, or merely correlated configuration still refuses `STRIPE_LIVE_MODE_NOT_AUTHORIZED` at both intent creation and grant. Activation additionally needs ADR 0021's separate captain go-live decision and authority 10 (spend/accounts) | Landing the mechanism in PR #168 did **not** activate it: no shipped call site passes the result. Test mode is structural on fixture commerce; money splits stay bookkeeping-only and there are no Connect payouts |
| **Kids work, later** | An explicit Kids safety decision. Kids is refuse-only (R0) by contract: nothing may depend on `@sceneaxi/profile-kids`, Kids identity and Kids commerce are refused by name on every path that can reach them, and Kids is not deployed | A passing gate is not Kids safety. This brief proposes no Kids surface and no timing |

## Explicit OUTs

Out of scope for this document, and not changed by it:

- Implementation changes of any kind; this documentation refresh closes no issue.
- Any captain decision — settled ones stand, open ones stay open.
- Live npm publication; Stage 1 or Stage 6 proof execution; Stripe LIVE; Connect
  payouts; Kids launch; deployment changes; account creation; spend.
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
