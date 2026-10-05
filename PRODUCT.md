# Product

<!-- impeccable:product-schema 1 -->

> Derived 2026-10-04 from `README.md`, `CONTEXT.md`, `docs/program/SPEC.md` (consumer copy of
> sceneaxi#1), `AGENTS.md`, and the two existing child records (`desktop/linux/PRODUCT.md`,
> `packages/profile-kids/PRODUCT.md`). No interview was held: the redesign brief stated no
> human was available. Facts quoted from those sources are unmarked; anything inferred from
> code rather than stated in a source is marked **[inferred]**. Child records win for their
> own surface where they are more specific.

## Platform

web

(The packaged desktop app in `desktop/linux` is Electron over the same HTML/CSS chrome, so its
design language is web, not native.)

## Users

- **Authoring agents (primary persona in the spec).** AI agents that build and modify
  interactive scenes through the agent-native CLI and need deterministic exit codes,
  versioned machine-readable output, fail-closed validation and evidence they can cite.
- **Human creators.** People who review and accept changes (their own or an agent's) in the
  web shell inspector, the packaged desktop editor, or the umbrella's entitled web editor.
  They need to see exactly what will change before anything is written.
- **Game and web-experience creators** evaluating whether SceneAxi's engine, SDK and
  profiles fit their project, mostly arriving on the umbrella site. **[inferred]** They are
  technical, comparison-shopping against Unity, Godot and Three.js (the umbrella's own
  comparison table names these three).
- **Asset buyers and sellers** on the two storefronts (game assets, web assets). The
  storefronts are dormant; commerce runs only on TEST fixtures.
- **Children with a parent or guardian nearby** on the isolated Kids origin: one small
  pick → add → play activity. Grown-ups need to be able to verify the privacy boundary.
- **Operators/admins** reading the credit ledger (`/admin/ledger`).

## Product Purpose

SceneAxi is an agent-native interactive engine and library: versioned engine packages plus
separately versioned Game, Web Experience and Kids profiles over one runtime/authoring core.
Humans and agents make the same propose → review → apply edits over text-canonical
documents, and the result opens through a versioned profile. Success means an edit made in
any surface is reviewable before it is written, byte-identical to the same edit made through
the CLI, and every claim the product makes is backed by evidence rather than assertion.

## Positioning

The umbrella states it plainly: "Unity and Godot are broad game engines. Three.js is a web
rendering library. SceneAxi is a smaller engine and library centered on reviewable source,
deterministic evidence, and versioned profiles." What a neighbour cannot copy: one shared
propose/apply protocol under CLI, web shell, desktop and importers (parity is a conformance
test), refusals that name the exact blocking reason or captain decision, digests shown
before and after every change, and a Kids product whose safety is structural (own origin,
no shared identity, no third-party model traffic) rather than a setting.

## Operating Context

- **Umbrella site** (`sites/umbrella`): product overview, engine SDK download, profiles,
  pricing for credit packs, docs, login/account, the live public open path (`/open`, a real
  WebGL canvas drawing a committed Sculpt Artifact), the entitled Minimum E2 web editor, and
  an admin credit ledger.
- **Storefronts** (`sites/catalog-game`, `sites/catalog-web`): curated catalogs over one
  shared skeleton with different merchandising; item pages, a publish/intake page. Dormant:
  commerce fields are inert until activation gates open.
- **Kids origin** (`sites/kids`): self-contained install root, empty SceneAxi allow list, not
  deployed.
- **Web shell** (`apps/web-shell`): loopback-only local inspector; type a document path, a
  JSON Pointer and a value, Propose, review the diff, Accept or Reject.
- **Engine Desktop** (`apps/desktop-shell` chrome, packaged by `desktop/linux`): a stateful
  editor with a seven-mode rail (build, sculpt, compose, animate, run, ship, plugins), docked
  scene tree, inspector, bottom dock (changes, evidence, console), AI assistant column with
  ask/build/agent modes and BYOK/hosted routes, command palette, profile switch, and a live
  Three.js viewport.
- Sessions are long and focused on the desktop and in the inspector; the umbrella and
  storefronts are visited in evaluation mode. **[inferred]** Desktop work happens on
  1280–1920px windows; the sites must work from 390px phones up.

## Capabilities and Constraints

- Every surface's behaviour is owned by contracts outside the UI: ADRs, schemas, refusal
  registries (`SITE_REFUSALS`, desktop refusal messages), and tests/goldens. Visual work must
  not change behaviour, routes, data hooks, ids, ARIA, control ids, or pinned copy.
- Three colour laws are load-bearing product rules, not decoration: **accent means
  pending, mint means verified, red means refused**; a diff's old value is stale bronze,
  never red.
- Change Review sub-rules: the pointer leaf never truncates; old value stale, new value mint;
  hash before and after always visible; a stale proposal is refused, never merged.
- Partial accept is unsupported: mixed decisions refuse by name
  (`CHANGE_REVIEW_PARTIAL_ACCEPT_UNSUPPORTED`).
- Sites are separate install roots (ADR 0018); only `sites/umbrella` may reach the engine
  presentation package and the identity plane. The desktop shell may not import
  `@sceneaxi/site-kit` (dependency matrix), so its tokens are a recorded copy.
- Kids: nothing may depend on the Kids profile; `sites/kids` imports no SceneAxi package and
  its activity reducer is byte-identical to the profile copy by parity test.
- No spend, accounts, deploys or publication without separate authority.
- Undecided: domain names, licence (`UNLICENSED`), storefront activation, Kids launch.

## Brand Commitments

- Name: **SceneAxi** (`sceneaxi`). Wordmark is the name set in the product sans next to a
  small square mark.
- Two captain-accepted visual authorities exist and are binding until a recorded
  deviation changes them: **Foundations v2** (`docs/design-foundations.md`, archive SHA-256
  `ad5d6e39…c15159`) for `sites/`, and **Cinematic Pro** (`docs/engine-desktop-surface.md`,
  archive SHA-256 `c4ecfce1…bc950b51`) for the Engine Desktop.
- Voice: precise, capable, restrained; honest about limits ("This matrix makes no shipping
  or availability claim"). Refusals are named and plain. Kids voice is clear, kind and
  quietly playful.
- Surface accents are fixed meanings: signal orange for the umbrella, game-store red and
  web-store teal for the storefronts, violet for Kids, cyan for the desktop.

## Evidence on Hand

- Committed public artifact for the hero and `/open`: a Sculpt Artifact composed into placed
  instances and drawn live (`.sceneaxi/evidence/issue-73-hybrid-sculpt-golden.json`,
  `tests/e2e/fixtures/scene-composition/`).
- Engine SDK archive with a SHA-256 checksum (`sites/umbrella/public/engine-sdk/`).
- Committed TEST storefront fixtures (e.g. `harbour-diorama`, `lantern-prop`,
  `market-stall-kit`, `odd-price-charm`).
- The engine comparison table and profile capability matrix in
  `sites/umbrella/src/lib/launch-marketing.ts`.
- **Absent and not to be fabricated:** customer logos, testimonials, user counts,
  benchmark numbers, performance claims, shipping/availability claims, real prices beyond
  the credit-pack data the site already renders, and any "production-ready" claim.

## Product Principles

1. **Review before write.** Every change is shown as an exact diff with digests before
   anything is written; the interface makes the pending state impossible to miss.
2. **Refuse by name.** An unavailable path stays visible and says why, in the registry's own
   words, instead of disappearing or failing silently.
3. **Evidence, not claims.** Show the artifact, the digest, the checksum, the real canvas;
   never decorate a claim the contracts do not make.
4. **One protocol, many faces.** CLI, web shell, desktop and web editor are faces of the
   same operations; a human surface never implies a capability the protocol lacks.
5. **Isolation is structural.** Kids is separate by construction; nothing visual or
   behavioural may bridge it to the rest of the family.

## Accessibility & Inclusion

WCAG 2.1 AA: body text ≥4.5:1 and large text ≥3:1, measured in the gate
(`packages/site-kit/test/design-tokens.test.ts`, `apps/desktop-shell/test/visual-tokens.test.ts`,
`tests/sites/kids-surface.test.ts`). Full keyboard operation with visible focus, named status
announcements, meaning never carried by colour alone, reduced-motion-safe state changes,
forced-colors support where already present. Kids: large touch targets, plain-language
refusals, no collection of age or other personal attributes.
