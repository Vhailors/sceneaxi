# ADR 0005: Plugin Host uses versioned capability manifests

- **Status:** Accepted — settled by captain decision `plugin-capability-model` (option A, locked 2026-07-22).
- **Date recorded:** 2026-07-22
- **Source:** `data/threejs-bgf-ecosystem-wayfinder-v1/decisions/plugin-capability-model.md`.
- **Lineage:** Narrow amendment to ADR [0004](0004-no-plugin-ports-before-two-adapters.md); this is the charted v1 Plugin Host / capability registry exception, not a repeal of the two-real-adapters rule.

## Context

SceneAxi needs a first-class way for independently versioned packages to add
public behavior without exposing engine internals or growing an arbitrary hook
bus. ADR 0004 previously allowed only the charted Model Provider Port ahead of
two real adapters. The captain selected a second, narrow exception: a v1 Plugin
Host whose vocabulary is a versioned manifest plus a public capability ID
registry.

The host is intentionally smaller than a general plugin framework. Contracts,
documentation, and validating examples carry the semantic language; packages
remain independent and integrations remain light.

## Decision

SceneAxi v1 has a first-class **capability-manifest Plugin Host**. A plugin is
an isolated package that presents one versioned manifest as a separately
inspectable data descriptor. The host reads that descriptor without importing
or evaluating the plugin entrypoint. The manifest may claim only IDs already
present in SceneAxi's public capability registry, and the package may implement
exactly those claimed capabilities.

### Manifest shape

The normative JSON Schema and its aligned TypeScript contract live in
`@sceneaxi/schemas`; its [package README](../../packages/schemas/README.md)
lists the exported schema path and validation API. At design level, a v1
manifest contains:

| Field | Meaning |
|---|---|
| `$schema` | Canonical URI of the exact JSON Schema; tooling hint that must agree with `schemaVersion`. |
| `schemaVersion` | Exact version of the plugin-manifest schema. V1 starts at `1.0.0`. |
| `pluginId` | Stable reverse-DNS public identity of the plugin package. It must be unique in one host load set. |
| `pluginVersion` | Semver version of the plugin implementation. |
| `hostApi` | Plugin Host API compatibility range in the exact v1 dialect published by `@sceneaxi/schemas`. |
| `registryVersion` | Exact capability-registry version against which the claims were authored. |
| `entrypoint` | Package-relative module entrypoint; it must resolve inside the plugin package root. |
| `capabilities` | A set of unique public capability ID strings. No hook names, inline port definitions, or engine-private imports may be declared here. |

The descriptor has one fixed package-root-relative path:
`sceneaxi.plugin.manifest.json`. A package locator resolves to the package root;
the host reads that file as data and does not accept an alternate descriptor
path or obtain the manifest by importing plugin code. A missing or unreadable
descriptor refuses the candidate before entrypoint evaluation.

Unknown properties refuse unless a later manifest schema explicitly defines
them. An empty `capabilities` set is valid and inert, which lets the initial
registry and conformance fixtures remain honest without inventing a renderer,
physics, storage, or other engine port.

### Public capability ID registry

The registry is a versioned, reviewable public artifact owned beside the
shared contracts. Each row binds one opaque capability ID to its public
contract, contract version, owning package, and documentation. A capability ID
is valid only when that row exists in the exact registry version named by the
manifest. IDs are not inferred from exports, filenames, package names, or
runtime behavior.

The seed registry may be empty. Adding the first ID is a separate contract
change with its own tests and package-boundary review; adding an ID cannot
quietly create a renderer, physics, storage, or other internal-library port.

### Deterministic load and refusal

The host receives an explicit set of plugin package locators; it never scans
the filesystem, environment, or dependency graph for implicit plugins.
Candidates are processed in stable lexical locator order. Loaded-plugin
listings are sorted by `pluginId`, then `pluginVersion`, then capability ID.
Refused-candidate listings are sorted by locator, which remains available even
when the descriptor cannot supply a valid plugin ID, version, or capability.

For each candidate, the host first applies this pre-evaluation descriptor
phase:

1. Resolve the package root, read `sceneaxi.plugin.manifest.json`, and parse and
   validate it against the exact supported schema. A missing, unreadable, or
   invalid descriptor refuses here.
2. Require a supported `schemaVersion`, a compatible `hostApi` range, and the
   exact loaded `registryVersion`.
3. Refuse a `pluginId` repeated in the host load set, a capability ID repeated
   within this manifest, and every capability ID absent from that registry.
4. Resolve `entrypoint` inside the package root and enforce the package
   isolation rules below using only the descriptor and inspectable package
   metadata or artifacts. If an isolation rule cannot be established without
   module evaluation, the candidate refuses.

Failure in this phase refuses the candidate without evaluating its entrypoint.
Only after every pre-evaluation check passes does the host intentionally load
and evaluate the entrypoint. It then performs one post-evaluation integrity
check before exposure: the implementation table must match the declared
capability set exactly. Missing and undeclared implementations both refuse.

Every refusal is reported with a stable machine-readable reason and identifies
the candidate. A post-evaluation integrity refusal never exposes the evaluated
implementation, and no refused package makes any of its capabilities partially
available. Repeating a capability ID within one manifest refuses; separate
plugins may implement the same registered capability. The host does not choose
an implicit winner, and callers address an implementation by `pluginId`.

The deterministic fixture matrix must distinguish the phases with observable
execution evidence. Descriptor and isolation refusal fixtures prove that their
entrypoints never execute. Implementation-table mismatch fixtures prove that
the intentionally loaded entrypoint executes but that none of its capability
implementations is exposed.

### Package isolation

- Each plugin is its own package, owns its dependencies, and exposes only the
  manifest entrypoint.
- The entrypoint and all package-relative resolution stay beneath that package
  root; path traversal and private-subpath imports refuse.
- Plugins may use only the public SceneAxi contract packages authorized by
  their registered capabilities. Direct imports from engine packages, private
  source paths, or another plugin package are isolation breaches.
- The host passes only the capability-specific public contract surface. It
  provides no engine container, private service locator, ambient hook bus, or
  mutable engine internals.
- Capability implementations are a declarative table keyed by declared IDs;
  arbitrary lifecycle hooks and import-time registration side effects are not
  part of the contract.

These are dependency and interface isolation rules, not a security sandbox for
hostile code. Trust, signing, or out-of-process execution would require a
separate decision before untrusted plugins could load.

## Consequences

- Agents can reason from one JSON Schema, inferred types, a registry, stable
  refusal behavior, and examples that validate in CI.
- Plugins remain independently versioned packages rather than code absorbed by
  a monolithic framework.
- The host can begin with an empty registry and an inert example; public
  capability design proceeds deliberately instead of manufacturing ports to
  demonstrate the mechanism.
- Every implementation must prove both success and fail-closed behavior across
  the version, capability, and isolation matrix.

## Rejected alternatives

- **Arbitrary hooks or event-name registration** — hook strings invent hidden,
  unversioned ports and cannot be checked against a public semantic contract.
- **A monolithic plugin framework** — central ownership of plugin behavior and
  dependencies defeats isolation and deep-module boundaries.
- **Manifest-declared custom ports** — a plugin cannot promote an engine
  internal into a public seam by naming it.
- **Implicit discovery or load-order behavior** — filesystem and import-order
  effects are not reproducible contracts.

## Settled here vs held elsewhere

**Settled:** the v1 Plugin Host exists; manifests, registry claims, loading,
refusal, and package isolation follow the contract above.

**Held or separately earned:** the initial non-empty capability IDs; any
renderer, physics, storage, or other internal-library port (two real adapters
still required by ADR 0004); trust/signing/sandbox policy; and any product
rollout decisions already governed by held keys. This ADR authorizes no Stage 1
proof run, package publication, account, spend, or deployment.
