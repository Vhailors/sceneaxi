# SceneAxi documentation

## User guides

Read these pages in order when you are starting with SceneAxi:

1. [Getting started](getting-started.md) builds the workspace and walks through the available authoring and runtime entry points.
2. [Runnable surfaces](runnable-surfaces.md) lists each surface, its run command, and its evidence.
3. [CLI reference](../packages/cli/README.md) covers command groups, flags, and refusal behavior.
4. [Linux desktop](desktop-linux.md) covers the packaged Electron application.
5. [Web consumer guide](web-consumer.md) documents supported package-root imports and version pins for external products.
6. [Plugin guide](plugins.md) covers manifests, registered capabilities, and plugin isolation.

## Governance and architecture

- [Architecture decisions](adr/README.md) records settled design decisions.
- [Dependency matrix](DEPENDENCY-MATRIX.md) documents package ownership and allowed dependencies.
- [Authoring contracts](authoring-contracts.md) defines the E1 and E2 behavior boundaries.
- [Bootstrap authority](bootstrap.md) lists the separate approvals required for external actions.
- [Production activation](production-activation.md) documents operator checks without authorizing a deployment.
- [Program specification](program/SPEC.md) is the in-repository copy of the canonical product specification.
