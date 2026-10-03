# SceneAxi Product Quality Loop

Run a bounded, evidence-first improvement cycle across SceneAxi's websites,
engine/runtime, and graphical product surfaces. Each reset iteration selects one
coherent bundle, proves it independently, and keeps it only when the repository
gate and a cross-brain verdict agree that it is an improvement.

This loop does not authorize a deployment, publication, purchase, provider
spend, account creation, Stage 1/6 proof, held-key decision, Kids expansion,
marketplace activation, Stripe LIVE path, commit, push, issue, pull request, or
release operation. Do not alter an accepted ADR or invent captain policy. Keep
individual games outside this repository.

## Fixed lanes and quality bar

- **Websites:** `sites/umbrella`, `sites/catalog-game`, `sites/catalog-web`,
  `sites/kids`, and their framework-free behavior/visual owners in
  `packages/site-kit`. Judge responsive layout, information hierarchy,
  keyboard/focus behavior, accessible names, contrast, reduced motion, route
  truthfulness, console/network cleanliness, and loading/refusal/error states.
- **Engine/runtime:** `packages/engine-kernel`, `engine-orchestrator`,
  `engine-presentation`, authoring and schema seams, the web shell, desktop
  bridge/host, and their golden paths. Judge correctness, deterministic replay
  and digests, browser safety, bounded work, refusal ordering, portability,
  performance evidence, and public-seam compatibility.
- **Graphics:** the Foundations v2 owners in `packages/site-kit`, the single
  Three viewport owners, `apps/desktop-shell`, and the packaged desktop visual
  surface. Judge real pixels rather than headless frame counters: composition,
  hierarchy, typography, contrast, spacing, affordance, state/motion clarity,
  rendering quality, responsive behavior, originality, and cross-surface
  cohesion.

The first cycle locks the applicable scorecard denominator. Later cycles may add
a receptor or metric only when a newly shipped surface makes it applicable;
they may never delete or reclassify a weak row to raise a score. A lane passes
only when its applicable score is at least 90%, it has no hard-gate zero, every
relevant focused check passes, and `pnpm gate` is green. A visual claim requires
fresh real-browser evidence at identical states and viewports. A headless
surface proves contracts only and never proves pixels.

Use these canonical artifacts:

- `docs/quality/SceneAxi-Product-Quality-Scorecard.md` — durable lane scores,
  retained evidence, decisions, and ordered gaps.
- `.maestro/playbooks/Product-Quality/Working/current-cycle.md` — the one active
  cycle brief; overwrite it only when the previous cycle is closed.
- `.maestro/playbooks/Product-Quality/Working/evidence/<cycle-id>/` — logs,
  measurements, screenshots, contact sheets, and reviewer verdict for that
  cycle. Never put credentials, cookies, bearer tokens, database URLs, or raw
  provider responses there.

## Tasks

- [ ] **Direct one bounded quality cycle from fresh evidence.** Read `AGENTS.md`,
  `CONTEXT.md`, `docs/program/SPEC.md`, `docs/runnable-surfaces.md`,
  `docs/design-foundations.md`, `docs/three-presentation-core.md`,
  `docs/engine-desktop-surface.md`,
  `docs/full-editor-v1-capability-matrix.md`, and
  `docs/audits/initiation/Gap-Register.md`, plus the current scorecard when it
  exists. Verify `pwd -P`, the repository root, branch, full HEAD, and
  `git status --short`; preserve every unrelated or pre-existing change. Run the
  fast structural checks relevant to current drift and inspect the latest valid
  evidence for all three lanes. On the first cycle, create the scorecard with a
  stable receptor/metric inventory, exact commands, baseline values, hard gates,
  and ordered evidence-backed gaps. Select exactly one highest-impact coherent
  bundle in exactly one primary lane. A bundle may cross a seam only when the
  owning contract requires it. Limit scope to at most four tightly related
  product source files plus focused tests, owner documentation, and evidence.
  Do not select the same primary lane for a third consecutive kept cycle while
  another lane has a verified sub-threshold gap. Write `current-cycle.md` with a
  unique cycle ID, lane, baseline, requirement/gap IDs, exact allowed files,
  expected user-visible or runtime outcome, focused checks, capture scenarios,
  rollback inventory, reviewer inputs, and definition of done. Make no product
  change in this task.

  **Cycle 00001 completion note (2026-08-26):** The exact merged-main checkout was
  verified at `dff0833a4041bf7e7d0de897c8ee4c5130a2fc6c` on
  `maestro/product-quality-loop-2`, with `main` and `origin/main` at the same
  SHA; the pre-existing untracked Product-Quality tree was preserved. This was
  confirmed as the first formal quality cycle because no scorecard or
  `current-cycle.md` existed. The locked scorecard is
  `docs/quality/SceneAxi-Product-Quality-Scorecard.md`, and the brief is
  `.maestro/playbooks/Product-Quality/Working/current-cycle.md`, with evidence
  under `.maestro/playbooks/Product-Quality/Working/evidence/pq-2026-08-26-02/`.
  Fresh structural checks passed (336 source files, 26 boundary-checked
  packages, 109 traced requirements, 4 sites, 3 desktop apps, 16
  publish-ready checks). The current process-level contract regression suite
  still fails 4 of 40 cases because its sandbox omits newer checker inputs;
  that current-head P0 verification gap is the sole selected Engine/runtime
  bundle. Existing package baseline coverage is 2 files / 5 tests passing.
  Websites and Graphics remain unscored until fresh matched browser evidence
  exists at `390x844`, `768x1024`, and `1440x1000`; historical owner records
  were inspected but not promoted to current proof. Two associated Phase 01
  screenshots (desktop and mobile `/open`) were analyzed. No product source
  change was made in this task.

- [ ] **Implement only the selected bundle.** Re-read `current-cycle.md`, every
  owner document named there, and the current versions of its allowed files.
  Search for existing helpers, tokens, ports, fixtures, and tests before adding
  anything. For a website bundle, keep behavior in `site-kit` and React/Next in
  the allowed site tier, preserve the storefront parity rules, and implement
  complete responsive, focus, disabled, loading, empty, refusal, and error
  states. For an engine bundle, add or update the failing contract/golden test
  first, preserve deterministic digests and browser-safe boundaries, and keep
  mutations behind their existing authority. For a graphics bundle, work only
  through the documented Foundations, presentation, viewport, or desktop visual
  owner; do not add a second renderer, copied palette, fabricated metric, remote
  runtime asset, or visual fact absent from its owner record. Do not add a
  dependency unless the selected bundle proves the repository lacks the
  capability and every boundary/install-root rule remains intact. Stay inside
  the allowed-file inventory. If the improvement cannot be completed safely in
  scope, make no substitute change and record the blocker.

  **Cycle 00001 implementation note (2026-08-26):** `scripts/check-contracts.test.mjs`
  now copies every contract, documentation, bundled-data, and evidence-test input
  read by `scripts/check-contracts.mjs`, preserving the existing 40 table-driven
  mutation/refusal assertions. The two reviewed-count documentation scenarios were
  updated to mutate the current non-empty registry seed wording rather than an
  obsolete empty-seed phrase. `package.json` now runs the unchanged Vitest command
  followed by the process-level suite. Direct verification passed 40/40 process
  cases; `pnpm test` passed 265 Vitest files / 3,946 tests and then 40/40 process
  cases. The next unchecked proof task still owns the candidate's build, gate,
  evidence capture, and independent verdict; none is claimed here.

- [ ] **Prove the candidate in contracts, runtime behavior, and pixels where
  applicable.** Run the smallest owning tests first, then all affected
  structural/site/desktop/golden checks, `pnpm build`, and `pnpm gate`; never
  skip, weaken, reorder away, or mask a failure. For a website bundle, build the
  owning install root and inspect every affected route at 390x844, 768x1024,
  and 1440x1000 in a real browser, covering keyboard navigation, focus,
  overflow, loading/empty/refusal/error states, console errors, page errors,
  failed same-origin requests, and relevant performance or bundle deltas. For an
  engine bundle, re-run deterministic save/replay/digest and browser-safety
  proofs plus a stable warm-run performance comparison when performance is part
  of the claim. For a graphics bundle, capture matched before/after states at
  those same viewports, inspect the actual images, and score every affected
  receptor without changing the denominator. Store compact evidence under the
  cycle folder and update the scorecard with exact paths and numeric deltas.
  Fail the candidate on any new gate regression, stale/empty/non-comparable
  evidence, clipping, inaccessible control, misleading readiness claim,
  fabricated pixel/performance fact, policy drift, or negative targeted delta.

  **Cycle 00001 proof note (2026-08-26):** The candidate passed the direct
  process suite (40/40), the focused package/desktop tests (2 files, 5 tests),
  root `pnpm test` (265 Vitest files, 3,946 tests, then 40/40 process cases),
  `pnpm test:golden` (51 files, 448 tests), `pnpm build`, and `pnpm gate`.
  Evidence is retained under
  `.maestro/playbooks/Product-Quality/Working/evidence/pq-2026-08-26-02/`,
  with the exact working-tree identity and selected-file inventory in
  `proof-final-inventory.log`. The scorecard records an Engine/runtime delta
  from `3/10` to `8/10` (`+5`): E04 and E06–E10 are now passing; E05 remains
  failing because the existing `test:golden` declaration still omits four
  documented golden files. This bundle makes no pixel claim, so no browser
  screenshot evidence was applicable. The candidate remains pending the
  independent cross-brain verdict and cycle-closure task.

- [ ] **Obtain an independent read-only cross-brain verdict.** Use the installed
  Codex CLI with `gpt-5.6-sol`, high reasoning, an ephemeral session, and the
  read-only sandbox. Give it the cycle brief, exact diff, focused/full gate
  results, scorecard rows, and evidence paths; do not give it credentials or
  authority to modify, commit, push, deploy, publish, or spend. Require it to
  validate the claim against the owning contracts, look for boundary/refusal and
  regression risks, check denominator gaming, and return exactly one of
  `KEEP`, `REWORK`, or `REVERT` with the single biggest remaining gap. For a
  visual bundle, conceal before/after labels for its first A/B choice and require
  an independent receptor score before revealing labels. Save the verdict in
  the cycle evidence folder and summarize it losslessly in the scorecard. If a
  non-Z.AI reviewer cannot run, record `cross-brain reviewer unavailable` and do
  not self-approve the candidate.

  **Cycle 00001 cross-brain verdict note (2026-08-26):** The installed Codex CLI
  ran in a fresh ephemeral read-only session with `gpt-5.6-sol` and high
  reasoning. It returned **`REWORK`**, not `KEEP`: the selected implementation
  passed the hermeticity and root gate-wiring review, but the scorecard reports
  `8/10` and `+5` while its passing rows total `9/10` and `+6`, and H04 lacks a
  candidate disposition. The complete report is retained at
  `.maestro/playbooks/Product-Quality/Working/evidence/pq-2026-08-26-02/cross-brain-verdict.md`;
  the scorecard records the disposition without self-approving the candidate.

- [ ] **Close the cycle, retain only a proven improvement, and prepare the next
  reset.** Re-read the candidate diff, verification evidence, and reviewer
  verdict. Keep only a `KEEP` candidate with positive targeted delta, no hard
  gate regression, no unresolved high-severity reviewer finding, and a green
  `pnpm gate`. For `REWORK`, leave a precise bounded next-cycle input and do not
  claim the current target passed. For `REVERT`, restore only this cycle's
  explicitly inventoried patch by a recoverable narrow method and re-run the
  prior focused proof; never use broad git cleanup. Update every affected
  scorecard row, ordered gap, evidence hash/path, command result, lane streak,
  and keep/rework/revert decision. Confirm unrelated work is unchanged and scan
  retained artifacts for secrets. If all three lanes meet the fixed bar, write
  `docs/quality/SCENEAXI-PRODUCT-QUALITY-COMPLETE.md` with the exact candidate
  identity and evidence, and make later reset iterations evidence-only no-ops.
  Otherwise name exactly one next highest-impact gap. If the same blocker
  survives three consecutive evidence-backed cycles, add Maestro's documented
  halt marker with the reason "repeated evidence-backed SceneAxi quality
  blocker" to this document, leave this task unchecked, and stop for operator
  direction.

**Cycle 00001 closure note (2026-08-26):** The independent verdict remains
`REWORK`, so the candidate is explicitly unkept and the selected target is not
claimed as passed. The scorecard now records the corrected Engine/runtime
candidate score `9/10` (`+6` over `3/10`) and an explicit H04 `FAIL`: E05
remains failing because `test:golden` omits four documented golden files, while
Websites and Graphics remain `0/10 U`; all three lane kept streaks remain `0`.
The exact retained proof paths, candidate diff hash, reviewer hash, final
identity, unchanged-work check, and secret scan are recorded under
`.maestro/playbooks/Product-Quality/Working/evidence/pq-2026-08-26-02/`.
The single next reset input is `AUDIT-AUTHORING-ROOT-ESCAPE` (P0), bounded to
current-HEAD containment proof in the authoring-core implementation and
transaction-history test. No commit or push was performed because this loop
does not authorize either operation.
