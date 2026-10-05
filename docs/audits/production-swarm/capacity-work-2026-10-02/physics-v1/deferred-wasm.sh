#!/bin/sh
# NOT RUN during frozen Astra review. Requires explicit WASM job permission,
# existing pinned dependency and installed TypeScript. No install/build performed.
set -eu
[ "${SCENEAXI_ALLOW_DEFERRED_WASM:-}" = "yes" ] || { echo 'NOTRUN: set SCENEAXI_ALLOW_DEFERRED_WASM=yes only after explicit handoff'; exit 2; }
exec timeout 90s node "$(dirname "$0")/probe.cjs" --wasm
