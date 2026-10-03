#!/bin/sh
# NOTRUN here. Future serial integrator only; cannot authorize itself.
set -eu
if [ "${1-}" != '--authorized-heavy-handoff' ]; then
  printf '%s\n' 'NOTRUN: requires explicit Astra freeze release, serial heavy-job authority, approved/included source patch, immutable candidate, correct existing dependencies and isolated build output; no live provider/DB/credentials.'
  exit 2
fi
ROOT=$(realpath "$(dirname "$0")/../../../../..")
printf '%s\n' 'Caller certifies separate explicit handoff authority and isolated checkout; existing workers must not be disturbed.'
# All heavy work below deliberately deferred, never executed by auxiliary agent.
pnpm --dir "$ROOT" exec vitest run tests/sites/billing-final-acceptance.test.ts tests/sites/site-response-hardening.test.ts
pnpm --dir "$ROOT/sites/umbrella" typecheck
pnpm --dir "$ROOT/sites/umbrella" build
node "$ROOT/docs/audits/production-swarm/capacity-work-2026-10-02/checkout-boundary/acceptance.cjs"
printf '%s\n' 'Remaining NOTRUN: independently start the fresh artifact on a unique owned loopback port and prove real Next HTTP malformed/origin/budget/client disconnect behavior, recording artifact hashes and cleaning only owned socket. No provider/production authority is conveyed.'
