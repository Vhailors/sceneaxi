---
type: report
title: SceneAxi Product Quality Scorecard
created: 2026-08-26
tags:
  - sceneaxi
  - product-quality
  - scorecard
related:
  - '[[SceneAxi-Product-Quality-Loop]]'
  - '[[Initiation-Audit]]'
  - '[[Full-Editor-v1-Capability-Matrix]]'
---

# SceneAxi Product Quality Scorecard

This is the first formal scorecard for the Product Quality Loop. It is a
baseline and denominator lock, not a release, deployment, publication, proof,
Kids, commerce, or authority decision. The active cycle brief is
`.maestro/playbooks/Product-Quality/Working/current-cycle.md`.

## Locked baseline identity

| Field | Value |
|---|---|
| Cycle | `pq-2026-08-26-02` |
| Playbook iteration | `00001` |
| Branch at baseline | `maestro/product-quality-loop-2` |
| Baseline HEAD | `dff0833a4041bf7e7d0de897c8ee4c5130a2fc6c` |
| `main` | `dff0833a4041bf7e7d0de897c8ee4c5130a2fc6c` |
| `origin/main` | `dff0833a4041bf7e7d0de897c8ee4c5130a2fc6c` |
| Worktree before cycle artifacts | `?? .maestro/playbooks/Product-Quality/` only |
| Current-cycle brief | `.maestro/playbooks/Product-Quality/Working/current-cycle.md` |
| Cycle evidence | `.maestro/playbooks/Product-Quality/Working/evidence/pq-2026-08-26-02/` |

The identity proof is retained in
`.maestro/playbooks/Product-Quality/Working/evidence/pq-2026-08-26-02/checkout-identity.log`.
The pre-existing untracked Product-Quality tree was preserved; no product source
was changed while establishing this baseline.

## Scoring rules

The denominator below is fixed for this product-quality program. Each row is a
stable receptor or metric, scored once per cycle against the exact evidence
named by the cycle brief. A row is one point: `P` means a current-cycle
measured pass, `F` means a measured failure, and `U` means unavailable or not
current/comparable. `U` never earns a point and is not silently converted into a
pass. A baseline score therefore describes current claimable evidence, not an
unmeasured product's intrinsic quality.

Each lane has ten rows. The lane bar is **at least 90%**, so a lane must reach
at least 9/10, have no hard-gate zero, pass every relevant focused check, and
have a green `pnpm gate`. Visual rows require fresh real-browser evidence at
identical states and the required `390x844`, `768x1024`, and `1440x1000`
viewports; headless frame counters and historical screenshots never earn a
visual point.

Rows may be clarified in owner documentation, but may not be deleted,
reclassified, or made inapplicable to raise a later score. A newly shipped
surface may add a receptor only with an explicit owner record before the cycle
that scores it.

## Fixed receptor and metric inventory

### Websites — 10 rows

Applicable surfaces: `sites/umbrella`, `sites/catalog-game`,
`sites/catalog-web`, and the isolated `sites/kids` surface, with each surface's
own allowed states and refusal contract.

| ID | Receptor / metric | Required evidence |
|---|---|---|
| W01 | Responsive geometry has no unintentional overflow | Browser measurements at `390x844`, `768x1024`, and `1440x1000`; inspect affected routes and deliberate scrollers separately |
| W02 | Information hierarchy remains readable at each viewport | Matched screenshots plus rendered heading/line/region measurements; no clipped or collapsed primary content |
| W03 | Keyboard order, focus visibility, and accessible names are usable | Real-browser Tab/Shift-Tab and control traversal, visible focus evidence, and accessibility-tree or equivalent assertions |
| W04 | Text and non-text contrast meet the owning contract | Composited browser contrast measurements, including disabled/refusal/hover states; 4.5:1 body floor where claimed |
| W05 | Reduced-motion behavior is honored | Browser run with reduced motion enabled; no required content depends on motion |
| W06 | Loading, empty, refusal, and error states tell the truth | Route/state matrix with named refusals, no fabricated readiness, and no unreachable state copy |
| W07 | Console and page errors stay clean | Browser console/page-error capture for every affected route/state |
| W08 | Same-origin request behavior is clean and bounded | Failed-request log, request inventory, and body/credential-boundary checks for affected routes |
| W09 | Route and entitlement state are consistent | Browser route transitions and access/refusal checks against the site-kit contract; no client-side bypass |
| W10 | Performance evidence is measured rather than asserted | Reproducible warm-run or bundle comparison with exact command, viewport, and scope; no invented timing |

**Website baseline:** `0/10` current-cycle rows claimable (`U` for all rows).
`check:sites` passes, but it proves install-root and structural rules rather
than the browser receptors above. Historical evidence remains useful context,
not a current-cycle score: `sites/umbrella/VISUAL-EVIDENCE.md` (latest sections
2026-08-05 and 2026-08-06), `sites/catalog-game/README.md`,
`sites/catalog-web/README.md`, and the Phase 01 baseline screenshot record.
No current-cycle browser run at the fixed three viewports exists yet.

### Engine/runtime — 10 rows

Applicable surfaces: the schema and authoring seams, kernel/orchestrator,
presentation portability, web shell, desktop shell/bridge/host, and their
public goldens.

| ID | Receptor / metric | Required evidence |
|---|---|---|
| E01 | Structural boundaries and syntax are green | Current `check:syntax`, `check:boundaries`, `check:sites`, `check:desktop`, and `check:publish-ready` outputs |
| E02 | Contract, traceability, and policy lockstep is green | Current `check:contracts` and `check:traceability` outputs plus owner-contract review |
| E03 | Focused selected package seam has positive baseline behavior | Schema/package golden tests, including existing install/remove/Kids/source/capability behavior |
| E04 | Process-level checker regressions are hermetic and wired into the gate | `node --test scripts/check-contracts.test.mjs`, then root `pnpm test`/`pnpm gate` inclusion |
| E05 | Claimed golden surfaces are all present in the owning command | `pnpm test:golden` declaration and runnable-surface claims agree; no omitted claimed proof |
| E06 | Deterministic save/replay/digest behavior holds | Focused deterministic goldens and checked-in evidence, with no same-run-only digest claim |
| E07 | Browser safety and portability hold at public seams | Browser-safe package checks, no Node-only imports/globals where prohibited, and real browser proof where pixels are claimed |
| E08 | Refusal ordering and privileged boundaries fail closed | Named refusal matrix, malformed-input behavior, Kids isolation, and no privileged throw or bypass |
| E09 | Bounded work and lifecycle/concurrency semantics remain explicit | Focused transitions, cancellation/recovery, one-request-at-a-time or equivalent bounded proof |
| E10 | Full build, test, lint, and gate are green at the candidate HEAD | Exact `pnpm build` and `pnpm gate` outputs anchored to the candidate commit |

**Engine baseline:** `3/10` current-cycle points (`E01`, `E02`, `E03` pass;
`E04` and `E05` fail; `E06`–`E10` are `U`). Fresh structural checks reported
336 parsed TypeScript source files, 26 boundary-checked packages, 109 traced
requirements, 4 deployable sites, 3 desktop applications, and 16 publish-ready
checks. The focused package baseline was 2 files / 5 tests passed. The process
checker was run against this HEAD and returned 40 tests with 36 passed and 4
failed because its sandbox omits newer checker inputs; the exact output is in
`contract-process-regression.log`. The current `package.json` also omits the
four golden files documented as omitted by the runnable-surface owner.

The existing `C1-phase02-verification-wiring` green logs are not accepted as
current-cycle proof: they have no branch or HEAD identity and conflict with the
current process-test result. They remain preserved historical artifacts.

### Graphics — 10 rows

Applicable surfaces: Foundations/site-kit, the umbrella viewport owners,
`apps/desktop-shell`, and the packaged desktop renderer. Headless surfaces prove
contracts only and never earn a pixel point.

| ID | Receptor / metric | Required evidence |
|---|---|---|
| G01 | Real WebGL pixels are drawn where a surface claims pixels | Browser or packaged-runtime canvas context, capture bytes, and `pixelsDrawn` evidence |
| G02 | Composition and visual hierarchy are coherent | Matched before/after screenshots at the fixed viewports with affected-state annotation |
| G03 | Typography, spacing, and contrast meet the owner contract | Browser-computed font/geometry/contrast readings, not token-table inference alone |
| G04 | Responsive layout stays usable | Matched desktop/tablet/phone captures with drawer, stacking, and no-clipping checks |
| G05 | Focus, controls, and state/motion feedback remain legible | Keyboard/pointer interaction evidence, refusal/empty/loading states, and reduced-motion run |
| G06 | Cross-surface visual language remains cohesive | Same-state comparisons across the owning surfaces against the relevant design authority |
| G07 | Pixel and performance claims are not fabricated | Frame metadata, capture bytes, metrics source, and exact scope all agree with the owner |
| G08 | Refusal and empty visual states remain reachable and honest | Browser/packaged state captures for missing renderer, Kids, unavailable host, and empty data |
| G09 | Renderer ownership stays singular and seam-hidden | Structural owner checks plus a real consumer run; no second renderer or leaked backend type |
| G10 | Candidate visual delta is positive and reproducible | Blind first A/B receptor score and matched post-change measurements; no denominator change |

**Graphics baseline:** `0/10` current-cycle rows claimable (`U` for all rows).
Historical observations exist in `docs/design-foundations.md`,
`docs/three-presentation-core.md`, `docs/engine-desktop-surface.md`, and
`sites/umbrella/VISUAL-EVIDENCE.md`, but their latest relevant dates are
2026-07-25 through 2026-08-06 and they predate the current merged-main HEAD or
later surface changes. No matched current-cycle browser screenshots or contact
sheet exist yet. Two existing Phase 01 images were inspected: the desktop and
mobile `/open` screenshots show a lit three-instance viewport, frame report,
responsive stacked content, and no visible blank/error surface; they remain
historical, not current-cycle visual proof.

## Baseline and candidate hard gates

These gates are independent of the numeric rows. A candidate cannot be kept if
any gate fails, even if a lane's arithmetic score is high.

| Gate | Requirement | Baseline state | Candidate closure state |
|---|---|---|---|
| H01 | The candidate's exact HEAD has green `pnpm gate`; no unanchored historical log substitutes for it | Not rerun for this planning task; current-cycle `U` | **Pass** — exact candidate HEAD and `proof-pnpm-gate.log` record exit 0 |
| H02 | Current structural checks all pass with their configured failure semantics | Pass; recorded in `structural-checks.log` | **Pass** — current candidate structural checks remain green |
| H03 | A visual claim has fresh, matched real-browser evidence at `390x844`, `768x1024`, and `1440x1000` | Not available; Websites and Graphics remain unscored | **N/A** — this Engine/runtime bundle makes no pixel claim |
| H04 | No hard-gate row is zero and each applicable lane reaches at least 90% | Baseline not passing; no candidate claim made | **FAIL** — E05 remains failing because `test:golden` omits four documented golden files, and Websites and Graphics remain `0/10 U`; the fixed all-lane bar is not met |
| H05 | Focused checks cover the selected contract and every affected refusal/order path | Selected bundle is not implemented; baseline gap is recorded | **Pass** — direct process, root, and focused proofs cover the selected checker path |
| H06 | Independent read-only cross-brain verdict is exactly `KEEP`, `REWORK`, or `REVERT` | No candidate verdict at baseline | **REWORK** — exact reviewer verdict is retained; no `KEEP` claim is made |
| H07 | Unrelated worktree paths remain unchanged and no secrets enter evidence | Pre-existing untracked Product-Quality tree preserved; evidence scan required at close | **Pass** — final closure inventory and secret scan record the unchanged unrelated paths |
| H08 | No action uses deployment, publication, purchase, account, Stage 1/6, held-key, Kids-expansion, or live-mode authority | Pass for planning; no such authority was used | **Pass** — closure used no external-authority operation |
## Candidate proof record — `pq-2026-08-26-02`

The candidate remains an uncommitted working-tree diff on the exact baseline
HEAD. No commit or push was performed because this loop explicitly does not
authorize either operation. The selected source diff (`package.json` and
`scripts/check-contracts.test.mjs`) has SHA-256
`c1cd4fee734c400f8cca911178135c33435ca5d77686532b233ba38fd19077cb`.

| Proof | Result | Evidence |
|---|---|---|
| Direct process-level contract suite | Exit 0; 40/40 tests pass | `.maestro/playbooks/Product-Quality/Working/evidence/pq-2026-08-26-02/proof-contract-process.log` |
| Focused package and desktop package goldens | Exit 0; 2 files / 5 tests pass | `.maestro/playbooks/Product-Quality/Working/evidence/pq-2026-08-26-02/proof-focused-package.log` |
| Root `pnpm test` | Exit 0; 265 Vitest files / 3,946 tests pass, then 40/40 process cases pass | `.maestro/playbooks/Product-Quality/Working/evidence/pq-2026-08-26-02/proof-pnpm-test.log` |
| Root `pnpm test:golden` | Exit 0; 51 files / 448 tests pass | `.maestro/playbooks/Product-Quality/Working/evidence/pq-2026-08-26-02/proof-pnpm-test-golden.log` |
| Root `pnpm build` | Exit 0; referenced and test TypeScript projects build | `.maestro/playbooks/Product-Quality/Working/evidence/pq-2026-08-26-02/proof-pnpm-build.log` |
| Root `pnpm gate` | Exit 0; structural checks, build, 265/3,946 Vitest tests, 40/40 process cases, and lint pass | `.maestro/playbooks/Product-Quality/Working/evidence/pq-2026-08-26-02/proof-pnpm-gate.log` |
| Candidate identity and change inventory | Exact baseline HEAD retained; only the two selected tracked source files are modified, alongside declared quality artifacts | `.maestro/playbooks/Product-Quality/Working/evidence/pq-2026-08-26-02/proof-final-inventory.log` |

`pnpm test:golden` is green, but its existing command declaration still omits
the four golden files named in the ordered gap
`AUDIT-GOLDEN-COMMAND-OMISSIONS`; therefore E05 remains a measured failure and
this proof does not claim that gap is repaired. The selected checker regression
is proved both directly and through `pnpm test`/`pnpm gate`. No pixel claim is
made for this Engine/runtime bundle, so the Websites and Graphics lanes remain
at their locked `0/10` current-cycle score.

### Engine/runtime candidate score

| ID | Baseline | Candidate | Delta | Evidence basis |
|---|---:|---:|---:|---|
| E01 | P | P | 0 | Current gate structural checks |
| E02 | P | P | 0 | Current contract and traceability checks |
| E03 | P | P | 0 | Focused package and desktop package goldens |
| E04 | F | P | +1 | Direct process suite plus root test/gate execution |
| E05 | F | F | 0 | Four documented golden files remain omitted by `test:golden` |
| E06 | U | P | +1 | Full golden paths with deterministic save/replay/digest coverage |
| E07 | U | P | +1 | Full tests/goldens and current browser-safe structural checks |
| E08 | U | P | +1 | Named refusal, Kids isolation, and privileged-boundary goldens |
| E09 | U | P | +1 | Lifecycle, cancellation, recovery, and bounded-transition goldens |
| E10 | U | P | +1 | Candidate `pnpm build` and `pnpm gate` |

**Engine/runtime candidate total:** `9/10` (`+6` points from the locked
baseline `3/10`). This reaches the Engine/runtime numeric threshold, but it is
not a kept cycle: E05 remains a measured failure, the Websites and Graphics
lanes remain `0/10 U`, and H04 therefore fails globally.
H01, H02, H05, H07, and H08 are green for this candidate; H03 is not applicable
because the bundle makes no visual claim; H04 is explicitly failed for the
all-lane bar; H06 is `REWORK`.

## Independent cross-brain review — `pq-2026-08-26-02`

The installed Codex CLI reviewed the candidate in a fresh ephemeral
read-only session using `gpt-5.6-sol` with high reasoning. No repository edits
or external-authority actions were permitted. The complete retained report is
`.maestro/playbooks/Product-Quality/Working/evidence/pq-2026-08-26-02/cross-brain-verdict.md`.

| Field | Result |
|---|---|
| Verdict | **`REWORK`** |
| Biggest remaining gap | Correct the Engine/runtime score and H04 disposition |
| Reviewer session | `01a03fb3-5e50-7193-8f56-a27bc62649f3` |
| Review scope | Engine/runtime candidate only; no pixel review applicable |
| Verdict evidence SHA-256 | `1897d28a7b99cbe42f10ffbd61ffff3d2fe780d43fa3c78ce1cad0eeca90d2e1` |

The reviewer observed that the implementation satisfies the selected
hermeticity and root gate-wiring bundle, with no identified runtime or boundary
regression. The reviewer found one high-severity scorecard issue: E01–E04 and
E06–E10 are nine passing rows, so the displayed candidate total should be
`9/10` and `+6` under the locked one-point-per-`P` rule, not `8/10` and `+5`.
The scorecard also leaves H04 without a candidate disposition. This is a
`REWORK` disposition, not a `KEEP` approval; cycle closure must correct the
arithmetic and explicitly resolve H04 without changing the denominator.

Observed contract checks from the review:

- `scripts/check-contracts.test.mjs:117` covers the current checker inputs,
  including the three fixture-derived evidence paths used by
  `scripts/check-contracts.mjs:1320`.
- Existing mutation cases still require non-zero exit status and their intended
  diagnostics at `scripts/check-contracts.test.mjs:581`.
- `package.json:16,23` uses failure-preserving `&&` integration for root test
  and gate execution.
- Retained evidence shows 40/40 direct and through root test/gate, with tracked
  changes limited to the two authorized files.

## Cycle closure — `pq-2026-08-26-02`

The independent reviewer returned **`REWORK`**, so this cycle does not claim that
the selected target passed and no candidate is marked kept. The closure fixes
the reviewer's scorecard arithmetic and resolves H04 explicitly without
changing the denominator. The implementation remains as the explicitly
inventoried working-tree rework diff; no revert was performed because the
verdict was not `REVERT`.

| Closure field | Result |
|---|---|
| Decision | **`REWORK`**; no current target passed |
| Candidate disposition | Unkept rework diff retained for the next reset; no product behavior is newly claimed |
| Engine/runtime score | `9/10`, `+6` over the locked `3/10` baseline |
| H04 | **FAIL** overall — E05 remains failing from the documented `test:golden` omissions, and Websites and Graphics are each `0/10 U`; Engine/runtime alone reaches `9/10` |
| Lane kept streak | Engine/runtime `0`; Websites `0`; Graphics `0` — a `REWORK` cycle increments no kept streak |
| Unrelated-work check | Only the selected two tracked source files and declared quality artifacts are present; see `cycle-closure.log` |
| Secret scan | No credential or secret-like matches in the retained cycle evidence; see `cycle-closure.log` |
| Next reset input | Exactly one gap: `AUDIT-AUTHORING-ROOT-ESCAPE` (P0), with its authoring-core containment proof re-anchored at the current HEAD |

### Evidence hashes

| Evidence | Path | SHA-256 |
|---|---|---|
| Candidate source diff | `package.json` + `scripts/check-contracts.test.mjs` | `c1cd4fee734c400f8cca911178135c33435ca5d77686532b233ba38fd19077cb` |
| Direct process proof | `.maestro/playbooks/Product-Quality/Working/evidence/pq-2026-08-26-02/proof-contract-process.log` | `ae3c99152e3a5ea343d2c42e2c0580790e227b06df367d4f493a5a87c04d27f8` |
| Root test proof | `.maestro/playbooks/Product-Quality/Working/evidence/pq-2026-08-26-02/proof-pnpm-test.log` | `0f81380785b3fb000f30f444810da864ad036e58628d92031fe8d34a3f3fc84a` |
| Root gate proof | `.maestro/playbooks/Product-Quality/Working/evidence/pq-2026-08-26-02/proof-pnpm-gate.log` | `7ac0565589b8879e0429b6474d0bda58633c2c76d12c795168c26a2e8cf30270` |
| Independent verdict | `.maestro/playbooks/Product-Quality/Working/evidence/pq-2026-08-26-02/cross-brain-verdict.md` | `1897d28a7b99cbe42f10ffbd61ffff3d2fe780d43fa3c78ce1cad0eeca90d2e1` |
| Pre-closure inventory | `.maestro/playbooks/Product-Quality/Working/evidence/pq-2026-08-26-02/proof-final-inventory.log` | `fc504a8d1811f732c3735496b5e71d78ba03a64295439f074840e23c8f878098` |
| Post-edit closure identity, inventory, and secret scan | `.maestro/playbooks/Product-Quality/Working/evidence/pq-2026-08-26-02/cycle-closure.log` | `c1fdffe9ab6dd872abd9e6f32a10dc36b49a306976f602abced57a686780c511` |


## Cycle 00002 — `pq-2026-08-27-01` (KEPT)

Brief: `.maestro/playbooks/Product-Quality/Working/current-cycle.md`. Selected
bundle: Engine/runtime, gap `AUDIT-AUTHORING-ROOT-ESCAPE` (P0) under
requirements `AUTH-002`/`CORE-010`, exactly the single next reset input named
by the 00001 closure. The implementation makes the shared propose/apply path
resolver fail closed on absolute, traversal, and outside-resolving symlink
paths against a canonicalized project root, reusing `validation-failed` with
the authoritative-root message (no schema widening), propagated through all six
former resolver call sites, including the `apply()` proposal-file read.
Baseline anchors: `evidence/pq-2026-08-27-01/baseline-repro.log`.

### Proof record — `pq-2026-08-27-01`

Candidate: uncommitted working-tree diff on the exact baseline HEAD
`dff0833a4041bf7e7d0de897c8ee4c5130a2fc6c`; no commit or push performed. The
00001 retained rework diff (`package.json`,
`scripts/check-contracts.test.mjs`) remains present by design, out of scope.

| Proof | Result | Evidence |
|---|---|---|
| Failing-first focused run | Two new containment cases red pre-fix; outside proposal file was accepted (`ok:true`) before the fix | `focused-red.log` |
| Focused suite post-fix | Exit 0; 9/9 tests (4 existing + 5 containment cases covering all six sites incl. forged apply edit/diff paths) | `focused-green.log` |
| Root `pnpm test` | Exit 0; 265 files / 3,951 Vitest tests, then 40/40 process cases | `proof-pnpm-test.log` |
| Root `pnpm test:golden` | Exit 0; 51 files / 448 tests; E05 omissions untouched | `proof-pnpm-test-golden.log` |
| Root `pnpm build` | Exit 0 | `proof-pnpm-build.log` |
| Root `pnpm gate` | Exit 0 at candidate state | `proof-pnpm-gate.log` |

### Independent cross-brain review — two sessions

First session (`gpt-5.6-sol`, high reasoning, ephemeral read-only,
`01a041fe-1991-74c3-8ebd-5d9a0b55ec7f`) returned **`REWORK`**: the source
covered all six containment sites but focused regression proof covered only
three. The rework added exactly the two missing forged-proposal test cases
(immutable spreads), changing only the test file. Second session
(`01a0420e-b433-7311-b66d-4a1ea84a0da2`, same settings, current state)
returned **`KEEP`** with one non-blocking note: the symlink case's
external-byte comparison is tautological (same inode via two paths) and proves
unchanged outside bytes only by inspection; recorded as a low-priority
follow-up inside gap 2's disposition below, never a kept-score deduction.
Raw verdicts: `codex-verdict-raw.log`, `codex-verdict-2-raw.log`.

### Lane scoring — `pq-2026-08-27-01`

| ID | Locked baseline | Cycle result | Delta | Basis |
|---|---:|---:|---:|---|
| E01–E04, E06–E10 (rows other than E05) | P/F/U mix per baseline table | P | +6 total from locked `3/10` | Current structural checks, contract/traceability lockstep, full 3,951-test root suite plus hermetic process cases, 448 goldens, browser-safety structure, named-refusal/Kids/privileged goldens **now including authoring-root escape refusals for E08**, bounded lifecycle goldens, candidate build+gate |
| E05 | F | F | 0 | `test:golden` still omits the four documented golden files; this bundle deliberately did not touch that command surface |

**Engine/runtime cycle score:** `9/10` (`+6` over locked `3/10`). For the
first time under an independent `KEEP`. Websites and Graphics remain `0/10 U`
— H04 still fails globally, so the program is not complete.

| Closure field | Result |
|---|---|
| Decision | **`KEEP`** after one bounded `REWORK` round |
| Candidate diff SHA-256 | `d5da68f0bd84ca05148404c03d104144192102f639abc026ec934f5ac4ba6b44` (`candidate-diff.patch`) |
| Gap disposition | `AUDIT-AUTHORING-ROOT-ESCAPE` **closed with evidence** at this HEAD |
| Lane kept streak | Engine/runtime `1`; Websites `0`; Graphics `0` |
| Unrelated-work check | Only the selected two tracked files changed alongside the declared 00001 rework diff and quality artifacts (`cycle-closure.log`) |
| Secret scan | Clean; matches were filename/prose false positives (`cycle-closure.log`) |
| Next reset input | Exactly one gap: `AUDIT-PACKAGE-CATALOG-SHAPE` (P0) |


### Evidence hashes — cycle 00002

| Evidence | Path | SHA-256 |
|---|---|---|
| Candidate source diff | `.maestro/playbooks/Product-Quality/Working/evidence/pq-2026-08-27-01/candidate-diff.patch` | `d5da68f0bd84ca05148404c03d104144192102f639abc026ec934f5ac4ba6b44` |
| Failing-first focused proof | `.maestro/playbooks/Product-Quality/Working/evidence/pq-2026-08-27-01/focused-red.log` | `c4a09eb92a459cb7d663d83310f16e975be61512c91d5eb3dc0343aea66af7b0` |
| Focused green proof (9/9) | `.maestro/playbooks/Product-Quality/Working/evidence/pq-2026-08-27-01/focused-green.log` | `11839e50be2bc69fd93e13dc6d935901ee97734ff51bcdeeb756a4b62cb48891` |
| Root test proof | `.maestro/playbooks/Product-Quality/Working/evidence/pq-2026-08-27-01/proof-pnpm-test.log` | `77fd44cfc175741fd2675879790da3b480ed5166dfbd033c7a62c068dc544826` |
| Root gate proof | `.maestro/playbooks/Product-Quality/Working/evidence/pq-2026-08-27-01/proof-pnpm-gate.log` | `e3143486906bc7588a45cd7dca66308697bdab0359f6c7fad4115f099a371d81` |
| Independent `KEEP` verdict | `.maestro/playbooks/Product-Quality/Working/evidence/pq-2026-08-27-01/codex-verdict-2-raw.log` | `2625e70f1544afba4fb6db83a2ef250b0debecef605c7d58a3f67e57fd0b3bae` |
| Closure identity, inventory, secret scan | `.maestro/playbooks/Product-Quality/Working/evidence/pq-2026-08-27-01/cycle-closure.log` | `c15a67185f7b29b17298175fbf5fd58060505de607e395ece74cc9651988a759` |


## Cycle 00004 — `pq-2026-08-27-03` (KEPT)

Verification-only closure of gap row 1. The candidate is iteration 00001's
retained two-file diff (candidate-diff hash `c1cd4fee734c400f8cca911178135c33
435ca5d77686532b233ba38fd19077cb`), re-presented unchanged after the 00001
closure corrected the arithmetic/H04 objections. Pre-work audit confirmed both
files' hunks relate solely to this gap.

| Proof | Result | Evidence |
|---|---|---|
| Direct process suite | Exit 0; 40/40 | `evidence/pq-2026-08-27-03/process-suite-direct.log` |
| Root `pnpm test` | Exit 0; 265 files / 3,955 tests, then pass 40 — inclusion through root path re-proven | `proof-pnpm-test.log` |
| Root `pnpm gate` | Exit 0 dedicated run at this exact tree state | `proof-pnpm-gate.log` |
| Independent verdict | **KEEP** (`01a04269-9318-7951-be95-e4f7315f245f`) | `codex-verdict-raw.log` |

Engine/runtime stays `9/10` (no measured row changed); this cycle converts a
governance REWORK into a formal closure and raises the lane kept streak to
`3`. Websites/Graphics remain `0/10 U`; H04 still fails globally.

| Closure field | Result |
|---|---|
| Decision | **`KEEP`** |
| Gap disposition | Row 1 closed; next input: `AUDIT-GOLDEN-COMMAND-OMISSIONS` (P1) — the E05 omissions are now the top open ordered gap |
| Unrelated-work / secret scan | Clean per `cycle-closure.log` (matches were benign structural text) |


## Cycle 00003 — `pq-2026-08-27-02` (KEPT)

Brief: `.maestro/playbooks/Product-Quality/Working/current-cycle.md`.
Selected bundle: Engine/runtime, gap `AUDIT-PACKAGE-CATALOG-SHAPE` (P0) under
requirements `TOPO-004`/`DESK-003`, the single next input named by the 00002
closure. The candidate hardens `parseScenePackageCatalog` (nested lock shape,
sha256 digests, contained locators, unique packageIds — refuse to `null`),
makes the desktop inspect consumer return the named `PACKAGE_CATALOG_INVALID`
refusal for any *present* catalog value that fails to parse (absent key keeps
the empty-catalog default; explicit result union), propagates that refusal
through the bridge's `package-inspect` via `commandTransaction` +
`bridgeRefuse`, and proves it end-to-end in the desktop-package golden.

### Independent cross-brain review — four sessions

All sessions: Codex CLI, `gpt-5.6-sol`, high reasoning, ephemeral read-only.

| Round | Session | Verdict | Gap named | Disposition |
|---:|---|---|---|---|
| 1 | `01a04222-08b1-7233-91ba-c7100b7b4dea` | REWORK | Inspect silently emptied malformed catalogs; refusal never reached bridge | Added inspect refusal mapping + bridge propagation + golden E2E case |
| 2 | `01a0423c-fe85-70e3-809a-4fd203b5a8a0` | REWORK | Brief's uniqueness contract not enforced on hand-edited locks | Parser rejects duplicate packageIds; duplicate schema cases added |
| 3 | `01a04248-9735-73d3-8e81-c286d115226a` | REWORK | Present `scenePackages: null` still parsed as empty success | Null guard centralized in helper; present-null golden case + absent-key default restore |
| 4 | `01a04256-216e-7020-acbd-3d6d8e0998db` | **KEEP** | Non-blocking note: bridge tests do not pin refusal transaction metadata | Recorded as low-priority follow-up within gap rows; not a kept-score deduction |

Raw verdict logs: `codex-verdict-raw.log`, `codex-verdict-2-raw.log`,
`codex-verdict-3-raw.log`, `codex-verdict-4-raw.log`.

### Proof record — `pq-2026-08-27-02`

| Proof | Result | Evidence |
|---|---|---|
| Failing-first focused run | Malformed-lock schemas case red with parser hunk stashed (1 fail / 4 pass); source restored byte-identical | `focused-red.log`, `baseline.log` |
| Focused suites final | schemas 5/5; combined with desktop-package golden 9/9 (malformed, present-null, absent-key default) | `focused-green.log` |
| Root `pnpm test` | Exit 0; 265 files / 3,955 tests, then process suite 40/40 | `proof-pnpm-test.log` |
| Root `pnpm test:golden` | Exit 0; 51 files / 448 tests; E05 omissions untouched | `proof-pnpm-test-golden.log` |
| Root `pnpm build` | Exit 0 | `proof-pnpm-build.log` |
| Root `pnpm gate` | Exit 0 dedicated run at candidate state | `proof-pnpm-gate.log` |

### Lane scoring — `pq-2026-08-27-02`

Engine/runtime cycle score: `9/10` (`+6` over locked `3/10`; only E05 remains
F from the documented `test:golden` omissions this bundle deliberately did not
touch). This bundle strengthens E08 evidence further (privileged-input
malformed-catalog refusals now proven through the real bridge). Websites and
Graphics remain `0/10 U`; H04 still fails globally.

| Closure field | Result |
|---|---|
| Decision | **`KEEP`** after three bounded rework rounds |
| Candidate diff SHA-256 | `023afd8904a7e3edcb76ee22c67310fb58c4bcce375fe88ae77fe545af0cf1c0` (`candidate-diff.patch`) |
| Gap disposition | `AUDIT-PACKAGE-CATALOG-SHAPE` **closed with evidence** at this HEAD |
| Lane kept streak | Engine/runtime `2`; Websites `0`; Graphics `0` |
| Unrelated-work check | Only the five amended files plus declared prior-cycle diffs and quality artifacts (`cycle-closure.log`) |
| Secret scan | Clean; all matches benign structural text/reviewer-quoted repo fixtures (`cycle-closure.log`) |
| Next reset input | Exactly one gap: `AUDIT-CONTRACT-REGRESSION-DISCOVERY` (P0) — fresh independent verdict for the retained proven diff |

### Evidence hashes — cycle 00003

| Evidence | Path | SHA-256 |
|---|---|---|
| Candidate source diff | `.maestro/playbooks/Product-Quality/Working/evidence/pq-2026-08-27-02/candidate-diff.patch` | `023afd8904a7e3edcb76ee22c67310fb58c4bcce375fe88ae77fe545af0cf1c0` |
| Failing-first proof | `.maestro/playbooks/Product-Quality/Working/evidence/pq-2026-08-27-02/focused-red.log` | `960ee0c07270e01830c57f1ab402d0d5530243a5aba31c3d7414f93fd3e3928a` |
| Focused green proof (9/9) | `.maestro/playbooks/Product-Quality/Working/evidence/pq-2026-08-27-02/focused-green.log` | `d658552d767572d0092c7bc56f9ca03446e133e5e355e48d11bb12af9bb976ee` |
| Root test proof | `.maestro/playbooks/Product-Quality/Working/evidence/pq-2026-08-27-02/proof-pnpm-test.log` | `dc79f64ea11d4c09e704a4fe907a3f91ceadaa5bc7b7848978144500241baf00` |
| Root gate proof | `.maestro/playbooks/Product-Quality/Working/evidence/pq-2026-08-27-02/proof-pnpm-gate.log` | `58aa16c513467b3aea8cc8daddb11125d6e5603c2367e91ace887a2f405aebfb` |
| Independent KEEP verdict | `.maestro/playbooks/Product-Quality/Working/evidence/pq-2026-08-27-02/codex-verdict-4-raw.log` | `696edb28edfea96b72fb431202b172e0ae069a2115fbe87e9cdc0c583919b32c` |
| Closure identity, inventory, secret scan | `.maestro/playbooks/Product-Quality/Working/evidence/pq-2026-08-27-02/cycle-closure.log` | `8f90be37a230a8d7d0d56f3df549aafe81263a98f12879e510983151526cd0e1` |

### Commands already run for this baseline

| Command | Result | Evidence |
|---|---|---|
| `pwd -P` / `git rev-parse --show-toplevel` / branch + HEAD + status | Exact merged-main identity; pre-work status only the existing Product-Quality tree | `checkout-identity.log` |
| `pnpm -s check:syntax && pnpm -s check:boundaries && pnpm -s check:contracts && pnpm -s check:traceability && pnpm -s check:sites && pnpm -s check:desktop && pnpm -s check:publish-ready` | Exit 0; all seven structural checks pass | `structural-checks.log` |
| `pnpm -s vitest run packages/schemas/test/desktop-scene-package.test.ts tests/e2e/desktop-package-golden.test.ts --reporter=verbose` | Exit 0; 2 files / 5 tests pass | `package-baseline.log` |
| `node --test scripts/check-contracts.test.mjs` | Exit 1; 40 tests, 36 pass, 4 fail | `contract-process-regression.log` |

### Candidate proof commands

The selected implementation must preserve the exact command semantics and add
no bypass:

```text
node --test scripts/check-contracts.test.mjs
pnpm test
pnpm test:golden
pnpm build
pnpm gate
```

Focused package behavior remains:

```text
pnpm -s vitest run packages/schemas/test/desktop-scene-package.test.ts tests/e2e/desktop-package-golden.test.ts --reporter=verbose
```

For later website/graphics scoring, use the owning install-root commands rather
than claiming a root-gate browser result:

```text
pnpm --dir sites/umbrella typecheck
pnpm --dir sites/umbrella build
pnpm --dir sites/umbrella test:visual
pnpm --dir sites/catalog-game typecheck
pnpm --dir sites/catalog-game build
pnpm --dir sites/catalog-web typecheck
pnpm --dir sites/catalog-web build
```

The live servers used for browser evidence are the explicit `start` commands in
the owning site package manifests. A browser record must identify the exact
candidate HEAD, route/state, viewport, console/network result, and screenshot
path; it must not be inferred from `check:sites` or a headless frame counter.

## Ordered evidence-backed gaps

The order preserves the initiation register's verification-foundation-first
rule and reflects current-head evidence, not stale working logs.

| Order | Gap | Priority | Evidence and disposition |
|---:|---|---|---|
| 1 | `AUDIT-CONTRACT-REGRESSION-DISCOVERY` | P0 | **Closed with evidence in kept cycle 00004 (`pq-2026-08-27-03`, independent `KEEP`, session `01a04269-9318-7951-be95-e4f7315f245f`).** The retained two-file diff (root `test` wiring via `&&` + hermetic sandbox covering every current checker input; reviewed-count mutation wording) is proven direct 40/40 and through root test/gate at the recorded tree state. Reviewer note: E05 `test:golden` omissions remain separately open below. |
| 2 | `AUDIT-AUTHORING-ROOT-ESCAPE` | P0 | **Closed with evidence in kept cycle 00002 (`pq-2026-08-27-01`, independent `KEEP`).** All six propose/apply resolver sites refuse absolute, traversal, and outside-resolving symlink paths with the authoritative-root diagnostic; regression-proven failing-first. Reviewer follow-up note (non-blocking): the symlink test's external-byte comparison is tautological; strengthen it only within a future authoring bundle. |
| 3 | `AUDIT-PACKAGE-CATALOG-SHAPE` | P0 | **Closed with evidence in kept cycle 00003 (`pq-2026-08-27-02`, independent `KEEP` after three documented rework rounds).** Parser fails closed on malformed/missing/non-array locks, invalid entries, and duplicate packageIds; inspect maps any present unparseable catalog to `PACKAGE_CATALOG_INVALID`; bridge propagates it through `commandTransaction`; present-null vs absent-key semantics proven end-to-end. Non-blocking reviewer note: pin refusal transaction metadata in bridge tests within a future desktop bundle. |
| 4 | `AUDIT-GOLDEN-COMMAND-OMISSIONS` | P1 | Current `package.json` `test:golden` omits `contained-git-golden`, `desktop-assistant-scene-loop-golden`, `full-editor-transactions-golden`, and `hosted-ai-metering-golden`; do not combine this separate command-surface fix with the selected checker bundle. |
| 5 | `AUDIT-CI-TIMEOUT-BOUND` | P1 | Workflow wall-clock limits remain an operational gap; it is outside this cycle's engine contract bundle. |
| 6 | Website current-browser evidence | P1 evidence gap | Historical route measurements and accessibility records exist, but no current matched three-viewport run is available. No website score or improvement is claimed. |
| 7 | Graphics current-pixel evidence | P1 evidence gap | Historical Three/Foundations/Desktop records and two inspected screenshots exist, but no current matched before/after evidence or receptor score is available. No graphics score or improvement is claimed. |

## Selected bundle lock

The sole selected bundle is **Engine/runtime**, gap
`AUDIT-CONTRACT-REGRESSION-DISCOVERY` (P0), under requirement `REL-001`.
The reason is concrete: on the exact merged-main checkout, the process-level
contract regression suite exits 1 while the ordinary structural contract check
exits 0. That allows a root gate to look green while the checker’s own
process-level regression harness is broken and its intended mutation assertions
are not exercised hermetically. The verification blind spot is a higher-impact
quality risk than adding another product path while it remains unresolved.

The next implementation task may touch at most these two source/command files,
plus focused existing test evidence and this cycle's owner artifacts:

- `scripts/check-contracts.test.mjs` — copy every input that the checker reads so
  the sandbox is complete; preserve the existing 40 behavioral assertions.
- `package.json` — wire the process-level suite into the root test/gate command
  without changing checker semantics or weakening failure behavior.

No `desktop-scene-package` product change is included. The package-catalog
shape gap is intentionally ordered next rather than smuggled into this bundle.

## Cycle closure target

This baseline task makes no product change. The selected candidate can be kept
only after it has a positive focused delta, no hard-gate regression, a green
candidate `pnpm gate`, and an independent read-only cross-brain `KEEP` verdict.
A later close task must update every affected row with exact evidence paths,
command results, score deltas, and the lane streak, then name exactly one next
gap without changing this denominator.
