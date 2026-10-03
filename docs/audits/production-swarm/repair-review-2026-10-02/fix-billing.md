# Billing repair review

Status: NEEDS_LOCAL_FIX. Work in progress; no current published SHA, full gate or production certification.

Scope: assigned billing/provider/DB seams; preserve inherited dirty work, TEST-only and hosted default-off policies. Root/site builds, root tests and publication belong to serial integration. No spend, production DB, LIVE activation or Git publication performed.

Primary repair assertions: 05-004 accessor-free bounded durable response contract with exact replay/no second provider; 05-005 hostile capability diagnostics refuse without conversion hooks or provider/store calls. Preserve all 15 disposable PostgreSQL race/restore oracles. Assigned external inputs remain explicitly blocked and broader intentional capabilities remain open for full production.

## Current executed evidence

- New `packages/billing/test/hosted-response.test.ts`: original 18 assertions reproduced **16 FAIL / 2 PASS** (lossy Map/Date/undefined/negative-zero/NaN/sparse/accessor/toJSON saves, incorrect malformed recovery/debit, hostile conversion throws). After repair, expanded **22 PASS**, including exact-byte/depth/value limits, producer mutation, PostgreSQL-compatible Unicode and fresh-process response decode; temporary fixture directory removed in `finally`.
- `packages/billing/src/hosted-response.ts` now owns bounded descriptor snapshots and hook-free serialization. `store.ts` validates both saves and response-ready reads at the shared boundary and in-memory implementation. `hosted-ai.ts` uses a fixed capability refusal and returns validated JSON for paid/recovered answers, never casting recovered JSON to generic `Response`. Unsupported responses retain reservations, do not debit, and retries do not invoke the provider again.
- Owned billing ESLint and `tsc --project packages/billing/tsconfig.json --noEmit` PASS after fixing one no-control-regex error and one newly written proxy-fixture typing error; original failures retained in JSON.
- Fresh `node --test db/local-postgres-oracle.mjs`: **exit 0; 15 PASS / 0 FAIL / 0 SKIP**. Current migration runner/ledger/reservation/quota races and populated 24-table dump/restore counts/digests/guards executed against disposable cached PostgreSQL17. Container removed in test `finally`; no image pull, production data or provider call.
- Latest combined owning command includes newly added root adapter oracles and remains FAIL at the graph-owned raw deployment adapter. `provider-adapters.ts`, account/checkout and root provider tests belong to identity/serial integration, not billing. Exact requests: restore `SqlRow = Readonly<Record<string, unknown>>`, keep unknown inputs at parser boundaries; use exported `snapshotHostedResponse` before raw save SQL and on response-ready reads. Both failures and exact commands/hashes retained in JSON. No casts or weakened oracles requested.

Full source hashes, raw executed output and nontransferred task accounting are retained in `fix-billing.json`. Root/site builds, exact published SHA/required CI and full-production inputs remain unverified by this lane.
