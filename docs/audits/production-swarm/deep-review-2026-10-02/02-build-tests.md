# 02 — Build, focused visual tests, checker policy

**Verdict: FAIL. Neither the narrow PR-with-verified-visual-improvements acceptance nor broader production/100%-locally-achievable acceptance is established.** This review covers build/checker and selected regression evidence, not all product requirements. No percentage is assigned.

## Artifacts and method

- Application cwd for every command: `/home/devuser/Documents/Projects/sceneaxi`.
- Published PR: https://github.com/Vhailors/sceneaxi/pull/312, OPEN; created `2026-10-01T21:40:09Z`; live head `346933c105305224d575bf9319256301c1eeabfa`, base `dd77cc9cb91d24091082e0c5bc20a130f0f51ffc`.
- Current worktree: HEAD `4e532e2fbf43e9948741578ab6208a3277870405`, captured `2026-10-02T06:55:41.433365+00:00`, 440 initial porcelain status lines. Tracked binary diff SHA-256: `7686a9652ddc4b1d5349d0c91c0d117d94f9532f42c17c536b28b4780e41b55b`. This fingerprint is not a commit SHA or a complete hash of untracked contents. Initial status is retained in `02-build-tests-artifact.json`.
- Fresh serial root build; no other full builds. One requested three-file Vitest invocation. Four isolated no-emit site typechecks, incremental output disabled. Independent anti-slop stage. Six shell tool invocations, each <=120s; captured subprocess return codes, not pipe/tail exit statuses. Logs retain full subprocess output even where the display was bounded.
- Product/config/source and git state were not edited. Writes are this numbered report and its numbered evidence only; compiler-generated output is permitted. Previously cached source/instruction files were not re-read on retry. Remote git diffs/tree existence, live checks, and own evidence were inspected.

## Top five findings

### 1. FAIL / P0 — Published artifact has no green executed CI jobs

**Expectation:** The exact published artifact passes owning required checks, including gate and site builds. **Observed:** Live `gh pr view 312` and `gh pr checks 312` show **9 FAILURE, 2 SKIPPED, 0 SUCCESS**. Gate fails in `pnpm docs:api` with `ENOENT` opening `packages/schemas/package.json`, at `scripts/docs-api.mjs:55`, before `pnpm gate` executes. Site/Kids jobs fail typechecking with missing root project references, e.g. `packages/schemas` and `packages/engine-kernel`. These are remote artifact failures, not the current local unknown-input errors.

**Evidence:** https://github.com/Vhailors/sceneaxi/actions/runs/36931652198/job/110602099368; `02-build-tests-remote-failed.log:701-727`; live check URLs in `02-build-tests-remote-checks.log`; exact head above. **Status:** Reproduced/refutes current-PR-green and production-ready claims. **Fix/acceptance:** Publish a complete intended tree preserving required manifests/projects/checkers; on that new exact head rerun all required CI and obtain successful owning checks. No CI result may be borrowed from the dirty worktree or older 4513-test/544-file artifact.

### 2. FAIL / P1 — Current root build exits 1 on incompatible typed boundaries

**Expectation:** `pnpm -s build` succeeds on the reviewed current worktree. **Observed:** Exit **1**, including `desktop/linux/src/lib/desktop-scene.ts:297:57` and `tests/e2e/asset-pipeline-golden.test.ts:162:59` unknown→JsonValue; `tests/sites/kids-surface.test.ts:214:39` unknown→KidsActivityInput; `tests/sites/provider-adapters.test.ts:108,143,154,189,190,227,264,1437` SqlValue/SqlRow and ProviderFetch incompatibilities. Example diagnostic: `Argument of type 'unknown' is not assignable to parameter of type 'JsonValue'.`

**Evidence:** `02-build-tests-build.log` and `02-build-tests-build-exit.json`. **Status:** Reproduced/refutes current-build-green. **Fix/acceptance:** Narrow/decode unknown values at real input boundaries and update typed fixtures/adapter responses without unsafe casts or weakened contracts; rerun root build to exit 0, then the complete gate. **`pnpm gate` was deliberately not run because the assigned build prerequisite failed**; this is missing gate verification, not a passing gate.

### 3. FAIL / P1 — Both current catalog site typechecks fail independently

**Expectation:** Each site's declared TypeScript project checks cleanly. **Observed:** `pnpm exec tsc --noEmit --incremental false -p <absolute-site-tsconfig>` exits **2** for catalog-game and catalog-web. Each reports TS2345 at `sites/catalog-{game,web}/src/app/page.tsx:115:106,117:80,121:78`: `string | readonly string[] | undefined` cannot be passed to `string | string[] | undefined`. Umbrella and Kids typechecks exit **0** only on the current local artifact.

**Evidence:** Per-site `02-build-tests-*-typecheck.log` and `*-typecheck-exit.json`. **Status:** Reproduced/refutes all-sites-check-clean. **Fix/acceptance:** Make non-mutating query-value helpers accept readonly arrays (or construct a justified mutable copy), retaining undefined/scalar/array behavior; both isolated site typechecks must exit 0. Typecheck-only successes do not establish site production-build success; no extra full site builds were run.

### 4. FAIL / P1 — Current anti-slop checker remains massively red

**Expectation:** Applicable checker stage succeeds without disabling rules or replacing negative oracles. **Observed:** `pnpm -s lint:anti-slop` exits **1**, reporting **21 warnings and 16564 errors**, 772 files/115 rules. Representative source: `tests/e2e/desktop-physics-golden.test.ts:44` runtime typeof and unjustified assertion, plus assertion at line 47. Counts are checker diagnostics, not distinct independently confirmed product defects.

**Evidence:** `02-build-tests-antislop.log`, `02-build-tests-antislop-exit.json`, summary in `02-build-tests-stage-evidence.json`. **Status:** Reproduced/refutes an all-required-local-checkers-green conclusion. **Fix/acceptance:** Resolve owning diagnostics and reproduce checker exit 0 under the agreed policy; do not blanket-exclude tests, suppress failures, or weaken checks to manufacture green. A full eslint pass and full gate were not executed by this review.

### 5. FAIL / P1 — Local visual green cannot certify the PR's missing tests/checkers

**Expectation:** Visual regression safety and required check implementations belong to the exact PR tree and execute there. **Observed local bounded success:** One `pnpm exec vitest run tests/sites/umbrella-visual.test.ts apps/desktop-shell/test/visual-refinement.test.ts apps/web-shell/test/visual-postpr.test.ts` invocation exits **0**, **3 files / 95 tests** (80 umbrella, 11 desktop, 4 web). **Observed remote gap:** Exact `git cat-file -e 346933c…:<path>` confirms the desktop and web test files are **absent**; umbrella test exists. `scripts/check-contracts.mjs` and `scripts/check-contracts.test.mjs` are also absent, although PR package scripts still reference them. No browser/product front-door traversal was performed by this invocation; this green does not prove rendered visual improvement, no overflow, contrast, keyboard behavior, or platform launch safety.

**Evidence:** `02-build-tests-visual.log`, `02-build-tests-visual-exit.json`, exact PR-tree existence results in `02-build-tests-stage-evidence.json`. **Status:** Local focused-test failure hypothesis refuted; published visual-safety/all-required-check-coverage claim not established and fails full-goal acceptance. **Fix/acceptance:** Include preserved owning tests/checkers and subsequent visual changes in the intended PR tree; execute owning suites and real-front-door visual acceptance on that exact artifact, with before/after evidence. Historical or local test totals cannot substitute.

## Policy and skipped-stage accounting

**P2 / confirmed policy change, no unsupported intentional-bypass allegation:** PR and local diffs change `.oxlintrc.json:41-46` from unconditional `anti-slop/no-runtime-typeof: error` to `error` with `allowInTypeGuards: true`. This is a substantive exception, not mere JSON formatting; no claim that the old unconditional policy remains identical is supportable. This review does not assert that type-guard exceptions are inherently unsafe or that anyone intentionally bypassed historical checks. Acceptance requires explicit policy disposition and preserved positive/negative checker tests.

The base and PR `package.json` gate strings are **identical**: syntax → boundaries → contracts → traceability → sites → desktop → publish-ready → build → test → lint. `lint:anti-slop` is a separate script and is not in that gate string on either artifact; therefore its omission was **not newly introduced by this PR script diff**. CI's gate job ran checkout/setup/installs then failed docs generation; later check stages were unreachable, not proven successful and not demonstrated to have been intentionally removed. Workflow diff adds pinned actions/read-only contents permissions and a Kids build job; it does not demonstrate deletion of existing checker stages. Published absence of referenced script implementations still prevents meaningful completion.

**Coverage limits:** No whole-repo test rerun, no gate after failed build, no additional full builds, no browser run or install, no source-policy oracle rerun, no exhaustive API compatibility review, and no certification of every product goal. Older 4513/544 green is not evidence for either reviewed artifact. All necessary missing coverage remains a failed full-goal criterion, not 'pass with minor'.

## Evidence index

`02-build-tests.json` is the machine-readable verdict. `02-build-tests-artifact.json` stores initial local identity/status; `02-build-tests-build*`, `-visual*`, per-site `-typecheck*`, `-antislop*` store exact command diagnostics/exit codes; `-remote-pr.log`, `-remote-checks.log`, `-remote-failed.log` store live remote evidence; `-policy-pr-diff.log`, `-policy-local-diff.log`, and `-stage-evidence.json` store policy and stage/tree comparisons. All paths are relative to this report directory.
