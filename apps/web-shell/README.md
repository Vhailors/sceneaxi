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

The issue #57 conformance case drives inspector propose → rendered diff →
accept against the same canonical fixture and asserts the CLI proposal diff,
final bytes, and content hash are identical. This remains a protocol client,
not a second editor, product UI, or design system.

No hosting, no deployment, no public visibility.

## Account panel

`createAccountPanel()` is the login + credit-balance **view model** over injected
`@sceneaxi/auth` and `@sceneaxi/billing` ports: it renders no markup and
implements no authentication. Every decision it exposes was already made by the
identity port and the entitlement matrix, whose contracts are owned by
[`docs/auth-credits.md`](../../docs/auth-credits.md).

## AI assistant panel

`createAssistantPanel()` is the in-app assistant **view model** (sceneaxi#121). It composes
two things that already exist and adds neither: the Model Provider Port for the model call,
and `runMeteredModelCall` for the credit decision. It builds no adapter, holds no
credential, and reads no ledger of its own — a `ModelProviderPort` per offered mode, a
credits view, and a `CreditStore` are all injected.

Three modes reach the model through the same port and differ only in metering: `fixture`
(recorded data, the **default**), `byo` (the user's own credential, free) and `hosted`
(SceneAxi-operated, credits, **off** unless explicitly enabled). Hosted requires a current
persisted ledger for every principal; fixture and BYO never touch it. Kids is refused at
construction — surface *and* profile — so no turn in any mode can be metered or dispatched.
Contract and ownership: [`docs/auth-credits.md`](../../docs/auth-credits.md).

## Open-path policy view

`createOpenPathView()` is the **view model** for the shared open-path demo
policy: the same payload `sceneaxi profile open-path` and
`sceneaxi-desktop open-path` report, rendered by nothing here because this
package ships no markup. It reports the policy verbatim and surfaces the Kids
refusal as a named refusal rather than an empty list. `policyFor(profile)` is the
same one-profile projection the two command surfaces report, so an off-policy
profile refuses with `OPEN_PATH_PROFILE_UNKNOWN` instead of rendering as an
absent row. Contract and ownership:
[`docs/open-path-policy.md`](../../docs/open-path-policy.md).

## Hybrid vertical: Minimum E2

`createMinimumE2Editor()` exposes only the hybrid vertical exception defined by
[ADR 0003's amendment](../../docs/adr/0003-editor-sequencing-e1-first-e2-specified.md#2026-07-24-vertical-only-amendment).
Persistence stays on authoring-core propose/apply. It is not a full IDE surface.
