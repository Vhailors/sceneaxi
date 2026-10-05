#!/bin/sh
# Serial owner: build packages + desktop runtime first; requires existing approved Linux host binaries.
# NOT RUN by builder. No install, signing, publication or provider access.
set -eu
ROOT=/home/devuser/Documents/Projects/sceneaxi
REPORT=$ROOT/docs/audits/production-swarm/implementation-expansion-2026-10-02/unsigned-project-build
: "${SCENEAXI_LOCAL_ELECTRON:?Set approved absolute symlink-free Electron executable}"
: "${SCENEAXI_LOCAL_RENDERER:?Set existing built standalone renderer.js}"
: "${SCENEAXI_LOCAL_PUBLISHER:?Set existing sceneaxi-publish-no-replace executable}"
TMP=$(mktemp -d /tmp/sceneaxi-local-smoke-driver.XXXXXX)
trap 'rm -rf "$TMP"' EXIT HUP INT TERM
"$ROOT/desktop/linux/node_modules/.bin/esbuild" "$REPORT/native-smoke.ts" --bundle --platform=node --format=esm --packages=external --outfile="$TMP/smoke.mjs"
dbus-run-session -- xvfb-run -a node --import "$ROOT/scripts/workspace-dist-resolver.mjs" "$TMP/smoke.mjs" --electron "$SCENEAXI_LOCAL_ELECTRON" --renderer "$SCENEAXI_LOCAL_RENDERER" --publisher "$SCENEAXI_LOCAL_PUBLISHER"
