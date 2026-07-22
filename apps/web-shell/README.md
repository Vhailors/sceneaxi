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
const accepted = session.accept(); // apply via authoring-core
if (accepted.journalRecoveryPending) session.refreshRecovery();
```

The inspector canonicalizes and retains the proposal's project root through
review and recovery. While journal recovery is pending, it refuses new propose,
accept, and reject actions; call `refreshRecovery()` until the transaction reaches
a terminal state.

Non-interactive path (agent parity): `shellProposeAndApply(...)`.

No hosting, no deployment, no public visibility.
