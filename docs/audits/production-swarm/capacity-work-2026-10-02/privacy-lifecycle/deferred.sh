#!/bin/sh
# NOT RUN in auxiliary review. This suite owns disposable DB/browser fixtures.
# Preconditions: explicit new heavy-resource authorization, installed dependencies,
# cached PostgreSQL image and Chromium; no production credentials or live provider.
set -eu
if [ "${1:-}" != "--authorized-heavy" ]; then
  printf '%s\n' 'NOT_RUN: heavy lifecycle suite requires separate explicit authorization.' >&2
  exit 2
fi
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../../../../.." && pwd)
exec pnpm --dir "$ROOT/sites/umbrella" exec vitest run --config vitest.config.ts test/account-lifecycle.test.ts --reporter=verbose
