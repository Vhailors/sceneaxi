# SceneAxi plugins

SceneAxi v1 plugins are independent packages loaded through the first-class
Plugin Host described by ADR
[0005](adr/0005-plugin-host-capability-manifest.md). They implement public,
versioned semantic contracts; they do not receive arbitrary hooks or access to
engine internals.

## Mental model for agents

1. Read the public capability registry owned with `@sceneaxi/schemas`.
2. Declare only capability IDs present in the exact registry version named by
   the manifest.
3. Implement exactly that declared set behind one package-local entrypoint.
4. Expect deterministic refusal for unknown capabilities, incompatible
   versions, duplicate identities or claims, entrypoint escape, forbidden
   imports, or declaration/implementation mismatch.

If the registry does not contain the capability you need, stop. Adding a
manifest string is not how a capability is created. Propose a public semantic
contract and its package boundary separately. Renderer, physics, storage, and
other internal-library ports still require two real adapters under ADR
[0004](adr/0004-no-plugin-ports-before-two-adapters.md).

## Minimal v1 manifest

The seed registry may be empty, so the smallest honest example is inert:

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

This manifest may validate and appear in the host's plugin list, but it exposes
no behavior. Future examples replace the empty array only with IDs already in
the public registry. The schema fixture for this example must validate in CI,
so prose and executable contracts cannot drift.

## Isolation and non-goals

- The entrypoint stays inside its plugin package; the plugin owns its own
  dependencies.
- Plugins import only public SceneAxi contract packages authorized by their
  registered capabilities. No engine-private paths and no plugin-to-plugin
  imports.
- The host exposes a capability implementation table, not a lifecycle hook bus
  or service locator.
- Multiple packages may implement one registered capability, but the host does
  not select one implicitly; callers identify the plugin explicitly.
- Package isolation is not a hostile-code sandbox. Untrusted loading needs a
  separate trust and execution decision.

Implementation is intentionally split under tracker
[#19](https://github.com/Vhailors/sceneaxi/issues/19): manifest contract
[#20](https://github.com/Vhailors/sceneaxi/issues/20), registry seed
[#21](https://github.com/Vhailors/sceneaxi/issues/21), host package
[#22](https://github.com/Vhailors/sceneaxi/issues/22), deterministic matrix
[#23](https://github.com/Vhailors/sceneaxi/issues/23), and docs/example
conformance [#24](https://github.com/Vhailors/sceneaxi/issues/24).
