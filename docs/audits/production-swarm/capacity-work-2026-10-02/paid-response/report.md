# paid-response — scoped source acceptance proof
Taskid: **paid-response**. Result: **71 PASS / 0 FAIL**, not complete product/PR/production acceptance.
Root `/home/devuser/Documents/Projects/sceneaxi`; HEAD `4e532e2fbf43e9948741578ab6208a3277870405`. Loaded-source-set fingerprint `3429d53b864dfcb54b38f84b8c5bfa0ba67b1c3fd9cdec7077ef179faedf7fb5` (definition/full map in JSON; not whole worktree).

## Exact subject and fingerprints
- `packages/billing/src/hosted-response.ts` `snapshotHostedResponse:17-84; bounds:5-7` SHA256 `23e95dc242718b0b6cc648c59dd1dd4bd33516f4fefabe375cdae67ec3edc791`.
- `packages/billing/src/hosted-ai.ts` `runMeteredModelCall:561; capability refusal:619-624; response-ready/save:786,823-847` SHA256 `66955f50919576c3ea1023be1dfdc1056d042b95109651cf3de396e3da54ff40`.
- `packages/billing/src/store.ts` `createCreditStore:558; snapshot reads/saves:623-631; createInMemoryCreditStore:665; held response:982-991` SHA256 `ddb5c93911554ec8a099ae15a79c8b1d23e70926cdaedcd65739f4c0118bcf9f`.
- `sites/umbrella/src/lib/provider-adapters.ts` `createNeonHostedCallStore:1052; response-ready read:1068-1073; pre-SQL save:1077-1086` SHA256 `715db8a4e4e33e3610899328fa45ae13fdc8c0e7b2057fa7ccd4ca3e8f63ebb2`.

`check.cjs` executes actual public billing exports and actual umbrella `createNeonHostedCallStore` using installed TypeScript 5.9.3 in memory. No copied codec, dist import/build or source edit. CJS loader substitutes `import.meta.url` with the actual file URL solely to parse deployment module; no SDK/provider imports are admitted. Root-path and CJS `import.meta` setup failures are retained in report.json.

## Executed proof
- Run `node docs/audits/production-swarm/capacity-work-2026-10-02/paid-response/check.cjs` (exit0): **71/0**. Twelve unsupported response fixtures (Map, Date, BigInt, cycles, depth65, accessor, toJSON, throwing reflection proxy, undefined, -0, sparse array, 262145-byte JSON) through codec, raw save/recovery, shared save and paid gate/retry. Raw saves have **0 SQL calls**; shared saves **0 backing save calls**. Invalid SQL reads make one necessary read and no write. Paid invalid responses retain pending reservation, **0 debit**, exactly one original fixture provider call and zero second provider call.
- Six hostile capability fixtures (throwing toString, Symbol.toPrimitive, conversion accessor, throwing get proxy, huge unsupported string, symbol) return bounded `ENTITLEMENT_CAPABILITY_UNKNOWN` diagnostics, **0 provider/store/conversion calls**. Serialization/accessor hooks never run; reflection failures are caught, not falsely claimed hook-free.
- Inclusive **262144-byte** valid JSON admitted. Valid adapter save/read preserves exact JSON bytes and SHA256. Interrupted paid call saves response-ready before simulated debit failure; bounded fresh child reconstructs fixture backing from retained JSON, returns exact answer/balance93, **0 provider**, one debit; completed retry does not double charge. Completed debit replay omits response by current contract.
- Negative control `node docs/audits/production-swarm/capacity-work-2026-10-02/paid-response/check.cjs --negative-control` (expected exit1): memory-only Map→{} regression produces **5 failures**, specifically codec/raw-save/raw-recovery/shared-save/paid Map. This proves the probes reach real boundaries without touching product source.

Inputs, observed names/messages, call counts, exact valid response JSON/bytes/hashes and all assertion outcomes: `evidence.json`; mutant output: `negative-control.json`. Initial successful revision had46 checks; final expanded rerun is71, not a merged total.

## Gap/refutation and handoff
Current source refutes the two narrow deep-review08:77 historical failures (lossy Map and hostile hosted capability stringification) at tested seams; **no new source fix needed**. This auxiliary proof does not repeat the full review or certify PR#312. Serial billing/provider owner should preserve `snapshotHostedResponse` at store.ts:623/629/986, provider-adapters.ts:1069/1078 and hosted-ai.ts:823/829, retain primitive-only capability diagnostics and pending/uncertain no-auto-retry. After Astra explicit handoff rerun harness on intended frozen candidate; require71/0 plus mutant5FAIL/exit1. Harness is ready to integrate; source repair already present is not attributed to this work.

## Deferred / limits / cleanup
`deferred-integration.sh` is executable but **NOTRUN**, guarded by explicit serial and heavy-acceptance acknowledgements. It runs this proof, existing scoped owning tests and existing disposable PostgreSQL oracle; requires existing pinned dependencies, cached PG17 and Docker. No build/gate/native/browser/fullsuite, actual DB/jsonb key-order/durability, live provider or published-package typecheck is claimed. Raw SQL is an injected public fixture port; no socket/paid provider/DB needed. Dist never used.
No installs/configuration/source/test/Git publication changes. No temporary files, listeners, services, containers or credentials; two stdin-only bounded child probes exited. Only this auxiliary directory written.
