#!/bin/sh
set -eu
# NOTRUN in capacity work. Only serial integrator may authorize these checks.
: "${SCENEAXI_SERIAL_HANDOFF_APPROVED:?requires explicit source-unfreeze/serial handoff}"
: "${SCENEAXI_HEAVY_ACCEPTANCE_APPROVED:?requires separate disposable PostgreSQL/container budget}"
[ "$SCENEAXI_SERIAL_HANDOFF_APPROVED" = yes ]
[ "$SCENEAXI_HEAVY_ACCEPTANCE_APPROVED" = yes ]
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../../../../.." && pwd)
cd "$ROOT"
# Preconditions: existing pinned dependencies; Docker available; cached PG17 image;
# no live/production credentials needed or authorized. The existing oracle owns cleanup.
node docs/audits/production-swarm/capacity-work-2026-10-02/paid-response/check.cjs
pnpm exec vitest run packages/billing/test/hosted-response.test.ts tests/sites/provider-adapters.test.ts
node --test db/local-postgres-oracle.mjs
