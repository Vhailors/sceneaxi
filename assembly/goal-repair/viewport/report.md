# Viewport terminal lifecycle repair — SCOPED VERIFIED / REVIEW HOLD

## Ownership and refutation

Only `/tmp/sceneaxi-comprehensive-owned-xd4gdfl1` was edited. Primary and foreign worktrees were not read or changed. No commits, index changes, manifests, policies, installs, root builds, native/Docker commands or browser processes. Reports were created before source edits.

The starting **230-line modular viewport already contained terminal cleanup**: AbortController, pagehide, LIFO releases, loop.stop, ResizeObserver.disconnect, camera-input detachment, mounts.dispose (backend owner), releaseThreeCanvas, canvas.remove and failed-mount finally. Original private reference `/tmp/sceneaxi-viewport-private-reference.ts:1203–1211` confirms those responsibilities. The broad assertion that teardown is absent is refuted; the old 1,400-line module was not restored. Current viewport remains 233 lines.

## Confirmed narrower defects and edits

- `desktop/linux/src/renderer/features/audio-playback.ts:300–320`: terminal abort now initiates real playback/context disposal synchronously. Normal per-session stop still samples silence after 100ms, but retired controls remain abort-owned until closure; abort cancels the pending timer and closes immediately. Retained controls/listeners and pending UI updates are fenced. An AudioContext resume completing after close cannot initiate decode.
- `desktop/linux/src/renderer/features/overlay-report.ts:68`: optional AbortSignal preserves old callers and genuine non-abort failure reporting; late success/rejection and retained report entrypoints cannot paint after abort.
- `desktop/linux/src/renderer/viewport.ts:167,209–213`: supplies the report signal; a late initial inputActions/scene rejection is cancellation, not an outer-catch refusal painted after pagehide. Live readiness failures still report.
- `desktop/linux/test/viewport-terminal-lifecycle.test.ts:1`: permanent executable root ownership regression, loading **actual current viewport, audio-playback, play-loop and overlay-report source**, with **real createAudioPlaybackPort and createSculptMountApi**. Instrumented DOM/GPU/codec/IPC ports replace unavailable host resources. Unrelated scene/feature installers are stubs. No teardown algorithm is copied into the harness; no real pixels/hardware audio are claimed.
- `features/services.ts` unchanged.

## Red → green evidence

`before.log`: 6 passed / 7 failed. Six failures were real delayed context-close / late-overlay defects; one decode-entry failure was a nondeterministic host digest queue. The host digest was corrected to deterministic real SHA-256, with the decode assertion retained (not weakened). `readiness-before.log`: 14 passed / 2 failed, both actual late initial-IPC rejection writes (`expected 1 to be 0`). The final suite retains positive live readiness rejection and live frame-rejection oracles.

The 18 terminal tests cover: real pagehide repeated twice; renderer/input/observer/mount/backend/canvas releases exactly once; retained frame, resize, input, request and report entrypoints; initial input/scene pending resolve **and reject**; actual deferred openPath; frame reply/rejection; partial mount/observe failure and throwing release; playing audio plus pending asset fetch, digest, resume and codec decode; immediate close; no later source start, decode, IPC or UI mutations; retired-stop timer cancellation. Promises settle normally; cancellation does not become fake success or never-settling promises.

### Exact final commands (OWNED cwd)

1. `pnpm exec vitest run desktop/linux/test/viewport-terminal-lifecycle.test.ts desktop/linux/test/audio-lifecycle-compat.test.ts desktop/linux/test/native-assistant-scene-compat.test.ts desktop/linux/test/viewport-input-actions.test.ts --reporter=verbose` — **4 files / 47 tests pass** (`after.log`: 18 new terminal + 29 existing compatibility/input/native assertions).
2. `pnpm exec vitest run desktop/linux/test/audio-lifecycle-compat.test.ts packages/engine-presentation/test/audio-playback.test.ts packages/engine-presentation/test/legacy-audio-compat.test.ts --reporter=verbose` — **3 files / 21 tests pass** (`compatibility.log`, untouched per-clip, profile/Kids, legacy/modern positive/negative cases). Ten tests overlap command 1; distinct total **58**, not 68. The requested historical 49-test command was not supplied/identified; these counts must not be relabeled as that exact suite.
3. `pnpm --dir desktop/linux typecheck` — exit 0 (`typecheck.log`).
4. `pnpm exec tsc --noEmit --target ES2022 --module NodeNext --moduleResolution NodeNext --strict --skipLibCheck desktop/linux/test/viewport-terminal-lifecycle.test.ts` — exit 0 (`test-typecheck.log`).
5. `pnpm exec eslint desktop/linux/src/renderer/viewport.ts desktop/linux/src/renderer/features/audio-playback.ts desktop/linux/src/renderer/features/overlay-report.ts desktop/linux/test/viewport-terminal-lifecycle.test.ts` — exit 0 (`lint.log`). Initial lint found three test-style errors (invalid void generic, empty class, non-null assertion); corrected without assertion changes.
6. `git diff --check -- desktop/linux/src/renderer/viewport.ts desktop/linux/src/renderer/features/audio-playback.ts desktop/linux/src/renderer/features/overlay-report.ts desktop/linux/test/viewport-terminal-lifecycle.test.ts` — exit 0 (read-only Git operation). Existing inherited diff is not attributed to this repair.

## Review hold and source handback

The tested guarantee is **viewport requests/open-path/audio/frame/resize/retained UI work**, not an exhaustive certification of all chrome callbacks. The separately installed BYOK surface receives raw configureByo and is stubbed in this harness; it has no root signal/disposer contract and is outside the granted source scope. Its terminal behavior is unproven and was routed to the controller, not silently called PASS. No real-browser or hardware/audio proof was executed (zero browser processes). Controller owns final freeze/build and publication.

The first reviewer full-merge finding remains **OPEN** until actual commits/main/PR receipts. This source repair is not a production or merge PASS.

Source handback: final SHA-256, byte lengths and preserved modes are in `report.json`; all paths remain in the OWNED worktree. Reports/log hashes are captured separately in `handback.sha256`.
