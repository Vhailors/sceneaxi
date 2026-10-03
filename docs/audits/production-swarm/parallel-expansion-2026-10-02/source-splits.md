# Source sublane proposal — active repair run orun-3-09og

Status: PROPOSED_ONLY, not queued, instructed, dispatched, acknowledged or Astra-approved. No product writes or verification commands executed. `link.list` exposed no reachable owners. This scout does not dispatch implementation children. The original repair graph remains authoritative; existing eight assignments are ready without waiting for this proposal.

## Inputs and authority

Read the control graph `/home/devuser/Documents/SceneAxi/.empryo/orchestrations/sceneaxi-repair-review-findings.json`, application `AGENTS.md`, `docs/agents/layout.md`, all eight repair assignment headers, and the current repair ledger structure. Correct audit paths are `docs/audits/production-swarm/repair-review-2026-10-02/baseline.md` and `docs/audits/production-swarm/deep-review-2026-10-02/08-FINAL.md` (initial shorter paths were not present). Baseline was PREPARING; assignment READY FOR DISPATCH is not evidence of a live child. Ledger contains 355 rows, 113 original local IDs, 53 previously missing IDs. Historical results supplied in peer findings are not current published-head certification.

## Critical ownership conflicts — resolve before any child writes

1. Graph assigns `sites/umbrella/src/lib/provider-adapters.ts`, checkout and account to `repair-identity-provider`; generated billing packet assigns those same files to billing (`assignments/billing.md:42-48`). Ledger 05-003 also labels SQL provider ownership billing. Hold cross-owner write grants; graph identity owner retains them absent explicit triage transfer. Billing may only request the SQL provider boundary fix.
2. Graph assigns `packages/site-kit` to `repair-sites-accessibility`; generated missing-capabilities packet assigns site-kit files to missing-capabilities (`assignments/missing-capabilities.md:31-80`). Keep site-kit parent-held pending triage reconciliation.
3. Generated authoring profiles packet exceeds graph's authoring/importers/plugin-host scope. Do not grant profile writes on that packet alone. Kids site belongs to sites-accessibility; profile reducer stays read-only and byte parity must remain.
4. Desktop `browserUiOpen` and trusted IPC handlers share `desktop/linux/src/electron/main.ts:529,1334`; they must be ONE child, not two symbol-level writers. Import propose/apply similarly share `packages/importers/src/index.ts:167,258`. Catalog parity files require ONE paired child across both install roots, not competing game/web writers.
5. Apply/propose and recovery import the same journal and atomic helpers (`propose-apply.ts:27-53`). Keep the transaction group together; splitting function names into writers would race correctness. Seed can be separate only with unchanged journal/atomic helper interfaces.

## Prospective source children: 20, not simultaneous dispatches

Every exact file list, task ID, focused command, acceptance oracle, dependency and exclusion is in `source-splits.json`. Files omitted from a child's list remain parent/shared-owner-held. Proposed child counts: authoring-assets 4; engine-physics 5; billing 2; identity-provider 2; sites-accessibility 3; desktop-cli 4; security-delivery 0; missing-capabilities 0. No new source grant for the last two: their existing coordination/manifest work remains intact. No grandchildren.

|Split ID|Original lead|Bounded unit|
|---|---|---|
|AA-TXN|repair-authoring-assets|propose/apply/recovery, one journal/atomic owner|
|AA-SEED|repair-authoring-assets|writeNativeProjectSeed and seed validity|
|AA-IMPORT|repair-authoring-assets|document import and contained glTF graph/vertices|
|AA-PLUGIN|repair-authoring-assets|pipeline/isolation, cached-byte binding|
|EP-KERNEL|repair-engine-physics|scene session/replay plus shared kernel transaction primitives|
|EP-CORE|repair-engine-physics|Three core/surface/runtime, facade and disposal|
|EP-AUDIO|repair-engine-physics|audio playback, standalone source/test|
|EP-ANIMATION|repair-engine-physics|numeric triangle-animation evaluator only|
|EP-RAPIER|repair-engine-physics|Rapier world, legacy physics contract compatibility|
|B-HOSTED|repair-billing|hosted model diagnostic/response boundary|
|B-LEDGER|repair-billing|append/derive ledger invariants, no store/SQL rewrite|
|I-AUTH|repair-identity-provider|identity port/adapters|
|I-SQL|repair-identity-provider|SQL provider boundary; 05-003 ownership hold|
|S-CATALOG|repair-sites-accessibility|both catalog pages and matched storefront CSS|
|S-KIDS|repair-sites-accessibility|Kids site component, reducer and CSS|
|S-UMBRELLA|repair-sites-accessibility|umbrella ShellButton/editor and global CSS|
|D-CHROME|repair-desktop-cli|desktop chrome and visual model|
|D-INSPECTOR|repair-desktop-cli|transport-free inspector app|
|D-IPC|repair-desktop-cli|Electron main/preload IPC and browserUiOpen|
|D-CLI|repair-desktop-cli|dispatch/protocol held-key integration|

## Resource and handback contract (applies to every child)

Planning/static read work is lightweight. Proposed commands are NOT executed. Focused package tests require parent resource approval; browser/full build/site build/native/package/dependency verification must use the unchanged serial integration owner, at most ONE heavyweight process graph-wide. Host values (12 logical CPUs, 5233 MiB available RAM, 49523 MiB swap used) are user-observed, not remeasured; 20 candidates do not imply 20 safe concurrent processes. No concurrency setting is changed.

Before activation: Astra allocation approval, reachable actual parent acknowledgment, exclusive path claim/release from existing writer, frozen dependency API and task-suboracle agreement. Parents cannot write child files until explicit handback. Each child hands back original/split IDs, exact source hashes, changed filenames, fail-before/pass-after named oracles, exits, refusals, dependency requests, resource cleanup and explicit released claims. Parent retains shared tests/barrels/configs/refusal registries and integrates after handback. Children must not invent new report ownership; this sidecar only owns this Markdown and JSON pair.

## Remaining gates and next action

All 20 nodes remain proposed, with observed dispatch count 0 by this scout. Actual original lead statuses/parallelism are unobserved, not assumed absent. Source partition is file-disjoint, not a guarantee of frozen import contracts. Send this pair to the parent allocator/Astra; triage must settle graph/assignment conflicts before delivering approved implementation grants. No owner acknowledgment or allocation judgment is available here. Full source, browser, native, root gate and published CI verification are deliberately not run. Reporter should carry these exact missing handoffs and serial barriers into the sidecar FINAL; this scout does not own FINAL.
