# Open a scene headlessly

This example uses the same reconstructed two-object scene and opens it through the public `@sceneaxi/engine-orchestrator` package-root API. The deterministic headless kernel session prints its initial digest and closes. No renderer, provider, or network connection is used.

From the repository root, run:

```sh
pnpm build
node examples/open-scene/run.mjs
```
