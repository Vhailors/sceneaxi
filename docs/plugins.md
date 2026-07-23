# SceneAxi plugins

SceneAxi v1 plugins are independent packages loaded through the first-class
Plugin Host described by ADR
[0005](adr/0005-plugin-host-capability-manifest.md). They implement public,
versioned semantic contracts; they do not receive arbitrary hooks or access to
engine internals.

The runtime implementation and its public seam live in
[`@sceneaxi/plugin-host`](../packages/plugin-host/README.md). Shared contracts
live in [`@sceneaxi/schemas`](../packages/schemas/README.md).

## Mental model for agents

1. Put the data descriptor at the fixed package-root path
   `sceneaxi.plugin.manifest.json`; the host never imports code to discover it.
2. Read the public capability registry owned with `@sceneaxi/schemas`
   (`contracts/plugin-capability-registry.schema.json` and the checked-in seed
   `contracts/plugin-capability-registry.1.0.0.json`).
3. Declare only capability IDs present in the exact registry version named by
   the manifest.
4. Implement exactly that declared set behind one package-local entrypoint.
5. Expect deterministic refusal for a missing or unreadable descriptor,
   unknown capabilities, incompatible
   versions, plugin IDs repeated in one load set, capability IDs repeated in
   one manifest, entrypoint escape, forbidden imports, or
   declaration/implementation mismatch.

<!-- plugin-capability-registry:seed-state -->
Registry seed state: `registryVersion` is `1.0.0`; `entries` is exactly `[]` (empty).
<!-- /plugin-capability-registry:seed-state -->

The host decides descriptor and isolation refusals before evaluating the
entrypoint. Only a candidate that passes those checks is intentionally loaded;
an implementation-table mismatch then refuses as a post-evaluation integrity
failure before any capability is exposed.

Loaded-plugin listings sort by plugin ID, plugin version, and capability ID.
Refused-candidate listings sort by locator, so malformed or unreadable
descriptors cannot make report order ambiguous. Regression fixtures prove that
descriptor and isolation refusals never execute the entrypoint, while an
implementation-table mismatch executes only after an intentional load and
still exposes nothing (`packages/plugin-host/test/refuse-matrix.test.ts`,
`packages/plugin-host/test/load-refuse.test.ts`).

## Author workflow

1. **Start from the inert example.** Copy
   `packages/schemas/contracts/plugin-manifest.inert.example.json` to
   `sceneaxi.plugin.manifest.json` at your package root (or paste the fenced
   block below). Validate shape with public imports:

   ```ts
   import { readFileSync } from "node:fs";
   import {
     parsePluginManifestText,
     PLUGIN_MANIFEST_PATH,
   } from "@sceneaxi/schemas";

   const text = readFileSync(PLUGIN_MANIFEST_PATH, "utf8");
   const result = parsePluginManifestText(text);
   if (!result.ok) {
     throw new Error(result.diagnostics.map((d) => d.message).join("; "));
   }
   ```

2. **Look up capability IDs** against the exact registry version you pin. A
   miss means stop — never invent a manifest hook, engine port, or unregistered
   ID string:

   ```ts
   import {
     emptyPluginCapabilityRegistrySeed,
     lookupPluginCapability,
   } from "@sceneaxi/schemas";

   const registry = emptyPluginCapabilityRegistrySeed();
   const hit = lookupPluginCapability(registry, "some.capability.id");
   if (!hit.ok) {
     // hit.reason === "unknown-capability"
     // Propose a public contract + registry row; do not claim the ID.
     throw new Error(`unknown capability: ${hit.capabilityId}`);
   }
   ```

3. **Implement only declared capabilities** behind the package-local
   `entrypoint`. Export a single table:

   ```ts
   // package entrypoint — public contracts only; no engine-private imports
   export const capabilities = Object.freeze({
     // keys must equal the manifest capabilities array exactly
   });
   ```

4. **Load explicitly** through the host public seam (no discovery):

   ```ts
   import { openPluginHost } from "@sceneaxi/plugin-host";
   import { emptyPluginCapabilityRegistrySeed } from "@sceneaxi/schemas";

   const host = openPluginHost({
     registry: emptyPluginCapabilityRegistrySeed(),
   });
   const report = await host.load(["/absolute/path/to/plugin-package"]);
   for (const refused of report.refused) {
     // branch on refused.reason — never free text
   }
   const listing = host.list();
   const impl = host.getImplementation("dev.sceneaxi.example.noop", "some.id");
   ```

5. **Address multiple providers** by `(pluginId, capabilityId)`. The host never
   picks an implicit default when two packages implement the same registered ID.

## Manifest fields (v1)

| Field | Meaning |
|---|---|
| `$schema` | Canonical URI of the exact JSON Schema; must agree with `schemaVersion`. |
| `schemaVersion` | Exact plugin-manifest schema version (`1.0.0` for v1). |
| `pluginId` | Reverse-DNS public identity; unique within one host load set. |
| `pluginVersion` | Semver of the plugin implementation. |
| `hostApi` | Semver range of Plugin Host API versions this package accepts. |
| `registryVersion` | Exact capability-registry version against which claims were authored. |
| `entrypoint` | Package-relative module path (no absolute roots or `..` escapes). |
| `capabilities` | Unique public capability ID strings. Empty is valid and inert. |

Normative schema: `packages/schemas/contracts/plugin-manifest.schema.json`
(exported as `@sceneaxi/schemas/contracts/plugin-manifest.schema.json`).
Unknown properties refuse. Shape validation is
`validatePluginManifest` / `parsePluginManifestText` in `@sceneaxi/schemas`.

## Minimal v1 manifest (checked-in fixture)

Save the descriptor below as `sceneaxi.plugin.manifest.json` at the package
root. The seed registry may be empty, so the smallest honest example is inert.
The same JSON is the checked-in conformance fixture
`packages/schemas/contracts/plugin-manifest.inert.example.json` and the
TypeScript helper `inertPluginManifestFixture()`. `pnpm check:contracts`
refuses schema/example/doc drift.

<!-- plugin-manifest:inert-example -->
```json
{
  "$schema": "https://sceneaxi.dev/schemas/plugin-manifest-1.0.0.json",
  "schemaVersion": "1.0.0",
  "pluginId": "dev.sceneaxi.example.noop",
  "pluginVersion": "0.1.0",
  "hostApi": "^1.0.0",
  "registryVersion": "1.0.0",
  "entrypoint": "./dist/plugin.js",
  "capabilities": []
}
```
<!-- /plugin-manifest:inert-example -->

This manifest may validate and appear in the host's plugin list, but it exposes
no behavior. Future examples replace the empty array only with IDs already in
the public registry. Use the package-exported schema and validation API listed
in the [`@sceneaxi/schemas` README](../packages/schemas/README.md).

## Capability registry: stop on absent IDs

If the registry does not contain the capability you need, **stop**. Adding a
manifest string is not how a capability is created. Do **not** invent a
lifecycle hook name, renderer/physics/storage port, engine-private import, or
tutorial-only fake capability to make a package look non-empty.

To add a capability:

1. Design a **public** semantic contract (owning package + versioned surface).
2. Propose a registry row: `capabilityId`, `contractRef`, `contractVersion`,
   `owningPackage`, `documentationRef` against
   `contracts/plugin-capability-registry.schema.json`.
3. Land the contract and registry change with tests and package-boundary review.
4. Only then declare the ID in a plugin manifest.

Renderer, physics, storage, and other internal-library ports still require two
real adapters under ADR
[0004](adr/0004-no-plugin-ports-before-two-adapters.md). The Plugin Host is a
narrow ADR 0005 exception, not a general engine port bus.

## Deterministic refusal table

Stable machine-readable reasons and corrective actions are normative in the
[`@sceneaxi/plugin-host` README](../packages/plugin-host/README.md#stable-refusal-reasons).
Callers branch on `reason`, never free text. Every reason has a named fixture
in `packages/plugin-host/test/refuse-matrix.test.ts`.

## Isolation and non-goals

- The entrypoint stays inside its plugin package; the plugin owns its own
  dependencies.
- Plugins import only public SceneAxi contract packages authorized by their
  registered capabilities. No engine-private paths and no plugin-to-plugin
  imports.
- Declaring `@sceneaxi/engine-kernel` (or any unauthorized `@sceneaxi/*`) in
  package dependencies, or importing it from source, refuses with
  `forbidden-sceneaxi-import` **before** entrypoint evaluation — fixture-tested
  without publishing packages or running untrusted marketplace code.
- The host exposes a capability implementation table, not a lifecycle hook bus
  or service locator.
- Multiple packages may implement one registered capability, but the host does
  not select one implicitly; callers identify the plugin explicitly.
- Package isolation is not a hostile-code sandbox. Untrusted loading needs a
  separate trust and execution decision.

### Package-isolation refusal (copy-safe illustration)

An isolation breach is proven from **descriptor + inspectable package metadata**
before any entrypoint runs. Example package root metadata that the host refuses
with `forbidden-sceneaxi-import` (do not ship this; it is a negative example):

```json
{
  "name": "dev-sceneaxi-example-forbidden",
  "type": "module",
  "dependencies": {
    "@sceneaxi/engine-kernel": "workspace:^"
  }
}
```

Corrective action: depend only on public contract packages authorized by the
declared capabilities (today: typically `@sceneaxi/schemas` when a registered
capability owns that surface). Never import engine packages, private source
paths, or another plugin package. See the host README refusal table and the
`forbidden-sceneaxi-import` fixture in `test/refuse-matrix.test.ts`.

## Implementation tracker

Implementation is intentionally split under tracker
[#19](https://github.com/Vhailors/sceneaxi/issues/19): manifest contract
[#20](https://github.com/Vhailors/sceneaxi/issues/20), registry seed
[#21](https://github.com/Vhailors/sceneaxi/issues/21), host package
[#22](https://github.com/Vhailors/sceneaxi/issues/22), deterministic matrix
[#23](https://github.com/Vhailors/sceneaxi/issues/23), and docs/example
conformance [#24](https://github.com/Vhailors/sceneaxi/issues/24).
