# Authoring production audit

Owner lane: **authoring**. Five items: three reproduced findings, one coverage hole, and one observed portability issue. These are inherited confirmed results, not newly rerun during report recovery. Application source remains read-only.

## AUTHORING-001 — Project propose/apply permits out-of-root document writes
- **Severity / status:** high / reproduced.
- **Source:** `packages/authoring-core/src/propose-apply.ts:95` (`resolvePath`), `:244` (`propose`), `:563` (`apply`).
- **Reproduction:** In an isolated fixture, CLI project propose/apply with `--cwd <root>` and `--document ../outside/victim.json` returned proposed exit 0, then applied exit 0; the victim outside the project root changed.
- **Impact:** The project-root write boundary can be bypassed through propose/apply.
- **Dependencies:** CLI document selection and path resolution. `writeDocumentFile` enforces containment, but these paths do not.
- **Recommended fix:** Apply canonical root-containment checks before proposal and application, including symlink targets.
- **Acceptance:** Parent traversal and symlink escapes are rejected before mutation; outside victim bytes remain unchanged; valid in-root propose/apply still succeeds.
- **Existing backlog mapping:** Unmapped; no verified identifier was inherited. Deduplicate against project-root containment work.

## AUTHORING-002 — Recovery and journal storage escape the project root
- **Severity / status:** high / reproduced.
- **Source:** `packages/authoring-core/src/apply-journal.ts:674` and `:711` (`recoverIncompleteApplies`). Exact journal-storage write lines were not inherited.
- **Reproduction:** Recovery consumed a valid schemaVersion 4 `.active` record with `documentPath: ../outside/victim.json` and wrote outside the root. Separately, a `.sceneaxi/journal` symlink to an outside sink redirected `.active`, `.completion-sequence`, and archive writes outside the root.
- **Impact:** Persisted recovery metadata and journal-directory redirection bypass filesystem write boundaries.
- **Dependencies:** Recovery record validation and journal-directory confinement.
- **Recommended fix:** Validate recovered document paths against the canonical project root and reject escaping journal-directory symlinks before any write; protect every journal artifact path.
- **Acceptance:** Crafted active records and journal symlinks fail safely; outside files remain unchanged and no artifacts reach the outside sink. Normal recovery still works.
- **Existing backlog mapping:** Unmapped; deduplicate against recovery integrity and filesystem containment work.

## AUTHORING-003 — Native seed accepts invalid document bytes
- **Severity / status:** medium / reproduced.
- **Source:** `packages/authoring-core/src/project-model.ts:627` (`writeNativeProjectSeed`).
- **Reproduction:** `documentBytes` equal to `not-json` returned ok; reopening failed with `PROJECT_MANIFEST_MALFORMED`.
- **Impact:** Initialization can report success while persisting a project that cannot reopen.
- **Dependencies:** Seed writing and reopen document validation.
- **Recommended fix:** Validate document bytes against the applicable parser/schema before writing seed files.
- **Acceptance:** Invalid JSON and invalid document shapes fail before writes; valid seeds reopen; failed initialization leaves no partial seed artifacts.
- **Existing backlog mapping:** Unmapped; deduplicate against native initialization validation work.

## AUTHORING-004 — Targeted tests lack negative containment and validity oracles
- **Severity / status:** medium / coverage-hole.
- **Source:** `packages/authoring-core/src/propose-apply.ts:95` (`resolvePath`), `packages/authoring-core/src/apply-journal.ts:674` (`recoverIncompleteApplies`), `packages/authoring-core/src/project-model.ts:627` (`writeNativeProjectSeed`). Exact test-file attribution was not inherited.
- **Reproduction:** Existing 159 targeted tests passed despite the reproduced failures. Inherited artifacts: `/tmp/sceneaxi-authoring-audit-jYPXkY` and `/tmp/sceneaxi-authoring-refute-ywAwly`; current availability not rechecked.
- **Impact:** A green targeted suite does not establish containment or seed validity.
- **Dependencies:** AUTHORING-001, AUTHORING-002, AUTHORING-003.
- **Recommended fix:** Add negative tests for traversal, symlink redirection, hostile recovery records, and malformed seed bytes, including no-mutation assertions.
- **Acceptance:** New tests fail on vulnerable behavior and pass after fixes; preserve the 159-test baseline. Use isolated temporary fixture roots, never real repository projects.
- **Existing backlog mapping:** Unmapped; attach regression coverage to the three reproduced findings.

## AUTHORING-005 — Migration journal reader assumes Linux procfs
- **Severity / status:** low / observed.
- **Source:** `packages/authoring-core/src/project-model.ts:377` and `:380` (`readMigrationJournal`).
- **Reproduction:** Inherited source observation: unconditional `/proc/self/fd` use. Native macOS/Windows failure was not demonstrated.
- **Impact:** Potential portability failure where Linux procfs is unavailable; not a native-platform-proven defect.
- **Dependencies:** OS descriptor-path support and migration journal reading.
- **Recommended fix:** Remove the unconditional procfs dependency or provide a platform-aware safe descriptor-reading strategy.
- **Acceptance:** Native Linux, macOS, and Windows tests read valid migration journals without requiring procfs, preserving descriptor/path safety.
- **Existing backlog mapping:** Unmapped; deduplicate against cross-platform migration-journal support.

## Verification provenance
No application source edits or new test execution were performed during this recovery. The 159 passing targeted tests and exploit outcomes are inherited. Backlog identifiers and peer-lane schema files were not independently rechecked; mappings remain explicitly unverified rather than invented.
