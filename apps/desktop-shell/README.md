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
| `status --document <path>` | Report the document's id, content hash, top-level `data` keys, whether the project's apply journal makes `undo` available, and validated inert document data |
| `propose --document <path> --pointer <ptr> --value <json>` | Render the diff for review — **writes nothing** |
| `apply --document <path> --pointer <ptr> --value <json>` | Propose and accept in one non-interactive step |
| `undo` | Revert the last completed apply |
| `open-path [--profile <p>] [--operation <op>]` | Report the shared open-path demo policy, or evaluate one demo operation against it — opens **no** session |
| `chrome [--mode …] [--profile …] [--overlay …] [--assistant-mode …] [--sculpt …] [--width/--height …]` | Render the Engine Desktop product chrome; standalone it refuses live actions, while a packaged host can inject the existing authoring/open-path bridge and viewport |

`--cwd <dir>` sets the working directory for the session commands above;
`open-path` opens no session and takes only its own two flags, so `--cwd` refuses
there as an unknown flag. `--json` works on every command and emits the machine
envelope with exactly the same data as the text rendering. The standalone
`chrome` envelope describes its static projection and carries no proposal count;
only a bound host session can populate the Changes badge in the emitted document.

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

The product-loop model is `src/product-loop.ts` (active project file, profile
capabilities, Web HTML and project-relative asset staging). The broader decision
layer is `src/visual-model.ts` (modes, mode-dependent dock tabs,
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

Every control declares its kind — `view` changes visual state and works, and
`live` declares a product action the injected desktop host — an enclosing consumer
runtime — must bind (the assistant prompt, Send, Retry, and the artifact
manipulators, plus New/Open Project, Recent, Reload/Save/Play, Undo once the
project's apply journal reports a completed Save, and Web staging, which the packaged Linux tier
binds through its bridge), and `inert` keeps its focus stop and refuses by a name
from `DESKTOP_VISUAL_REFUSALS`. This app invokes no authoring operation itself
and adds no engine/profile/site/billing dependency: the host remains the adapter
that reaches shared authoring, orchestration, and presentation seams, so a `live`
control rendered by the standalone `chrome` command is inert and says why.

Change Review is populated only by the active `DesktopSession` proposal and
offers one atomic Accept/Reject pair. Accept may write through authoring-core;
Reject discards without writing. A transport failure or malformed response leaves
the last validated review intact; a validated host session snapshot replaces it,
including when that snapshot carries a refusal diagnostic. Neither conflict action
reaches the host when there is no active review, including while apply recovery is
pending, where the surface reports `DESKTOP_RECOVERY_PENDING` without changing the
recovery state. Web staging also refuses before reaching the host during recovery
and retains the transaction details and recovery instructions.
The conflict dialog is raised only by a diagnostic a shipped path can produce —
`content-hash-conflict` from staging or Save, `journal-conflict` from Save — and its
heading names that diagnostic: the document-changed wording is restored for a real
content-hash conflict, and any other diagnostic is announced as a session refusal.
When a host snapshot
has already cleared a stale proposal, an unavailable conflict action names its own
outcome and carries the recorded conflict as detail, so it neither claims a
normal-open document nor replays the earlier action's status sentence over a newer
one.

The first-release loop has one honest active file, `scene.json`. In the packaged
host, first launch shows New Project and Open Project without binding or seeding
an implicit root. New Project creates the existing starter only after a native
directory choice; Open Project and Recent validate a canonical root before the
shared authoring session is rebound. The chrome displays the host-provided
project name, canonical root, and active document, but never receives file
contents through the lifecycle port. Standalone chrome has no lifecycle port,
so those controls refuse honestly. Reload validates
and reads it through the long-lived authoring session. An opened project also
exposes the one editable scene entity the host reports: selecting it fills the
Build inspector with a numeric Translation X field whose Stage control asks the
host for a single proposal, and the panel is re-read from the host's inspection
rather than from a value the chrome keeps. Web Experience can stage
stored HTML or the normalized `assets/hero.glb` reference as one `/data`
proposal; Save accepts that proposal atomically. The chrome never executes the
stored HTML. Stored markup is capped at 100,000 characters; asset paths are
capped at 512 characters and each document carries at most 256 of them. A
pending durable apply leaves Save in a visible recovery state; Save calls the
host recovery operation, while Open can start a fresh session and re-read the
document if recovery remains non-terminal. Profile switching stays blocked
until either path resolves the session. A staged proposal also blocks profile
switching until Save applies it or Open explicitly discards it through the same
authoring session. Play passes that active document path to the existing host
`open-path` action, which re-reads and validates its stored composition before it
opens, advances, observes, and closes the scene session. The mounted viewport
receives that same composition and must acknowledge the returned post-play frame
before the Run panel reports its ticks, frame, and closed state. Game exposes scene/runtime + FreeJS vocabulary, Web exposes
HTML/site-canvas/asset-injection, and Kids remains the shared refuse-only policy
surface with every new live control demoted in the same central mint.

The refuse-only profile demotes in **one** place: every control is minted through
one function inside `desktopVisualView()`, and on Kids that function makes each
one inert unless it is already inert for a more specific reason. A control added
anywhere is behind the refusal by default, so forgetting fails closed; the
seven that are deliberately *not* behind it — the three profile chips, the
title-bar and status-bar palette openers, the refusal-help disclosure, and the
outcome dialog's dismissal — say so by naming
`outsideRefusal()`. The browser-side switch applies
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

The document is self-contained: no remote font, script, style, or image. On its
own it mounts no presentation runtime, draws no pixels, and names
`DESKTOP_RUNTIME_UNAVAILABLE` when a live control is used. The packaged desktop
injects the bridge and the one presentation owner without forking these bytes.

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
reaches a terminal state. A `journal-not-found` result requires the host to
create a fresh session and re-read the active document before continuing. The
packaged bridge exposes that lifecycle step as `authoring.restart`. The
non-interactive one-shot helper
`shellProposeAndApply()` remains available for agent parity.

## What this is not

Deliberately absent, not missing: native packaging (electron/tauri), an
installer, an offline store, hosting, and authentication. The shell stays
protocol-thin — `docs/dependency-matrix.json` allows it only
`@sceneaxi/schemas` and `@sceneaxi/authoring-core`.

Packaging exists, but as its own tier rather than here: `desktop/linux`
(`@sceneaxi/desktop-linux`, ADR 0024) wraps this shell's chrome and session in an
Electron window over the real engine stack, consuming this package unchanged
through its public exports. The emitted script accepts the portable
`sceneaxiDesktop` host port and the existing `sceneaxiDesktopLinux`
compatibility name; it imports no host contract and cannot bypass the host's
path containment or refusal envelope — see
[`docs/desktop-linux.md`](../../docs/desktop-linux.md).

`chrome` does not own native lifecycle, a dev server, a renderer, or a kernel.
It renders the product UI plus a small adapter onto an optional injected host;
without that host all live actions refuse. The generated bytes still draw no
pixels themselves — the document begins with
`<meta name="sceneaxi-pixels-drawn" content="false">`, and only the packaged
presentation owner may update it from a real frame.

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
("chrome / open-path parity") asserts the identity. Interactive File/Edit/Run,
palette, and accelerator parity is owned by `DESKTOP_INTERACTION_COMMANDS` and
executed semantically in
`tests/e2e/desktop-command-interactions-golden.test.ts`.

`tests/e2e/desktop-product-loop-golden.test.ts` is the authoring/play vertical.
`tests/e2e/desktop-project-lifecycle-golden.test.ts` drives the emitted UI through
a preload-shaped project host for first launch, create, cancel, open, invalid
bytes, recents, removal, and restart. The former
test executes the emitted browser script at the narrow window tier, clicks all
three profile surfaces plus Open, Web asset staging, Save recovery, and Play
against the real host bridge, and observes the viewport playback acknowledgement.
