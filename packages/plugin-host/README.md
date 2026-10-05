# @sceneaxi/plugin-host

First-class v1 Plugin Host for capability-manifest packages (ADR
[0005](../../docs/adr/0005-plugin-host-capability-manifest.md),
[`docs/plugins.md`](../../docs/plugins.md)).

## Public seam

Import only the package root:

```ts
import {
  openPluginHost,
  PLUGIN_HOST_API_VERSION,
  type PluginHost,
  type PluginHostOptions,
  type PluginHostLoadResult,
  type PluginHostListing,
  type PluginCapabilityImplementationResult,
  type CapabilityContractCheck,
  type CapabilityContractCheckResult,
  type CapabilityContractChecks,
  type PluginRefusalReason,
  type RefusedPlugin,
  type LoadedPlugin,
} from "@sceneaxi/plugin-host";
import {
  pluginCapabilityRegistrySeed,
  type PluginCapabilityRegistry,
} from "@sceneaxi/schemas";
```

### Signatures

```ts
function openPluginHost(options?: PluginHostOptions): PluginHost;

type PluginHostOptions = {
  /** Exact capability registry document. Defaults to the checked-in v1 seed. */
  readonly registry?: PluginCapabilityRegistry;
  /** Override advertised host API version (tests only). Defaults to 1.0.0. */
  readonly hostApiVersion?: string;
  /**
   * Injected per-capability contract checks, keyed by registered capability ID.
   * An implementation that fails its check refuses with
   * `capability-contract-violation` and exposes nothing.
   */
  readonly capabilityContracts?: CapabilityContractChecks;
};

type CapabilityContractCheckResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly message: string };

type CapabilityContractCheck = (
  implementation: unknown,
) => CapabilityContractCheckResult;

type CapabilityContractChecks = ReadonlyMap<string, CapabilityContractCheck>;

type PluginHost = {
  /**
   * Process an explicit set of package-root locators.
   * Replaces any previous load set. No filesystem/environment/dependency scanning.
   */
  readonly load: (
    locators: readonly string[],
  ) => Promise<PluginHostLoadResult>;
  /** Deterministic loaded + refused listings from the last load. */
  readonly list: () => PluginHostListing;
  /**
   * Address one capability implementation by (pluginId, capabilityId).
   * Multiple providers coexist; the host never selects an implicit default.
   */
  readonly getImplementation: (
    pluginId: string,
    capabilityId: string,
  ) => PluginCapabilityImplementationResult;
  /** Host API version advertised for hostApi range checks. */
  readonly hostApiVersion: string;
  /** Bound registry document (exact version). */
  readonly registry: PluginCapabilityRegistry;
};
```

`PLUGIN_HOST_API_VERSION` is the exact version advertised to manifests via
`hostApi` ranges (`"1.0.0"` for v1).

The host consumes only public contracts from `@sceneaxi/schemas`. It does not
import engine packages and never receives an engine service locator.

### Lookup miss reasons (`getImplementation`)

| Reason | Meaning | Corrective action |
|---|---|---|
| `plugin-not-loaded` | No loaded plugin has that `pluginId`. | Load the package first, or fix the plugin id spelling. |
| `capability-not-implemented` | Plugin is loaded but does not implement that capability. | Claim and implement the ID (only if it exists in the registry), or use a different address. |
| `not-addressable` | Plugin id is not uniquely addressable in the load set. | Ensure `pluginId` is unique within one `load` set (duplicates refuse at load). |

## Deterministic pipeline (ADR 0005)

Candidates process in stable lexical locator order. Descriptor and isolation
checks run before entrypoint evaluation. Only after those pass does the host
intentionally load the package-root entrypoint and require exact equality
between declared capability IDs and the exported implementation table, followed
by whatever capability-contract checks the caller injected. A refused package
exposes nothing.

Loaded listings sort by `pluginId`, then `pluginVersion`, then capability ID.
Refused listings sort by locator.

The complete refusal matrix — every stable refusal reason, refusal precedence,
and execution-sentinel evidence for pre- vs post-evaluation refusals — is
fixture-tested over the public seam in `test/refuse-matrix.test.ts` and
`test/load-refuse.test.ts`; extend those when touching the pipeline.

Repository golden coverage uses this public seam in three paths. The CLI golden
loads the checked-in inert sample and names an illegal-claim refusal. The
importers/plugin golden binds a test-only registry to the capability sample and
asserts addressed lookup hits and misses. The capability golden drives the one
**registered** capability (`sceneaxi.sculpt.intake-source.v1`) from the shipped
seed through load, contract check, addressed call, and a golden Sculpt Intake —
and proves the same provider refuses when the bound registry defines nothing.
See
[`tests/e2e/cli-golden-path.test.ts`](../../tests/e2e/cli-golden-path.test.ts),
[`tests/e2e/importers-plugin-golden.test.ts`](../../tests/e2e/importers-plugin-golden.test.ts),
and
[`tests/e2e/plugin-capability-golden.test.ts`](../../tests/e2e/plugin-capability-golden.test.ts).
Run them with `pnpm test:golden`; their fixtures live under
`tests/e2e/fixtures/plugin-host/`.

## Stable refusal reasons

Every `RefusedPlugin.reason` is a stable machine-readable code. Branch on
`reason`; treat `message` as diagnostic only. `phase` is one of `descriptor`,
`isolation`, `evaluation`, or `integrity`. `entrypointEvaluated` is `true` only
after an intentional load (integrity / evaluation failures).

| Reason | Phase | Corrective action |
|---|---|---|
| `descriptor-missing` | descriptor | Place `sceneaxi.plugin.manifest.json` at the package root locator. |
| `descriptor-unreadable` | descriptor | Fix filesystem permissions/encoding so the descriptor can be read as UTF-8 text. |
| `descriptor-invalid` | descriptor | Fix JSON parse errors, unknown fields, or shape failures against `plugin-manifest.schema.json` / `validatePluginManifest`. |
| `schema-version-unsupported` | descriptor | Set `schemaVersion` to the host-supported value (`1.0.0` for v1). Silent migration is refused. |
| `host-api-incompatible` | descriptor | Widen or retarget `hostApi` so it satisfies `PLUGIN_HOST_API_VERSION`. |
| `registry-version-mismatch` | descriptor | Pin `registryVersion` to the exact registry document bound into the host. |
| `duplicate-plugin-id` | descriptor | Ensure each `pluginId` appears once in a single `load` set. |
| `unknown-capability` | descriptor | Remove unregistered IDs, or propose a public capability contract and registry row — never invent a hook/port. |
| `entrypoint-escape` | isolation | Keep `entrypoint` and package-relative resolution inside the package root (no parent escapes, absolute paths, or out-of-root symlinks). |
| `entrypoint-missing` | isolation | Ship the file named by `entrypoint` under the package root. |
| `forbidden-sceneaxi-import` | isolation | Drop unauthorized `@sceneaxi/*` dependencies/imports (including engine packages). Depend only on public contracts authorized by claimed capabilities. |
| `isolation-unverifiable` | isolation | Remove dynamic imports, loader aliases, plugin-to-plugin imports, or other edges the host cannot prove safe from inspectable artifacts alone. |
| `entrypoint-evaluation-failed` | evaluation | Fix runtime errors thrown while loading the entrypoint after pre-evaluation checks passed. |
| `implementation-table-mismatch` | integrity | Export `capabilities` keys that exactly match the manifest set (no missing and no undeclared IDs). |
| `capability-contract-violation` | integrity | Make the implementation satisfy the public contract that owns the declared capability ID (checked only when the caller binds a check for that ID). |

### Package-isolation example (fixture-tested)

A package that depends on or imports `@sceneaxi/engine-kernel` is refused with
`forbidden-sceneaxi-import` during the isolation phase, with
`entrypointEvaluated: false`. This is covered by named fixtures in
`test/refuse-matrix.test.ts` and `test/load-refuse.test.ts` without publishing
packages or executing untrusted marketplace code. Corrective action: depend
only on public contract packages authorized by the declared capabilities.

## Multiple providers

Two packages may claim the same **registered** capability ID. After both load
successfully, callers must address implementations explicitly:

```ts
const a = host.getImplementation("dev.sceneaxi.provider.a", capabilityId);
const b = host.getImplementation("dev.sceneaxi.provider.b", capabilityId);
// There is no getImplementation(capabilityId) default.
```

## Minimal authoring path

1. Copy
   `@sceneaxi/schemas/contracts/plugin-manifest.inert.example.json` to
   `sceneaxi.plugin.manifest.json`.
2. Look up capability IDs with `lookupPluginCapability` against the bound
   registry; stop on `unknown-capability` and propose a contract instead of
   inventing IDs.
3. Implement the declared table at `entrypoint`.
4. `openPluginHost({ registry }).load([packageRoot])` and branch on refusals.

Agent overview and field glossary: [`docs/plugins.md`](../../docs/plugins.md).

## Execution trust boundary and cache integrity

`openPluginHost` is a **trusted-code, same-process** loader, not an untrusted marketplace execution boundary. Static package isolation checks enforce public import/capability contracts; they do not revoke Node builtins, filesystem access, process authority, or network access. Callers must review and trust every candidate before passing a locator. No marketplace activation or arbitrary hostile-code execution is supported.

The host hashes the inspected entrypoint, transitive modules, JSON and package metadata, and descriptor before evaluation. These identities are reserved process-wide before awaiting import, because Node caches both successful and failed module evaluations. Unchanged reloads may reuse that evaluation; edited artifacts refuse `isolation-unverifiable` and clear addressable previous state. Restart the process to adopt edited code. Reinspection after evaluation also refuses a changed graph and exposes no implementation; the suspect cached entrypoint remains refused across hosts even if its files are restored, until process restart. This integrity check is not a security sandbox against adversarial self-modification or concurrent filesystem writers.

`test/seam.test.ts` covers entry/helper/package edits across host instances, 32 unchanged reloads, and evaluation-time mutation. Untrusted execution would require a separately approved isolated-process/OS authority design and versioned message-only capability contracts; broadening the seed registry is not a substitute.

## Non-goals

No CLI/engine/profile wiring, renderer/physics/storage ports, lifecycle hook
bus, hostile-code sandbox claim, or package publication. Adding a capability ID
to the registry is a separate reviewed contract change, and the host still never
calls a capability implementation itself — it only makes one addressable.
