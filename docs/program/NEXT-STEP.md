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
| SHA | `3f9bc1cce3c57d8b3d3397743d8f1beddf899bee` (`3f9bc1c`) |
| Head commit | `fix: close Step 14 doc/code hygiene gaps (#150)`, merged 2026-07-27 |
| Repository gate | `pnpm gate` green on this tree — 2036 tests across 136 files, hermetic: no network, no `DATABASE_URL`, no Stripe key |
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

All merged into `main`; all reachable from `3f9bc1c`.

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
| 15 — this brief | [#141](https://github.com/Vhailors/sceneaxi/issues/141) | this PR | — |

The foundation the ladder was built on, also merged:

| Work | PR | Merged |
|---|---|---|
| Deterministic multi-object scene composition | [#113](https://github.com/Vhailors/sceneaxi/pull/113) | 2026-07-25 |
| Browser-runnable kernel sessions | [#122](https://github.com/Vhailors/sceneaxi/pull/122) | 2026-07-25 |
| Three.js as product presentation core | [#123](https://github.com/Vhailors/sceneaxi/pull/123) | 2026-07-25 |
| Runnable surfaces v1 | [#124](https://github.com/Vhailors/sceneaxi/pull/124) | 2026-07-25 |
| Deployable sites + public engine SDK archive | [#125](https://github.com/Vhailors/sceneaxi/pull/125) | 2026-07-25 |

Surface-by-surface runnable levels and their proofs are owned by
[`runnable-surfaces.md`](../runnable-surfaces.md); how far each profile's open
path may be *demonstrated* is owned by
[`open-path-policy.md`](../open-path-policy.md). Neither is a shipping claim —
`shippingClaim` is structurally `false`.

## Visual gate outcome

There is **no canonical visual archive** in this repository, and node gates
cannot produce one: WebGL does not run in node, so `pnpm gate` exercises the
deterministic headless surface, which reports `pixelsDrawn: false` and captures
nothing. A frame counter is deliberately never allowed to imply pixels
([ADR 0017](../adr/0017-three-product-presentation-core.md)).

The pixel claim therefore rests on the existing evidence record, not on a gate
inference: [`three-presentation-core.md` § "What is verified
where"](../three-presentation-core.md#what-is-verified-where). That record holds
manual Chrome observations at two different levels. The standalone snippets were
verified on 2026-07-25 against a committed fixture artifact served through Vite,
with a frame report and a `capture()` PNG byte count. The two shipped surfaces
were verified against the production build (`next build && next start`) — `/open`
on 2026-07-25, and `/editor` plus a re-verification of `/open` on 2026-07-26 —
and those two each carry the frame report, `toDataURL` byte counts,
distinct-colour and non-background pixel counts, and the byte-identical **Reset
view** capture. Read that section for the figures; they are not duplicated here.

Two facts from it are load-bearing for anything downstream: with the editor
preview flag unset the same build serves **no canvas at all** and refuses
`IDENTITY_PLANE_NOT_WIRED`, and the shared viewport boundary left `/open`
unmoved. The corresponding node-gate coverage is
`tests/e2e/umbrella-live-open-golden.test.ts` and
`tests/e2e/umbrella-editor-viewport-golden.test.ts`, both headless and both
making no pixel claim.

## Open decisions and deferred follow-ups

### Deferred at the auth-credits v1 review gate

Three siblings under epic [#90](https://github.com/Vhailors/sceneaxi/issues/90),
deferred by explicit captain decision rather than overlooked. All three remain
**open**.

| Issue | What it closes | Dependency / authority implication |
|---|---|---|
| [B1 — #126](https://github.com/Vhailors/sceneaxi/issues/126) | Runtime-unforgeable provenance brands for `AdminIdentity` and `VerifiedCheckoutCompletion`, so a hand-built or `as`-cast value cannot satisfy an admin guard or reach the grant path | Both are **in-process** trust boundaries, not remote ones: no HTTP client, webhook sender, or browser crosses them today. Closing it needs no new authority — it is in-repo design work under the existing hermetic gate |
| [B2 — #127](https://github.com/Vhailors/sceneaxi/issues/127) | Binds settlement to the exact Checkout Session id, and rebuilds `recordMoneySale` from verified completion evidence plus the persisted intent snapshot | **Blocks any Stripe Connect payout work.** In v1 a `MoneySplitRecord` moves no money — the contract refuses payout, transfer, destination, and Connect-account fields — so today's blast radius is an inaccurate ledger row, not a cash transfer. That containment ends the moment payouts are considered |
| [B3 — #128](https://github.com/Vhailors/sceneaxi/issues/128) | Transactional settlement, a persisted idempotent webhook grant boundary, and atomic append-or-replay metering | Every finding asks for enforcement "at the persistence boundary", which in v1 is an **injected port** whose only in-tree implementation is the in-memory reference store. Closing it means building the production Neon adapter — deliberately outside core under [ADR 0021](../adr/0021-identity-credits-injected-adapters.md). Until then, `applyCreditsSale`, `applyCheckoutCompletedGrant`, and `meterCredits` return a new ledger state and the **caller** owns the commit |

Note when reading #128: its body links the injected-adapters ADR as
`docs/adr/0016-…`; in this tree that ADR is
[0021](../adr/0021-identity-credits-injected-adapters.md), and `0016` is the
portable kernel digest. The issue text is otherwise unchanged and authoritative.

Also open, not deferred from that gate:

- [#120](https://github.com/Vhailors/sceneaxi/issues/120) — `apps/web-shell` is
  library-only and not startable. **Blocked on an ownership decision**: whether
  the runtime authoring shell is `apps/web-shell` or the deployed umbrella. Note
  that Step 5 did not settle this — it used umbrella editor ownership under
  [ADR 0022](../adr/0022-umbrella-owns-the-public-viewport.md), which is a
  different question.
- [#121](https://github.com/Vhailors/sceneaxi/issues/121) — implemented as the
  library-only `createAssistantPanel()` view model. Its contract is owned by
  [`auth-credits.md`](../auth-credits.md), and its non-runnable level is owned by
  [`runnable-surfaces.md`](../runnable-surfaces.md); this brief does not restate
  either or decide the separate host ownership question in #120.
- [#114](https://github.com/Vhailors/sceneaxi/issues/114) — the runnable-surfaces
  epic; its issue graph owns the remaining closure dependencies.
- [#1](https://github.com/Vhailors/sceneaxi/issues/1) — the canonical product
  spec, a standing issue rather than a work item.

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
| **Stripe LIVE mode** | An explicit `liveModeAuthorized` captain gate — absent it, the settlement path refuses `STRIPE_LIVE_MODE_NOT_AUTHORIZED` — plus authority 10 (spend/accounts). [#127](https://github.com/Vhailors/sceneaxi/issues/127) should be weighed first, and **must** land before any Connect payout | Test mode is structural on the fixture-commerce path, which neither accepts nor forwards `liveModeAuthorized`. Money splits stay bookkeeping-only; there are no Connect payouts |
| **Kids work, later** | An explicit Kids safety decision. Kids is refuse-only (R0) by contract: nothing may depend on `@sceneaxi/profile-kids`, Kids identity and Kids commerce are refused by name on every path that can reach them, and Kids is not deployed | A passing gate is not Kids safety. This brief proposes no Kids surface and no timing |

## Explicit OUTs

Out of scope for this document, and not changed by it:

- Implementation changes of any kind; no issue is closed by this brief except
  [#141](https://github.com/Vhailors/sceneaxi/issues/141) itself.
- Any captain decision — settled ones stand, open ones stay open.
- Live npm publication; Stage 1 or Stage 6 proof execution; Stripe LIVE; Connect
  payouts; Kids launch; deployment; account creation; spend.
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
