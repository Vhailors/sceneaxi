# @sceneaxi/desktop-shell

Thin wrapper over the **same** authoring-core propose/apply protocol layer as
`@sceneaxi/web-shell`. No forked behavior, no CLI binary spawn, no engine imports.

## sceneaxi#11 stub

```ts
import { shellProposeAndApply } from "@sceneaxi/desktop-shell";

const result = shellProposeAndApply({
  documentPath: "scene.json",
  jsonPointer: "/data/entities/0/x",
  newValue: 42,
  cwd: projectRoot,
});
```

Parity with the CLI and web-shell is a conformance test (same operation →
byte-identical documents), not a habit. Stub only — no native packaging.
