#!/bin/sh
set -eu
# NOT RUN by capacity worker. Exclusive integration/browser token required.
[ "${CATALOG_SERIAL_HANDOFF:-}" = "stable-source-and-fresh-site-builds-approved" ] || { echo 'REFUSED: stable source, fresh hashed catalog builds, existing dependencies and exclusive browser token required' >&2; exit 78; }
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../../../../.." && pwd)
cd "$ROOT"
# Revalidate the source-backed oracle before deferred site acceptance.
node docs/audits/production-swarm/capacity-work-2026-10-02/catalog-query/probe.cjs
# Requires installed existing site dependencies; no dependency install or build here.
pnpm --dir sites/catalog-game exec tsc --noEmit --incremental false
pnpm --dir sites/catalog-web exec tsc --noEmit --incremental false
# Existing four-site proof also needs stable rebuilt umbrella/Kids and browser token.
node sites/catalog-game/test/repair-accessibility-proof.mjs
