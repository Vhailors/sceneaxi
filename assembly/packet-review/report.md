# Frozen packet independent review

## Verdicts

- **PolicyPatch FAIL**: `c5bb51cbf0d963c80b301271cf4dbcb9d18daf20050391fdc7c0fc63afcaf2d9` is **not approved**. Two actual false exemptions require a replacement immutable patch.
- **MutationPatch PASS, partial / frozen-baseline only**: approve `6597a311f1749a860a05f2182c2beaa37b3e4a6a05b63bfd3ca223e0c3c10227` for its checked-parsing changes against its recorded baseline. This is NOT approval to apply unchanged to the current candidate or override child-owned work.
- **CandidateCompatibility NOT READY**: concrete valid collider mutation incompatibility below.
- **SOURCEGUARDZERO NO**. **Full merge NOT READY**. Assembly remains mutable; no full-candidate PASS.

## Provenance and methods

Before review, `sha256sum -c checksums.sha256` in `assembly/packets` verified all four entries (both patches and reports). All 17 recorded post-patch file hashes matched the read-only packet-origin tree `/tmp/sceneaxi-pr310-main-first.tSd8ya`. That exact matching implementation was executed, not a rewritten approximation. The 40-fixture harness was copied as a lightweight probe changing only source-root and temporary-directory locations. Source/config files in both trees were untouched.

Current candidate `/tmp/sceneaxi-comprehensive-owned-xd4gdfl1` was inspected read-only. `git apply --check` accepts policy patch; mutation patch fails context in `packages/schemas/src/desktop-scene-physics.ts`, `packages/schemas/src/index.ts`, and `desktop/linux/src/lib/desktop-scene.ts`. Context compatibility is not semantic approval.

Only `assembly/packet-review` contains new reports/probes/receipts. No install, build, full suite, browser, Docker, source/config edit, staging, commit, push or protection action.

## Policy correctness, not counts

Supplied real native oxlint fixtures: **40 pass**. Independent controls: **9 pass, 2 fail** (`independent-policy-tests.log:1-18`). Resolver shadowing, guard aliases, subject aliases, early success, assertion predicates, incorrect primitive claims, imported/fake/always-true guards, changed subjects, object-only domain claims, ordinary unchecked parameters/casts and unchecked dictionaries are covered across both runs. Ordinary negative cases retain ERROR diagnostics. Optional-unknown object shells establish only object representation, not required domain fields or safe getter access; the primitive decoder recognizer does not accept these as domain decoders.

**P148-1 / P148-2:** `checked-boundaries.ts` in the patch (`code.patch:178-216`) never rejects async/generator owners. Both programs produce zero anti-slop errors:

```ts
async function guard(value: unknown): value is string {
  return typeof value === "string";
}
function decode(value: unknown): string | null {
  return guard(value) ? value : null;
}
// Repeat with function* guard instead of async function guard.
```

Expected `no-runtime-typeof` and `no-unknown-parameters`; actual `[]` (`independent-policy-tests.log:47-48,80-81`). Independently transpiling/executing both proves `decode(42) === 42`, because a Promise/iterator is truthy. TypeScript rejects these predicate signatures; this is **not a claim of bypassing a complete typechecked gate**. It is a real unsound exemption in the native rule's purported conservative semantic proof, with missing modifier controls.

**Required replacement:** reject `owner.async` and `owner.generator` in predicate recognition and decoder eligibility, including declaration/expression/arrow forms where applicable; add async/generator negative fixtures and rerun the real native harness. Do not mutate the frozen packet. No conditional policy approval is granted before a new hash is verified.

Existing `cause` and predicate-subject exemptions and the existing `typeof ... === "undefined"` exemption are inherited, not newly established semantic guarantees. The 65 source errors (59 typeof / 4 unknown / 2 dictionaries) are packet-reported historical evidence, not an independently fresh current-candidate result.

## Mutation correctness and public contracts

- Actual unchanged-root-config Vitest: **10 files / 121 tests pass** (`mutation-vitest-retry.log`). Native config loader plus an in-memory cache-directory override kept writes in review-owned paths; source aliases/assertions were not changed.
- Reconstructed pre-patch text by reversing every exact hunk in memory, checking every postimage. Differential run: **1512 domain outcomes identical** in empty/populated contexts, including bounds, IDs, enums, NaN/Infinity and refusal precedence. Each of five old getter throws becomes its actual domain `*_INPUT_UNSUPPORTED` refusal, with zero getter reads after patch (`differential.json`). Unsafe malformed throws need not be preserved.
- Independent **223 checks** cover each supplied variant, null-prototype data, snapshot/freeze behavior, nested object/array getters and owner-required fields. Required-field expectations were not obtained by asking the parser whether omission was accepted. All pass (`independent-mutation.log`).
- Independent TypeScript checker comparison of virtual before/current modules: **50 desktop exported types unchanged**, no existing schema/index export-type mismatch; only the five parser exports plus their index reexports are added (`abi.json`). No assertion-based fake parser or public input narrowing is introduced by this mutation-only patch.
- The patch snapshots descriptors through the existing schema owner, checks every consumed field, creates fresh frozen values, and retains domain/range enforcement in apply functions. Primitive-number recognition intentionally does not certify finiteness: original domain refusal ordering remains downstream. Desktop public consumers actually execute the parsers, and tests verify valid success, no partial mutation and named refusals.

Limits: this establishes the recorded packet baseline, not all possible executable/proxy inputs or arbitrary class-instance compatibility. Accepted positive inputs are plain serialized/data-descriptor boundary values, including null-prototype records; getters/prototype-carried inputs are deliberately refused. Packet's five baseline TS2339 errors and native oxlint 251 diagnostics are historical nonzero blockers, not erased by this approval. No full typecheck/build/native runtime proof was run here.

## Exact current-candidate incompatibility / required new source

`packages/schemas/src/desktop-scene-physics.ts:236-243` currently supports **both** shape-upsert field vocabularies. Actual candidate apply accepts:

```json
{"kind":"shape-upsert","colliderId":"s1","bodyId":"b1","colliderKind":"box","size":1}
```

After a valid body insertion, candidate application succeeds; frozen `parseScenePhysicsMutation` returns **null** (`candidate-compat.json`). This is a legitimate consumer regression if the frozen parser is transplanted unchanged. Its legacy `shapeId`/`shapeKind` path alone is insufficient.

Required integration changes (not yet approved):

1. Derive the checked physics decoder from the **current** owner union, preserving collider and legacy shape variants, checking descriptor-snapshotted fields and retaining current `requireScenePhysicsCatalog` / `physicsMutationResult` save-reload validation. Add actual positive tests for both vocabularies and malformed/conflicting-field controls. Re-run desktop consumers and freeze a new integration hash.
2. Reconcile index additions and five desktop parser-call replacements surgically; preserve child work. Do not restore packet-origin files wholesale. The candidate has independent catalog normalization, alias and raw-input changes absent from this packet baseline.
3. Preserve public raw `unknown` I/O parameters in the candidate; do not import unrelated inherited packet-origin parameter narrowing. Owner-derived contracts are appropriate **after** structural decoding, or when equivalent to the actual raw boundary, not as casts hiding untrusted input.
4. Remaining raw bridge signatures need a real named request decoder with captured success/refusal flow, or a separate checked internal contract after a raw adapter. Scene-package catalogs need complete structural validation on every success path. Proposal transport must resolve the actual imported parsers and subject identity in both branches. Legacy dictionary outputs require documented semantic output contracts and checked consumers; compatibility alone does not establish trusted fields. No blanket name/file exceptions or unchecked casts.

## Verification failures and delivery

Initial Vitest CLI attempt failed before tests with `CACError: Unknown option --cacheDir` (`mutation-vitest.log:5`). Corrected programmatic invocation ran the same root configuration/ten files successfully; the failed attempt is retained. Two policy negative-control failures remain intentionally unresolved. No source repairs were made.

Policy failure details were sent directly to bg-156 (`lm_349`). Final mutation approval/limits delivery to bg-156 then failed `unknown-endpoint` because that endpoint had exited. Controller received the complete partial verdict and candidate incompatibility (`lm_358`); final report delivery is recorded separately. Final approval applies only to the exact mutation hash above, not a future reconciled patch.
