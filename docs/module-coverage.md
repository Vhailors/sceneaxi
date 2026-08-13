# Module coverage and end-to-end chain evidence

Canonical product scope is [sceneaxi#1](https://github.com/Vhailors/sceneaxi/issues/1)
and the in-tree consumer copy [`docs/program/SPEC.md`](program/SPEC.md). Architecture
owners are the ADRs under [`docs/adr/`](adr/). This document does not copy those
policies and authorizes no Stage 1 proof, Kids LLM/commerce, Stripe live, deploy,
or publication.

Allowed edges stay in [`docs/dependency-matrix.json`](dependency-matrix.json). The
table below adds the remaining module-matrix fields: role, public seam,
verification owner, and status. `pnpm check:boundaries` still owns the edges;
`tests/docs/module-coverage.test.ts` owns this table.

Statuses: **real** (shipped and evidenced), **partial** (honest named gap),
**dormant** (present, unused), **delayed** (spec slot, not on disk).

## Module matrix

| Package | Role | Public seam | Verification owner | Status |
|---|---|---|---|---|
| `@sceneaxi/schemas` | Shared contracts and seam vocabulary | `packages/schemas/src/index.ts` | `packages/schemas/test/seam.test.ts` | **real** |
| `@sceneaxi/engine-kernel` | Game Kernel: open/dispatch/advance/observe/save/replay | `packages/engine-kernel/src/index.ts` | `packages/engine-kernel/test/scene-session.test.ts` | **real** |
| `@sceneaxi/engine-presentation` | Presentation runtime behind ADR 0002 | `packages/engine-presentation/src/index.ts` | `packages/engine-presentation/test/seam.test.ts` | **real** |
| `@sceneaxi/engine-orchestrator` | Open-path host above the kernel (ADR 0023) | `packages/engine-orchestrator/src/index.ts` | `packages/engine-orchestrator/test/golden-path-orchestrated.test.ts` | **real** |
| `@sceneaxi/authoring-core` | Document, propose/apply, Model Provider Port | `packages/authoring-core/src/index.ts` | `packages/authoring-core/test/model-provider-port.test.ts` | **real** |
| `@sceneaxi/profile-game` | Game profile conformance and open path | `packages/profile-game/src/index.ts` | `packages/profile-game/test/seam.test.ts` | **real** |
| `@sceneaxi/profile-web` | Web Experience profile | `packages/profile-web/src/index.ts` | `packages/profile-web/test/seam.test.ts` | **real** |
| `@sceneaxi/profile-kids` | Kids profile; isolation deny surface | `packages/profile-kids/src/index.ts` | `packages/profile-kids/test/seam.test.ts` | **real** |
| `@sceneaxi/cli` | Thin protocol adapter over authoring-core | `packages/cli/src/index.ts` | `packages/cli/test/bin-smoke.test.ts` | **real** |
| `@sceneaxi/importers` | Contained external-content adapters | `packages/importers/src/index.ts` | `packages/importers/test/seam.test.ts` | **real** |
| `@sceneaxi/provider-openrouter` | Fixture-tested OpenRouter adapter | `packages/provider-openrouter/src/index.ts` | `packages/provider-openrouter/test/adapter.test.ts` | **real** |
| `@sceneaxi/plugin-host` | Capability-manifest plugin host (ADR 0005) | `packages/plugin-host/src/index.ts` | `packages/plugin-host/test/seam.test.ts` | **real** |
| `@sceneaxi/auth` | Identity port and single-admin resolution | `packages/auth/src/index.ts` | `packages/auth/test/identity-port.test.ts` | **real** |
| `@sceneaxi/billing` | Ledger, metering, fixture commerce | `packages/billing/src/index.ts` | `packages/billing/test/entitlements.test.ts` | **real** |
| `@sceneaxi/web-shell` | Local browser authoring shell | `apps/web-shell/src/index.ts` | `apps/web-shell/test/assistant-panel.test.ts` | **real** |
| `@sceneaxi/desktop-shell` | Engine Desktop chrome and session | `apps/desktop-shell/src/index.ts` | `apps/desktop-shell/test/app.test.ts` | **real** |
| `@sceneaxi/catalog-game` | Dormant Game catalog app | `apps/catalog-game/src/index.ts` | `apps/catalog-game/test/seam.test.ts` | **dormant** |
| `@sceneaxi/catalog-web` | Dormant Web catalog app | `apps/catalog-web/src/index.ts` | `apps/catalog-web/test/seam.test.ts` | **dormant** |
| `@sceneaxi/site-kit` | Shared site behaviour, no React | `packages/site-kit/src/index.ts` | `packages/site-kit/test/change-review.test.ts` | **real** |
| `@sceneaxi/site-umbrella` | Deployable umbrella site (ADR 0018/0022) | `sites/umbrella/src/index.ts` | `tests/sites/identity-plane-wiring.test.ts` | **real** |
| `@sceneaxi/site-catalog-game` | Game storefront install root | `sites/catalog-game/src/index.ts` | `tests/sites/catalog-storefronts.test.ts` | **real** |
| `@sceneaxi/site-catalog-web` | Web storefront install root | `sites/catalog-web/src/index.ts` | `tests/sites/catalog-storefronts.test.ts` | **real** |
| `@sceneaxi/site-kids` | Isolated Kids origin; empty allow list | `sites/kids/src/index.ts` | `tests/sites/kids-surface.test.ts` | **real** |
| `@sceneaxi/desktop-linux` | Packaged Linux desktop (ADR 0024) | `desktop/linux/src/index.ts` | `tests/e2e/desktop-linux-bridge-golden.test.ts` | **real** |
| `@sceneaxi/desktop-windows` | Windows packaging root; no public download yet | `desktop/windows/src/index.ts` | `tests/e2e/desktop-project-build-golden.test.ts` | **partial** |
| `@sceneaxi/desktop-macos` | macOS packaging root; stages Linux runtime | `desktop/macos/src/index.ts` | `desktop/macos/test/seam.test.ts` | **partial** |
| `@sceneaxi/engine-asset-compiler` | Delayed engine package reserved by spec #1 | `docs/program/SPEC.md` | `docs/program/spec-41.md` | **delayed** |
| `@sceneaxi/engine-platform-host` | Delayed engine package reserved by spec #1 | `docs/program/SPEC.md` | `docs/program/spec-41.md` | **delayed** |
| `@sceneaxi/engine-evidence` | Delayed engine package reserved by spec #1 | `docs/program/SPEC.md` | `docs/program/spec-41.md` | **delayed** |
| `@sceneaxi/provider-<name>` | Delayed extra provider adapters | `docs/program/SPEC.md` | `docs/program/SPEC.md` | **delayed** |

## Provider → authoring → desktop → engine sequence

Reproducible, fixture-only. No live credentials, network, or hosted desktop
metering.

1. `pnpm exec vitest run tests/e2e/desktop-provider-host-golden.test.ts` —
   privileged OpenRouter composition, Model Provider Port, exact model pin,
   credential lease, named missing-config refusals.
2. `pnpm exec vitest run tests/e2e/desktop-provider-authoring-engine-golden.test.ts` —
   one BYOK Build through that host into `assistant-apply-build`, Change Review
   accept/reject, persist/reopen, and `open-path` play.
3. `pnpm exec vitest run tests/e2e/rarity-provider-desktop-golden.test.ts` —
   the bounded Agent fixture through the same port, review, persist, and kernel
   replay.
4. `pnpm exec vitest run tests/e2e/desktop-linux-bridge-golden.test.ts` —
   packaged-like bridge, scene, and open-path without claiming pixels.

Named expected refusals on that path:

- `ASSISTANT_SCULPT_KIDS_DENIED`
- `DESKTOP_ASSISTANT_HOSTED_METERING_UNAVAILABLE`
- `DESKTOP_ASSISTANT_BYO_UNAVAILABLE`
- `DESKTOP_RARITY_PROVIDER_UNAVAILABLE`
- `content-hash-conflict`

Boundary, contract, unit, and site checks stay `pnpm gate`. Desktop smoke that
needs a window is a host concern, not a second product path.

## Host limitations

The Electron 43.2.0 local headless graphics crash remains a **host limitation**:
local packaged GPU-process SIGSEGV before SceneAxi printed proof. CI under Xvfb
owns the valid packaged-runtime record. This is not a SceneAxi defect unless new
evidence says otherwise. See [`desktop-linux.md`](desktop-linux.md) and the
capability-matrix audit.

## What this does not claim

- Engine-ready, commercially validated, kids-safe, or marketplace-ready.
- Live provider credentials, hosted desktop identity/credits, or Stage 1 proof.
- Catalog activation, `shippingClaim`, delayed engine packages, or publication.
