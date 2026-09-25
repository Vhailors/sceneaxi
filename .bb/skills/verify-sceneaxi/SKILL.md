---
name: verify-sceneaxi
description: Verify SceneAxi changes through its real CLI binaries, local web inspector, focused tests and repository gate. Use after changes or when collecting runtime evidence; includes isolated inspector launch, state inspection and screenshots.
---

# Verify SceneAxi

Read [the feature map](features/README.md) and select the changed behavior. SceneAxi is an engine/library, not one web app. This skill drives the root binaries and local inspector. [Runnable surfaces](../../../docs/runnable-surfaces.md) owns the full inventory. Site builds and packaged Electron require their separate install roots and proofs; root tests cannot prove their pixels.

## Launch

Run on Linux from the repository root with Bash, coreutils, curl, Node matching `package.json`, and its pinned pnpm. Install both existing lockfiles, as [CI](../../../.github/workflows/gate.yml) does. The root test typecheck also needs the Linux desktop's Electron types and package links. Rebuild after source changes because binaries execute `dist`, not TypeScript sources.

```bash
export VITEST_MAX_WORKERS=2
pnpm install --frozen-lockfile
pnpm --dir desktop/linux install --frozen-lockfile
.bb/skills/verify-sceneaxi/verify build
.bb/skills/verify-sceneaxi/verify doctor
```

For an interactive inspector, create scratch state and evidence separately. Run these in one Bash session. The empty project is deliberate; mutation proof uses the existing seeded binary tests.

```bash
VERIFY=.bb/skills/verify-sceneaxi/verify
PROJECT=$(mktemp -d /tmp/sceneaxi-verify.XXXXXX)
mkdir -p .cache
EVIDENCE=$(mktemp -d "$PWD/.cache/verify-sceneaxi.XXXXXX")
"$VERIFY" serve "$PROJECT" >"$EVIDENCE/server.log" 2>&1 &
SERVER_PID=$!
for attempt in {1..100}; do
  URL=$(sed -n 's/^[[:space:]]*url:[[:space:]]*//p' "$EVIDENCE/server.log" | head -n 1)
  if [[ -n $URL ]] || ! kill -0 "$SERVER_PID" 2>/dev/null; then break; fi
  sleep 0.1
done
[[ -n $URL ]] && kill -0 "$SERVER_PID" &&
  printf 'pid=%s url=%s project=%s evidence=%s\n' "$SERVER_PID" "$URL" "$PROJECT" "$EVIDENCE"
```

Readiness is `sceneaxi-web-shell: serving the inspector` and a printed `http://127.0.0.1:<port>/` URL. Port `0` isolates parallel sessions. Never serve the checkout or a user's project for a mutation check. If launch fails, read `server.log`, run cleanup, and report the failure. In agent tools, use a persistent terminal or background runner and retain its handle instead of assuming shell variables survive separate calls.

## Doctor

`verify doctor` is read-only. It checks the Node range, pinned pnpm, root test/build executables, desktop typecheck dependencies, and all three built binaries' help entrypoints. Success prints `doctor OK`. It does not prove build freshness, a packaged Electron launch, site installs, or server ownership. Confirm the URL came from this run's log and the saved process is still alive before driving it.

## Drive

These are all helper commands, including a focused-file example. The worker limit above reduces concurrent processes, not test coverage. Run the long checks through the agent's background runner. Preserve their exit codes when capturing logs.

```bash
"$VERIFY" help
"$VERIFY" inspect "$URL" >"$EVIDENCE/state.json"
"$VERIFY" screenshot "$URL" "$EVIDENCE/inspector.png"
"$VERIFY" test >"$EVIDENCE/smoke.log" 2>&1
"$VERIFY" test tests/parity/shell-cli-parity.test.ts >"$EVIDENCE/parity.log" 2>&1
"$VERIFY" gate >"$EVIDENCE/gate.log" 2>&1
```

Inspection must return `app: sceneaxi-web-shell`, `ok: true`, and `snapshot.phase: idle` for this empty project. `test` defaults to the three existing binary smoke suites. They spawn real processes and prove edits through public commands and HTTP, including unchanged bytes before acceptance and changed bytes after acceptance. File arguments select existing `.test.ts` files. Flags and nonexistent paths refuse before Vitest runs. The authoritative `gate` delegates to the root script unchanged, including contract, boundary, type/build, test and lint checks. A focused pass never substitutes for the gate.

Screenshot requires installed Chrome/Chromium, optionally selected by `CHROME_BIN`. It uses a fresh temporary profile and refuses an existing output path. Open the resulting PNG and check the inspector heading and project root. It proves only inspector rendering, not an engine viewport. If Chrome is unavailable or sandboxing fails, report that limitation; do not add dependencies or disable its sandbox just to pass.

## Evidence

Retain command, revision, exit code, stdout/stderr, state JSON, and the inspected screenshot. Store files under the printed `EVIDENCE` directory. It is local proof, not something to add to a commit. For changed behavior, capture the action and resulting state, including persisted bytes for writes and named refusals for denied operations. Existing fixture-provider tests prove fixture mode only. Do not invent captain decisions, replace held-key registries, enable hosted AI, use live credentials, or infer shipping authorization from a test pass.

## Cleanup

In the same shell, stop only the saved process and delete only this run's scratch project. Run this after failed attempts too. Keep evidence for review.

```bash
if kill -0 "$SERVER_PID" 2>/dev/null; then kill "$SERVER_PID"; fi
if wait "$SERVER_PID"; then echo 'Server stopped.'; else echo 'Server exited nonzero; inspect server.log.'; fi
rm -rf -- "$PROJECT"
test -s "$EVIDENCE/server.log" && test -s "$EVIDENCE/state.json" && test -s "$EVIDENCE/inspector.png"
printf 'Retained evidence: %s\n' "$EVIDENCE"
```

A signal exit from `wait` is expected if the server did not handle termination. For agent background tools, stop the saved handle and confirm exit. Never kill by process name. Chrome removes its own temporary profile on normal exit. Do not delete screenshots or logs with the scratch project.

## Helpers

[verify](verify) is the executable command adapter. Unknown commands, wrong argument counts, and non-loopback URLs exit `2`. It changes no dependency, held-key, or application configuration. [check](check) checks the adapter's usage refusals and skill structure without launching the app.

```bash
.bb/skills/verify-sceneaxi/check
```

Update the feature map when routes, controls, or outcomes change. Use `/maintain-verification-skill` for a later audit; this skill itself grants no commit, push, deployment, or merge authority.
