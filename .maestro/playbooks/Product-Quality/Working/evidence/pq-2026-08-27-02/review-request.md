# Review request — SceneAxi Product Quality cycle pq-2026-08-27-02 (fourth round)

You are the independent read-only cross-brain reviewer for this cycle. Return
exactly one verdict: `KEEP`, `REWORK`, or `REVERT`, plus the single biggest
remaining gap. Do not modify, commit, push, deploy, publish, or spend anything.
Three prior review sessions returned REWORK; all verdicts and dispositions are
recorded below.

## Brief

`.maestro/playbooks/Product-Quality/Working/current-cycle.md` (cycle
`pq-2026-08-27-02`, iteration 00003, as amended through the third rework):
close P0 gap `AUDIT-PACKAGE-CATALOG-SHAPE` — a malformed project-controlled
catalog could throw through the privileged desktop bridge instead of returning
`PACKAGE_CATALOG_INVALID`. The final bundle:

1. `packages/schemas/src/desktop-scene-package.ts`: `parseScenePackageCatalog`
   validates the nested lock before any consumer iterates it — array lock,
   every entry matching the existing `ScenePackageLockEntry` shape (non-empty
   string packageId/version, sha256 digest, sourceLocator without `://`,
   string-only capabilities), and **unique packageIds** — else it returns
   `null`.
2. `desktop/linux/src/lib/desktop-scene.ts`: `packageCatalogFromData` now
   distinguishes key presence from value: an absent key returns an empty
   catalog, while any present value (`null`, malformed object, bad lock)
   flows to the parser and may return `null`. `inspectDesktopScenePackages`
   (explicit result union) returns the existing named
   `PACKAGE_CATALOG_INVALID` refusal when the catalog is null. Stage path
   already refused on null and keeps doing so via the same helper.
3. `desktop/linux/src/lib/bridge.ts`: `package-inspect` propagates that
   refusal through `commandTransaction(validated.command.id, bridgeRefuse(...))`;
   success payload unchanged (`"ok" in inspected && inspected.ok === false`
   discrimination because the success type has no `ok` field).
4. `tests/e2e/desktop-package-golden.test.ts`: two end-to-end cases —
   malformed `lock: "evil"` catalog refusing both inspect and install, and a
   present `scenePackages: null` refusing both while deleting the key restores
   the empty-catalog success default.

## Candidate identity

- Base HEAD `dff0833a4041bf7e7d0de897c8ee4c5130a2fc6c`; retained 00001 rework
  diff and 00002 KEPT authoring diff in worktree are out of scope here.
- Current candidate diff:
  `.maestro/playbooks/Product-Quality/Working/evidence/pq-2026-08-27-02/candidate-diff.patch`
  (SHA-256 `023afd8904a7e3edcb76ee22c67310fb58c4bcce375fe88ae77fe545af0cf1c0`)
  covering exactly the five files above.

### Prior verdicts and dispositions

1. First session **REWORK** (`01a04222-08b1-7233-91ba-c7100b7b4dea`): parser
   hardening alone left inspect silently emptying malformed catalogs. Fixed by
   items 2–4 plus golden case (`codex-verdict-raw.log`).
2. Second session **REWORK** (`01a0423c-fe85-70e3-809a-4fd203b5a8a0`): brief's
   uniqueness contract not enforced against hand-edited locks. Fixed: parser
   rejects duplicate packageIds; `[validEntry, validEntry]` + differing-digest
   schema cases added (`codex-verdict-2-raw.log`).
3. Third session **REWORK** (`01a04248-9735-73d3-8e81-c286d115226a`): present
   `scenePackages: null` still parsed as empty, succeeding on inspect despite
   the contract reserving empty for key absence. Fixed: null guard centralized
   in `packageCatalogFromData`; new golden case covers present-null refusal and
   absent-key default restore (`codex-verdict-3-raw.log`).

## Claimed proof (current candidate)

| Proof | Result | Evidence |
|---|---|---|
| Failing-first | With only the parser hunk stashed, the new malformed-lock schemas case failed against baseline behavior (1 failed / 4 passed); source restored byte-identical afterward | `focused-red.log`, `baseline.log` |
| Focused suites | schemas 5/5; schemas + desktop-package golden together 9/9 including malformed-catalog and present-null bridge cases | `focused-green.log` |
| Root `pnpm test` | Exit 0; 265 files / 3,955 tests, then process suite 40/40 | `proof-pnpm-test.log` |
| `pnpm test:golden` | Exit 0; 51 files / 448 tests | `proof-pnpm-test-golden.log` |
| `pnpm build` | Exit 0 | `proof-pnpm-build.log` |
| `pnpm gate` | Exit 0 dedicated run at current candidate state | `proof-pnpm-gate.log` |

## Review focus

1. Duplicate-ID policy: producer installs replace same-ID entries; producer
   output can never be duplicated; the parser refuses hand-edited duplicates.
2. Absent-vs-present semantics: absence defaults to empty; any present value
   must parse or refuse everywhere (inspect, stage/install).
3. False-reject risk: does stricter parsing reject anything the desktop tier
   legitimately produces today?
4. Refusal semantics end-to-end with no new refusal names or contract drift.
5. Test quality, denominator gaming, unrelated-work preservation.

Evidence folder: `.maestro/playbooks/Product-Quality/Working/evidence/pq-2026-08-27-02/`.
