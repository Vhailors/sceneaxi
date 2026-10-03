# workflow-ci — BLOCKED published acceptance; auxiliary proof complete

Taskid: workflow-ci. Only this directory changed; product frozen. Read AGENTS, layout, repair integration/ledger/security-delivery report and deep-review08. This is not another full review.

## Executed evidence
- `./verify.py --live`: **exit1**, correctly refusing published artifact. Local static closure **0 errors**; PR static closure **84 errors**. Actual `node scripts/check-publish-ready.mjs`: **exit0**. Negative control deletes `packages/schemas/package.json` in memory: same validator reports `matrix-manifest`; no product mutation.
- Live PR#312 head `346933c105305224d575bf9319256301c1eeabfa`: **9 FAILURE / 2 SKIPPED / 0 SUCCESS**, BLOCKED. Five failed-run logs captured with SHA256 receipts in report.json. Logs prove missing schemas manifest (gate), missing referenced projects/TS6053 (sites/Kids), missing tsconfigs/TS5083 (Windows), and MODULE_NOT_FOUND checker (SDK). Retrieval success is not CI success.
- Local HEAD `4e532e2fbf43e9948741578ab6208a3277870405`; inspected-source fingerprint `cf3439546417205f631eb1cafdc7c0ea226d5b8d19bb0dcafb5145890c1e8e44`. This hashes inspected inputs, **not the entire candidate**. No dist used.
- Harness initially crashed on absent PR matrix; repaired to flag absence and use baseline expectations. Initial Windows missing-script result was a verifier false positive; corrected step working-directory resolution. Final observations above supersede it.

## Exact handoff
Restore full intended tree through serial native-Git descendant integration, preserving all baseline executable modes, manifests, checker imports and approved checkout handler; no deletion approval inferred. `verify.py --candidate SHA --live` records static closure and fast-forward ancestry; it does not authorize publication or certify required-check policy. Re-query CI on the **resulting** published SHA; old9FAIL cannot certify restoration. No additional product patch justified here.

Source anchors: `.github/workflows/gate.yml:28-29` runs docs before gate; `engine-sdk.yml:24` invokes checker; `desktop-windows.yml:46,75` default-off jobs require dispatch; `scripts/docs-api.mjs:55-70` reads source exports with type checking; `workspace-dist-resolver.mjs:67-84` maps manifests to dist, not proof of build freshness.

## NOT RUN / limits
Full gate, docs generation, SDK generation, four-site builds and native/signing checks deferred to authorized serial owner; executable command packet in deferred.sh. Lexical import/workflow checks are bounded, not full YAML/TS semantics or SDK archive-content validation. Branch-protection required-check configuration unqueried. Skipped native/signing jobs cannot certify their predicates. No services, ports, dependencies or temporary fixtures created; in-memory control discarded; only owned durable receipts remain.
