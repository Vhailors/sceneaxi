# Checkout-boundary auxiliary acceptance

Task: `checkout-boundary`. Status: **NEEDS_LOCAL_HARDENING**; proposal is **NOT LANDED**. All writes are confined to this auxiliary directory. No product edit, staging, install, provider/DB access, build, browser, deployment, or nested agent.

## Actual subject and fixture authority
`acceptance.cjs` executes the exact public `createCheckoutHandler` source through TypeScript 5.9.3 in-memory CommonJS transpilation, with real source dependencies (not copied handler logic, not dist). Injected authority follows `tests/sites/billing-final-acceptance.test.ts:14-41,88-118`. `route.ts:9-20` delegation is statically asserted; this is NOT a Next socket/transport proof or full independent review.

Source references: `sites/umbrella/src/app/api/checkout/checkout-handler.ts:37` handler; `:67-75` origin-before-body; `:89-110` reader/cancellation; `:42-50` JSON 429 mapping. `packages/site-kit/src/deep-link.ts:221-230` rejects alias request URL. Recorded handler SHA-256: `a4c3a2a93dfd3bfa94daefe5fd8e4f655da4330b17aa67d50449056ade6a3ab3`; route: `6d9658d6e8827c71f1794cd52517f1fd62f7e90a1fcd2683e5df39ad00ddbb75`. Full closure fingerprints and restart evidence are in `report.json` and the evidence artifacts; each run rejects source drift.

## Executed evidence
- `node acceptance.cjs`: recorded **22 PASS / 3 FAIL**, exit 1. Exact inputs, input SHA-256, observed refusals, counters, and failures are in `evidence.json`.
- `node acceptance.cjs --proposal`: recorded **25 PASS / 0 FAIL**, exit 0, auxiliary in-memory proposal only.
- `node acceptance.cjs --negative-control`: recorded **17 PASS / 8 FAIL**, expected exit 1. Removes the real origin guard in memory; getter-trap assertions fail, proving the probe is live. Same-origin getter trap also proves the body is actually inspected.
- Retry executed two fresh exact-source processes: **22 PASS / 3 FAIL** each, with identical fingerprints/totals. Proposal and negative control were independently rerun: **25/0** and **17/8**, respectively. `retry-verification.json` records complete output and syntax/read-only patch checks (all PASS). Existing auxiliary artifacts were retained; results are newly executed, not presumed from cache. Negative-control output subject text is imprecise: its `NEGATIVE_CONTROL_MUTANT` fingerprint and command identify the in-memory mutation.

## Refuted and reproduced gaps
Missing/hostile/alias/null Origin returns 403 before body getter, session, and plane access. Valid 8192-byte form reaches verified-user checkout; 8193 bytes returns named 400 and cancels. Duplicate fields, malformed JSON and multipart refuse before authority access. JSON rate limiting returns 429 / Retry-After 300; HTML intentionally redirects 303. Host alias alone cannot rewrite configured redirects; alias request URL deliberately refuses 402 (corrected initial harness expectation).

Three live reader failures: request abort leaves stalled reader pending/locked with zero cancels at 100 ms; zero-byte stalled stream has no source deadline; 8193-byte overflow awaits nonsettling cancellation, holding refusal pending/locked at 100 ms. A 100-ms observation is not an externally defined product SLA; five-second deadline is a proposed policy requiring integrator approval.

## Serial handoff / deferred acceptance
At explicit Astra freeze release ONLY, approve/apply `reader-proposal.patch` to `checkout-handler.ts:89-111`: race reads against request abort/deadline, remove listener/timer, initiate cancellation without awaiting transport, release reader lock. No public-interface change. Require exact-source harness **25 PASS / 0 FAIL**, expected failing guard mutant, fresh-process identical fingerprints, then owning contracts/typecheck. Proposal acceptance in memory does not establish landed code or type safety.

`deferred-acceptance.sh --authorized-heavy-handoff` is executable but **NOT RUN**: isolated immutable candidate and explicit heavy-job authority required; owning tests, site typecheck/build, then independent Next HTTP disconnect/origin/budget probes with fresh artifact hashes and unique owned port. Loader does not typecheck, and source fingerprints do not certify dist or PR #312.

## Cleanup / limitations
Pending readers are errored/cancelled, deferred cancellation promises released. No ports, temporary external fixtures, workers, credentials, or dist artifacts touched. Prior launcher/root, mutable post-cleanup assertions, alias expectation, and proposal-anchor errors are disclosed in `report.json`; corrected observations are recorded, not hidden. This is auxiliary boundary proof, not duplicate full review.
