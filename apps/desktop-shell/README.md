# @sceneaxi/desktop-shell

A **startable** desktop authoring surface over the *same* `@sceneaxi/authoring-core`
propose/apply protocol layer as `@sceneaxi/web-shell` and `@sceneaxi/cli`. No
forked behavior, no CLI binary spawn (matrix-denied), no engine imports.

## How to run

The workspace keeps source-backed package exports, so the shell runs the
`tsc --build` output. Build once, then invoke it:

```bash
pnpm install
pnpm build

pnpm sceneaxi-desktop --help
```

From the repository root, keep using the verified root script:

```bash
pnpm sceneaxi-desktop --help
```

If the build output is missing, the shell says so and exits `1` rather than
failing obscurely.

## Commands

| Command | Effect |
|---|---|
| `status --document <path>` | Report the document's id, content hash, and top-level `data` keys |
| `propose --document <path> --pointer <ptr> --value <json>` | Render the diff for review — **writes nothing** |
| `apply --document <path> --pointer <ptr> --value <json>` | Propose and accept in one non-interactive step |
| `undo` | Revert the last completed apply |
| `open-path [--profile <p>] [--operation <op>]` | Report the shared open-path demo policy, or evaluate one demo operation against it — opens **no** session |
| `chrome [--mode …] [--profile …] [--overlay …] [--assistant-mode …] [--sculpt …] [--width/--height …]` | Render the Engine Desktop editor chrome for one visual state as a self-contained HTML document — mounts **no** renderer and draws **no** pixels |

`--cwd <dir>` sets the working directory for the session commands above;
`open-path` opens no session and takes only its own two flags, so `--cwd` refuses
there as an unknown flag. `--json` works on every command and emits the machine
envelope with exactly the same data as the text rendering.

Exit codes use the CLI protocol's compatible subset so scripts branch
identically for shared outcomes: `0` success, `1` operational refusal (typed
diagnostics), `2` usage. The desktop shell has no held-key-gated verb, so it
does not emit the CLI's `3` (`HELD_KEY`).

```bash
pnpm sceneaxi-desktop status --document scene.json
pnpm sceneaxi-desktop propose --document scene.json --pointer /data/entities/0 --value 7
pnpm sceneaxi-desktop apply --document scene.json --pointer /data/entities/0 --value 7
pnpm sceneaxi-desktop undo
```

## The visual surface

`chrome` renders the accepted Engine Desktop editor chrome (sceneaxi#158). Text
mode emits the document itself, so it redirects straight to a file:

```bash
pnpm sceneaxi-desktop chrome > shell.html          # open shell.html in a browser
pnpm sceneaxi-desktop chrome --mode sculpt --sculpt running
pnpm sceneaxi-desktop chrome --profile kids        # the refuse-only profile
pnpm sceneaxi-desktop chrome --overlay palette
pnpm sceneaxi-desktop chrome --width 1024 --height 700
```

The decision layer is `src/visual-model.ts` (modes, mode-dependent dock tabs,
profile switch, assistant states, Change Review, command palette, overlays,
sculpt progress, window tiers, refusals); `src/chrome.ts` renders it and decides
nothing. The chrome's product **vocabulary** is not this app's: the mode ids and
rail labels, the dock-tab ids and their per-mode derivation, the assistant modes
and states, the viewport sources, and the window-tier thresholds are derived from
`packages/schemas/src/editor-shell.ts` (sceneaxi#184), which the umbrella's
entitled web editor projects too — so the two surfaces cannot disagree about what
the editor is, and `tests/parity/editor-shell-parity.test.ts` asserts that as a
data identity. What stays local is this renderer's own detail (glyph geometry,
tier shape) and everything below.

Every control declares its kind — `view` changes visual state and works,
`review` edits the fixture Change Review queue and writes no document, `live`
declares a product action an enclosing consumer runtime must bind (the assistant
prompt, Send, Retry, and the artifact manipulators, which the packaged Linux tier
binds through its bridge), and `inert` keeps its focus stop and refuses by a name
from `DESKTOP_VISUAL_REFUSALS`. This app invokes no authoring operation itself,
so a `live` control rendered by the standalone `chrome` command is inert and says
why.

The refuse-only profile demotes in **one** place: every control is minted through
one function inside `desktopVisualView()`, and on Kids that function makes each
one inert unless it is already inert for a more specific reason. A control added
anywhere is behind the refusal by default, so forgetting fails closed; the
eleven that are deliberately *not* behind it — the profile switch and the overlay
open/close — say so by naming `outsideRefusal()`. The browser-side switch applies
the same answer by sweeping every `[data-kind]` element against
`view.controls`, never a selector list. Everything else the switch changes comes
from the same kind of serialized projection — the assistant seat, its model
label, and the status-bar profile pin — so no per-profile value is recomputed in
the browser, and the footer names the profile the switch landed on rather than
the one the document was rendered for.

That split is enforced rather than followed, by `test/control-accounting.test.ts`
in this package. Its four properties are *derived* from the view rather than
listed, so a control added here is covered the moment it exists and there is no
case list to extend alongside it. Exactly what those four properties claim — and
the narrower thing they do **not** claim, markup a renderer conditions on a
control's kind at render time — is owned by
[`docs/engine-desktop-surface.md`](../../docs/engine-desktop-surface.md); read it
there before widening any statement about what the guard covers.

The document is self-contained: no remote font, script, style, or image. It
mounts no presentation runtime, so it draws no pixels and says so on the surface.

It draws **Foundations v2**, the product visual language for every surface. The
shared token layer lives in `packages/site-kit`, but the dependency matrix allows
this app only `@sceneaxi/schemas` and `@sceneaxi/authoring-core`, so those tokens
are transcribed locally in `src/visual-tokens.ts` rather than imported. Do not
resolve that by adding the edge: `FOUNDATIONS_V2_ALIGNMENT` gives every token the
sheet prints exactly one disposition, and `test/visual-tokens.test.ts` fails if a
carried value drifts from it or a new upstream token goes unaccounted for.

The canonical archive, the `Engine Desktop v1.dc.html` supersession, every
deviation from the archive (including the contrast floor and the Kids refusal),
the boundary-forced token duplication, the responsive strategy, and the recorded
browser evidence are owned by
[`docs/engine-desktop-surface.md`](../../docs/engine-desktop-surface.md).

## Session API

The command layer is a thin shell over a session any embedder can drive:

```ts
import { createDesktopSession } from "@sceneaxi/desktop-shell";

const session = createDesktopSession({ cwd: projectRoot });
const review = session.proposeEdit({
  documentPath: "scene.json",
  jsonPointer: "/data/entities/0/x",
  newValue: 42,
});
// review.renderedDiff is what the human sees before accepting
const accepted = session.accept();
if (accepted.journalRecoveryPending) session.refreshRecovery();
```

Phases (`idle`, `reviewing`, `applied`, `pending`, `rejected`) mirror the
web-shell inspector exactly, so the two surfaces stay interchangeable faces of
one protocol rather than two editors.

A round-trip can report pending or indeterminate journal recovery with a
`transactionId`. While recovery is pending the session refuses new propose,
accept, and reject actions; call `refreshRecovery()` until the transaction
reaches a terminal state. The non-interactive one-shot helper
`shellProposeAndApply()` remains available for agent parity.

## What this is not

Deliberately absent, not missing: native packaging (electron/tauri), an
installer, an offline store, hosting, and authentication. The shell stays
protocol-thin — `docs/dependency-matrix.json` allows it only
`@sceneaxi/schemas` and `@sceneaxi/authoring-core`.

Packaging exists, but as its own tier rather than here: `desktop/linux`
(`@sceneaxi/desktop-linux`, ADR 0024) wraps this shell's chrome and session in an
Electron window over the real engine stack, consuming this package unchanged
through its public exports. Nothing in this package knows that consumer exists,
which is exactly the point — see [`docs/desktop-linux.md`](../../docs/desktop-linux.md).

`chrome` does not change that. It renders a **view model**, not an application:
it opens no session, binds no document, mounts no renderer, and has no dev
server. There is no installer and no packaged desktop app here, and the chrome
draws no pixels — a claim the emitted document carries as
`<meta name="sceneaxi-pixels-drawn" content="false">`.

## Parity

Parity with the CLI and web-shell is a conformance test, not a habit:
`tests/parity/shell-cli-parity.test.ts` drives the same fixture operations
through all three surfaces and asserts byte-identical documents and content
hashes — including through the runnable `sceneaxi-desktop apply` path (this is
what issue #58 pinned for the library wrapper, now extended to the startable
surface). `test/bin-smoke.test.ts` spawns the real binary so a broken
entrypoint fails here rather than shipping as a "startable" claim.

`open-path` extends that parity from documents to *policy*:
`tests/parity/open-path-policy-parity.test.ts` asserts this shell, the CLI, and
the web shell report one identical payload and reach the same verdict for every
profile × operation, including the Kids refusal
([`docs/open-path-policy.md`](../../docs/open-path-policy.md)). The command
reports policy only — opening a kernel session would need the engine kernel,
which the matrix denies this package.

The visual surface extends that parity again: the chrome's profile switch
projects the same `openPathPolicyView()` payload rather than describing a profile
itself, so Kids refuses there with the shared code. `test/app.test.ts`
("chrome / open-path parity") asserts the identity, and also that a palette row
may claim to be driveable only when it names a real desktop command.
