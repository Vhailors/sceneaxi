#!/bin/sh
# NOT RUN: heavy acceptance requires explicit independent release + job token.
set -eu
if [ "${SCENEAXI_RELEASED_HEAVY_ACCEPTANCE:-}" != "explicit-owner-release" ]; then
  echo 'NOTRUN: requires Astra release, serial integrator authority, exclusive heavy token and exact clean candidate checkout' >&2
  exit 2
fi
: "${CANDIDATE_SHA:?immutable accepted candidate commit required}"
[ "$(git rev-parse HEAD)" = "$CANDIDATE_SHA" ] || { echo 'REFUSED: HEAD differs from candidate' >&2; exit 2; }
[ -z "$(git status --porcelain)" ] || { echo 'REFUSED: candidate checkout is dirty' >&2; exit 2; }
# Installs, secrets, provider/database actions, signing and publication are absent.
pnpm gate
for site in umbrella catalog-game catalog-web kids; do
  pnpm --dir "sites/$site" build
done
# SDK/docs/native/rendered acceptance stays separately owned; this is not their PASS.
