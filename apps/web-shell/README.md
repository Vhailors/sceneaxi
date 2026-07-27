# @sceneaxi/web-shell

Human authoring surface — protocol *client* of `@sceneaxi/authoring-core`, never
a second authoring implementation and never a CLI spawner (matrix-denied).

## Run it locally (sceneaxi#120)

The package exports are source-backed, so the binary runs `tsc --build` output:
**`pnpm build` is a prerequisite.** From the repository root:

```bash
pnpm install
pnpm build
pnpm sceneaxi-web-shell --cwd /path/to/your/project
```

It prints the URL it bound and stays in the foreground until `Ctrl+C`:

```
sceneaxi-web-shell: serving the inspector
  url:          http://127.0.0.1:5180/
  project root: /path/to/your/project
  scope:        loopback only; nothing is written until a proposal is accepted
```

Open that URL and you get the inspector: type a document path, a JSON Pointer,
and a JSON value, press **Propose** to review the rendered diff, then **Accept**
or **Reject**. Nothing is written to disk until you accept.

| Flag | Default | Meaning |
|---|---|---|
| `--host <addr>` | `127.0.0.1` | Loopback address to bind (`127.0.0.1`, `::1`, `localhost`) |
| `--port <n>` | `5180` | Port to bind; `0` asks the OS for a free one |
| `--cwd <dir>` | current directory | The project root that is served |
| `--help` | — | Usage, including the served route table |

`pnpm sceneaxi-web-shell --help` prints the same table plus every route. The
routes are also a public export (`INSPECTOR_ACTIONS`), and each one names the
`InspectorSession` method it forwards to:

| Route | Session method |
|---|---|
| `GET /api/state` | `snapshot()` |
| `GET /api/document?path=…` | — (read-only status: id, content hash, data keys) |
| `POST /api/propose` | `proposeEdit()` |
| `POST /api/accept` | `accept()` |
| `POST /api/reject` | `reject()` |
| `POST /api/recover` | `refreshRecovery()` |

The server is a transport and nothing else. `createInspectorApp()` maps one
request onto one session call; `createInspectorSession()` — documented below and
unchanged by this — still owns every phase, and `@sceneaxi/authoring-core` still
owns every write. That is why the same edit through this surface and through
`sceneaxi project propose|apply` produces byte-identical documents and the same
content hash, asserted in `tests/parity/shell-cli-parity.test.ts`.

### How it fails closed

This is a **local development** surface: it authenticates nobody, and it writes
whatever files the process that launched it can write. Every rule below refuses
rather than degrading.

| Situation | Behaviour |
|---|---|
| `--host` is not a loopback address | Refuses at launch (`host-not-loopback`, exit `2`). It is never silently rebound — a routable bind would hand unauthenticated write access to the network. |
| `--cwd` is missing or not a directory | Refuses at launch (`project-root-unusable`, exit `2`). |
| Unknown flag, bare argument, or valueless flag | Refuses at launch (`argument-invalid`, exit `2`). |
| The port is already bound | Refuses (`listen-failed`, exit `1`). |
| `documentPath` resolves outside the served project root — `../`, an absolute path, or a symlink pointing out | `403 document-outside-project-root`. The root is the boundary of the served surface; the library path below has no such bound because a local caller already chose its own directory. |
| Request body is not a JSON object | `400 request-body-not-json`. |
| Request body exceeds 64 KiB | `413 request-body-too-large`; the server stops reading rather than buffering the rest. |
| A required edit field is missing or the wrong type | `400 edit-field-invalid`. `newValue` must be present — send `null` explicitly to set null. |
| The document is absent or is not a SceneAxi document | `404` / `422 document-unreadable`. |
| `authoring-core` refuses (bad pointer, hash conflict, nothing to accept, recovery pending) | `409 inspector-refused`, carrying the typed diagnostics and the unchanged snapshot — never a `200` beside a refusal. |
| An unknown route or the wrong method | `404 route-unknown` / `405 method-not-allowed`. |

Every reason above is an entry in `WEB_SHELL_REFUSALS`, and
`test/refuse-matrix.test.ts` asserts each one is actually reachable. The binary
itself is proven to start by `test/bin-smoke.test.ts`, which spawns it and drives
propose → accept over a real socket.

It still does no hosting, deployment, TLS, process management, or domain work —
that tier is `sites/` ([ADR 0018](../../docs/adr/0018-sites-tier-three-vercel-one-neon.md)),
and this is not it. It spawns no CLI and imports no engine package.

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
