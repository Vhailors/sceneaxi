# Docs/checkpoints semantic reconciliation

Status: **PREPARED_GIT_OBJECT_MAP_UNPUBLISHED_COMPARISON_PENDING**. Analysis and integration proposals only; no source/config/index/ref/stage/push/merge/commit/protection changes.

Fixed main: `c202bfcbf3e93f5414596e7fc0fbec5d51d82a16`. Published `346933c105305224d575bf9319256301c1eeabfa` is malformed/non-authoritative, NOT the current local candidate. Latest shared work is uncommitted over `4e532e2fbf43e9948741578ab6208a3277870405`; no repaired immutable candidate exists. No foreign physical worktree inspected.

## Conclusions

- **Do not no-op merge maintenance.** Of78 changed paths,54 contain genuine unincorporated source/test/design/media deltas on main;22 are zero-byte regular-file environment placeholders;2 root manifests already match source exactly. Every substantive main path equals its pre-feature parent blob (or its pre-addition absence). This is exact path evidence, not a no-ancestry inference or blanket claim that no alternative implementation exists elsewhere.
- Six unique commits and85 family paths are individually mapped in `report.json`, with source/main/malformed snapshot blobs/modes, origin commit membership, source SHA256, source Git-blob line symbols, all diff hunk ranges, imports/resolution and acceptance criteria. The four captured family tips and all preservation refs remain recorded.
- All six commits are `git cherry` plus against fixed main: no whole-commit patch equivalence. That does not contradict exact-file equivalence for package.json, pnpm-lock.yaml and the two playbook symlinks.
- Cloud/audit work is documentation and historical status, not toolchain/runtime implementation or current authorization. Keep canonical AGENTS and current completed audit state. Preserve historical versions through eventual ancestry plus these supersession receipts. No ancestry integration has occurred here.
- Static four-PNG output SHA256/size/IHDR verification passed. Historical screenshots are not current live browser/native/CI evidence. No tests, builds, installs, browser/native/Docker/provider or live CI executed.

## Commit DAG and explicit dispositions

| Commit | Parent / dependency | Disposition |
|---|---|---|
| `1d2fe8aa089772c87271580deb158d87dd68cb64` | `dfe31d9718311e22cbb9998758544163e24f30e5`; base `dfe31d9718311e22cbb9998758544163e24f30e5` | Cloud docs proposal, canonical AGENTS retained |
| `89c7aa5e9fbaa7e31b9c7e879841684651426d07` | `6c0e44af9be207c46f287a8acfbac323ca5fd4a3`; base `9873ea3bd5f012c4b84ceccca60739ec5111d9d1` | Historical documentation retained through future ancestry with explicit supersession |
| `6c0e44af9be207c46f287a8acfbac323ca5fd4a3` | `9873ea3bd5f012c4b84ceccca60739ec5111d9d1`; base `9873ea3bd5f012c4b84ceccca60739ec5111d9d1` | Historical documentation retained through future ancestry with explicit supersession |
| `94a4503050def7641f78faa24ae756497ceb3292` | `89c7aa5e9fbaa7e31b9c7e879841684651426d07`; base `9873ea3bd5f012c4b84ceccca60739ec5111d9d1` | Historical documentation retained through future ancestry with explicit supersession |
| `23413eb7889ad2cdb41ab8d729c32c7512917394` | `4e669cc39766bbd4b24c25ee64bdae8aedc24564`; base `dd77cc9cb91d24091082e0c5bc20a130f0f51ffc` | Missing implementation packet; not no-op history |
| `4e669cc39766bbd4b24c25ee64bdae8aedc24564` | `dd77cc9cb91d24091082e0c5bc20a130f0f51ffc`; base `dd77cc9cb91d24091082e0c5bc20a130f0f51ffc` | Missing implementation packet; not no-op history |

Audit frontier94a45030 includes89c7aa5e and6c0e44af; no separate duplicate merge is needed to preserve their ancestry. Maintenance23413eb7 includes motion4e669cc3. Cloud is independent. Source merge preview conflicts are1 cloud /4 audit /0 maintenance, not semantic acceptance. Exact preview trees remain in JSON.

## Historical audit supersession receipts

- `AGENTS.md:87-91 delegates ownership map to docs/agents/layout.md; keep canonical rules.`
- `package.json:7 pnpm@12.6.0; package.json:23-24 traceability already in unchanged quality gate.`
- `.maestro/playbooks/Initiation/Phase-02-Executable-Spec-Traceability-Audit.md:7-141 later all8 tasks checked; source94a45030 only first task checked.`
- `docs/audits/initiation/Initiation-Audit.md:58-124 keeps old baseline historical and adds later handoff; :162 checker owner; :234-325 later audit/verification scope.`
- `docs/runnable-surfaces.md:39-50 binary/public open/startup mapping; :109 build prerequisite; :204 loopback explanation.`
- `sites/umbrella/package.json:19-21 build:sdk + prebuild/predev.`

Source audit records reference baseline `9873ea3bd5f012c4b84ceccca60739ec5111d9d1` and dated August26 Node24.14/pnpm9.15 observations; retain those observations as historical, never rewrite as current. The source phase-2 audit explicitly says it has not yet implemented requirement inventories/checker. Modern main already owns the later audit/checker.

Resolution by conflict path:

- `94a4503050def7641f78faa24ae756497ceb3292:.maestro/playbooks/Initiation/Phase-01-Trusted-Baseline-and-Live-Prototype.md:1-45`: **HISTORICAL_ALTERNATIVE_RETAIN_ANCESTRY_PROPOSED**. Preserve current completed checklist and immutable old evidence in history; no old unchecked state/live-CI claim or rules restored. Main blob `47da06f1db4c87a3f794e193277888f81ab92e47` / source `ba8885baccb4077fd3529a74bad93f1de3ebab26`; mode `100644`.
- `94a4503050def7641f78faa24ae756497ceb3292:.maestro/playbooks/Initiation/Phase-02-Executable-Spec-Traceability-Audit.md:1-58`: **HISTORICAL_ALTERNATIVE_RETAIN_ANCESTRY_PROPOSED**. Preserve current completed checklist and immutable old evidence in history; no old unchecked state/live-CI claim or rules restored. Main blob `b697b197419a2766e61b6163e2908ca0e3f3a352` / source `e78b6d6190f4b50857242d0cb3bad5a945627482`; mode `100644`.
- `94a4503050def7641f78faa24ae756497ceb3292:.maestro/playbooks/Initiation/Working/Phase-01/Baseline.md:1-75`: **HISTORICAL_ALTERNATIVE_RETAIN_ANCESTRY_PROPOSED**. Preserve current completed checklist and immutable old evidence in history; no old unchecked state/live-CI claim or rules restored. Main blob `b6c4748be26c47cb8441fe923db92573cc2f5c10` / source `bffa33d90753cfb8edd8cfa00f62ca206d8455df`; mode `100644`.
- `94a4503050def7641f78faa24ae756497ceb3292:.maestro/playbooks/Phase-01-Trusted-Baseline-and-Live-Prototype.md:1-1`: **INCORPORATED_UNCHANGED**. Keep exact canonical main file and mode; do not replay stale manifest/toolchain changes. Main blob `d16feeee37bd63a2875d467323689d6c5a31b21b` / source `d16feeee37bd63a2875d467323689d6c5a31b21b`; mode `120000`.
- `94a4503050def7641f78faa24ae756497ceb3292:.maestro/playbooks/Phase-02-Executable-Spec-Traceability-Audit.md:1-1`: **INCORPORATED_UNCHANGED**. Keep exact canonical main file and mode; do not replay stale manifest/toolchain changes. Main blob `69b210b4a34e216b6593f9fa5fc14d05ff303611` / source `69b210b4a34e216b6593f9fa5fc14d05ff303611`; mode `120000`.
- `94a4503050def7641f78faa24ae756497ceb3292:docs/audits/initiation/Initiation-Audit.md:1-156`: **HISTORICAL_ALTERNATIVE_RETAIN_ANCESTRY_PROPOSED**. Preserve current completed checklist and immutable old evidence in history; no old unchecked state/live-CI claim or rules restored. Main blob `9c0392ad282405425d2e8cf0bae46c1e72c91eee` / source `800e6e01c7b407883009e7ab9ed9431a7755065e`; mode `100644`.

## Cloud notes: proposal only; do not edit AGENTS/CLAUDE rules

Source `1d2fe8aa089772c87271580deb158d87dd68cb64:AGENTS.md:623-657` appends Cloud startup/root-install notes. Main AGENTS:87,91 deliberately delegates ownership detail and stays short. Preserve that canonical file exactly. Proposed non-authoritative destination: `docs/agents/cloud-environment.md` (not created here).

Retain useful notes: independent install roots; build compiled binaries first; project documents contained by authoritative --cwd; loopback web-shell; umbrella SDK predev/prebuild; anonymous /open versus entitled editor/provider refusal. Link canonical runnable-surfaces, authoring-contracts and websites-deploy instead of copying authority. Modern main proofs: runnable-surfaces:39-50,109,204 and umbrella/package.json:19-21.

**Do not copy** old pnpm9.15 or preinstalled-runtime/default-root claims as current facts: main package.json:7 pins12.6.0. Current Cloud startup script/default installations require environment-owner confirmation. Notes confer no permission to install, use preview flags, deploy, spend, enable Kids/LIVE or run held proof programs.

## Ordered integration packets (not applied)

### P0 — historical-audit
Dependencies: none. Source `94a4503050def7641f78faa24ae756497ceb3292`.
Retain later main audit/playbooks. Carry historical94a45030 ancestry (which includes89c7aa5e and6c0e44af) only with explicit four-path supersession receipts; preserve both120000 symlinks already exact.

- Current completed tasks remain completed as historical records, not fresh CI.
- Source precedence and held authority boundaries remain unchanged.
- Do not restore stale audit inventory42contracts/15packages or unchecked task statuses.

### P1 — cloud-environment
Dependencies: P0. Source `1d2fe8aa089772c87271580deb158d87dd68cb64`.
Keep canonical AGENTS byte-for-byte; migrate useful cloud notes into separately reviewed docs proposal, not rules. Keep source ancestry.

- Main AGENTS.md:87,91 ownership pointers preserved.
- Current package.json:7 pnpm12.6.0 wins over old9.15 claim.
- No current cloud provisioning/default-install assertion absent environment owner confirmation.

### P2 — motion-foundation
Dependencies: none. Source `4e669cc39766bbd4b24c25ee64bdae8aedc24564`.
Port three motion commit paths as one unit with exact existing CSS generator API, then rebase onto latest shared candidate.

- FOUNDATION_MOTION values 120ms/200ms/cubic-bezier(0.2,0,0,1).
- foundationsVariablesCss emits three vars for every surface.
- Existing palette/contrast/freeze/public API behavior unchanged.
- Exact binary-capable source delta receipt: `/home/devuser/Documents/SceneAxi/.empryo/merge-analysis/sceneaxi-comprehensive-2026-10-02/docs-checkpoints/P2.bounded-source-delta.receipt.txt`. Receipt is not an apply instruction; rebase into latest candidate first.

### P3 — proof-media
Dependencies: P2. Source `23413eb7889ad2cdb41ab8d729c32c7512917394`.
Add four original PNG blobs, MEDIA-PROVENANCE and ProofMedia/PROOF_MEDIA together. Do not execute prose reproduction script.

- Each output SHA256/size/IHDR exactly verified in report.json.
- Historical date/developer/software/Linux/partial labels kept; no current native proof claimed.
- Crop-source originals not inspected; owner export needed if independent crop validation required.
- Exact binary-capable source delta receipt: `/home/devuser/Documents/SceneAxi/.empryo/merge-analysis/sceneaxi-comprehensive-2026-10-02/docs-checkpoints/P3.bounded-source-delta.receipt.txt`. Receipt is not an apply instruction; rebase into latest candidate first.

### P4 — catalog-redesign
Dependencies: P2. Source `23413eb7889ad2cdb41ab8d729c32c7512917394`.
Port both15-path storefront sets together; merge current local commerce/pipeline changes rather than whole-file replacement. Add StoreNav/PublishSlot, compatible DigestFigure/ListingTile adapters before changed consumers.

- Every row acceptance from report.json applies.
- Existing listSiteCatalog/current local artifact payload/source and checkout/refusal security retained.
- Both independent install roots keep identity prefix and common CSS skeleton; reduced motion/contrast/focus/mobile behavior covered.
- Source tests lack dedicated new nav/slot/variant behavioral coverage: add those assertions, do not infer passing from existing tests.
- Exact binary-capable source delta receipt: `/home/devuser/Documents/SceneAxi/.empryo/merge-analysis/sceneaxi-comprehensive-2026-10-02/docs-checkpoints/P4.bounded-source-delta.receipt.txt`. Receipt is not an apply instruction; rebase into latest candidate first.

### P5 — umbrella-redesign
Dependencies: P2, P3. Source `23413eb7889ad2cdb41ab8d729c32c7512917394`.
Port ProofFigure first, then home/engine, hero pending state, docs rails and remaining layout-only routes. Preserve latest host/controller/security/pricing changes during rebase.

- No overwrite of modern /open host/runtime, auth/checkout controls or profile/Kids restrictions.
- Historical gallery images are not current live-frame proof.
- Source tests retain caption limitations, matrix/refusal data and all navigation targets.
- Exact binary-capable source delta receipt: `/home/devuser/Documents/SceneAxi/.empryo/merge-analysis/sceneaxi-comprehensive-2026-10-02/docs-checkpoints/P5.bounded-source-delta.receipt.txt`. Receipt is not an apply instruction; rebase into latest candidate first.

### P6 — redesign-tests
Dependencies: P4, P5. Source `23413eb7889ad2cdb41ab8d729c32c7512917394`.
Union all new source/contrast/media/motion/browser assertions with modern suites, retaining existing negative/security/current-runtime coverage.

- packages/site-kit/test/design-tokens.test.ts
- tests/sites/catalog-storefronts.test.ts
- tests/sites/umbrella-visual.test.ts
- sites/umbrella/test/first-release.visual.spec.ts
- No test run here; future scoped root/site verification plus browser/native layers require separate execution permission.
- Exact binary-capable source delta receipt: `/home/devuser/Documents/SceneAxi/.empryo/merge-analysis/sceneaxi-comprehensive-2026-10-02/docs-checkpoints/P6.bounded-source-delta.receipt.txt`. Receipt is not an apply instruction; rebase into latest candidate first.

### P7 — empty-environment-placeholders
Dependencies: P6. Source `23413eb7889ad2cdb41ab8d729c32c7512917394`.
Explicitly retain22 empty100644 placeholders only in original history; omit active tree restoration after reviewer acknowledgment. Keep two exact root manifests unchanged. No no-op maintenance merge until54 substantive paths resolved.

- All original commits reachable through eventual accepted merge ancestry.
- Each original path has source/main/candidate mode/blob + explicit disposition; no accidental deletes.
- No activating .claude, shell startup, gitconfig or skills from checkpoint.

## Maintenance exact per-path semantic/acceptance map

All rows below use source `23413eb7889ad2cdb41ab8d729c32c7512917394`; motion rows originate in `4e669cc39766bbd4b24c25ee64bdae8aedc24564`. Main is `c202bfcbf3e93f5414596e7fc0fbec5d51d82a16`. Every row also has exact blobs/modes/hash/hunks in JSON. No current local equivalence is inferred from malformed published snapshot.

### `.bash_profile:1`
**EMPTY_PLACEHOLDER_NOT_RUNTIME** → HISTORICAL_ALTERNATIVE_RETAIN_ANCESTRY_PROPOSED (empty-environment-placeholders); mode `100644`.
Zero-byte regular100644 placeholder; no executable code, settings, symlink or submodule content.
Acceptance: Retain exact object through eventual maintenance ancestry; explicitly do not activate/install dot/harness files. Owner export required for any claimed intended nonempty local counterpart.
Exact source blob `e69de29bb2d1d6434b8b29ae775ad8c2e48c5391`; main `ABSENT`; main equals pre-feature parent: `True`.

### `.bashrc:1`
**EMPTY_PLACEHOLDER_NOT_RUNTIME** → HISTORICAL_ALTERNATIVE_RETAIN_ANCESTRY_PROPOSED (empty-environment-placeholders); mode `100644`.
Zero-byte regular100644 placeholder; no executable code, settings, symlink or submodule content.
Acceptance: Retain exact object through eventual maintenance ancestry; explicitly do not activate/install dot/harness files. Owner export required for any claimed intended nonempty local counterpart.
Exact source blob `e69de29bb2d1d6434b8b29ae775ad8c2e48c5391`; main `ABSENT`; main equals pre-feature parent: `True`.

### `.claude/agents:1`
**EMPTY_PLACEHOLDER_NOT_RUNTIME** → HISTORICAL_ALTERNATIVE_RETAIN_ANCESTRY_PROPOSED (empty-environment-placeholders); mode `100644`.
Zero-byte regular100644 placeholder; no executable code, settings, symlink or submodule content.
Acceptance: Retain exact object through eventual maintenance ancestry; explicitly do not activate/install dot/harness files. Owner export required for any claimed intended nonempty local counterpart.
Exact source blob `e69de29bb2d1d6434b8b29ae775ad8c2e48c5391`; main `ABSENT`; main equals pre-feature parent: `True`.

### `.claude/commands:1`
**EMPTY_PLACEHOLDER_NOT_RUNTIME** → HISTORICAL_ALTERNATIVE_RETAIN_ANCESTRY_PROPOSED (empty-environment-placeholders); mode `100644`.
Zero-byte regular100644 placeholder; no executable code, settings, symlink or submodule content.
Acceptance: Retain exact object through eventual maintenance ancestry; explicitly do not activate/install dot/harness files. Owner export required for any claimed intended nonempty local counterpart.
Exact source blob `e69de29bb2d1d6434b8b29ae775ad8c2e48c5391`; main `ABSENT`; main equals pre-feature parent: `True`.

### `.claude/hooks:1`
**EMPTY_PLACEHOLDER_NOT_RUNTIME** → HISTORICAL_ALTERNATIVE_RETAIN_ANCESTRY_PROPOSED (empty-environment-placeholders); mode `100644`.
Zero-byte regular100644 placeholder; no executable code, settings, symlink or submodule content.
Acceptance: Retain exact object through eventual maintenance ancestry; explicitly do not activate/install dot/harness files. Owner export required for any claimed intended nonempty local counterpart.
Exact source blob `e69de29bb2d1d6434b8b29ae775ad8c2e48c5391`; main `ABSENT`; main equals pre-feature parent: `True`.

### `.claude/launch.json:1`
**EMPTY_PLACEHOLDER_NOT_RUNTIME** → HISTORICAL_ALTERNATIVE_RETAIN_ANCESTRY_PROPOSED (empty-environment-placeholders); mode `100644`.
Zero-byte regular100644 placeholder; no executable code, settings, symlink or submodule content.
Acceptance: Retain exact object through eventual maintenance ancestry; explicitly do not activate/install dot/harness files. Owner export required for any claimed intended nonempty local counterpart.
Exact source blob `e69de29bb2d1d6434b8b29ae775ad8c2e48c5391`; main `ABSENT`; main equals pre-feature parent: `True`.

### `.claude/loop.md:1`
**EMPTY_PLACEHOLDER_NOT_RUNTIME** → HISTORICAL_ALTERNATIVE_RETAIN_ANCESTRY_PROPOSED (empty-environment-placeholders); mode `100644`.
Zero-byte regular100644 placeholder; no executable code, settings, symlink or submodule content.
Acceptance: Retain exact object through eventual maintenance ancestry; explicitly do not activate/install dot/harness files. Owner export required for any claimed intended nonempty local counterpart.
Exact source blob `e69de29bb2d1d6434b8b29ae775ad8c2e48c5391`; main `ABSENT`; main equals pre-feature parent: `True`.

### `.claude/output-styles:1`
**EMPTY_PLACEHOLDER_NOT_RUNTIME** → HISTORICAL_ALTERNATIVE_RETAIN_ANCESTRY_PROPOSED (empty-environment-placeholders); mode `100644`.
Zero-byte regular100644 placeholder; no executable code, settings, symlink or submodule content.
Acceptance: Retain exact object through eventual maintenance ancestry; explicitly do not activate/install dot/harness files. Owner export required for any claimed intended nonempty local counterpart.
Exact source blob `e69de29bb2d1d6434b8b29ae775ad8c2e48c5391`; main `ABSENT`; main equals pre-feature parent: `True`.

### `.claude/routines:1`
**EMPTY_PLACEHOLDER_NOT_RUNTIME** → HISTORICAL_ALTERNATIVE_RETAIN_ANCESTRY_PROPOSED (empty-environment-placeholders); mode `100644`.
Zero-byte regular100644 placeholder; no executable code, settings, symlink or submodule content.
Acceptance: Retain exact object through eventual maintenance ancestry; explicitly do not activate/install dot/harness files. Owner export required for any claimed intended nonempty local counterpart.
Exact source blob `e69de29bb2d1d6434b8b29ae775ad8c2e48c5391`; main `ABSENT`; main equals pre-feature parent: `True`.

### `.claude/scheduled_tasks.json:1`
**EMPTY_PLACEHOLDER_NOT_RUNTIME** → HISTORICAL_ALTERNATIVE_RETAIN_ANCESTRY_PROPOSED (empty-environment-placeholders); mode `100644`.
Zero-byte regular100644 placeholder; no executable code, settings, symlink or submodule content.
Acceptance: Retain exact object through eventual maintenance ancestry; explicitly do not activate/install dot/harness files. Owner export required for any claimed intended nonempty local counterpart.
Exact source blob `e69de29bb2d1d6434b8b29ae775ad8c2e48c5391`; main `ABSENT`; main equals pre-feature parent: `True`.

### `.claude/settings.json:1`
**EMPTY_PLACEHOLDER_NOT_RUNTIME** → HISTORICAL_ALTERNATIVE_RETAIN_ANCESTRY_PROPOSED (empty-environment-placeholders); mode `100644`.
Zero-byte regular100644 placeholder; no executable code, settings, symlink or submodule content.
Acceptance: Retain exact object through eventual maintenance ancestry; explicitly do not activate/install dot/harness files. Owner export required for any claimed intended nonempty local counterpart.
Exact source blob `e69de29bb2d1d6434b8b29ae775ad8c2e48c5391`; main `ABSENT`; main equals pre-feature parent: `True`.

### `.claude/skills:1`
**EMPTY_PLACEHOLDER_NOT_RUNTIME** → HISTORICAL_ALTERNATIVE_RETAIN_ANCESTRY_PROPOSED (empty-environment-placeholders); mode `100644`.
Zero-byte regular100644 placeholder; no executable code, settings, symlink or submodule content.
Acceptance: Retain exact object through eventual maintenance ancestry; explicitly do not activate/install dot/harness files. Owner export required for any claimed intended nonempty local counterpart.
Exact source blob `e69de29bb2d1d6434b8b29ae775ad8c2e48c5391`; main `ABSENT`; main equals pre-feature parent: `True`.

### `.claude/workflows:1`
**EMPTY_PLACEHOLDER_NOT_RUNTIME** → HISTORICAL_ALTERNATIVE_RETAIN_ANCESTRY_PROPOSED (empty-environment-placeholders); mode `100644`.
Zero-byte regular100644 placeholder; no executable code, settings, symlink or submodule content.
Acceptance: Retain exact object through eventual maintenance ancestry; explicitly do not activate/install dot/harness files. Owner export required for any claimed intended nonempty local counterpart.
Exact source blob `e69de29bb2d1d6434b8b29ae775ad8c2e48c5391`; main `ABSENT`; main equals pre-feature parent: `True`.

### `.gitconfig:1`
**EMPTY_PLACEHOLDER_NOT_RUNTIME** → HISTORICAL_ALTERNATIVE_RETAIN_ANCESTRY_PROPOSED (empty-environment-placeholders); mode `100644`.
Zero-byte regular100644 placeholder; no executable code, settings, symlink or submodule content.
Acceptance: Retain exact object through eventual maintenance ancestry; explicitly do not activate/install dot/harness files. Owner export required for any claimed intended nonempty local counterpart.
Exact source blob `e69de29bb2d1d6434b8b29ae775ad8c2e48c5391`; main `ABSENT`; main equals pre-feature parent: `True`.

### `.gitmodules:1`
**EMPTY_PLACEHOLDER_NOT_RUNTIME** → HISTORICAL_ALTERNATIVE_RETAIN_ANCESTRY_PROPOSED (empty-environment-placeholders); mode `100644`.
Zero-byte regular100644 placeholder; no executable code, settings, symlink or submodule content.
Acceptance: Retain exact object through eventual maintenance ancestry; explicitly do not activate/install dot/harness files. Owner export required for any claimed intended nonempty local counterpart.
Exact source blob `e69de29bb2d1d6434b8b29ae775ad8c2e48c5391`; main `ABSENT`; main equals pre-feature parent: `True`.

### `.idea:1`
**EMPTY_PLACEHOLDER_NOT_RUNTIME** → HISTORICAL_ALTERNATIVE_RETAIN_ANCESTRY_PROPOSED (empty-environment-placeholders); mode `100644`.
Zero-byte regular100644 placeholder; no executable code, settings, symlink or submodule content.
Acceptance: Retain exact object through eventual maintenance ancestry; explicitly do not activate/install dot/harness files. Owner export required for any claimed intended nonempty local counterpart.
Exact source blob `e69de29bb2d1d6434b8b29ae775ad8c2e48c5391`; main `ABSENT`; main equals pre-feature parent: `True`.

### `.mcp.json:1`
**EMPTY_PLACEHOLDER_NOT_RUNTIME** → HISTORICAL_ALTERNATIVE_RETAIN_ANCESTRY_PROPOSED (empty-environment-placeholders); mode `100644`.
Zero-byte regular100644 placeholder; no executable code, settings, symlink or submodule content.
Acceptance: Retain exact object through eventual maintenance ancestry; explicitly do not activate/install dot/harness files. Owner export required for any claimed intended nonempty local counterpart.
Exact source blob `e69de29bb2d1d6434b8b29ae775ad8c2e48c5391`; main `ABSENT`; main equals pre-feature parent: `True`.

### `.profile:1`
**EMPTY_PLACEHOLDER_NOT_RUNTIME** → HISTORICAL_ALTERNATIVE_RETAIN_ANCESTRY_PROPOSED (empty-environment-placeholders); mode `100644`.
Zero-byte regular100644 placeholder; no executable code, settings, symlink or submodule content.
Acceptance: Retain exact object through eventual maintenance ancestry; explicitly do not activate/install dot/harness files. Owner export required for any claimed intended nonempty local counterpart.
Exact source blob `e69de29bb2d1d6434b8b29ae775ad8c2e48c5391`; main `ABSENT`; main equals pre-feature parent: `True`.

### `.ripgreprc:1`
**EMPTY_PLACEHOLDER_NOT_RUNTIME** → HISTORICAL_ALTERNATIVE_RETAIN_ANCESTRY_PROPOSED (empty-environment-placeholders); mode `100644`.
Zero-byte regular100644 placeholder; no executable code, settings, symlink or submodule content.
Acceptance: Retain exact object through eventual maintenance ancestry; explicitly do not activate/install dot/harness files. Owner export required for any claimed intended nonempty local counterpart.
Exact source blob `e69de29bb2d1d6434b8b29ae775ad8c2e48c5391`; main `ABSENT`; main equals pre-feature parent: `True`.

### `.vscode:1`
**EMPTY_PLACEHOLDER_NOT_RUNTIME** → HISTORICAL_ALTERNATIVE_RETAIN_ANCESTRY_PROPOSED (empty-environment-placeholders); mode `100644`.
Zero-byte regular100644 placeholder; no executable code, settings, symlink or submodule content.
Acceptance: Retain exact object through eventual maintenance ancestry; explicitly do not activate/install dot/harness files. Owner export required for any claimed intended nonempty local counterpart.
Exact source blob `e69de29bb2d1d6434b8b29ae775ad8c2e48c5391`; main `ABSENT`; main equals pre-feature parent: `True`.

### `.zprofile:1`
**EMPTY_PLACEHOLDER_NOT_RUNTIME** → HISTORICAL_ALTERNATIVE_RETAIN_ANCESTRY_PROPOSED (empty-environment-placeholders); mode `100644`.
Zero-byte regular100644 placeholder; no executable code, settings, symlink or submodule content.
Acceptance: Retain exact object through eventual maintenance ancestry; explicitly do not activate/install dot/harness files. Owner export required for any claimed intended nonempty local counterpart.
Exact source blob `e69de29bb2d1d6434b8b29ae775ad8c2e48c5391`; main `ABSENT`; main equals pre-feature parent: `True`.

### `.zshrc:1`
**EMPTY_PLACEHOLDER_NOT_RUNTIME** → HISTORICAL_ALTERNATIVE_RETAIN_ANCESTRY_PROPOSED (empty-environment-placeholders); mode `100644`.
Zero-byte regular100644 placeholder; no executable code, settings, symlink or submodule content.
Acceptance: Retain exact object through eventual maintenance ancestry; explicitly do not activate/install dot/harness files. Owner export required for any claimed intended nonempty local counterpart.
Exact source blob `e69de29bb2d1d6434b8b29ae775ad8c2e48c5391`; main `ABSENT`; main equals pre-feature parent: `True`.

### `docs/design-foundations.md:76`
**MISSING_SOURCE_DELTA_ON_MAIN** → NEEDS_EXPLICIT_RESOLUTION (motion-foundation); mode `100644`.
D4 token timing/easing and transform caps; D5 neutral atmosphere luminance; D6 float media frame; D7 Unicode glyphs; recorded alternatives.
Acceptance: Port visual decision documentation with exact provenance; not captain authority, no changing Kids/canonical rules.
Exact source blob `7f662b204719636d251e8f7cf44dafcc2b9a4f9a`; main `af968e332509b3a7912e0377adf2a1aef048aecf`; main equals pre-feature parent: `True`.

### `package.json:1`
**INCORPORATED_UNCHANGED_BYTES_AND_MODE** → INCORPORATED_UNCHANGED (maintenance); mode `100644`.
Exact source/main blob and mode equality; separate nonancestor commit remains in preservation inventory.
Acceptance: Keep exact canonical main file and mode; do not replay stale manifest/toolchain changes.
Exact source blob `765ec55e98683ab5ab1c0691cc4edf417416615b`; main `765ec55e98683ab5ab1c0691cc4edf417416615b`; main equals pre-feature parent: `False`.

### `packages/site-kit/src/design-tokens.ts:27`
**MISSING_SOURCE_DELTA_ON_MAIN** → NEEDS_EXPLICIT_RESOLUTION (motion-foundation); mode `100644`.
Frozen motion-fast120ms, motion-base200ms, ease-standard cubic-bezier(0.2,0,0,1), emitted by existing public CSS generator.
Acceptance: Same 3 variables emitted for all surfaces; FOUNDATION_MOTION not root-reexported in source index.ts:334-371, so do not invent public export necessity; preserve existing frozen API.
Exact source blob `16e5ee2b9fcbcf073f588fdd7ca9bcb7b1803e2e`; main `92e425ac0277260d58f7a03f545518dd118b5c5a`; main equals pre-feature parent: `True`.

### `packages/site-kit/test/design-tokens.test.ts:37`
**MISSING_SOURCE_DELTA_ON_MAIN** → NEEDS_EXPLICIT_RESOLUTION (motion-foundation); mode `100644`.
D4 exact three-line emitted token assertions for variables CSS and all foundation surface CSS.
Acceptance: Run existing owning design-token test without weakening existing contrast/safety oracles.
Exact source blob `b1be0c43cb43f11fa39ba41c2fde792ef937d3e2`; main `820dd6a5fa66351c8019c5f2f561f2c554a64306`; main equals pre-feature parent: `True`.

### `pnpm-lock.yaml:1`
**INCORPORATED_UNCHANGED_BYTES_AND_MODE** → INCORPORATED_UNCHANGED (maintenance); mode `100644`.
Exact source/main blob and mode equality; separate nonancestor commit remains in preservation inventory.
Acceptance: Keep exact canonical main file and mode; do not replay stale manifest/toolchain changes.
Exact source blob `4be08523a9c0e16945782b76d105a438cdf8d930`; main `4be08523a9c0e16945782b76d105a438cdf8d930`; main equals pre-feature parent: `False`.

### `sites/catalog-game/src/app/_components/commerce-notice.tsx:26`
**MISSING_SOURCE_DELTA_ON_MAIN** → NEEDS_EXPLICIT_RESOLUTION (catalog-redesign); mode `100644`.
Reframe existing policy/explanation and mode/completion/viewer/registry into notice-facts dl; refusal/account data remains authoritative.
Acceptance: Assert all four facts including unresolved viewer reason and registry remain visible; no purchase enablement.
Exact source blob `a5ca9c56192dbd6306723f85f2a2ef7e15e2adbe`; main `8dca58f219d1a321ebaab45f528690261c1d3d47`; main equals pre-feature parent: `True`.

### `sites/catalog-game/src/app/_components/digest-figure.tsx:17`
**MISSING_SOURCE_DELTA_ON_MAIN** → NEEDS_EXPLICIT_RESOLUTION (catalog-redesign); mode `100644`.
Replace large boolean by card/lead/detail variant, explicit record-mark legend/chips/stats; no asset preview claim.
Acceptance: Keep old large caller adapter until full call-site proof; invalid digest draws no mark; all variants identify record not asset.
Exact source blob `8c0687c0384105bbbe50caa38a39f209b91b278b`; main `c0217b30a2b4d935b1da9609c3b37a4d1debc45a`; main equals pre-feature parent: `True`.

### `sites/catalog-game/src/app/_components/family-bar.tsx:15`
**MISSING_SOURCE_DELTA_ON_MAIN** → NEEDS_EXPLICIT_RESOLUTION (catalog-redesign); mode `100644`.
External sibling glyph only when resolved sibling anchor exists.
Acceptance: Missing deployment origin remains non-link; configured links retain correct origin and accessible text.
Exact source blob `b1f7f0b49e31051109753966ac11dda79a6b4e9c`; main `20c9142f20969f84716265d7d8cc3724b6945315`; main equals pre-feature parent: `True`.

### `sites/catalog-game/src/app/_components/listing-card.tsx:19`
**MISSING_SOURCE_DELTA_ON_MAIN** → NEEDS_EXPLICIT_RESOLUTION (catalog-redesign); mode `100644`.
Add reusable credit/money numeral/unit/alternative rendering and creator-share footer; compact still suppresses extra share text.
Acceptance: Credit-only/money-only/both/unpriced named reason; preserve authoritative share rounding and fixture availability.
Exact source blob `c7214aaa884966d17a3413f4b2ead0a75c7e3708`; main `aedd2ab0bd62ed5b2bc8cf6437719b57c7e8704e`; main equals pre-feature parent: `True`.

### `sites/catalog-game/src/app/_components/listing-tile.tsx:15`
**MISSING_SOURCE_DELTA_ON_MAIN** → NEEDS_EXPLICIT_RESOLUTION (catalog-redesign); mode `100644`.
Single lead record plate uses variant lead and shared ListingPrice rather than old hero tile.
Acceptance: Retain ListingTile compatibility export unless scoped import inventory proves safe removal; no invented listings.
Exact source blob `4fb82786e264cf2c3d5ea1afe63df5bfa95d1a37`; main `29690911ca24db28c770ce608ab1b76628d6d170`; main equals pre-feature parent: `True`.

### `sites/catalog-game/src/app/_components/publish-slot.tsx:11`
**MISSING_SOURCE_DELTA_ON_MAIN** → NEEDS_EXPLICIT_RESOLUTION (catalog-redesign); mode `100644`.
New honest final grid cell links publish rules, explicitly publishing not open; no price/digest/TEST listing impersonation.
Acceptance: Assert link /publish, unavailable copy and absent fake product metadata.
Exact source blob `941fbcd1e5921ed905dd10802fef2a3aa5aa3bb2`; main `ABSENT`; main equals pre-feature parent: `True`.

### `sites/catalog-game/src/app/_components/state-panel.tsx:11`
**MISSING_SOURCE_DELTA_ON_MAIN** → NEEDS_EXPLICIT_RESOLUTION (catalog-redesign); mode `100644`.
Move named reason to heading row before children; preserve site-kit status/heading semantics.
Acceptance: Refusal reason present exactly once, wraps accessibly; no status remapping.
Exact source blob `3a51ee21e9e4b9bcb2ef4f64d5874855a8960b05`; main `0c476303ff681ae22f663206daf7a98a0cabe025`; main equals pre-feature parent: `True`.

### `sites/catalog-game/src/app/_components/store-nav.tsx:19`
**MISSING_SOURCE_DELTA_ON_MAIN** → NEEDS_EXPLICIT_RESOLUTION (catalog-redesign); mode `100644`.
New usePathname client primary navigation with aria-current shared by visual marker; optional configured engine link.
Acceptance: Root+item descendants catalogue current; publish descendants publish current; unknown route neither; no-JS links remain usable; origin null omits engine.
Exact source blob `4387cce860ecfbf5b5cd153bbec46cf4f240c973`; main `ABSENT`; main equals pre-feature parent: `True`.

### `sites/catalog-game/src/app/_components/test-pipeline-proof.tsx:16`
**MISSING_SOURCE_DELTA_ON_MAIN** → NEEDS_EXPLICIT_RESOLUTION (catalog-redesign); mode `100644`.
New ordered intake/history step cards retain stored state/reason/time/human verdict; shortened digest displays carry full title; refusing branch shows no listing.
Acceptance: Keep explicit TEST/process-local/no-LIVE disclaimer; refused/null listing renders no flow; digests complete in title and real recorded history only.
Exact source blob `edf9ceb16e7ee370c998221fc44b51b220861c49`; main `67fc78f9958e4cab6a5360c4c736d0cb014f7e72`; main equals pre-feature parent: `True`.

### `sites/catalog-game/src/app/globals.css:1`
**MISSING_SOURCE_DELTA_ON_MAIN** → NEEDS_EXPLICIT_RESOLUTION (catalog-redesign); mode `100644`.
Motion vars, glyph nudge, current-nav indicator, lead/card/detail digest plates, price typography, publish slot, flow steps, responsive/footer/rail layout; store identity prefix remains separate.
Acceptance: Compare both skeletons below END STORE IDENTITY; contrast pairs, <=200ms token-only motion, reduced motion <=0.001ms, 3px/1.015 caps, focus and no overflow.
Exact source blob `0771df3e025094c0aaa055653dbfee796ce0146c`; main `fe25bede3897cf07b0435f51b99feb539de25068`; main equals pre-feature parent: `True`.

### `sites/catalog-game/src/app/item/[itemId]/page.tsx:43`
**MISSING_SOURCE_DELTA_ON_MAIN** → NEEDS_EXPLICIT_RESOLUTION (catalog-redesign); mode `100644`.
Reframe listing header/tabs, purchase card/price and availability/specs, detail record-mark and related cards; retain authoritative checkout/refusal path.
Acceptance: Valid/unknown/cross-store item IDs, named disabled checkout, money/credits/both, publication time/digest/availability all retained; no restored stale purchase authority.
Exact source blob `8f1a1b001c8a06520da83f318e27fa46d679dfad`; main `81028bd1f018e57d5fcf518a17b2b70d424b083c`; main equals pre-feature parent: `True`.

### `sites/catalog-game/src/app/layout.tsx:21`
**MISSING_SOURCE_DELTA_ON_MAIN** → NEEDS_EXPLICIT_RESOLUTION (catalog-redesign); mode `100644`.
Use new StoreNav; Archivo width font axis; per-store copy data for common shell/footer and honest publishing-not-open invitation.
Acceptance: Resolve sibling/umbrella origins by existing resolver only; keep metadata/CSP/fonts/skip link and independent install root boundaries.
Exact source blob `a6ea0ecd080b47aee729682738b25c882cbcf27e`; main `2084070b78b1e105142e622433bff66776b51d19`; main equals pre-feature parent: `True`.

### `sites/catalog-game/src/app/not-found.tsx:9`
**MISSING_SOURCE_DELTA_ON_MAIN** → NEEDS_EXPLICIT_RESOLUTION (catalog-redesign); mode `100644`.
Use brand-specific listing/catalogue terms and larger return link.
Acceptance: Cross-store and unknown ID remain 404; honest committed-record copy and accessible return link.
Exact source blob `b894f71feed98c831009f4ff15be41d9f276d6cb`; main `e3a0aae3c74366ee7be2b175d7f2cb7bf80fa984`; main equals pre-feature parent: `True`.

### `sites/catalog-game/src/app/page.tsx:25`
**MISSING_SOURCE_DELTA_ON_MAIN** → NEEDS_EXPLICIT_RESOLUTION (catalog-redesign); mode `100644`.
Lead first real listing, facts/count/price-mode/creator-share/TEST rail, facet proportional bars and PublishSlot; actual listing grid retained.
Acceptance: Zero/one/many listings; no NaN proportions; no fake filter/sort/pager; TEST refusals and actual counts retained.
Exact source blob `eab90218b295f61933c730500a54f2c9d42474b5`; main `9e0a0242709613006587219a24cf4e8d0ae95eb3`; main equals pre-feature parent: `True`.

### `sites/catalog-game/src/app/publish/page.tsx:25`
**MISSING_SOURCE_DELTA_ON_MAIN** → NEEDS_EXPLICIT_RESOLUTION (catalog-redesign); mode `100644`.
Share rule lead/stat, required evidence/ordered pipeline sections and honest unopen publication copy; display-only deterministic TEST projection.
Acceptance: No submit/upload/LIVE action; exact share split/rounding/read-model refusal and stored human approval; both store copy variants kept.
Exact source blob `c6e24c9cc937e888b80cc1a4aca1723c6c535004`; main `5656e00f3d2f730d3d3668ec0f22e659eb3ea1e5`; main equals pre-feature parent: `True`.

### `sites/catalog-web/src/app/_components/commerce-notice.tsx:26`
**MISSING_SOURCE_DELTA_ON_MAIN** → NEEDS_EXPLICIT_RESOLUTION (catalog-redesign); mode `100644`.
Reframe existing policy/explanation and mode/completion/viewer/registry into notice-facts dl; refusal/account data remains authoritative.
Acceptance: Assert all four facts including unresolved viewer reason and registry remain visible; no purchase enablement.
Exact source blob `a5ca9c56192dbd6306723f85f2a2ef7e15e2adbe`; main `8dca58f219d1a321ebaab45f528690261c1d3d47`; main equals pre-feature parent: `True`.

### `sites/catalog-web/src/app/_components/digest-figure.tsx:17`
**MISSING_SOURCE_DELTA_ON_MAIN** → NEEDS_EXPLICIT_RESOLUTION (catalog-redesign); mode `100644`.
Replace large boolean by card/lead/detail variant, explicit record-mark legend/chips/stats; no asset preview claim.
Acceptance: Keep old large caller adapter until full call-site proof; invalid digest draws no mark; all variants identify record not asset.
Exact source blob `8c0687c0384105bbbe50caa38a39f209b91b278b`; main `c0217b30a2b4d935b1da9609c3b37a4d1debc45a`; main equals pre-feature parent: `True`.

### `sites/catalog-web/src/app/_components/family-bar.tsx:15`
**MISSING_SOURCE_DELTA_ON_MAIN** → NEEDS_EXPLICIT_RESOLUTION (catalog-redesign); mode `100644`.
External sibling glyph only when resolved sibling anchor exists.
Acceptance: Missing deployment origin remains non-link; configured links retain correct origin and accessible text.
Exact source blob `b1f7f0b49e31051109753966ac11dda79a6b4e9c`; main `20c9142f20969f84716265d7d8cc3724b6945315`; main equals pre-feature parent: `True`.

### `sites/catalog-web/src/app/_components/listing-card.tsx:19`
**MISSING_SOURCE_DELTA_ON_MAIN** → NEEDS_EXPLICIT_RESOLUTION (catalog-redesign); mode `100644`.
Add reusable credit/money numeral/unit/alternative rendering and creator-share footer; compact still suppresses extra share text.
Acceptance: Credit-only/money-only/both/unpriced named reason; preserve authoritative share rounding and fixture availability.
Exact source blob `c7214aaa884966d17a3413f4b2ead0a75c7e3708`; main `aedd2ab0bd62ed5b2bc8cf6437719b57c7e8704e`; main equals pre-feature parent: `True`.

### `sites/catalog-web/src/app/_components/listing-tile.tsx:15`
**MISSING_SOURCE_DELTA_ON_MAIN** → NEEDS_EXPLICIT_RESOLUTION (catalog-redesign); mode `100644`.
Single lead record plate uses variant lead and shared ListingPrice rather than old hero tile.
Acceptance: Retain ListingTile compatibility export unless scoped import inventory proves safe removal; no invented listings.
Exact source blob `4fb82786e264cf2c3d5ea1afe63df5bfa95d1a37`; main `29690911ca24db28c770ce608ab1b76628d6d170`; main equals pre-feature parent: `True`.

### `sites/catalog-web/src/app/_components/publish-slot.tsx:11`
**MISSING_SOURCE_DELTA_ON_MAIN** → NEEDS_EXPLICIT_RESOLUTION (catalog-redesign); mode `100644`.
New honest final grid cell links publish rules, explicitly publishing not open; no price/digest/TEST listing impersonation.
Acceptance: Assert link /publish, unavailable copy and absent fake product metadata.
Exact source blob `941fbcd1e5921ed905dd10802fef2a3aa5aa3bb2`; main `ABSENT`; main equals pre-feature parent: `True`.

### `sites/catalog-web/src/app/_components/state-panel.tsx:11`
**MISSING_SOURCE_DELTA_ON_MAIN** → NEEDS_EXPLICIT_RESOLUTION (catalog-redesign); mode `100644`.
Move named reason to heading row before children; preserve site-kit status/heading semantics.
Acceptance: Refusal reason present exactly once, wraps accessibly; no status remapping.
Exact source blob `3a51ee21e9e4b9bcb2ef4f64d5874855a8960b05`; main `0c476303ff681ae22f663206daf7a98a0cabe025`; main equals pre-feature parent: `True`.

### `sites/catalog-web/src/app/_components/store-nav.tsx:19`
**MISSING_SOURCE_DELTA_ON_MAIN** → NEEDS_EXPLICIT_RESOLUTION (catalog-redesign); mode `100644`.
New usePathname client primary navigation with aria-current shared by visual marker; optional configured engine link.
Acceptance: Root+item descendants catalogue current; publish descendants publish current; unknown route neither; no-JS links remain usable; origin null omits engine.
Exact source blob `4387cce860ecfbf5b5cd153bbec46cf4f240c973`; main `ABSENT`; main equals pre-feature parent: `True`.

### `sites/catalog-web/src/app/_components/test-pipeline-proof.tsx:16`
**MISSING_SOURCE_DELTA_ON_MAIN** → NEEDS_EXPLICIT_RESOLUTION (catalog-redesign); mode `100644`.
New ordered intake/history step cards retain stored state/reason/time/human verdict; shortened digest displays carry full title; refusing branch shows no listing.
Acceptance: Keep explicit TEST/process-local/no-LIVE disclaimer; refused/null listing renders no flow; digests complete in title and real recorded history only.
Exact source blob `edf9ceb16e7ee370c998221fc44b51b220861c49`; main `67fc78f9958e4cab6a5360c4c736d0cb014f7e72`; main equals pre-feature parent: `True`.

### `sites/catalog-web/src/app/globals.css:1`
**MISSING_SOURCE_DELTA_ON_MAIN** → NEEDS_EXPLICIT_RESOLUTION (catalog-redesign); mode `100644`.
Motion vars, glyph nudge, current-nav indicator, lead/card/detail digest plates, price typography, publish slot, flow steps, responsive/footer/rail layout; store identity prefix remains separate.
Acceptance: Compare both skeletons below END STORE IDENTITY; contrast pairs, <=200ms token-only motion, reduced motion <=0.001ms, 3px/1.015 caps, focus and no overflow.
Exact source blob `ffaf07854a6600e8dac34074acf05b0f0b54891d`; main `4fadda227286b364bc61c93082fc1c24639b6112`; main equals pre-feature parent: `True`.

### `sites/catalog-web/src/app/item/[itemId]/page.tsx:43`
**MISSING_SOURCE_DELTA_ON_MAIN** → NEEDS_EXPLICIT_RESOLUTION (catalog-redesign); mode `100644`.
Reframe listing header/tabs, purchase card/price and availability/specs, detail record-mark and related cards; retain authoritative checkout/refusal path.
Acceptance: Valid/unknown/cross-store item IDs, named disabled checkout, money/credits/both, publication time/digest/availability all retained; no restored stale purchase authority.
Exact source blob `8f1a1b001c8a06520da83f318e27fa46d679dfad`; main `81028bd1f018e57d5fcf518a17b2b70d424b083c`; main equals pre-feature parent: `True`.

### `sites/catalog-web/src/app/layout.tsx:21`
**MISSING_SOURCE_DELTA_ON_MAIN** → NEEDS_EXPLICIT_RESOLUTION (catalog-redesign); mode `100644`.
Use new StoreNav; Archivo width font axis; per-store copy data for common shell/footer and honest publishing-not-open invitation.
Acceptance: Resolve sibling/umbrella origins by existing resolver only; keep metadata/CSP/fonts/skip link and independent install root boundaries.
Exact source blob `f37c88a241a50f05e8f0ca0b1947c0a214e6783e`; main `ba346e7a95719bfd227a0a8b1360c626345ffa3a`; main equals pre-feature parent: `True`.

### `sites/catalog-web/src/app/not-found.tsx:9`
**MISSING_SOURCE_DELTA_ON_MAIN** → NEEDS_EXPLICIT_RESOLUTION (catalog-redesign); mode `100644`.
Use brand-specific listing/catalogue terms and larger return link.
Acceptance: Cross-store and unknown ID remain 404; honest committed-record copy and accessible return link.
Exact source blob `b894f71feed98c831009f4ff15be41d9f276d6cb`; main `a3fb2987edbcf8481dc0ae2d320a965dd6ac5b1f`; main equals pre-feature parent: `True`.

### `sites/catalog-web/src/app/page.tsx:25`
**MISSING_SOURCE_DELTA_ON_MAIN** → NEEDS_EXPLICIT_RESOLUTION (catalog-redesign); mode `100644`.
Lead first real listing, facts/count/price-mode/creator-share/TEST rail, facet proportional bars and PublishSlot; actual listing grid retained.
Acceptance: Zero/one/many listings; no NaN proportions; no fake filter/sort/pager; TEST refusals and actual counts retained.
Exact source blob `8971b73f8ce810d48702249a4b3bd37413ecb768`; main `d69a4bdab409cd432263ad774dd84eab84203014`; main equals pre-feature parent: `True`.

### `sites/catalog-web/src/app/publish/page.tsx:25`
**MISSING_SOURCE_DELTA_ON_MAIN** → NEEDS_EXPLICIT_RESOLUTION (catalog-redesign); mode `100644`.
Share rule lead/stat, required evidence/ordered pipeline sections and honest unopen publication copy; display-only deterministic TEST projection.
Acceptance: No submit/upload/LIVE action; exact share split/rounding/read-model refusal and stored human approval; both store copy variants kept.
Exact source blob `2a76cc0807cad96b54d6029a367bdf68fdce7de1`; main `58d2282bebc00f3228116f73956fafe983967706`; main equals pre-feature parent: `True`.

### `sites/umbrella/MEDIA-PROVENANCE.md:1`
**MISSING_SOURCE_DELTA_ON_MAIN** → NEEDS_EXPLICIT_RESOLUTION (proof-media); mode `100644`.
530-line historical image source/crop/hash/claim/limitations and dormant reproduction script; data only.
Acceptance: Retain dated source SHA/hash and limits; do not execute embedded script or follow private source paths; source originals require owner export.
Exact source blob `9aa9886f0b10fd1090fb73c3b9067130324635f6`; main `ABSENT`; main equals pre-feature parent: `True`.

### `sites/umbrella/public/proof/desktop-change-review.png:1`
**MISSING_SOURCE_DELTA_ON_MAIN** → NEEDS_EXPLICIT_RESOLUTION (proof-media); mode `100644`.
Historical Linux desktop capture; not live/current UI evidence.
Acceptance: Verify exact SHA256/bytes/IHDR against MEDIA-PROVENANCE; preserve developer/software/Linux/partial scope; no claimed crop source revalidation without owner export.
Exact source blob `cf5395757f8efd0344313de82ff638d9d8fb5eb1`; main `ABSENT`; main equals pre-feature parent: `True`.

### `sites/umbrella/public/proof/desktop-local-build.png:1`
**MISSING_SOURCE_DELTA_ON_MAIN** → NEEDS_EXPLICIT_RESOLUTION (proof-media); mode `100644`.
Historical Linux desktop capture; not live/current UI evidence.
Acceptance: Verify exact SHA256/bytes/IHDR against MEDIA-PROVENANCE; preserve developer/software/Linux/partial scope; no claimed crop source revalidation without owner export.
Exact source blob `a909a64797c79800b5dcbe4922788dc71a39d2c4`; main `ABSENT`; main equals pre-feature parent: `True`.

### `sites/umbrella/public/proof/desktop-run-viewport.png:1`
**MISSING_SOURCE_DELTA_ON_MAIN** → NEEDS_EXPLICIT_RESOLUTION (proof-media); mode `100644`.
Historical Linux desktop capture; not live/current UI evidence.
Acceptance: Verify exact SHA256/bytes/IHDR against MEDIA-PROVENANCE; preserve developer/software/Linux/partial scope; no claimed crop source revalidation without owner export.
Exact source blob `02634ec2e29dc3058ca701fbddd0a9ea1a17caa6`; main `ABSENT`; main equals pre-feature parent: `True`.

### `sites/umbrella/public/proof/desktop-run-window.png:1`
**MISSING_SOURCE_DELTA_ON_MAIN** → NEEDS_EXPLICIT_RESOLUTION (proof-media); mode `100644`.
Historical Linux desktop capture; not live/current UI evidence.
Acceptance: Verify exact SHA256/bytes/IHDR against MEDIA-PROVENANCE; preserve developer/software/Linux/partial scope; no claimed crop source revalidation without owner export.
Exact source blob `7f6781b39004c927c36db1f415020d98056bb56b`; main `ABSENT`; main equals pre-feature parent: `True`.

### `sites/umbrella/src/app/_components/hero-viewport.tsx:37`
**MISSING_SOURCE_DELTA_ON_MAIN** → NEEDS_EXPLICIT_RESOLUTION (umbrella-redesign); mode `100644`.
Expose pending/refused/drawn data-frame and labelled pre-script panel; retain frame/refusal provenance.
Acceptance: No-JS pending panel visible; real frame switches drawn; refusal remains named; do not equate screenshot with live frame.
Exact source blob `55907490bcd18af3e615b6c1724e78da657a74cc`; main `76255288f80c6fdebba1410224967b1495bfd847`; main equals pre-feature parent: `True`.

### `sites/umbrella/src/app/_components/proof-figure.tsx:8`
**MISSING_SOURCE_DELTA_ON_MAIN** → NEEDS_EXPLICIT_RESOLUTION (umbrella-redesign); mode `100644`.
New server-only plain lazy img with exact srcSet/dimensions; every caption limitation chip, level and optional proof link.
Acceptance: No next/image re-encoding/client state; all limits always rendered; alt, width/height, lazy decoding, proof route allowlist.
Exact source blob `1b7e4e0cd3ea84a1ddbee5163dc0ebebaf2a03d3`; main `ABSENT`; main equals pre-feature parent: `True`.

### `sites/umbrella/src/app/docs/_components/help-doc-page.tsx:10`
**MISSING_SOURCE_DELTA_ON_MAIN** → NEEDS_EXPLICIT_RESOLUTION (umbrella-redesign); mode `100644`.
Shared docs rail, server-computed aria-current, breadcrumbs and related link glyphs around unchanged guide body.
Acceptance: Every HELP_DOCS guide reachable; active guide unique; breadcrumb and section semantics retained.
Exact source blob `8019fa1329f4f42e3406025e4aea095965409921`; main `49357e7ed47a881d155b86d113ca8f6ede04b555`; main equals pre-feature parent: `True`.

### `sites/umbrella/src/app/docs/page.tsx:14`
**MISSING_SOURCE_DELTA_ON_MAIN** → NEEDS_EXPLICIT_RESOLUTION (umbrella-redesign); mode `100644`.
Docs landing rail/current link and breadcrumb; existing contract data retained.
Acceptance: All documents and canonical contract links still reachable, no duplicate current marker.
Exact source blob `4e4645127c7f678ed8c09552824ffce79c651c6b`; main `4b6b92e803eac6bdbad3605521049160bb5d2769`; main equals pre-feature parent: `True`.

### `sites/umbrella/src/app/engine/page.tsx:29`
**MISSING_SOURCE_DELTA_ON_MAIN** → NEEDS_EXPLICIT_RESOLUTION (umbrella-redesign); mode `100644`.
Platform availability layout plus wide historical full-window ProofFigure and scroll-labelled pipeline.
Acceptance: Linux-only/developer/software limitations visible; no macOS/Windows readiness claim; retain platform refusals.
Exact source blob `7b1a04a9a166143206aad0001092ae17d7c88464`; main `5caf6526d1095995c2bb720d886001acba24f909`; main equals pre-feature parent: `True`.

### `sites/umbrella/src/app/globals.css:1`
**MISSING_SOURCE_DELTA_ON_MAIN** → NEEDS_EXPLICIT_RESOLUTION (umbrella-redesign); mode `100644`.
Shared motion, marketing atmosphere/media/glyph system, masthead/hero pending artwork/trust rail, proof gallery, docs/auth/commerce/profile layouts and responsive tables.
Acceptance: Token-only <=200ms motion; reduced-motion <=0.001ms; D4-7 caps and contrast; mobile overflow/focus and no-script hero; current local selectors must survive.
Exact source blob `17ec085a6a239b61388424fa62bbecef91bc787a`; main `69a7e9dcaac8d83b2c7dcbf18370452b11abc1b8`; main equals pre-feature parent: `True`.

### `sites/umbrella/src/app/layout.tsx:22`
**MISSING_SOURCE_DELTA_ON_MAIN** → NEEDS_EXPLICIT_RESOLUTION (umbrella-redesign); mode `100644`.
Header Engine download/action control increases to button-lg.
Acceptance: Keep current auth/navigation/origin/CSP unchanged; keyboard target and responsive masthead tests.
Exact source blob `f2549a6f8ed86d78e85430091efb87723710a2db`; main `f8e74ea286337d1787ac00550ded932e4505b019`; main equals pre-feature parent: `True`.

### `sites/umbrella/src/app/login/page.tsx:17`
**MISSING_SOURCE_DELTA_ON_MAIN** → NEEDS_EXPLICIT_RESOLUTION (umbrella-redesign); mode `100644`.
Auth layout/card wraps existing method=post /api/login with existing refusal/reason logic.
Acceptance: Preserve current origin/body/auth/rate limits and refusal behavior; no credential value in evidence.
Exact source blob `428659f3e37991c1428bd0b5a9ccc15dd0108730`; main `74b16cfadedc7918bfeebf83faf823661147efde`; main equals pre-feature parent: `True`.

### `sites/umbrella/src/app/open/page.tsx:12`
**MISSING_SOURCE_DELTA_ON_MAIN** → NEEDS_EXPLICIT_RESOLUTION (umbrella-redesign); mode `100644`.
Open layout/viewport structure and labelled scrollable placed-instance region.
Acceptance: Preserve public anonymous open, current host/runtime/scene APIs; keyboard scroll and mobile layout; no screenshot-only pixel claim.
Exact source blob `6a8ed03bb4188797e0ec30bcf694820f158c3cc3`; main `25e9eb88a83dbad352eebf3c4398d8c5fe775563`; main equals pre-feature parent: `True`.

### `sites/umbrella/src/app/page.tsx:13`
**MISSING_SOURCE_DELTA_ON_MAIN** → NEEDS_EXPLICIT_RESOLUTION (umbrella-redesign); mode `100644`.
New three-image historical proof gallery, comparison/profile table bands and release-path cards; retains existing authoritative comparison/profile data.
Acceptance: All matrices/links/refusals remain; three limited captions, responsive first fold/masthead and navigation targets.
Exact source blob `3402923953505422a5700b32953dced64c114ac2`; main `2541fd4d3f4bf1ba39f5721379c3ce8e916af1e9`; main equals pre-feature parent: `True`.

### `sites/umbrella/src/app/pricing/page.tsx:38`
**MISSING_SOURCE_DELTA_ON_MAIN** → NEEDS_EXPLICIT_RESOLUTION (umbrella-redesign); mode `100644`.
Reframe purchase offer/refusal layouts; existing POST checkout hidden fields and refused links retained.
Acceptance: Keep modern server-issued policy/current checkout boundary/security logic; no fake receipt or eligibility; login/missing provider/disabled offer named.
Exact source blob `e7d8dec24a9673e1c8dfa1feab3ff7ac800432b1`; main `542dccab7080d864767a3d53c197f4be69f66203`; main equals pre-feature parent: `True`.

### `sites/umbrella/src/app/profiles/page.tsx:13`
**MISSING_SOURCE_DELTA_ON_MAIN** → NEEDS_EXPLICIT_RESOLUTION (umbrella-redesign); mode `100644`.
Responsive grading matrix wrapping with labelled scroll region, existing profile-state lookup unchanged.
Acceptance: Keep shippingClaim/held Kids/default status; all rows/operations present and keyboard scroll.
Exact source blob `29c68b9a25dc47829cfa758f8ab0d299edd4f18d`; main `d8fade9dc7bfe496f243344be16f7389a8ecf8be`; main equals pre-feature parent: `True`.

### `sites/umbrella/src/lib/site-content.ts:28`
**MISSING_SOURCE_DELTA_ON_MAIN** → NEEDS_EXPLICIT_RESOLUTION (proof-media); mode `100644`.
New immutable four-image metadata records; three home/one engine, dimensions/claims/limitations/proofHref recorded explicitly.
Acceptance: Deep-freeze records/limitations; match all four pinned PNG dimensions/hashes and provenance; never remove historical limitations.
Exact source blob `0e49c66b80e183224fc302ba99b34021dc59eb35`; main `20f52cfa5f61325f8e2afd7d9e7c2f716b4e2da5`; main equals pre-feature parent: `True`.

### `sites/umbrella/test/first-release.visual.spec.ts:8`
**MISSING_SOURCE_DELTA_ON_MAIN** → NEEDS_EXPLICIT_RESOLUTION (redesign-tests); mode `100644`.
Browser masthead edges/height, first-fold CTAs/artifact/trust rail, three limited proof cards, type ramp, no-script pending hero.
Acceptance: Review source geometry oracles against current responsive contract; preserve historical assertions via compatible equivalent if changed. Browser run not authorized here.
Exact source blob `ae5b743a42a73e6b05b192dac4356fd962bb0f31`; main `314cc406f620cdc3c4fdb45f349f510dad39d80a`; main equals pre-feature parent: `True`.

### `tests/sites/catalog-storefronts.test.ts:41`
**MISSING_SOURCE_DELTA_ON_MAIN** → NEEDS_EXPLICIT_RESOLUTION (redesign-tests); mode `100644`.
Adds contrast pairs fg over bg-raised/bg-field/bg-row/bg-control at existing accessibility oracle.
Acceptance: Preserve all existing guards and run both store palettes; tests do not alone prove interactive StoreNav/PublishSlot behavior.
Exact source blob `c5736f4270976d7cddad66788d844f753ba5d46e`; main `e4a9fd1fdaf8b292eacd39831c8fef99dd75823d`; main equals pre-feature parent: `True`.

### `tests/sites/umbrella-visual.test.ts:58`
**MISSING_SOURCE_DELTA_ON_MAIN** → NEEDS_EXPLICIT_RESOLUTION (redesign-tests); mode `100644`.
Deep-freeze media assertions, PNG existence/dimensions, limitation/proof/caption restrictions, server lazy-image source checks, token-only timing and transform bounds.
Acceptance: Merge additions into current stronger suite; keep all existing safety/refusal/security and motion/contrast tests; no deleting asserts for redesign.
Exact source blob `ad45cc376a070a0f91dee90730f2cc917dfaf3d9`; main `4ece07cc5f8f48d4eb1068d1fc117dcb901e0b17`; main equals pre-feature parent: `True`.

## Import, API, mode and coverage closure

- Every static relative import in mapped TypeScript/TSX resolves inside its source Git tree. JSON records each dependency and whether its target must be added to main. This is source import existence proof, not typecheck/runtime proof. Package imports stay in existing separate site roots; maintenance root manifests already exactly match main.
- Motion declaration is exported within design-tokens.ts but not added to package-root index.ts:334-371; the existing foundationsCss/foundationsVariablesCss API emits it. Preserve modern public APIs; do not invent a root export change.
- Both storefront9 component pairs, item pages and not-found pages are byte-identical across game/web. CSS skeletons after END STORE IDENTITY are byte-identical. Layout, index and publish differ by store copy; do not collapse those legitimate differences.
- ListingTile→LeadPlate and DigestFigure.large→variant are compatibility risks even though site-local. Retain adapters/aliases pending full latest-candidate call-site review. Current security/held keys/Kids/LIVE, real pipeline/artifact payloads and current host/controller changes are load-bearing.
- All54 substantive maintenance paths are100644, including PNGs.22 placeholders are100644 zero-byte blobs, not120000 symlinks nor160000 submodules. Two historical playbook links are120000 and already exact main: preserve their link bytes, do not dereference or turn them into regular files.
- Source tests add exact motion variables, four catalog contrast pairs, media freeze/dimensions/caption/limits, token-only motion/transform caps, and browser masthead/first-fold/proof/type/no-script assertions. Source does not add dedicated behavioral StoreNav/PublishSlot/variant tests; these are explicit extra acceptance work, not green by implication.

## Dependency-boundary blob receipts

- `packages/site-kit/package.json`: source/main tree-entry exact `True`; source `100644 blob a6790acd0ef3350264e0b6c8b634ddda1a17adc0`, main `100644 blob a6790acd0ef3350264e0b6c8b634ddda1a17adc0`.
- `packages/site-kit/src/index.ts`: source/main tree-entry exact `True`; source `100644 blob ff13aa878bc5431f128b454137a5e8c545732d83`, main `100644 blob ff13aa878bc5431f128b454137a5e8c545732d83`.
- `sites/catalog-game/package.json`: source/main tree-entry exact `True`; source `100644 blob 343fd0266d8bb5851bd5b6caa7ddaf8779528ea8`, main `100644 blob 343fd0266d8bb5851bd5b6caa7ddaf8779528ea8`.
- `sites/catalog-game/pnpm-lock.yaml`: source/main tree-entry exact `True`; source `100644 blob a0c04c0e4e74a0a76f7b0c9dfe294390e28d2f98`, main `100644 blob a0c04c0e4e74a0a76f7b0c9dfe294390e28d2f98`.
- `sites/catalog-web/package.json`: source/main tree-entry exact `True`; source `100644 blob f623181dd3e7a4064b2a747ae498757ee8ecf184`, main `100644 blob f623181dd3e7a4064b2a747ae498757ee8ecf184`.
- `sites/catalog-web/pnpm-lock.yaml`: source/main tree-entry exact `True`; source `100644 blob a0c04c0e4e74a0a76f7b0c9dfe294390e28d2f98`, main `100644 blob a0c04c0e4e74a0a76f7b0c9dfe294390e28d2f98`.
- `sites/umbrella/package.json`: source/main tree-entry exact `True`; source `100644 blob 6d6c5cb815299ae47898e1ee23eeaabcbe227c48`, main `100644 blob 6d6c5cb815299ae47898e1ee23eeaabcbe227c48`.
- `sites/umbrella/pnpm-lock.yaml`: source/main tree-entry exact `True`; source `100644 blob 2fb5cf89046ef2ecd0f52b99b34665cec92e4235`, main `100644 blob 2fb5cf89046ef2ecd0f52b99b34665cec92e4235`.
- `docs/dependency-matrix.json`: source/main tree-entry exact `True`; source `100644 blob 707421b350a2f49721d67b5914ab76055b4cde26`, main `100644 blob 707421b350a2f49721d67b5914ab76055b4cde26`.

## Unresolved map

- **U-LOCAL / NEEDS_EXPLICIT_RESOLUTION** — All54 substantive maintenance paths plus canonical docs context: Compare verified exported latest shared work per path/content hash before applying; malformed published346933c is not candidate.
- **U-COMPAT / NEEDS_EXPLICIT_RESOLUTION** — catalog-game and catalog-web DigestFigure large/variant; ListingTile/LeadPlate; modern site source: Keep compatibility adapters and old consumer support until exact full candidate call-site closure.
- **U-CLOUD / NEEDS_EXPLICIT_RESOLUTION** — historical Cursor Cloud provisioning/default-installed roots: Environment owner confirmation; migrate durable notes only, current pnpm pin12.6.0.
- **U-EMPTY / NEEDS_EXPLICIT_RESOLUTION** — 22 zero-byte shell/git/IDE/harness paths: Accept exact historical retention/active omission; owner export for intended nonempty content, never follow/execute harness.
- **U-MEDIA / OWNER_EXPORT** — historical crop source files outside captured images: Only if independent crop-source validation requested; four output file hashes/IHDR verified.
- **U-VERIFY / NEEDS_EXPLICIT_RESOLUTION** — test imports/mode/runtime/CI on assembled candidate: No tests/CI run in this analysis; future validation must retain negative/security/Kids/LIVE proofs and report red results truthfully.

## Verification and preservation limits

Read-only Git-object extraction, mode/blob comparisons, cherry/merge-base, relative import existence, and four PNG hash/metadata checks were performed. Structural report completeness is validated independently of application correctness. Source/main deltas include binary hunks and exact full-index blobs; source tree snapshot and ancestors remain in the verified private recovery bundle. No live CI queries/run, application checks or assertions executed. User-permitted red-CI integration cannot mean green CI or authorize hook/tool approval bypass.

An eventual integration receipt must bind each accepted output path/blob/mode to its reviewed feature disposition and include all original captured tips in ancestry or explicit retained-history resolution. No wholesale source-tree replacement or ignored accidental deletion is acceptable. Foreign uncommitted/ignored files need OWNER_EXPORT.

## Captured SHA preservation inventory

All captured commit/tree/blob identities are retained verbatim in report.json and receipts. Inventory (includes captured34-reference/30-tip set and this family/object inventory):

- `07f0a3e8b27d2c6deb76856c3376243df490b822`
- `136fee1103d650baf3dc40ebbc4fc3d3f6fb2f45`
- `1471150caeda3db7624f206753c566851182c688`
- `16f312c61435e3d379a0e54525ac8115e35fee86`
- `1d2fe8aa089772c87271580deb158d87dd68cb64`
- `1e5ea6043946afbdddeac049ee01d7019dceec03`
- `21c135b3eb671a79c37444513fe775dc5ff6cefd`
- `23413eb7889ad2cdb41ab8d729c32c7512917394`
- `346933c105305224d575bf9319256301c1eeabfa`
- `45866fc43f1d45920bbbfc32274685d61cf061c9`
- `4e532e2fbf43e9948741578ab6208a3277870405`
- `4e669cc39766bbd4b24c25ee64bdae8aedc24564`
- `4e9a3347ec2d0ee2dd1de68b4e0236ceafcf9ce1`
- `5698f78d5bff24513ee53ec181d28bfebbdf0a83`
- `60cd238d0fafa427c0bd1b363f6cc21e1a885727`
- `62e84cbee60471bd2cdd5f2e0e26a8c45f598928`
- `6c0e44af9be207c46f287a8acfbac323ca5fd4a3`
- `740c7e950cf5eb6528e6629ee6f7041ef50dde5c`
- `7e7767a44c7ab20942b93469295c97aa972ba54d`
- `8729660a5cdaed2e5ced97124ac85311f3cef7ba`
- `89c7aa5e9fbaa7e31b9c7e879841684651426d07`
- `907d1d5db146189b0e50db49450feb3d635abc72`
- `94a4503050def7641f78faa24ae756497ceb3292`
- `9873ea3bd5f012c4b84ceccca60739ec5111d9d1`
- `9b2fd5d6ff24f08855c2669c011d7aba79e0211b`
- `ac1440670a8ad4eb8532cb20b4b85a9fbd0458df`
- `b63dc23d61e883332f85d272c980a404530b70a7`
- `c202bfcbf3e93f5414596e7fc0fbec5d51d82a16`
- `d1a676ea53bd4e8f368f027fb80f6b0097ab6aa3`
- `d423adffed61a6f39509843ebbd2ee20f7c80f34`
- `d53d180beccfd11e1178fbc9abf3b08282d2ed44`
- `db8afa68c18e46b426e0c9ac2a846fc8a7d3fdba`
- `dd77cc9cb91d24091082e0c5bc20a130f0f51ffc`
- `dfe31d9718311e22cbb9998758544163e24f30e5`
- `e26f30bca3b4800cd7301606c7271244c1d6ea29`
- `f1b468fa6b319ffede42f6d8d6bb40480818c08e`
- `f60de6e0c6237b71c6b5cb94ef056e3207d75d17`
- `fed05a766f1277b23ebf1757022067837d00621e`
