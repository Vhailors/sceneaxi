# Serial integration / publication packets — PROPOSAL ONLY, NOT RUN

## Ownership and preconditions

Product source/config/test tree remains frozen for Astra/orun-3-09og. No source candidate commit/tree was supplied to this lane; neither dirty HEAD, the stale index nor an auxiliary source fingerprint constitutes an accepted candidate. Obtain explicit handoff from the serial integration owner (integration.md identifies bg-106) and independent exact-artifact verdict before changing product paths. This packet grants no staging/commit/push/merge authority. Do not import another draft PR merely because GitHub calls it mergeable.

## Packet A: complete native Git tree, not partial subtree API overlay

Under later **separate** publication authority use an isolated native Git checkout/index based on the freshly observed PR #312 head, not the shared index. Apply the approved complete source snapshot, retaining untouched base paths and real symlink/executable metadata; commit normally with hooks only when separately authorized. The update commit must descend from the existing published head so a normal fast-forward update is possible; current local HEAD is NOT its descendant. No force push, replace-subtree API builder, broad `git add .`, or shared-index reuse.

Proposed path-level changes are supplied as exact desired mode/blob records in `report.json` → `inventories.currentCheckout.entries`; review `comparisons.publishedToCheckout` (1,616 missing publication additions + 113 changed existing blobs at capture), rather than reconstructing from changed-path lists. This is a review input, not automatic approval of all untracked reports/assets. All base paths survive locally with identical modes; explicitly approve the base `docs/audits/surface-probe.json` rename/retention decision and every other deletion. The 826 base path-set omissions on PR are 825 deletions plus the source of one rename, not 826 semantic deletions.

Explicitly include these legitimate candidates after owner approval:
- `sites/umbrella/src/app/api/checkout/checkout-handler.ts` (untracked, imported by route.ts:5).
- Four `sites/{umbrella,catalog-game,catalog-web,kids}/src/app/globals.css`, `apps/desktop-shell/src/chrome.ts`, `apps/web-shell/src/inspector-app.ts`; desired blobs differ from published and remain recorded separately from screenshots.
- `docs/audits/production-swarm/finish-visual-postpr-{sites,desktop}.json` plus their explicitly reviewed evidence assets; neither JSON exists on published PR.
- Preserve restored `tests/e2e/{desktop-asset-import-order-golden,desktop-control-dispatch-real-bridge-golden,desktop-editor-command-forms-golden}.test.ts` and `tests/helpers/scoped-tmpdir.ts`. All exist locally, but the current index still omits all four: a plain commit of the existing index would lose them.
- Restore 25 lost package.json paths (20 product manifests, five fixtures; exact list in report), checker/export graph targets, and four executable modes. `.bb/skills/verify-sceneaxi/{check,verify}`, `apps/desktop-shell/bin/sceneaxi-desktop.mjs`, `scripts/check-traceability.mjs` must retain 100755. Do not edit harness contents.

## Packet B: read-only exact-candidate acceptance

After owner supplies existing immutable candidate ref, run (no fetch or writes):

```sh
python3 docs/audits/production-swarm/capacity-work-2026-10-02/pr-ready/compare_trees.py --candidate "$CANDIDATE_SHA" --github
# Expected tool exit is 2: publication remains externally gated.
# Inspect checkoutToCandidate: every array must be empty unless explicitly approved.
git merge-base --is-ancestor 346933c105305224d575bf9319256301c1eeabfa "$CANDIDATE_SHA"
```

Compare full path/blob/type/mode inventory, not just count. Require no snapshotErrors; pin report SHA256; reconcile excluded capacity-work auxiliary scope explicitly if any of it is selected for publication. Git ignored build/install outputs are not the intended source tree. Native raw Git blobs intentionally avoid filters; check any later clean filters/EOL conversion against desired candidate bytes. The script detects per-file concurrent mutation, not atomic whole-checkout freezing: obtain owner freeze and repeat for matching fingerprints before approval.

## Packet C: heavy acceptance and safe PR update — NOT RUN

Only after Astra release, explicit heavy-job token and clean exact-candidate checkout with already authorized dependencies: run unchanged `pnpm gate`; owning four production site builds/typechecks; SDK/docs API generation and public import/export checks; native packaged and visual acceptance required by owning lanes. Heavy command entry point: `deferred-checks.sh` (defaults to refusal). No prior/dist/local green transfers to a new SHA. Read-only GitHub snapshot currently has 9 FAILURE / 2 SKIPPED / 0 SUCCESS; determine branch-required checks from authorized branch rules, not this rollup alone. Default-off native jobs are not proof of native success.

After explicit commit/push authority and independent acceptance, re-read remote PR head/base, ensure both still match the reviewed inputs, require candidate ancestry, then publication owner may perform a normal fast-forward update of existing PR #312. No merge requested or authorized. Re-query required CI on the new immutable head and require all mandatory checks; do not certify the old `346933c` results or label this auxiliary work as landed.

Open PR snapshot: #312 OPEN/MERGEABLE/BLOCKED; #311 draft/MERGEABLE/CLEAN; #310 draft/CONFLICTING/DIRTY; #309 OPEN/MERGEABLE/BLOCKED. Branch ownership, conflict resolution and duplicate/superseded scope decisions remain maintainers' decisions. No modifications or new PRs performed.
