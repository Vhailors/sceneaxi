#!/bin/sh
# NOT RUN. Separate serial-owner heavy-job grant, frozen clean accepted candidate,
# existing frozen dependencies and explicit authority required. Never signs/publishes.
set -eu
[ "${1:-}" = '--execute-authorized' ] || { echo 'NOT RUN: requires --execute-authorized SHA plus separate serial-owner heavy-job grant'; exit 2; }
[ "${SCENEAXI_SERIAL_HEAVY_GRANTED:-}" = 'yes' ] || { echo 'NOT RUN: no serial heavy-job grant'; exit 2; }
root=$(git rev-parse --show-toplevel)
[ "$root" = '/home/devuser/Documents/Projects/sceneaxi' ] || exit 2
[ "$(git rev-parse HEAD)" = "${2:?immutable accepted candidate SHA required}" ] || exit 2
git diff --quiet
git diff --cached --quiet
# Operator must separately approve complete path/blob/mode inventory and untracked set.
pnpm docs:api
pnpm gate
pnpm build:sdk
for site in umbrella catalog-game catalog-web kids; do
  pnpm --dir "sites/$site" typecheck
  pnpm --dir "sites/$site" build
done
# Native/signing/platform actions are NOT performed by this packet.
