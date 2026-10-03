# Repair baseline — 2026-10-02

**Control status: DONE_VERIFIED for inventory/routing invariants only. Candidate local completion: NOT VERIFIED. Published PR: FAIL. Full production: BLOCKED.**

## Artifact identity

Application root: `/home/devuser/Documents/Projects/sceneaxi`. Local branch `go-live-loop`, HEAD `4e532e2fbf43e9948741578ab6208a3277870405`. Initial line-count observation was 1001 status rows; the later full NUL-delimited source snapshot records **368 tracked-dirty paths and 634 untracked paths**, excluding only new control reports enumerated separately. Every inherited byte/path/mode must remain protected.

Current source inventory contains **1910 present paths**; complete inventory SHA-256 is `fe52317041b984c2cfd11976efdddf9efdcd38631a1c52ab8e01c70c27cde936`. This is a dirty-source inventory fingerprint, NOT a commit SHA or application test result. `artifact-inventory.json` retains every base/head/current path/blob/mode, index entry, untracked source/test/evidence path, current missing path and base executable.

Read-only live GitHub metadata still identifies OPEN PR [#312](https://github.com/Vhailors/sceneaxi/pull/312), head `346933c105305224d575bf9319256301c1eeabfa`, base `dd77cc9cb91d24091082e0c5bc20a130f0f51ffc`: **nine FAILURE, two SKIPPED, zero successful checks**. `remote-pr.json` and `remote-checks.json` retain exact commands, timestamps, exits and check links. Their command exit 0 means metadata retrieval succeeded, not CI success.

Native `git ls-tree -rz` and `git diff --name-status` freshly reproduce **1101 base files → 456 published files; D825/M204/A180/R1; executable paths four → zero**. Current source retains all four executables. The 826 base paths missing from the old head include the old side of one rename; that is not 826 deletions. No trees were rebuilt or Git objects/index written.

## Reconciled ledger and owners

`ledger.json` has **355 distinct accounting records**, not 355 independent defects: all **113 originals**, 194 additional historical/supplemental mappings, four new supplemental findings, 40 numbered findings across the eight deep-review reports, and four final additional findings. Every record retains exact provenance, source targets/symbols/hashes, primary task owner, source-owner dependencies, a nonblank executable command/assertions and reviewed artifact identity. All seven scoped machine reports plus final machine report are parsed and fingerprinted; finish evidence is retained without inheriting its DONE claims. No pre-existing newrepair assignment packet was found; this directory was initially absent.

All **53 originals without finish rows** are exclusively assigned to missing-capabilities as primary task coordinator, with exact cross-lane source dependencies. Local tasks are not parked under older authority/signing labels. The planning ledger starts with **320 NEEDS_LOCAL_FIX**, **22 EXTERNAL_BLOCKER with exact input**, **13 INTENTIONAL_FULL_PRODUCTION_GAP**; no application task receives new DONE from this node. These categories are not a completion percentage.

Eight disjoint source lanes and **20 one-level child packets** are in `assignments.json`, `ownership.json` and `assignments/*.md`. Requested implementer/reviewer models are Sol 6.1/Astra, standard tier; actual model dispatch is not attested here. Parents coordinate cross-file acceptance and cannot write delegated child files before explicit completion handoff. Do not duplicate live builders or spawn grandchildren.

Security-delivery exclusively owns ALL dependency manifests/lockfiles/workflows. Serial integration owns shared schemas/index, root configs/exports/tests and existing owning docs. Other report directories are READ ONLY. Per-lane fix reports live only in this repair directory. Shared code requests are dependencies, not overlapping source grants.

## Unapproved deletions — serial action required

Restore these paths or obtain explicit per-path deletion approval; none is approved by this node:

- `tests/e2e/desktop-asset-import-order-golden.test.ts`
- `tests/e2e/desktop-control-dispatch-real-bridge-golden.test.ts`
- `tests/e2e/desktop-editor-command-forms-golden.test.ts`
- `tests/helpers/scoped-tmpdir.ts`

Retain every legitimate untracked checkout handler, visual implementation, test and evidence asset. Other untracked paths are inventoried for explicit serial review; inventory does not silently authorize secrets/generated-artifact publication. Preserve untouched paths and executable modes.

## Verification, failures and resource policy

Executed from the real root: `python3 docs/audits/production-swarm/repair-review-2026-10-02/prepare-baseline.py` and `python3 docs/audits/production-swarm/repair-review-2026-10-02/complete-baseline.py`, final exits **0**. Verified all 113/53 mappings, nonblank acceptance, unique lane/child ownership, manifests precedence, historical external/intentional inputs, complete native-Git counts and unchanged source snapshot bytes. `verification.json` retains assertions. Initial string-form final-finding normalization failed with `AttributeError`; corrected without dropping records. A shell-filtered counting attempt failed with `IndexError`; direct subprocess Git output now asserts exact counts. Failures remain in `baseline.json`.

**Application root build/gate, focused source suites, production-site builds, browser/native/provider acceptance were NOT executed by this control node.** Deep-review current-build FAIL is dated input, not a freshly rerun result. Historical 4513/4297/other green counts certify neither current dirty source nor published PR. Root/site builds and whole gate remain serial-integration-owned.

Parent resource input: 12 logical CPUs, 5233 MiB available RAM, 49523 MiB swap used. At most **one heavy build/browser/native packaging process** graph-wide. Static research/code can fan out; focused test admission remains resource-controlled. No fixture copies, servers, containers, installs, provider calls or temporary resources were created. No stage/commit/push/post/merge/deploy/sign/spend/account/production-DB action occurred.

## Handoff

`DECISIONS.md` records safety, compatibility, capacity, actual visual acceptance and three-pass Astra criteria. Source repair loops are at pass zero, not executed; maximum three passes each. After failure exhaustion retain NEEDS_LOCAL_FIX. Serial integration must reconcile per-node/per-task actual oracles and write `FINAL.md`/`FINAL.json`. Serial publication alone may correct existing PR #312 using checked native descendant commits and fast-forward pushes under prior authorization, then obtain Astra judgment on the exact published SHA and mandatory CI. No force or changed-subtree API builders, bypassed checks, merge/deploy or new monetary authorization.

Baseline/decisions/ledger/inventory/assignment ownership is released to serial integration on completion. Missing-capabilities may expand acceptance without weakening canonical assertions. Genuine provider/DB operations/legal/signing/hardware/held-key inputs remain separately specified; intentional exclusions remain full-production gaps, never full-goal closure.
