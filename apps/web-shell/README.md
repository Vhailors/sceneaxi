# @sceneaxi/web-shell

Human authoring surface — protocol *client* of `@sceneaxi/authoring-core`, never
a second authoring implementation and never a CLI spawner (matrix-denied).

## sceneaxi#11 stub

Minimal inspector seed for one propose → review rendered diff → accept/reject
round-trip:

```ts
import { createInspectorSession } from "@sceneaxi/web-shell";

const session = createInspectorSession({ cwd: projectRoot });
const review = session.proposeEdit({
  documentPath: "scene.json",
  jsonPointer: "/data/entities/0/x",
  newValue: 42,
});
// review.renderedDiff is what the human sees before accepting
session.accept(); // apply via authoring-core
```

Non-interactive path (agent parity): `shellProposeAndApply(...)`.

No hosting, no deployment, no public visibility.
