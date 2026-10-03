# Minimal semantic lint correction — handback

**BLOCKED_SEMANTIC_PROOF_PARTIAL_PATCH.** Owned clone only. No staging, commits, pushes, protection, product parser, shared-app or other-worktree writes.

## Applied candidate

- `tools/oxlint/anti-slop/shared/checked-boundaries.ts`: conservative lexical-symbol proof of single-return primitive predicates and optional-unknown raw object shells. Subject writes, unrelated probes, mismatched contracts, unsupported statements and shadowed builtins fail closed. A same-input/null primitive decoder requires an immutable resolved local validator declaration, checked predicate body, matching primitive return union and identical input/return binding. No filename/function allowlist, prefix convention, assertions or aliases.
- `rules/no-runtime-typeof.ts`: closes the inspected existing enclosing-predicate-annotation loophole; only the exact proved subject probe is accepted with the option.
- `rules/no-unknown-parameters.ts`: adds only proved single-return same-input primitive decoders. All existing generic checks/exemptions retained.
- `.oxlintrc.json:38`: only existing `allowInTypeGuards:true`, severity remains error.
- `tools/oxlint/anti-slop/tests/checked-boundaries.test.mjs`: actual installed oxlint process harness; 10 positive and 30 negative fixture cases. Always-true/shadowed/reassigned validators, unchecked returns/defaults/alternate branches, unrelated typeof, pre-validation property access, wrong input/contract, unchecked assertions and legacy dictionaries rejected. Arbitrary decoder names accepted only with semantic proof.
- `no-unsafe-dictionary-type.ts`: **unchanged**, no unproved compatibility exception.

## Executed verification

- Native rule harness **40/40 PASS**, zero skipped (`native-rule-tests.log`).
- Targeted strict helper/rules tsc **PASS** (`typecheck.log`); not a full source typecheck/build.
- ESLint `--no-ignore` for four candidate code files **PASS** (`eslint-no-ignore.log`). Default lint ignored these files and is not used as evidence.
- Scoped `git diff --check` **PASS**.
- Native oxlint on 8 currently staged source/test paths, current working source bytes: **exit1 / 65 residual errors**: runtime-typeof59, unknown-parameters4, unsafe-dictionary2. Exact native JSON and machine summary: `scoped-staged-oxlint.json`, `scoped-staged-summary.json`. This is not a staged-blob/index mutation or comprehensive guard closure. Mutation worker was concurrent; no fabricated before/after source count is claimed.
- Initial targeted tsc errors (nullable body and Identifier union) were fixed without casts. Initial no-ignore ESLint failed `URL` no-undef at harness9:32; explicit node:url import fixed it. No native fixture tests failed.

## Exact semantic blockers — no exception shipped

- **named-domain-decoder**: The actual decoder has a typed empty-catalog early return and a local catalog predicate with nested lock-entry validation, array iteration and duplicate checks. This limited checker cannot establish all success paths implement the named ScenePackageCatalog contract. Accepting a predicate annotation/call name would also accept always-true validators or unchecked early returns. Diagnostic retained.
- **raw-public-port-and-projection**: Signature declarations have no body. Their named return union alone cannot prove request refusal or opaque forwarding. Implementation descriptor-derived fields and projection callbacks need source-capture, alias and validation-flow analysis across nested calls; no name, prefix or filename exemption was added.
- **transport-discrimination**: The typeof source is a property of ApplyInput, not the predicate subject. Both paths must resolve imported parseProposalText/validateProposal, contained-file read provenance, success-result capture and subsequent proposal uses. Merely detecting calls in branches cannot reject shadowed validators, unrelated reads or an unchecked alternate success. No transport exception added.
- **legacy-output-consumer-validation**: The existing exported Record<string,unknown> outputs have no AST-level declaration distinguishing them from unchecked compatibility dictionaries. The inherited 50-signature equality oracle proves compatibility, not validation of every opaque consumer before property access/cast. Consumer validation provenance must be established across exports; dictionary rule left byte-for-byte unchanged.
- **remaining-runtime-projections**: Other descriptor/projection and imported guard property checks remain errors. Conservative predicate grammar deliberately rejects unsupported bodies rather than infer meaningful contracts from enclosing function names or annotations.

## Review and release

Independent Astra review requested via advisor messages lm305/lm308 **before parent commit; not received**. Candidate remains unstaged. `code.patch` includes new helper/harness files, and report.json captures hashes, executed counts and exact blockers. No normal commit was attempted or bypassed. No full build/install/browser/Docker/native integration run. Existing 50-public-type oracle is inherited source-worker evidence, not independently reexecuted by this worker. Product files were never edited by this worker.

**End handback: integration stage remains blocked.** Parent must not describe this partial candidate as the requested zero-error semantic correction or bypass the normal commit hook.
