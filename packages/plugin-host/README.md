# @sceneaxi/plugin-host

First-class v1 Plugin Host for capability-manifest packages (ADR
[0005](../../docs/adr/0005-plugin-host-capability-manifest.md),
[`docs/plugins.md`](../../docs/plugins.md)).

## Public seam

- `openPluginHost` — create a host bound to an exact capability registry
- `load(locators)` — process an **explicit** set of package-root locators
- `list()` — deterministic loaded / refused listings
- `getImplementation(pluginId, capabilityId)` — address one provider; no implicit default

The host consumes only public contracts from `@sceneaxi/schemas`. It does not
import engine packages and never receives an engine service locator.

## Deterministic pipeline (ADR 0005)

Candidates process in stable lexical locator order. Descriptor and isolation
checks run before entrypoint evaluation. Only after those pass does the host
intentionally load the package-root entrypoint and require exact equality
between declared capability IDs and the exported implementation table. A refused
package exposes nothing.

## Non-goals

No CLI/engine/profile wiring, renderer/physics/storage ports, lifecycle hook
bus, hostile-code sandbox claim, or package publication. The seed registry may
be empty; adding the first capability ID is a separate contract change.
