# SceneAxi verification map

Build and run doctor with [the skill](../SKILL.md) first. Each recipe selects existing tests rather than another test implementation.

| Feature | Entry points and proof |
| --- | --- |
| [Document edits](documents.md) | CLI, desktop command and web inspector propose/apply; bytes and hashes agree. |
| [Fixture assistant](assistant.md) | Inspector HTTP assistant route and embedded panel API; fixture reply without metering. |
| [Credit reconciliation](../../../../docs/auth-credits.md#operator-reconciliation-records) | Signed `POST /api/stripe/webhook` application path. Run `pnpm exec vitest run packages/billing/test/stripe-webhook-reconciliation.test.ts tests/sites/identity-plane-wiring.test.ts tests/sites/provider-adapters.test.ts tests/db/schema-lockstep.test.ts tests/e2e/auth-credits-refuse-matrix.test.ts`. Proves durable adapter records, replay, unchanged credits, and 200/503/400 outcomes with fixture providers, not live Stripe or PostgreSQL. |
| [Profile policy](profiles.md) | CLI and desktop open-path commands plus web-shell public view; Game/Web parity and Kids refusal. |
| [Linux crash diagnostics](../../../../docs/desktop-linux.md#local-crash-diagnostics) | Native Help → Reveal logs; local rotating event log and minidumps; renderer-loss Reload window. Verify in packaged Electron, not the root inspector. |
| [Three viewport](three-viewport.md) | Browser `/open` canvas, orbit, mount, reset, idle pacing, screenshots and timing samples. |
| Hosted logout | `POST /api/logout` delegates to `performLogout`. Run `pnpm exec vitest run tests/sites/umbrella-login-flow.test.ts tests/sites/identity-plane-wiring.test.ts`, then `pnpm --dir sites/umbrella test:provider`. The real Better Auth handler must stop resolving the revoked cookie and bearer. Failed deletion must produce a named refusal and permit retry. These checks use isolated stores, not a deployed database. |

This is a seed map, not complete product coverage. For packaged desktop, sites, engine playback, importers, plugins or billing changes, start at [runnable surfaces](../../../../docs/runnable-surfaces.md) and its owning test/doc. Add the changed user entry points here. Headless tests do not prove WebGL pixels, native dialogs, hosted sign-in or deployment.

Use separate scratch projects and OS-assigned ports for parallel inspectors. Keep evidence outside scratch state. Record feature ID, entry point, command, exit status and observed outcome. A failure or unavailable browser is a reported gap, never a pass through a different path.
