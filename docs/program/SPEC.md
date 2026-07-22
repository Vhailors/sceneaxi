# SceneAxi — Product Specification (consumer copy)

> **Canonical source: [Vhailors/sceneaxi#1](https://github.com/Vhailors/sceneaxi/issues/1)** —
> "Spec: SceneAxi — agent-native interactive engine/library ecosystem (canonical product
> specification)". This file is a **consumer copy**, mirrored into the repo so the spec is
> readable in-tree. It grants nothing and decides nothing on its own. If this file and #1
> disagree, **#1 wins**; later captain decisions win over both. Mirrored 2026-07-21 from
> the issue body as of that date; later locked decisions are reflected here with
> pointers to their owning documents.

---

**Mode:** canonical product specification only. This issue authorizes **no** implementation beyond what its tracker workflow already covers: it does **not** authorize proof execution, install, merge, push beyond its own creation, deployment, accounts, spend, or publication. Every authority stays separate (see the Authority table below).
**Author routing:** Claude + Fable 5 + xhigh (crewmate task `sceneaxi-to-spec-v1`).
**Provenance:** `to-spec` synthesis of the SceneAxi ecosystem Wayfinder chart (backlog `threejs-bgf-ecosystem-wayfinder-v1`, independent non-Claude re-review **v4 PASS**, 2026-07-21), the captain's issue-transfer plan, and the landed bootstrap tree (`Vhailors/sceneaxi` main, commit `f0a5b90` — the exact tree the v4 review verified, aggregate digest `fecfff0c…6ba5c4`).
**Source of truth:** this issue is the SceneAxi **product-scope** spec. factories-helpers [#41](https://github.com/Vhailors/factories-helpers/issues/41) remains the source of truth for the **engine-core proof program** (Stages 0–8, Stage 1 contract); #42–#52 remain live per the issue-transfer plan. Nothing here rewrites, erases, or supersedes any factories-helpers body. Later captain decisions win over older prose.

---

## Problem Statement

Creators — increasingly *agent* creators working alongside humans — have no interactive-engine ecosystem that treats an AI agent as a first-class author. Existing engines assume a human at a GUI; existing agent-first creation platforms (v0, Websim, Rosebud, Bolt, Lovable) ship chat surfaces, not deterministic authoring protocols. The result, from the user's perspective:

- An agent asked to build or modify an interactive scene must screen-scrape GUIs or improvise against undocumented internals, so its work is neither reproducible nor verifiable.
- A human and an agent working on the same project use different tools that drift apart, so neither can trust the other's edits.
- Claims about what a project does ("it runs at 60fps", "the asset imported losslessly") are assertions, not evidence.
- Parents cannot trust interactive content tools with children, because safety is a runtime toggle rather than a structural property.
- Creators who want vetted, rights-clean assets have a choice between open marketplaces with unverifiable provenance and closed stores with no agent access.

## Solution

**SceneAxi** is an agent-native interactive **engine/library ecosystem**: versioned engine packages plus three **separately versioned profiles** — **Game**, **Web Experience**, and **Kids** — all consuming **one agent-native runtime/authoring core**.

From the user's perspective:

- The **agent-native CLI** is the primary authoring surface: deterministic exit codes, versioned machine-readable output, fail-closed validation, and evidence-emitting verbs. An agent can author, test, and prove work without parsing prose.
- **Web and desktop shells** give humans the same operations over the same protocol layer — one behavior, many faces. Anything a shell can do maps to a CLI/protocol operation; a propose→diff→apply edit made in the shell and one made by an agent produce identical documents.
- **Profiles** select and configure core capabilities at build time and pin a core version range. The Kids profile compiles its safety policy in — absent capability is absent code, never a flag.
- **Curated asset catalogs** (game-asset and website-asset storefronts over one shared pipeline) exist as dormant bounded apps until their activation gates open; curation is the product, provenance and AI-disclosure are mandatory metadata.
- The engine's renderer composition is **not assumed**: the Three-vs-PlayCanvas Stage 1 proof (factories-helpers #41 program) decides it under its own precommitted, double-gated rules.
- Product policy the captain has not decided is **structurally refusable**: any CLI verb gated by an open captain hold refuses and names the key, fail-closed on every degraded state.

## User Stories

### Agent authors (primary persona)

1. As an authoring agent, I want a CLI with a documented, stable exit-code map, so that I can branch on outcomes without parsing prose.
2. As an authoring agent, I want machine-readable output whose schema is versioned with the CLI, so that an output change is a semver event I can detect rather than a silent breakage.
3. As an authoring agent, I want fail-closed validation (refuse on schema major-mismatch, unknown flags, ambiguous input, partial-write risk), so that I never corrupt a project by having my mistake "best-efforted" into a mutation.
4. As an authoring agent, I want evidence-native verbs (`test`/`capture`/`report`) that emit Evidence Packets with stable paths, so that my claims about the project are reproducible artifacts, not chat assertions.
5. As an authoring agent, I want every result to carry next-action hints, so that I can discover the protocol without leaving the tool.
6. As an authoring agent, I want propose/apply editing over text-canonical documents, so that my edits are reviewable diffs validated by the same validator as human edits.
7. As an authoring agent, I want commands gated by undecided product policy to refuse and name the held decision key, so that I can report "blocked on captain decision X" instead of silently inventing policy.
8. As an orchestrating agent (firstmate/harness), I want a schema-enforced result mode and deterministic session semantics, so that I can drive many authoring sessions concurrently without cross-talk.

### Human creators (shells)

9. As a human creator, I want a web shell whose inspector shows propose→diff→apply, so that I can review and accept changes (mine or an agent's) with full visibility.
10. As a human creator, I want shell parity with the CLI enforced as a conformance test, so that nothing I do in the GUI is impossible to reproduce, script, or audit via the protocol.
11. As a human creator, I want a desktop shell that is a thin wrapper over the same protocol layer, so that going offline-capable doesn't fork the product's behavior.
12. As a human creator collaborating with an agent, I want both of us to produce identical document formats and evidence, so that handoffs in either direction are lossless.

### Game creators (Game profile)

13. As a game creator, I want a Game profile that pins a core version range, so that my project builds reproducibly against a known engine surface.
14. As a game creator, I want engine claims (performance, capability) backed by the proof program's evidence rather than marketing, so that I can trust the readiness ladder.
15. As a game creator, I want my shipped game to live in its own repository consuming versioned SceneAxi releases, so that engine churn never destabilizes my product.

### Web-experience creators (Web Experience profile)

16. As a web-experience creator, I want a profile scoped to interactive real-time web experiences, so that I get engine capabilities without game-specific baggage. *(Exact scope: held key `web-experience-profile-scope`.)*
17. As a web-experience creator, I want curated web/UI assets with compatibility badges (core range × profile), so that what I install is known to work with my profile version.

### Kids surface (Kids profile)

18. As a parent/guardian, I want the Kids product to be structurally isolated (own surface, no shared accounts/telemetry, no third-party LLM routes by default), so that safety is a property of the build, not a setting someone can flip.
19. As a parent/guardian, I want Kids content drawn from an allowlist over already-curated items with Kids-specific screening, so that curation failures elsewhere cannot leak into the Kids surface.
20. As the captain, I want nothing in the ecosystem able to depend on the Kids profile, so that the fully isolated Kids boundary cannot open by drift.

### Asset catalog participants (dormant until gates open)

21. As an asset seller, I want a catalog intake that records rights, provenance, and mandatory AI-generation disclosure, so that my honest listings aren't undercut by unverifiable ones.
22. As an asset buyer, I want every listed item to have passed screening and human curation with recorded transitions, so that "listed" means vetted, not merely uploaded.
23. As a catalog curator, I want quarantine→screen→curate→list→delist to be fail-closed with recorded reasons, so that no item reaches buyers without passing my gate and takedowns are auditable.
24. As an asset buyer, I want compatibility metadata (core range × profile list, format profiles), so that purchases work in my project without trial and error.

### Engine maintainers and reviewers

25. As an engine maintainer, I want package boundaries enforced by an executable allow/deny matrix, so that architectural violations fail CI instead of accumulating.
26. As an engine maintainer, I want release groups and profile core-pins stamped on manifests and checker-verified, so that the versioning policy is a machine-checkable fact.
27. As an engine maintainer, I want delayed packages (asset-compiler, platform-host, evidence, provider adapters) to land into pre-declared matrix slots, so that growth follows the charted architecture.
28. As an independent reviewer, I want the quality gate to fail while build/test/lint are unwired, so that a passing gate can never be counterfeit ("a passing gate here means the gate has been tampered with").
29. As the captain, I want every undecided choice registered as a structured hold with the CLI refusing on it, so that autonomy never converts my open decisions into accidental defaults.
30. As the program owner, I want the Stage 1 renderer proof to stay double-gated (tier-3 captain decisions AND explicit run authorization), so that the monorepo's existence never pre-decides the engine composition.
31. As a provider integrator, I want a thin Model Provider Port with per-profile policy filters, so that adding or swapping an LLM provider is an adapter, never a rewrite — and Kids routes stay denied by default.

## Implementation Decisions

### Identity and topology (locked captain decisions — constitution, not open questions)

1. **Core product topology:** SceneAxi = interactive engine/library with separately versioned **Game / Web Experience / Kids** profiles over **one agent-native runtime/authoring core**. Factory methodology, CLI, shells, importers, and catalogs are surrounding bounded contexts, not the core identity. "Browser Game Factory" names the factory-methodology context (owned by factories-helpers), not this product.
2. **Packaging:** a core ecosystem monorepo with strict package/app boundaries. Asset catalogs may incubate inside and split later. **Individual game products are never monorepo members** — they are separate repos consuming versioned releases.
3. **Name:** SceneAxi / `sceneaxi` (captain-resolved key `core-product-name`). Registry-clean on every checked authority as of 2026-07-21; full trademark clearance remains a pre-launch gate (see Further Notes).

### Monorepo package map

| Layer | Package / app | Role |
|---|---|---|
| L0 | `schemas` | ALL shared contracts, versioned, **zero dependencies** |
| L1 | `engine-kernel` | Game Kernel seam (`open/dispatch/advance/observe/save/replay`; only `advance` mutates) |
| L1 | `engine-presentation` | Presentation Runtime seam — renderer backend hidden; **Stage 1 proof decides composition** |
| L1 | `engine-orchestrator` | Factory Orchestrator seam (per spec #41's module set) |
| L1 (delayed) | `engine-asset-compiler`, `engine-platform-host`, `engine-evidence` | Pre-declared matrix slots; arrive with proof-program landings |
| L2 | `authoring-core` | The ONE agent-native runtime/authoring core: document model, propose/apply application service, session orchestration, evidence hooks, **Model Provider Port** |
| L3 | `profile-game`, `profile-web`, `profile-kids` | Build-time versioned profiles; each pins a core range; Kids policy compiled in |
| L3 | `cli` | Agent-native CLI — thin protocol adapter (verbs + envelope) over `authoring-core`; **denied direct engine access by the matrix** |
| L3 | `importers` | External-content adapters (per-format packages later) |
| L3 (delayed) | `provider-<name>` | LLM provider adapters behind the Model Provider Port; only after `llm-provider-policy` resolves |
| L4 | `web-shell`, `desktop-shell` | Human authoring surfaces — protocol clients of `authoring-core` |
| L4 | `catalog-game`, `catalog-web` | Dormant storefront apps; touch the Core only via `schemas` catalog contracts |

### Dependency matrix (executable allow/deny; everything not allowed is denied)

Machine-readable truth is the repository's dependency-matrix JSON, enforced by the boundary check (`pnpm check:boundaries`); the prose document explains it, and when they disagree the JSON + checker win.

| From \ To | schemas | kernel | presentation | orchestrator | authoring-core | profile-* | cli | importers | apps |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| engine-kernel | ✓ | — | | | | | | | |
| engine-presentation | ✓ | ✓ | — | | | | | | |
| engine-orchestrator | ✓ | ✓ | | — | | | | | |
| authoring-core | ✓ | ✓ | ✓ | ✓ | — | | | | |
| profile-game/web/kids | ✓ | ✓ | ✓ | ✓ | ✓ | never each other | | | |
| cli | ✓ | | | | ✓ | | — | | |
| importers | ✓ | | | | ✓ | | | — | |
| web/desktop shell | ✓ | | | | ✓ | | | | — |
| catalog-game/web | ✓ | | | | | | | | — |

Deliberate denials that carry design intent:

- **cli → engine packages denied** — makes it structurally impossible for the orbiting CLI to become the missing core.
- **shells → cli denied** — shells are protocol *clients* of the application service, not spawners of a binary.
- **catalogs → authoring-core/engine/profiles denied** — catalogs speak only the `schemas` catalog contracts.
- **anything → profile-kids denied** — the fully isolated Kids boundary is enforced independently of allow lists (`kidsBoundary`; `allowedDependents` remains empty).
- **profile → profile denied; anything → apps/cli denied** (leaves stay leaves).

### Versioning and release groups (checker-verified manifest stamps)

- **contracts** (`schemas`): own versions; every consumer refuses major mismatches.
- **core-train** (`engine-*` + `authoring-core`): one shared semver train — a "core release".
- **profile** (`profile-*`): independently versioned; each manifest MUST carry a core pin (semver range of the supported core train).
- **cli-protocol** (`cli`): versions with its protocol envelope; output-schema changes are semver events.
- Catalog Items pin compatibility as (core range × profile list). Nothing auto-migrates; migrations are explicit, replayable, fixture-tested.

### Shared contract registry (all in `schemas`)

Product Manifest · Kernel Session · Document schemas + propose/apply · F1 stage contract · Asset Package · Catalog Item (Asset Package + rights/provenance/AI-disclosure/compatibility/moderation) · Evidence Packet · Ship Event · CLI protocol envelope · Held-key registry snapshot + CLI command map · Profile Conformance.

### Held-key protocol (runtime contract for captain holds — normative)

The runtime source of truth for undecided product policy is a **versioned held-key registry snapshot generated from the FirstMate structured backlog** (never a Markdown document). Two schemas are seeded in `schemas`: the registry snapshot (schemaVersion, monotonic `registryEpoch`, `generatedAt`, `sourceDigest`, per-key `open|resolved`) and the CLI command map (per-verb `heldKeys`, `builtForRegistryEpoch`; undeclared verb = refuse; explicit `heldKeys: []` = ungated).

Fail-closed refusal semantics (the repository's held-key enforcement doc is normative):

- Every gated verb must establish the **live authoritative epoch** before local checks. **There is no offline exception for gated verbs**; a signed offline marker is not permitted (it can lag an authoritative epoch bump).
- Refuse on: currency unavailable · authoritative epoch ≠ local · snapshot missing/schema-invalid/stale (24h budget) · map/snapshot epoch mismatch · undeclared verb · open gating key (refusal names the key) · unknown key. Allow only when all gating keys are resolved AND currency is OK.
- Ungated verbs may skip the currency check but must not encode product policy.
- Acceptance for any held-key-gated CLI MUST include both regressions: fresh N/N vs authoritative N+1, and offline/unavailable authority.

### Agent-native CLI protocol (normative properties)

One umbrella CLI with per-context command groups (`project|asset|profile|catalog|evidence <verb>`). Deterministic exit-code map enforced by a shared dispatcher at every nesting level; Axi-style typed/counted output with strict `--json`; versioned output schemas; fail-closed validation with tmp-then-rename atomicity; held-key refusal as above; `help[]` affordances; evidence-native verbs. E1's verbs (#49) transfer as the `project` group unchanged — the ecosystem CLI is a superset of E1, and #49's contracts remain its authoritative core. MCP arrives later, if ever, as a thin adapter over the same command layer. Human/agent parity is a conformance test: shells render what the protocol exposes; where policy requires a human gate (craft verdicts, curation), the CLI represents the gate — it never simulates it.

### Model Provider Port

Owned by `authoring-core`: complete/tool-call/stream + typed capability descriptors + per-profile policy filter, with provider adapters behind it in pre-declared delayed slots. Direct first-party adapters are the default posture; aggregation (e.g. OpenRouter) is an optional breadth adapter only under the chart's falsified conditions (pinned provider slug, contractual residency, `zdr:true`, `allow_fallbacks:false`, pinned params/quantization — ZDR is retention, not geography). **The Kids profile's policy filter denies third-party model routes by default.** Every evidence packet records the exact model descriptor (model, provider, quantization, version). Adoption itself is held (`llm-provider-policy`, `deepseek-adoption`).

### Catalog pipeline (one platform, two storefronts — topology held)

`intake (quarantine, #48 controls) → screening (rights/provenance/AI-disclosure) → curation (human verdict — curation IS the product) → listing (compatibility badges) → delisting/takedown (recorded reason)`. Every transition recorded and fail-closed. Commerce fields exist but are **inert** until the existing 6b activation holds open (read per-storefront). Kids consumption is an allowlist over already-curated items — a consumer of the pipeline, never a fork.

### Proof program (unchanged; referenced, not absorbed)

The Stage 0–8 falsification program of factories-helpers **#41 transfers intact and stays its own source of truth**. Stage 1 (Three-vs-PlayCanvas renderer composition) remains **double-gated**: tier-3 captain decisions AND explicit run authorization — the monorepo is packaging, not proof, and nothing in this spec pre-decides the renderer. Stage 8 remains the readiness/claims gate. The single topology amendment already recorded: repository *creation* moved ahead of Stage 8 (captain authority); proof-prep docs (#50–#52) re-home to SceneAxi `docs/proof/` under the issue-transfer plan, with execution still double-gated. Readiness vocabulary is inherited: factory-ready ≠ engine-ready ≠ commercially validated ≠ kids-safe ≠ marketplace-ready; evidence never rounds up.

### Authority table (non-transitive; PASS ≠ commit ≠ push ≠ merge)

| # | Authority | Covers | Explicitly does NOT cover |
|---|---|---|---|
| 1 | Review PASS (non-Claude) | Eligibility to request the authorities below | Any action |
| 2 | Apply | Copying a reviewed tree into the clone | Install, commit, push |
| 3 | Install | `pnpm install`, lockfile creation | Commit, push |
| 4 | Initial commit / commit | Local commit only | Push |
| 5 | Push | Pushing a branch to `Vhailors/sceneaxi` | Merge, issue creation, publication |
| 6 | **Merge** | Merging to main | Deploy, publication |
| 7 | Issue transfer/creation | Owned by the issue-transfer plan under its own explicit transfer authority | — |
| 8 | Proof execution | Stage 1+ runs — dual-gated (tier-3 captain decisions AND explicit run authorization) | — |
| 9 | Spend / accounts | Any paid service or account creation | — |
| 10 | Publication | Package publishing, public visibility, docs sites | — |

No grant implies another; a cross-brain review PASS grants **no** action. Bootstrap authorities 1–5 for the initial tree have been exercised (main holds the v4-PASSed tree); every future change re-earns its own grants.

## Open Captain Decisions (held keys — listed, not answered)

This spec **does not answer** any of the following. Each is a registered structured hold (origin `threejs-bgf-ecosystem-wayfinder-v1`) with dependency edges enforcing one-at-a-time surfacing in this order; recommended answers live in the Wayfinder tickets and are recommendations, never resolutions. Any CLI verb touching one of these refuses until the captain resolves it.

| # | Held key | Decides |
|---|---|---|
| 1 | `web-experience-profile-scope` | What the Web Experience profile is (and is not) |
| 2 | `catalog-storefront-topology` | One catalog platform with two storefronts vs other topologies |
| 3 | `cli-audience` | Internal-first vs public CLI; publication preconditions |
| 4 | `authoring-surface-priority` | Order: CLI / web shell / desktop / importers |
| 5 | `profile-rollout-order` | Which profile ships conformance first |
| 6 | `website-catalog-scope` | Scope of the website-asset storefront |
| 7 | `llm-provider-policy` | Provider port posture: first-party direct vs aggregation conditions |
| 8 | `deepseek-adoption` | Whether/how DeepSeek V4 is adoptable (re-verify post-GA; never official endpoint for Kids/user data) |

Resolved anchors: `core-product-name` = **SceneAxi** and
`kids-surface-isolation` = a fully separate Kids domain and origin with isolated
identity, cookies, data, telemetry, and LLM routing (captain, durable). The
residual Kids holds are only the 6a age, safety, curriculum, and jurisdiction
decisions; they do not reopen the resolved surface topology. The **24 existing
holds** (origin `threejs-factory-wayfinder-v1`, tiers 1–6b — including
`capability-name`, `kernel-name`, the residual 6a Kids branch, the 6b marketplace
activation/scope gates, hosted-accounts/telemetry boundaries, and the tier-5
license hold) remain open, unmodified, and authoritative; the registry ticket is
factories-helpers #42.

Locked decision: `site-domain-topology` uses the hybrid topology recorded in
[`site-domain-topology.md`](site-domain-topology.md): an umbrella domain for the
core product and docs, distinct game-asset and website-asset storefront domains,
and a fully separate Kids domain/origin. Exact domain strings and purchases are
out of scope. This human-readable record does not replace the current
authoritative FirstMate registry snapshot required by
`docs/held-key-enforcement.md` to resolve either key for CLI enforcement.

## Testing Decisions

Good tests here verify **external behavior at contracts and seams**, never implementation internals. The highest seam is the protocol layer (`authoring-core`'s application service + the CLI envelope); prefer it for every behavior test. Existing executable prior art in the repo sets the pattern:

- **Boundary enforcement:** `pnpm check:boundaries` passes on the clean tree and demonstrably fails on injected violations (manifest edges, source imports, Kids boundary, release-group stamps, core pins, shared-prefix sibling escapes like `cli` vs `cli-shadow`). Keep the injected-violation regressions.
- **Honest gate:** `pnpm gate` MUST fail while build/test/lint are unwired — a passing gate on an unwired tree is evidence of tampering, and this property is itself a test.
- **Held-key enforcement:** fixture-tested against the full refusal table, mandatorily including the fresh-N/N-vs-authoritative-N+1 regression and the offline/unavailable-authority regression (both must refuse). The v4 review's executable state-table transcription is the model.
- **Profile Conformance:** one shared kernel/document/evidence conformance suite that every profile must pass to claim the shared core — this is what makes "consumes one agent-native core" testable.
- **CLI protocol:** golden tests on the exit-code map (at every nesting level — the observed gh-axi sub-subcommand exit-0 wart is the anti-pattern), output-schema snapshot tests versioned with the CLI, strict `--json` equivalence, refusal-naming-the-key assertions.
- **Parity:** shell-vs-CLI parity as conformance tests (same operation → identical documents and evidence), not habit.
- **Contract discipline:** schema major-mismatch refusal fixtures for every consumer; migration fixtures (explicit, replayable).
- **Evidence:** `test`/`capture`/`report` emit Evidence Packets with stable paths; packets record exact model descriptors where LLM calls occur.

## Out of Scope

- **Spend and accounts** — no paid service, no account creation, anywhere in this program (separate authority, currently ungranted).
- **Deployment / hosting / publication** — no deploys, no package publishing, no public visibility, no docs sites (tier-4/5 holds + Stage 7 evidence first).
- **Merge authority** — this spec grants none; PASS ≠ commit ≠ push ≠ merge (authority table).
- **Stage 1 proof execution** — remains double-gated under #41's program; not started, scheduled, or resourced by this spec.
- **AAA-scope engine ambitions** — the ecosystem's budgets and kill criteria come from the proof program; no console/AAA/general-purpose-engine expansion is chartered.
- **Open/two-sided UGC marketplace** — catalogs stay curated-only and dormant until the existing 6b activation holds open per storefront; commerce fields inert until then.
- **Kids launch** — nothing Kids-facing ships until the residual 6a age, safety,
  curriculum, and jurisdiction holds resolve; Kids never borrows readiness.
- **CLI publication** — internal until `cli-audience` + tier-5 holds + Stage 7 evidence say otherwise.
- **LLM provider adoption** — no provider adapter lands until `llm-provider-policy` (and for DeepSeek, `deepseek-adoption` post-GA re-verification) resolve.
- **License selection** — `UNLICENSED` stands until the open tier-5 license hold resolves.
- **Issue transfer execution** — creating/closing the remaining factories-helpers mirrors is owned by the issue-transfer plan under its own explicit transfer authority.
- **Game products in the monorepo** — never; separate repos by locked decision.
- **Factory methodology absorption** — glossary/readiness/proof policy/decision registry stay owned by factories-helpers; SceneAxi consumes contracts.

## Further Notes

- **Transfer linkage:** this issue is the "new product-spec issue set" anchor foreseen by the issue-transfer plan (created after bootstrap landed, labeled `transferred-from: factories-helpers#41`). Per the plan, #41 should receive its single reconciliation comment when transfer authority is exercised; this task had read-only access to factories-helpers, so that comment is **pending** and owned by firstmate under transfer authority — record it when executing the plan.
- **Naming residuals (pre-launch gates, not re-opened decisions):** full trademark clearance (USPTO/EUIPO class search, common-law, app stores) has not been performed; the "Axi" adjacency (Axi/AxiCorp trading brand, ARM AXI bus, the internal `*-axi` helper-CLI family) needs deliberate brand-copy separation before SceneAxi goes public. Fallback candidates from the verification screen are preserved in the chart should clearance fail.
- **Evidence trail:** Wayfinder chart + map + tickets 01–21, the FAIL→remediation→v4-PASS review chain, checksummed research captures (OpenRouter, DeepSeek V4, CLI patterns, naming), and the issue-transfer plan live in the FirstMate program archive (`data/threejs-bgf-ecosystem-wayfinder-v1*`), outside this repo by design until transfer authority exists.
- **Benchmark posture:** no competing agent-first creation platform ships an Axi-grade deterministic authoring CLI; CLI v1 acceptance is charted to include an axi.md-style ergonomics benchmark so the claim is earned, not asserted.
