# Engine Desktop visual surface

The accepted Engine Desktop editor chrome, as `apps/desktop-shell` implements it
(sceneaxi#158). This document owns three things nothing else does: **what the
canonical archive is**, **where this implementation deliberately departs from
it**, and **the recorded browser evidence** behind every visual claim.

It authorizes nothing. Where it disagrees with an ADR, a schema, a refusal
registry, or an executable gate, that owner wins.

## Canonical source

| | |
|---|---|
| Archive | `SceneAxi Design System.zip` |
| SHA-256 | `ad5d6e39215a4aee9c81b827308fc944784719168d3fba2db5d9e5ef8fc15159` |
| Member implemented | `Engine Desktop.dc.html` |
| Archive sync date | 2026-07-25T12:40:00Z |

The archive is **not committed to this repository**. It is a design input, not a
build input: nothing in `pnpm gate` reads it, and no generated file is derived
from it at build time. What the code carries instead is the archive's *decided
values*, held as data in `apps/desktop-shell/src/visual-tokens.ts` with the
digest above beside them, so a reviewer can re-derive any colour or metric from
the named member of the named archive.

### `Engine Desktop v1.dc.html` is superseded

The same archive contains an earlier pass. It is **reference-only** and must not
be reintroduced. It differed in kind, not in degree:

| | v1 (superseded) | Current (implemented) |
|---|---|---|
| Accent | amber `#F5A524` / `#FFC24D` | signal orange `#FF6B2C` / `#FF8A54` |
| Typeface | Space Grotesk + IBM Plex Sans | Archivo + JetBrains Mono |
| Canvas | 2064×1400 storyboard | 1680×1000 editor stage |
| Model | a project-launcher storyboard: project list, profile cards, offline-capability panel. No mode rail, no assistant, no command palette, no profile switch. | one stateful editor: seven-mode rail, mode-dependent dock, profile switch, assistant, command palette, overlays |

`SUPERSEDED_V1.retiredValues` holds the v1 values as a closed list, and
`test/visual-tokens.test.ts` asserts that none of them appears in the token set
or in a rendered document. A review slip is a failing test, not a judgement call
— the same shape `LIVE_OPEN_PRESENTATION.retiredLabels` uses in `site-kit`.

## Foundations v2, and why its tokens are duplicated here

Foundations v2 — near-black `--bg-base #07080A`, signal orange `--accent
#FF6B2C`, Archivo + JetBrains Mono — is the product visual language for **every**
shipped surface, including this one (captain decision D1, recorded 2026-07-28).
The shared token layer for it lives in `packages/site-kit` (decision D2).

**This package cannot reach that layer, and the duplication below is forced by
that, not chosen.** `docs/dependency-matrix.json` allows
`@sceneaxi/desktop-shell` exactly:

```
"@sceneaxi/desktop-shell": { "allow": ["@sceneaxi/schemas", "@sceneaxi/authoring-core"] }
```

and the matrix's own `rule` states that *allow lists are exhaustive — any
internal dependency or source import not listed here is a violation*. So
`@sceneaxi/site-kit` is not a permitted dependency of this app, and importing it
would fail `pnpm check:boundaries`. No edge was added and the matrix was not
edited; the shared values are transcribed locally instead, into
`FOUNDATIONS_V2_COLORS` in `apps/desktop-shell/src/visual-tokens.ts`.

### What is duplicated

All 24 colour tokens the Foundations v2 sheet prints, plus its two families.
`packages/site-kit/src/design-tokens.ts` (`FOUNDATION_COLORS`) remains the
**upstream** source of these values — this copy is downstream of it, not a second
opinion about them.

| Disposition | Tokens | Meaning |
|---|---|---|
| **carried** (20, plus both families) | `--bg-base`, `--bg-panel`, `--bg-raised`, `--bg-control`, `--bg-field`, `--bg-row`, `--line-soft`, `--line`, `--fg`, `--fg-2`, `--accent`, `--accent-hi`, `--ok`, `--danger`, `--info`, `--axis-x`, `--axis-y`, `--axis-z`, `--kids`, `--store-web`, and the `Archivo`/`JetBrains Mono` families | the sheet's hex, verbatim |
| **raised** (1) | `--fg-4` `#3F464F` → `#7D8694` | below the 4.5:1 text floor on this surface's near-black chrome; names its `DEVIATIONS` row |
| **absent** (3) | `--line-strong`, `--stale`, `--store-game` | named with a reason, not silently unused (see below) |

`--line-strong` `#2C323B` is the one place the two archive members genuinely
disagree: the Foundations sheet prints three line weights, but the implemented
member `Engine Desktop.dc.html` draws its own six-step line scale and does not
use `#2C323B` anywhere in the file. For a value the accepted surface itself
specifies, that member wins. `--stale` belonged to the removed struck-through
fixture row; the active E1 proposal renders one unified diff and has no stale-text
role. `--store-game` is a storefront accent this app never
paints — the Game profile chip is drawn with the accent instead. `--store-web`
*is* painted here, on the Website profile chip, so it is carried as
`PROFILE_DOT.web` rather than declared absent: a token this surface ships cannot
be accounted for as unused.

### What stops the two copies drifting

Not an import — a shared anchor plus an executable check on each side. Both
transcriptions name archive SHA-256 `ad5d6e39…c15159`, and each asserts its own
transcription in `pnpm gate`. On this side that is
`apps/desktop-shell/test/visual-tokens.test.ts`, which asserts the sheet is
accounted for **in full** (every token has exactly one disposition, so a token
added upstream cannot be silently ignored), that every *carried* token equals the
sheet hex exactly, that a *raised* token is only raised where the sheet value
measurably fails the floor, that an *absent* token gives a reason, does not
reappear under a different local name, **and does not appear in the emitted
document**, that every hex the document ships comes from a token the table
accounts for, that the document ships **no `rgb()`/`rgba()` at all** — decimal is
the notation the hex scan cannot follow, and matching only exact copies of a token
still let `rgba(4,5,7,.68)` ship next to `SURFACE.backdrop` #050607, so a
translucent value is written as a `color-mix()` over a declared token's custom
property (`SCRIM`) and moves when that token does — and that the accent,
near-black, and both families survive into the actually-emitted document. Editing
a hex on either side without the other is a failing test.

If the matrix ever permits `@sceneaxi/site-kit` here, the thing to delete is
`FOUNDATIONS_V2_COLORS` and its transcription tests — `FOUNDATIONS_V2_SOURCE
.duplicationReason` is `"dependency-matrix-forbids-site-kit"` so that trigger is
asserted rather than remembered.

## Ownership

| Concern | Owner |
|---|---|
| Colours, typography, metrics, contrast deviations, archive provenance | `apps/desktop-shell/src/visual-tokens.ts` |
| Shared chrome vocabulary — the seven modes, rail labels, dock-tab derivation, assistant modes, window-tier thresholds, structural metrics | `packages/schemas/src/editor-shell.ts` (sceneaxi#184); this model **derives** its tables from it, and the umbrella web editor projects the same rows — parity is a data identity in `tests/parity/editor-shell-parity.test.ts`, and the web surface's own record is [`web-editor-shell.md`](web-editor-shell.md) |
| First-release project/file and per-profile product loop, including host-projected New/Open/Recent lifecycle, selected composed-instance transforms and local add/remove, Web stored-HTML, the portable project-relative asset fixture, and the packaged host's contained-asset invocation | `apps/desktop-shell/src/product-loop.ts` + emitted adapter in `chrome.ts` (sceneaxi#196/#224/#225); root validation, scene-edit/import validation and staging, and persistence remain host-owned, with the contained profile owned by [`asset-ingestion.md`](asset-ingestion.md) |
| Mode/profile/dock/assistant/overlay/sculpt state, refusals, window tiers, control kinds, and Change Review's static controls/empty state | `apps/desktop-shell/src/visual-model.ts` |
| The emitted document (markup, stylesheet, behaviour script), including validated host-snapshot projection and the active Change Review decision flow | `apps/desktop-shell/src/chrome.ts` |
| The `chrome` command and its flags | `apps/desktop-shell/src/app.ts` |
| Runnable level and how to start it | [`runnable-surfaces.md`](runnable-surfaces.md) |

The visual model decides the static projection and the renderer draws it. Every
table the emitted script reads — which dock tabs a mode has, which dock height,
what the assistant becomes on each profile and with which refusals, which
refusal the rail takes — is serialized from the model at render time, so the
document and the model cannot disagree about those states. The emitted adapter
separately validates host responses and projects the one active Change Review
proposal; it does not derive proposal data or acceptance outcomes itself.
**A state a client toggle can reach is a state the bytes already contain.** The Kids editor refusal, and
now the Kids assistant lock, are emitted in *every* document and selected by a
`[data-profile="kids"]` / `[data-assistant="denied"]` rule rather than by a
server-side branch, because a refuse-only decision a browser-side profile switch
could walk around is not a decision. The switch applies the model's own
projection for the profile it lands on — state, model label, and the toggle,
close, and Send refusals — so switching *back* restores a correct column instead
of stranding one. That holds for the emitted
bytes too, not just for what the script does afterwards: the visible dock
tabpanel is `state.dockTab`, so `--mode run` opens on Console rather than on a
hardcoded Change Review queue the mode does not even have a tab for. Change
Review itself follows the same rule — it belongs to the Changes tab, so `run` and
`ship` do not offer it, and the emitted script re-applies that condition when the
mode switches rather than only tracking whether a proposal is under review.
Because a region hidden by the model is hidden with the `hidden` attribute, the
stylesheet declares `[hidden]{display:none !important}`: `.change-proposal` sets
its own `display`, and an author class outranks the UA sheet's `[hidden]` rule.

## How to render it

```
pnpm build
node apps/desktop-shell/bin/sceneaxi-desktop.mjs chrome > shell.html   # then open shell.html
node apps/desktop-shell/bin/sceneaxi-desktop.mjs chrome --mode sculpt --sculpt running
node apps/desktop-shell/bin/sceneaxi-desktop.mjs chrome --profile kids
node apps/desktop-shell/bin/sceneaxi-desktop.mjs chrome --overlay palette
node apps/desktop-shell/bin/sceneaxi-desktop.mjs chrome --width 1024 --height 700
node apps/desktop-shell/bin/sceneaxi-desktop.mjs chrome --json                # envelope, same bytes under `html`
```

Text mode emits the document itself so it redirects straight to a file; `--json`
keeps the versioned envelope. That standalone envelope carries no proposal count:
only the bound host session can populate the Changes badge in the document. An
unknown flag value refuses with exit `2` and
renders nothing, rather than silently falling back to a state nobody asked for.

The document is **self-contained**: no remote font, script, style, or image, and
no `fetch`. One request loads it and nothing else is fetched (measured below).
Live controls use only an optional host port exposed in the packaged window; in
the standalone file they refuse `DESKTOP_RUNTIME_UNAVAILABLE` and stay honest.

## What actually works, and what refuses

The archive is a mockup: it draws controls for behaviour this shell has no
contract for. Rather than dim them and hope, every control in the model declares
one of three kinds, and `test/visual-model.test.ts` asserts that an inert control
always has a refusal and a non-inert one never does.

| Kind | Meaning | Examples |
|---|---|---|
| `view` | changes visual state; genuinely works | mode rail, dock tabs, profile switch, assistant open/close, its Ask/Build/Agent modes and its three route chips, menu openers, the palette openers, the outcome dismissal, drawer toggles, the composed-instance selector |
| `live` | delegates a product action to an injected desktop-host seam; refuses visibly when that host is absent | File New/Open/Save and Export Web, the Ship panel's Export Web action, Edit Undo when the active project's authoring journal reports a completed Save, Run Play, their palette rows and accelerators where assigned, Change Review's Accept and Reject, the nine selected-instance transform fields, Stage, local-copy Add and leaf Remove, stage Web HTML, and the **Import GLB/glTF…** control; and — only once the packaged Linux runtime binds them — the assistant prompt, Send, Retry, and the artifact manipulators |
| `inert` | renders, keeps its focus stop, refuses by name | Undo when the active project's authoring journal has no completed Save or has recovery pending, Sculpt object and its static progress cancellation, standalone-shell assistant prompt/Send/Retry and the four artifact manipulators, the three viewport-source tabs, and — on the refuse-only profile — every control except the seven named below |

The chrome imports no engine, profile, site, billing, or host package, and
reaches no authoring package itself. Build, Run, and Ship are product rooms in
this shell; Sculpt, Scene composition, Animate, and Plugins remain
presentation-only rail states whose panels print `DESKTOP_NO_DOCUMENT_BOUND`
where no desktop operation is bound. Their mode buttons and dock tabs change
presentation only and never claim that unsupported authoring work occurred. Its
live adapter calls the host's existing refusal envelope; that host remains solely
responsible for project containment, the shared authoring session, the
orchestrated kernel path, and the presentation runtime. No host is present in the
standalone CLI render, so the assistant
product actions stay inert there and the project-loop `live` controls refuse
`DESKTOP_RUNTIME_UNAVAILABLE` when clicked; `test/app.test.ts` proves a `chrome`
invocation leaves a document byte-identical. The packaged Linux tier also renders
`assistantRuntime: "none"`; after its bridge, initial Mount API scene, and every
assistant handler bind, the renderer emits the model-owned runtime event that
promotes the controls to `local`. If that runtime cannot mount or bind, the
chrome retains the precomputed `none` projection for every control rather than
maintaining a renderer-owned control list. The runtime contract is owned in
`docs/desktop-linux.md`.

### First-release product loop

The Project / Files panel begins unbound. New Project, Open Project, a Recent
chooser, Open Recent, and Remove are modelled controls like every other control;
on standalone chrome they refuse because no host lifecycle method exists, and on
Kids the central refusal mint demotes them before a dialog or storage request.
The packaged host supplies only typed project summaries — name, canonical root,
and `scene.json` — so the chrome can update its title and project surface without
receiving document contents through this lifecycle path. Selecting a different
root reloads the same unforked chrome against a newly bound instance of the
existing engine bridge; it does not create a second authoring implementation.

The left dock owns one project/file answer rather than parallel mock panels:
`scene.json` remains the one active authoring target. Once a root binds, a separate
typed browser port fills the file selector with that document and its admitted
manifest assets, fills the selected row's type, digest, provenance, and validation
detail, and fills the Assets dock from the same response. Open selected, Rename,
and Delete are modelled controls; the exact containment, confirmation, and
immutability rules live in `docs/desktop-linux.md`. The title-bar **Reload**
control still calls the host's authoring `status` operation and retains its
validated inert `data`; it re-reads the bound project and never selects one, and
under a host with no bound root it refuses instead of opening.

Once a bound project has been opened, the same panel selects among the validated
composed instances the host reported (a `view` control) and fills the Build
inspector with nine bounded translation/rotation/scale fields, Stage, local-copy
Add, and leaf Remove, all `live`. The chrome derives no value of its own — it re-reads the panel from
the host's inspection after every open, stage, save, and recovery, and keeps the
operator's selection across that read. Staging asks the host for one proposal and
displays the rendered diff and any diagnostic message; Save is the existing
accept. The operations, their refusals, and byte-level CLI parity are owned by
`docs/desktop-linux.md`.

Web Experience stages starter HTML through the shared shell decision. Its second
control is **Import GLB/glTF…**: when the packaged Linux host exposes the native
picker port, the selected file goes through the fixed contained-copy authority
owned by [`asset-ingestion.md`](asset-ingestion.md), then returns one `/data` E1
proposal to this same Change Review. The portable fixture host has no native
dialog; only there, the control preserves the earlier bounded
`assets/hero.glb` reference proposal so the transport-free shell remains
executable. Both proposal paths bind the content hash read from the document, so
an external edit made after Open refuses with `content-hash-conflict` before
stale data can enter review. Save accepts that exact pending proposal through the
long-lived shared session. Pending or journal-recovery results keep the surface
in `recovering`; Save calls the bridge's `recover` operation until the session
reaches a terminal state, while Open is the explicit escape that starts a fresh
session and re-reads the active document if recovery remains non-terminal. If
the journal is missing, the diagnostic remains visible through that same
fresh-session re-read. Either path releases Open and profile switching from the
indeterminate session. A
staged proposal also blocks profile switching until Save applies it or Open
rejects it and clears its browser copy, so Web work cannot later be accepted
under Game or Kids. The HTML is stored and displayed only as escaped text—never inserted into
the chrome DOM. On the portable fallback, invalid existing Web data and asset
paths outside normalized `assets/` refuse before a proposal is made; that shared
decision caps stored markup at 100,000 characters, asset paths at 512 characters,
and the fallback document asset list at 256 entries. The native profile's
separate limits and refusal matrix are not copied here.

Play calls the host's existing `open-path` action with the active document path.
In the packaged desktop the bridge re-reads that document, validates and
reproduces its stored composition through `composeScene()`, and passes that
scene through `bootstrapOpenPath()`: the response must contain tick digests, the
matching mountable payload, and a closed session before the chrome reports play.
The chrome then emits the shared viewport-play event carrying that evidence;
the separate renderer owner validates it, redraws the same `MountableScene`
after playback, and acknowledges that frame. It does not claim the closed
kernel session's tick state was projected into the presentation. Without that acknowledgement
Play refuses. On success the Run panels replace their pre-play empty state with
the returned tick, terminal digest, viewport frame, and closed-session evidence.
The shell neither constructs a renderer nor invents a pixel claim.

The HTML/portable-fixture staging decision itself lives in exactly one place. `desktopWebStageDecision()`
closes over no module binding, so `chrome.ts` embeds `String(desktopWebStageDecision)`
into the emitted script and passes it the serialized `DESKTOP_WEB_STAGE_CONFIG`:
the browser runs the same function `stageWebHtml()` and `stageWebAssetInjection()`
call, rather than a hand-copied paraphrase that can — and previously did — lose a
guard. The exported wrappers add only the deeper finite-JSON check an in-process
caller needs, after the shared decision has answered, so the refusal order is
identical on both sides. Packaged contained import bypasses this fixture decision
and reaches the native picker/importer port instead. `test/product-loop.test.ts`
asserts the emitted document contains the shared function and still parses as
JavaScript.

Two loop properties the surface depends on. **One request at a time:** every live
control reads the retained document before its first `await`, and the host holds a
single proposal, so overlapping clicks are serialized and the controls report
themselves unavailable for the duration — otherwise the second action would build
its proposal from the pre-edit document and silently replace the first. **Re-opening
discards on the host, not just locally:** Open rejects a proposal the session is
still holding before it re-reads, so the surface never reports a clean project over
an edit the host would still apply.

The product status is written to the title pill, the left-dock file line, **and** an
always-visible status-bar mirror, which is also where the `aria-live` region lives.
Below the compact tier the title centre is `display:none` and the left dock is a
closed drawer, so a refusal written only to those two would be unreadable at exactly
the sizes in the recorded browser evidence; Play refusals go to the product status
for the same reason, since the run report is hidden there too.

The Game surface names scene authoring, composed-scene play, and project-local
FreeJS behavior. Web Experience names stored HTML, site canvas, contained asset
import (with the portable fixture fallback described above), and the same
composed-scene play path without importing any site or billing package. Kids
remains `OPEN_PATH_KIDS_REFUSED`: the central control mint demotes
every new live control alongside the existing modes and panels, while the three
profile chips still let the operator leave the refusal.

### The refuse-only profile demotes in one place

A `view` control on the refuse-only profile is decided **once**, not per call
site. `desktopVisualView()` mints every control through one local function, and
on Kids that function makes each one `inert` with `OPEN_PATH_KIDS_REFUSED` —
unless the control is *already* inert, which keeps its own more specific reason
(the assistant's denial or Undo's unavailable state), because one control must
not carry two refusals. A control added anywhere in the projection is therefore
behind the refusal by default: **forgetting fails closed.**

That replaced a per-call-site `kids ?` branch, which is a pattern that only has
to be forgotten once. It was: the mode rail and the assistant remembered it and
the two drawer toggles did not, so at 1024×700 — and at 1920×620, which is the
same tier on height alone — "Panels" and "Inspector" rendered as live `view`
buttons that set `aria-expanded="true"` on regions
`.shell[data-profile="kids"]` keeps shut at every size.

Exactly seven controls are exempt, and they are the ones **not behind** the
refusal: the three profile chips (the switch is how an operator leaves the Kids
state, so making it inert would turn a state you can exit into a dead end), the
two palette openers, the refusal-help disclosure, and the outcome dismissal.
Those genuinely work on every
profile, and marking a control
that works as refusing is the same dishonesty pointing the other way.

Which dismissals may be exempt is decided by the model rather than by a
judgement call per button: every entry in `DESKTOP_OVERLAY_DISMISSALS` declares a
`productAction`, and one that names an action is minted `live` through the
central `control()` mint — so it goes inert on Kids like every other path to the
host, and refuses `DESKTOP_RUNTIME_UNAVAILABLE` in the standalone render. The
shipped outcome dialog reports a refusal a response already returned and decides
nothing, so its dismissal declares no action and only closes the dialog. Since
sceneaxi#227 the decisions that would once have been offered there — discard the
held proposal, re-open against the current document — belong to Change Review's
own all-or-nothing Accept and Reject, which are `live` and inert on Kids like the
rest of the project loop. `Escape` and the outcome dismissal still close the
dialog on every profile, so the refusal stays a state you can leave.

The dialog reports the diagnostic it was raised for and nothing else: its
heading names the action that refused, its body carries the host's own code,
message, and re-read hint, and no standing sentence about what a conflict
generally is survives to be read as current. Only the diagnostics a shipped path
can actually produce raise it — staging for `content-hash-conflict`, Save for
that or `journal-conflict` from a stale durable transaction; pending apply
recovery stays represented by the `recovering` state and raises no dialog.

A decision also needs a review the surface actually validated and projected.
Without one, Accept and Reject refuse with `DESKTOP_PROPOSAL_NOT_REVIEWING` and
make zero host requests;
pending recovery stays non-decidable, reports `DESKTOP_RECOVERY_PENDING` once,
and keeps the recovery instructions beside it — Web staging refuses before
reaching the host under the same condition. When a validated host snapshot has
cleared a stale proposal, a blocked decision names its own outcome and carries
the recorded conflict as detail —
`Decision refused · DESKTOP_PROPOSAL_NOT_REVIEWING · <recorded conflict>` — so it
neither claims a normal-open document nor replays the earlier action's status
sentence over whatever the operator did since, and repeating it answers the same
way rather than accumulating the previous answer. That recorded conflict stays
attached to its unresolved session transition across intervening status
messages; a validated clean session snapshot or a successful document re-open
clears it. A transport failure
or malformed response leaves the last validated review projected; a validated
host session snapshot replaces it, including when that snapshot carries a
refusal diagnostic.

The browser-side switch applies the same decision the same way: it sweeps
**every** `[data-kind]` element and applies the model's own `[kind, refusal]` for
that control id, serialized per profile and assistant-runtime state from
`view.controls`. The same table owns runtime loss. There is no selector list — a
list of the controls to update is a list that has to be edited whenever a control
is added, and the one that existed had never gained `.drawer-toggle`.

Demoting a control is not the whole of the switch, though: a drawer **already
open** when the profile changes has state of its own. Closing the toggle is not
enough if `data-drawer-left` still says `open` and the toggle still says
`aria-expanded="true"` over a region the refusal has taken off screen, so the
switch closes any drawer whose toggle it just made inert — read from the applied
`aria-disabled`, after the sweep, so it follows the model rather than naming a
profile a second time. It is the reset the assistant toggle already did for its
own drawer.

Nor is the editor body the whole of the switch. The status bar **names** the
profile the document is on (`view.profilePin`), which makes it the one place a
stale value is not a cosmetic lag but the surface asserting a profile it is not
on. The switch updates it from the same kind of serialized per-profile table it
reads for the assistant seat and the controls — the model's own `profilePin` for
each profile, projected exactly as a render of that profile would compute it, so
the renderer decides nothing here either. Until this landed the pin was rendered
correctly and then never updated, so clicking the Kids chip left a footer reading
`game profile · core 0.0.0` under the full `OPEN_PATH_KIDS_REFUSED` lock screen.

### Refusal registry

Two closed registries, never a string literal in a call site.
`DESKTOP_VISUAL_REFUSALS` (`visual-model.ts`) names why a *control* renders inert,
and every entry is reachable from some state — asserted in both directions.
`DESKTOP_PRODUCT_REFUSALS` (`product-loop.ts`) names why a *product-loop action*
declines, on either side of the host port. `DESKTOP_WEB_CAPABILITY_REQUIRED` is
one code with one owner: the visual registry re-exports the product-loop entry
rather than restating the string, because the same refusal both greys the control
out and refuses the staging decision behind it.

`refusalLegend()` prints a sentence for every code in both registries, de-duplicated
by code, and the emitted script reads its names out of the serialized
`T.product.refusals` table — so a refusal a visitor can read is a refusal the
document also explains. `test/product-loop.test.ts` asserts that in both directions.

| Code | When |
|---|---|
| `OPEN_PATH_KIDS_REFUSED` | the refuse-only profile, and every control behind it that is not already refusing for a more specific reason — Open, Save, Play, the mode rail, the dock tabs, the two drawer toggles, the Change Review decisions, the static sculpt cancellation, and the driveable palette rows; the code comes from the shared open-path policy, not from here |
| `DESKTOP_KIDS_ASSISTANT_DENIED` | assistant on Kids — its toggle, its close, its prompt, its Send, its Retry, its three route chips, and its three composer modes |
| `DESKTOP_NO_PRESENTATION_RUNTIME` | the viewport: no renderer is mounted, so no pixels — the three viewport-source tabs, because switching what a viewport shows needs the runtime that is missing, and every `live` assistant control (prompt, Send, Retry, the four artifact manipulators) while `assistantRuntime` is `none` |
| `DESKTOP_NO_KERNEL_SESSION` | the static `run` mode before a host-backed Play response; the chrome never invents a tick, frame, or body |
| `DESKTOP_NO_DOCUMENT_BOUND` | authoring controls not covered by the first-release project loop (for example Sculpt) |
| `DESKTOP_UNDO_UNAVAILABLE` | Edit Undo and its palette row when the active project's authoring journal has no completed Save |
| `DESKTOP_WEB_CAPABILITY_REQUIRED` | the Web stored-HTML and asset-import controls on Game and Kids; these controls are already inert with the more specific capability refusal, so the Kids demotion preserves it |
| `DESKTOP_WINDOW_BELOW_MINIMUM` | the window is smaller than 900×600 |

| Product-loop code | When |
|---|---|
| `DESKTOP_WEB_CAPABILITY_REQUIRED` | staging asked for outside Web Experience (the same code the control carries) |
| `DESKTOP_WEB_ASSET_PATH_INVALID` | the portable fixture's injected asset reference is outside the normalized `assets/` subset, exceeds 512 characters, or would exceed 256 stored assets; the packaged native importer has its own `ASSET_IMPORT_*` refusal registry |
| `DESKTOP_WEB_HTML_INVALID` | stored markup exceeds 100,000 characters or carries a null byte |
| `DESKTOP_DOCUMENT_DATA_INVALID` | the open document's data, or its existing `webExperience` value, is not data this loop may replace |
| `DESKTOP_RUNTIME_UNAVAILABLE` | no packaged host port is attached |
| `DESKTOP_RUNTIME_REQUEST_FAILED` | the host threw instead of answering |
| `DESKTOP_RUNTIME_REQUEST_REFUSED` | the host refused and named no reason of its own |
| `DESKTOP_VIEWPORT_UNAVAILABLE` | orchestrated playback completed but the live viewport did not acknowledge a post-play frame |
| `DESKTOP_EXPORT_PROJECT_REQUIRED` | Export Web was requested before New, Open, or a validated recent project bound a root |
| `DESKTOP_WEB_EXPORT_PROJECT_DIRTY` | Export Web was requested while a proposal or durable recovery state was still pending |
| `DESKTOP_AUTHORING_REFUSED` | the shared authoring session refused and carried no diagnostic code |
| `DESKTOP_PROPOSAL_NOT_REVIEWING` | propose returned without parking the edit for review, or Accept or Reject was taken with no validated active review |
| `DESKTOP_PROPOSAL_NOT_DISCARDED` | Reject, or a re-open, could not discard the proposal the host still holds |
| `DESKTOP_PROFILE_SWITCH_DIRTY` | a staged proposal must be saved or discarded before another edit stages, the project changes, or the profile changes |
| `DESKTOP_UNDO_STAGED_PROPOSAL` | Undo would drop a staged, unsaved proposal along with the Save it reverses |
| `DESKTOP_APPLY_NOT_COMPLETED` | accept returned without reporting the apply completed |
| `DESKTOP_RECOVERY_PENDING` | Undo, staging an edit, changing the project, switching profiles, and the Change Review decisions are blocked — none of them reaches the host — until Save resolves recovery or Open starts a fresh re-read session |
| `DESKTOP_OPEN_PATH_EVIDENCE_INVALID` | the play response carried no closed session with observed tick digests |
| `DESKTOP_PRODUCT_REQUEST_IN_FLIGHT` | another serialized product-loop request currently owns the shared session |

A named diagnostic from the host wins over the generic code above it: the surface
prints `snapshot.diagnostics[0].code` when there is one, which is how
`apply-in-progress` — the session's cue that journal recovery, not another click,
is what moves this forward — reaches the operator. `journal-not-found` remains
visible through the fresh-session re-read that prevents recovery from becoming
a permanent UI lock.

### Parity with the CLI

The profile switch does not describe a profile; it **projects
`openPathPolicyView()`** from `@sceneaxi/schemas` — the same value
`sceneaxi profile open-path`, `sceneaxi-desktop open-path`, and web-shell's
`createOpenPathView()` report. So Kids refuses here because the shared policy
says so, with the shared code, and the identity is asserted in
`apps/desktop-shell/test/app.test.ts` ("chrome / open-path parity") rather than
maintained as four prose descriptions.

Window commands use `DESKTOP_INTERACTION_COMMANDS`, deliberately separate from
the `sceneaxi-desktop` CLI's `DESKTOP_COMMANDS`. File, Edit, Run, the palette,
and keyboard accelerators carry the same interaction command id and dispatch it
through one handler table. Commands this desktop cannot execute are absent.

Each accelerator is declared beside its command in that list rather than written
into the key handler, so the chord a menu prints is the chord that fires; a
command may declare none (New Project does). They are plain `Ctrl`/`Cmd` chords,
and a `Shift` or `Alt` modifier is not one of them, so `Ctrl+Shift+Z` is not
Undo. A command whose declaration does not set `allowInTextEntry` does not fire
while focus is in a text-entry context — only the palette opener does, so
`Ctrl/Cmd+K` still reaches the palette from the assistant prompt. A refused
command names its reason in the outcome dialog, which carries the failure's own
code and message and is dismissed by its one `Dismiss` button or `Escape`.

## Responsive and windowing strategy

The archive is a fixed 1680×1000 stage scaled with `transform: scale()`. That is
a mockup device, not a windowing strategy, and it is not reproduced — the emitted
document has no `transform: scale(` and no `width:1680px`. Instead
`WINDOW_TIERS` names four tiers, and columns undock outside-in.

| Tier | From | Docked columns | Undocked |
|---|---|---|---|
| `regular` | 1440×720 | rail, left dock, viewport, inspector, assistant | — |
| `compact` | 1180×660 | rail, left dock, viewport, inspector | assistant → drawer |
| `narrow` | 900×600 | rail, viewport | left dock, inspector, assistant → drawers |
| `minimum` | below 900×600 | none — the chrome **refuses** | — |

Two rules keep this honest:

- **Every undocked column has an opener.** The assistant keeps its existing
  toggle; the left dock and the inspector gain two title-bar toggles that appear
  at `narrow`. A drawer nobody can open is not a responsive strategy, so an
  undocked drawer also starts closed rather than covering the panel it undocked
  from.
- **A refused column is never a drawer.** The one exception to the rule above:
  when the assistant is `denied` it keeps a real column at every tier. Its body
  is the Kids lock screen carrying `THIRD_PARTY_LLM_DENIED_BY_DEFAULT`, and the
  only control that could open a drawer is the toggle that same refusal makes
  inert — so undocking it would leave a named refusal on no reachable surface at
  1280×800 while the surface still claimed to state it. Hiding a refusal behind a
  breakpoint is hiding a refusal.
- **The toggle reports what the tier actually shows, and the bytes ship a closed
  drawer.** Below `regular` the assistant column can be `open` and still not on
  screen. Every emitted document therefore carries
  `data-drawer-assistant="closed"` — never a value seeded from the *render*
  size — because a document rendered at 1680×1000 can be opened at 1280×800, and
  an attribute chosen at render time would put the drawer over the inspector at
  first paint and keep it there with no script. Which rule lights the toggle is a
  stylesheet decision on the two **complementary** media conditions
  (`atTierOrAbove("regular")` and `belowTier("regular")`, both derived from
  `WINDOW_TIERS`): where the assistant is docked the toggle reads
  `data-assistant`, and below that tier it reads `data-drawer-assistant`. So the
  lit state follows the viewport rather than the render size, `aria-pressed` is
  brought to the viewport by `syncAssistantTier()` at load and on every
  `matchMedia` change, and one press opens the drawer at every tier — there is no
  first press that only turns off a claim nothing honoured.
- **Every breakpoint in the stylesheet is derived, and covers both axes.** The
  two undocking breakpoints are interpolated from `WINDOW_TIERS`
  (`@media (max-width:1439px),(max-height:719px)` and
  `(max-width:1179px),(max-height:659px)`), and the refusal breakpoint from
  `DESKTOP_MINIMUM_WINDOW`, as are the refusal block's printed `900×600` and its
  sentence. Both axes matter because `resolveWindowTier()` reads both: a 1920×700
  window is `compact` to the model, and a width-only breakpoint would have left
  the stylesheet describing a layout the model does not produce. Raising a tier
  therefore moves the stylesheet, the printed size, and `resolveWindowTier()`
  together instead of leaving two of the three stale. Below the minimum the
  editor is replaced by a named refusal, not by an unusable layout.

## Accessibility

- **Landmarks, not anonymous divs**: `header` / `nav` / `aside` / `footer` /
  `section`, every one labelled.
- **Real controls**: button actions use `<button type="button">`. The other
  controls are the modelled assistant `<textarea>`, the recent-project and
  composed-instance `<select>` elements, and nine numeric transform `<input>`
  elements. The static `--sculpt running` preview has no bound job, so its
  cancellation control is inert with `DESKTOP_NO_DOCUMENT_BOUND` rather than
  hiding progress locally. Keyboard order is DOM order, and no click handler sits
  on a `div` or `span`.
- **Inert controls stay reachable.** An inert control is marked `aria-disabled`
  rather than `disabled`, so it keeps its focus stop, and `aria-describedby`
  points at the paragraph carrying its refusal — a screen reader gets the reason,
  not just "dimmed". Every button is rendered through the one
  `button(control, …)` helper — the mode rail, the dock tabs, the
  viewport-source tabs, the profile chips, the drawer openers, the menu triggers
  and every command row under them, the palette rows, the status-bar
  overlay shortcuts, the assistant modes, the sculpt cancel, the outcome
  dialog's dismissal, and the assistant artifact manipulators. The prompt
  uses the parallel `promptInput(control)` helper so it carries the same
  `data-kind`, refusal reference, and profile-switch demotion; when inert it is
  `readonly` rather than removed from the focus order. The recent-project and
  composed-instance choosers use the same parallel treatment, as do the transform
  inputs; when inert, each retains its refusal reference and focus stop. Thus a
  control cannot reach the document without its
  kind, and a control the model builds cannot fail to reach the document. That is
  not a convention here: `test/control-accounting.test.ts` enumerates the
  controls by walking the view and fails in both directions. The status bar's
  collapsed Refusal help panel prints the **whole closed registry**, one sentence
  per code taken from `DESKTOP_REFUSAL_MESSAGES`, for
  two reasons: a code must not have two wordings in one document, and a control
  that becomes inert *in the browser* — the profile switch does that to the rail
  and to the assistant — needs its reason to already be there to point at.
- **Roving tabindex** on both tablists, with `aria-selected` on the active tab
  and `aria-pressed` on the active mode and profile — **and the arrow keys that
  make it a pattern rather than a lost focus stop.** Roving tabindex takes every
  non-active tab out of the Tab order, so `ArrowLeft` / `ArrowRight` / `Home` /
  `End` are the only way to reach them: on the dock strip they select the tab they
  move to, and on the viewport strip they move focus without moving the
  selection, because all three viewport sources are inert — a viewport source
  cannot be switched on a surface that mounts no renderer, and they say so with
  `DESKTOP_NO_PRESENTATION_RUNTIME` rather than looking switchable.
- **A tablist owns nothing but its tabs.** ARIA restricts a `tablist`'s children
  to `tab`, so `role="tablist"` sits on an inner wrapper holding only the tabs;
  the spacer and the tool glyphs stay siblings in the same flex row. Change
  Review's own Accept and Reject live inside the Changes tabpanel beside the
  proposal they decide, not in the strip — the decision is all-or-nothing over
  one proposal, so there is nothing for a strip-level control to act on — and
  `moveTab()` enumerating `[role="tab"]` depends on the same boundary.
- **`aria-modal` is backed by a real trap.** An overlay declares
  `role="dialog" aria-modal="true"`, which tells assistive tech the rest of the
  document is inert, so keyboard focus must agree: opening one moves focus into
  the dialog, `Tab` and `Shift+Tab` wrap inside it, and closing it — by button or
  by `Escape` — returns focus to the control that opened it. The `keydown`
  handler is on the document rather than the shell so a lost focus cannot swallow
  `Escape`.
- **A `role="menu"` is backed by the keys that role implies.** A menu trigger
  carries `aria-haspopup="menu"` and an `aria-expanded` that tracks its panel;
  opening one moves focus to its first non-inert `role="menuitem"`, `ArrowUp` /
  `ArrowDown` / `Home` / `End` move between the items, and `Escape` or a click
  outside closes it. Closing a menu while focus is still inside it returns focus
  to the trigger that owns it — the same return the overlay makes — because
  hiding the focused element would otherwise restart the Tab order at the top of
  the document. The items keep their plain Tab stop as well, so an inert command
  stays reachable with its refusal, exactly like every other inert control here.
- **Element ids are unique and well-formed**, because a control id is derived
  from a declared identity (`DESKTOP_INTERACTION_COMMANDS[].id`,
  `DESKTOP_MENU_IDS`) and never from display text. An `aria-describedby` reference is only meaningful
  if it resolves to exactly one element.
- **The viewport's image role sits on an empty backdrop.** `role="img"` is
  Children Presentational, so anything under it is pruned from the accessibility
  tree. It is carried by a dedicated empty `.viewport-backdrop`, leaving the two
  viewport notes and the sculpt `role="status"` / `role="progressbar"` region as
  real siblings — otherwise the pass progress would be announced to nobody.
- **Reduced motion**: `@media (prefers-reduced-motion:reduce)` collapses every
  animation and removes the sculpt sweep entirely.
- **Contrast**: every text token clears 4.5:1 against every chrome surface, and
  the focus ring clears 3:1. This is where the archive is departed from — see
  below.
- **An inert control is dimmed by paint, not by `opacity`.** That is a contrast
  rule, not a style one. Element opacity composites a whole control toward
  whatever is behind it *after* every check on this surface has looked: the token
  test compares `TEXT` against `SURFACE`, and a browser sweep reads
  `getComputedStyle().color`, and neither sees compositing. The dimming that
  shipped under those checks — `opacity:.72` on any inert button, `opacity:.5` on
  a Kids rail label — resolved to 3.67:1 on an inert view tab, 4.07:1 on an inert
  primary button, and **2.16:1** on a Kids rail label, i.e. a refusal that could
  not be read. It is now the painted `INERT` tokens, which the same token test
  measures directly, plus a structural assertion that the emitted document
  declares no `opacity` at all outside `@keyframes`, so the next dimmed control
  cannot walk into the same blind spot. `INERT.text` *is* `TEXT.faint` on
  purpose: the floor is the constraint, and `faint` is already the dimmest tier
  that clears it everywhere. The paint has to hold **in every state, not only at
  rest**: a single-class `:hover` outranks `button.is-inert` (0,2,0 against
  0,1,1), so every control class whose hover repaints its label ships the inert
  answer beside it — `.ghost-button`, `.primary-button`, and `.decision`. Miss
  one and that control is indistinguishable from a live one under the pointer,
  which is the same dimmed-by-nothing state the tokens replaced.

## Deviations from the archive, and why

Every row that is an archive-versus-shipped *value* — a colour, a font source, a
stage geometry — is also carried as data in `DEVIATIONS`, so the test suite can
re-measure it. The rows below that settle a product or contract question instead
carry no data row, because there is no archive value for the suite to compare
against.

| Deviation | Archive | Shipped | Why |
|---|---|---|---|
| Dim text tiers collapsed | `#6E7681` (4.36:1), `#565E68` (3.05:1), `#3F464F` (2.10:1), `#333A42` (1.74:1) | two passing tiers, `#8A929C` and `#7D8694` | all four fail the 4.5:1 text floor on the surfaces they are used on. Lightening them monotonically would have produced four indistinguishable greys; two tiers keep a real hierarchy, and the archive's remaining separation is carried by size, weight, and letter-spacing, which is preserved. |
| Inert dimming | element `opacity` on a control that cannot be used | the painted `INERT` tokens, and no `opacity` outside `@keyframes` | opacity composites a label toward its background after every check here has read the declared colour, so the dimming was measured by nothing and shipped at 3.67:1, 4.07:1, and 2.16:1. Raising the fraction would have left the blind spot; a painted token is measured by the test that already exists. An inert control is deliberately not `disabled`, so its refusal has to stay readable. |
| Web fonts | `fonts.googleapis.com` link for Archivo + JetBrains Mono | font-family stack, no remote request | the emitted document is self-contained and offline. The archive families are named first and render when installed; otherwise the system UI face does. |
| Fixed stage | 1680×1000 scaled with a transform | fluid layout, four window tiers | see above |
| Informational blue | the member carries both `#5B9CFF` and a lighter `#8FB7F5` for the same informational role | `#5B9CFF` | the two archive members disagree, so the shared sheet settles it: Foundations v2 canonicalises `--info` to `#5B9CFF`, D1 makes the sheet binding, and the value clears the text floor here anyway (6.16:1 at worst on `SURFACE`, 6.48:1 on the note's own fill) — so there is no accessibility reason to keep the member's lighter variant, and keeping it would be drift from the shared layer. |
| Kids profile | a working editor with only the assistant locked | the **whole editor body** refuses | **contract conflict, resolved for the repository.** Kids authoring exists only on its dedicated, simplified origin (`kids-first-release.md`); the shared desktop open path remains `OPEN_PATH_KIDS_REFUSED`. An adult editor that merely looked disabled under a Kids badge would cross that boundary. Every control behind the refusal goes inert — in the emitted bytes, not only after a click, and decided in one place rather than remembered per call site — so no mode can be entered and no removed panel can be opened from behind it; the seven chrome controls enumerated above stay live so the refusal is a state you can leave and its named reasons remain reachable. |
| Panel inventory | fixture object trees, digests, byte sizes, fps, triangle counts, run timings, evidence rows | real structure with honest empty and inert states | the chrome mounts no renderer itself and reports only results returned by the packaged host, so it has no authority to invent fps, a triangle count, or a `14.2 MB` artifact. Rendering the archive's fixtures would be inventing file sizes and hashes. Change Review was the one fixture queue kept, and sceneaxi#227 retired that exception too: the panel is populated only by the active `DesktopSession` proposal — its real document path, base content hash, and rendered diff — with an honest empty state when none exists. It is therefore the one panel here that **does** write: Accept applies the whole proposal through the shared authoring session (`writesDocuments: true`), Reject discards it without writing, and there is no per-row or partial acceptance to have. |
| Project lifecycle and contained browser (sceneaxi#224 plus the contained browser slice) | a Project / Files panel drawn with fixture files already present, plus a fixture Assets inventory; no project selection, recents, unbound state, validation detail, or file operation is recorded | an unbound launcher with New Project, Open Project, a recent chooser, Open Recent, and Remove; after binding, one canonical file selector, a metadata detail card, Open selected, Rename, Delete, and an Assets dock populated only from the host response | **product decision, not a visual one.** First launch must not silently choose a project root, and a bound panel must not preserve the archive's invented inventory. The lifecycle chooser is `view`; its four actions and the browser's selector and three actions are `live`, so standalone chrome refuses them without a host and Kids demotes them through the central mint before a dialog, state read, or project read. The detail and Assets regions start empty and receive no fabricated digest, provenance, or status. No archive colour or geometry is claimed for the added regions, and their rendered contrast has not been swept in a browser; see the caveat below. |
| Ship Web export | a Ship room that names a Delivery Handoff but explicitly exposes no export action | one `Export Web` action shared by the File menu, palette, and Ship inspector, followed by only the returned output path, bundle digest, source digest, and handoff path | **product decision, not a visual one.** The accepted vertical makes Ship a real offline product job while retaining the archive's room. The new control is modelled `live`, goes inert through the central Kids refusal, and refuses by name without a clean bound project. Evidence fields start empty and appear only from the packaged host's validated response; no fabricated hash, size, deployment, or release state is drawn. No new colour, token, or geometry is claimed from the archive, and the added controls retain the recorded browser-sweep caveat below. |
| Selected composed-instance edit (sceneaxi#225 plus this narrow breadth vertical) | nothing recorded: the archive draws no composed-instance selector or property editor in the Build inspector | one composed-instance `<select>` under the bound project; a Build-inspector editor carrying the selected identity; bounded X/Y/Z translation, Euler rotation, and scale fields; Stage, local-copy Add, and leaf Remove; the staged proposal's own diff; and the host's named inspection refusal | **product decision, not a visual one.** The operation stays on the existing E1/Minimum-E2 seam: selection is `view`; the nine fields and three actions are `live`; all go inert through the central mint on Kids before a session or document is reached. Add names no external artifact and can only copy already-validated local bytes; Remove is a non-root leaf operation, not a general hierarchy editor. No colour, size, or geometry is claimed from the archive, and the added controls have not received a new browser contrast sweep; the recorded-sweep caveat below remains explicit. |
| Assistant product flow (sceneaxi#192) | nothing recorded: this document has never carried an assistant composer inventory from the archive, and the archive is a design input for visual values, not for product flow | a real prompt `<textarea>`, three provider-route chips (`local`, `byo`, `hosted`), progress and result regions that report actual work, a `Retry` action, and a viewport manipulator bar (`Move +X`, `Move +Y`, `Rotate Y`, `Scale +`) | **product decision, not a visual one.** sceneaxi#192 turns the assistant from a drawn panel into a flow that a runtime performs, so the surface needs controls for the states that flow really has. They ship as modelled controls under the rules already on this page: each declares its kind, all of them are `inert` with a named refusal in the standalone CLI render and become `live` only when the packaged Linux runtime binds them, and all of them are denied on Kids. No colour, size, or geometry is claimed for them from the archive, which is why there is no `DEVIATIONS` row: there is no archive value to compare against. Their rendered contrast has not been swept in a browser — see the caveat on the recorded sweep below. |
| Application menus (sceneaxi#226) | eight menu-bar headings — `File`, `Edit`, `Scene`, `Object`, `Sculpt`, `Run`, `Window`, `Help` | three — `File`, `Edit`, `Run` | **removing fiction, not trimming a design.** The eight shipped as inert buttons naming `DESKTOP_VERB_NOT_ON_THIS_SURFACE`, which was honest only while none of them did anything. Once a menu opens real commands, a heading is a promise: `Scene`, `Object`, `Sculpt`, `Window`, and `Help` have no command this shell can execute, and the issue forbids inventing one. An empty menu that opens onto nothing is worse than no menu, so they are absent rather than inert — the same rule the palette rows follow. The three that remain are exactly the menus whose commands exist, and `DESKTOP_VERB_NOT_ON_THIS_SURFACE` was retired with them. |
| Menu dropdown geometry (sceneaxi#226) | none: the archive draws a menu bar and never opens one, so it records no panel fill, width, offset, or elevation | an absolutely-positioned `.menu-panel` — 220px min-width, 25px top offset, `--raised` fill, `0 18px 45px -16px` shadow, `z-index:45` — with `.menu-command` rows and a `--dim` accelerator `kbd` at `font-size:9px` | **no archive value to compare against**, which is why there is no `DEVIATIONS` row. The panel is drawn from Foundations v2 members already on this page (`--raised`, `--line-raised`, `--hover`, `--dim`) rather than from new values, and its elevation follows the refusal-legend panel that already floats over the status bar. Its rendered contrast has not been swept in a browser — see the caveat on the recorded sweep below, which names this chrome explicitly. |
| Rarity provenance regions (sceneaxi#241) | nothing recorded: the archive draws no rarity anything, and its Evidence panel is a fixture table of invented digests and byte sizes | a `data-change-rarity-evidence` region inside the Change Review article, a `data-run-rarity-evidence` region inside the Run panel, and an Evidence panel that shows the accepted namespace's safe provenance — tier, candidate, event, scope, seed, algorithm, the policy/request/outcome/provenance/namespace digests, both draws against their totals, and the provider's exact model/provider/quantization/version — above an honest empty state | **product decision, not a visual one**, and the same no-fabricated-inventory rule as the row above: every field is a value the packaged host returned from a kernel-verified roll, and the panel shows nothing when none has been opened or staged. The text is not written here at all — the chrome embeds `formatSafeRarityEvidence()` from the import-free `@sceneaxi/authoring-core/rarity-evidence` entry with `String()`, exactly as it embeds the web staging decision, so the Assistant, Change Review, Run report, and Evidence dock render one function's output rather than four paraphrases. The Run region carries that same full output plus one added sentence attributing the rarity product session, because the digests on the run report line beside it were produced by the composed scene session instead; the run report itself therefore names no tier, candidate, or digest of its own. The panel keeps its original statement that evidence digests come from `sceneaxi project capture` and are never invented by a viewer: rarity provenance is an addition to that panel, not a narrowing of it, and both empty states ship. Three honesty rules bind the regions: an idempotent replay (`replayed: true`) stages nothing, so it updates Evidence only and neither selects the Changes dock nor marks the project dirty; rejecting an unrelated proposal leaves accepted rarity in the dock, because only the rarity proposal's own discard retires it, and a path that may have removed the namespace — Undo, a recovery restart — asks the reopened document whether `data.rarity` is still there rather than clearing on the action alone, so neither a stale digest nor an empty state over real bytes can survive; and the Run report names the rarity product session separately from the composed-scene digests beside it, since that session carries no entities and produced none of them. No colour, size, or geometry is claimed from the archive, which is why there is no `DEVIATIONS` row. Their rendered contrast has not been swept in a browser — see the caveat on the recorded sweep below. |
| Outcome dialog and search-free palette (sceneaxi#226) | two static dialogs — `Refused` (with a fabricated two-item refusal list) and `Conflict` — each with two dismiss buttons, plus a `Search commands` field above the palette and their two status-bar shortcuts | one `outcome` dialog whose title, refusal code, and message are written by the failure that opened it, with one `Dismiss`; a palette with no search field | **required by the issue intent**, and consistent with the no-fabricated-inventory rule already in this table. The archive's dialogs are screenshots of refusals that never happened — a static refusal list is invented evidence in exactly the way a `14.2 MB` artifact is. A search field that filters nothing is the same fiction in an input, and the intent permits it only if filtering and selection are keyboard-accessible, which is not built. Both status shortcuts went with the dialogs; `⌘K` remains. |

### The renderer note is deliberately dropped

The archive's viewport carries **`Preview renderer is experimental — not the
final choice`**. That sentence is **not** shipped. The archive is authority for
purely visual facts; this is product copy asserting a product fact, and the
captain has settled Three as the product presentation core, so the sentence is
stale regardless of whether ADR 0017's pixel-surface scope formally reaches a
surface that mounts no renderer at all. It was removed rather than reworded,
because `VIEWPORT_INERT_NOTE` already says the only thing this viewport can
honestly say — that no renderer is mounted here and no pixels are drawn — and
the document carries `<meta name="sceneaxi-pixels-drawn" content="false">`
beside it.

The two labels ADR 0017 retired by name, `Experimental Three preview` and
`non-decision`, **remain asserted absent** in `test/chrome.test.ts` and
`test/visual-model.test.ts`, in every state, so neither they nor the dropped
sentence can return by review slip.

## What is verified where

- **Node gates** (`pnpm gate`) cover the whole model — mode/dock-tab derivation,
  the active project file, profile capability projection and the Kids refusal,
  Web stored-HTML/portable project-asset staging and the packaged import-port
  invocation, assistant states including the
  non-reopenable deny, Change Review's proposal projection and empty state,
  sculpt pass advance and
  clamping, static sculpt cancellation refusal, overlays, window tiers, control kinds, refusal reachability, view
  freezing, and determinism — plus the emitted document: escaping (including a
  hostile selection name that cannot close the script tag), landmarks, labels,
  `aria` wiring, roving tabindex, the reduced-motion rule, the focus ring, the
  breakpoints, and the absence of any remote reference, fabricated digest, byte
  size, frame rate, or timing in **any** state. Each per-profile table the
  emitted script reads is checked against the model's own projection for that
  profile — the assistant seat, every control by id, and the status-bar pin,
  which is asserted to be genuinely per profile so a table frozen on one value
  fails rather than passing an identity vacuously. `apps/desktop-shell/test/bin-smoke.test.ts`
  spawns the real binary and renders a document from it.
  `tests/e2e/desktop-product-loop-golden.test.ts` crosses the rendered profiles,
  existing desktop bridge, shared authoring session, durable accept, and
  orchestrated composed-scene play path, and drives Change Review itself against
  that bridge: the rendered proposal, Accept writing, Reject leaving the document
  untouched, a stale base hash refusing, the conflict dialog naming the
  diagnostic it was raised for, and the default emitted document carrying no
  review row.

- **Every interaction command is invoked, not inventoried** —
  `tests/e2e/desktop-command-interactions-golden.test.ts` loads the emitted
  document, then drives each `DESKTOP_INTERACTION_COMMANDS` id from its menu
  item, its palette row, and its accelerator, and asserts the host call or the
  named refusal each one produces. `tests/e2e/desktop-control-inventory-golden.test.ts`
  mounts the full emitted surface and observes mode, dock, drawer, assistant,
  profile, overlay, refusal, and standalone product outcomes. A control that
  only closed its overlay would fail there, which is the fault the palette rows
  carried before #226.

- **The model/renderer split is enforced, not conventional** —
  `apps/desktop-shell/test/control-accounting.test.ts`. Review round after review
  round found the next instance of one family of fault: a control the model built
  and the renderer never drew, a button the renderer drew that no control
  accounted for, a state the document reported untruthfully, or a control
  declaring itself live over a region its own profile removes. The split itself
  was sound; nothing checked it. That file checks four things across eighteen
  states, and each is derived rather than listed, so a newly modelled control is
  covered the moment it exists:
  1. Every control reachable by walking `desktopVisualView()` is in the document
     with the kind it declares, and an inert one with its `data-refusal` and a
     legend row its `aria-describedby` resolves to; and `view.controls` — the
     index the mint records and the renderer serializes for the browser-side
     switch — is *exactly* that walked set, so an index missing a control (which
     the switch would then silently skip) fails here. The one deliberate
     exception is `profiles[].assistant`, the projection of the *other* profiles
     that the renderer serializes instead of drawing.
  2. No `<button>` in the document lacks the `id` + `data-kind` pair only
     `button(control, …)` emits, every such id is one the model minted, and the
     only non-button interactive elements or focus stops are the modelled
     assistant `<textarea>`, the two project/instance `<select>` elements, and
     the nine transform `<input>` elements — each asserted by id and kind.
  3. Every named refusal resolves to a visible region **at every window tier**,
     computed through the emitted stylesheet's own cascade — media conditions on
     both axes and in both directions, selector matching, specificity, source
     order, and `!important` — rather than by reading a `hidden` property. A
     companion case asserts the same helper reports `display: none` for the
     docked assistant below the regular tier, so the check cannot pass vacuously.
     This is the property the Kids lock screen failed at 1280×800.
  4. **A declared kind tells the truth.** No control declares itself `view`
     or `live` while the region it names through `aria-controls` resolves to
     `display: none` — judged with the control's *own* effect applied, since a
     drawer opener naming a region the sheet keeps shut until it opens it is the
     control working, not a region the profile removed. An `aria-controls` target
     with no region mapping fails rather than being skipped. And the assistant
     toggle is checked across the **cross product** of render size and open size:
     every document ships a closed drawer, the column is shown exactly where the
     tier docks it, and the lit fill agrees with the column at the viewport the
     document is opened at, not the one it was rendered at. Properties 3 and 4
     each fail on the defect they were added for — verified by reverting it.

  Those four properties are the whole claim, and it is narrower than "the split
  is enforced" sounds. It does **not** cover markup a renderer conditions on a
  control's kind *at render time*: property 4 probes `aria-controls` targets, so
  an attribute a row is given only while its control is live — and which the
  browser-side switch cannot add back when it promotes that control — is outside
  every probe in the file. That is how the palette's dismiss action was gated on
  `kind === "view"` and still passed; it is now emitted unconditionally, and the
  click handler's `aria-disabled` check is what keeps an inert row from acting.

- **First-release product loop, recorded 2026-08-05.** Chromium 148 controlled
  through `chrome-devtools-axi` against the actual generated `file://` document. At
  1680×1000 the accessibility tree exposed the active `scene.json`, Open/Save,
  the Game capability surface, and Play. Switching to Website replaced that
  region with HTML, site canvas, and asset injection controls and updated the
  profile pin; switching to Kids displayed the full `OPEN_PATH_KIDS_REFUSED`
  alert and demoted Open, Save, and Play to inert controls carrying that reason.
  Standalone Open visibly refused `DESKTOP_RUNTIME_UNAVAILABLE`. With an
  injected fixture host port, the browser drove exactly
  `status → propose → accept → open-path`, reported `open → staged → saved`,
  stored `assets/hero.glb`, entered Run, and printed `4 ticks · session closed`.
  At 1000×700 and the exact 900×600 minimum the Web tools and Play remained
  displayed, the left/inspector columns became closed drawers, and both page and
  shell measured 0 horizontal/vertical overflow. The model-owned Refusal help
  button opened its in-viewport scrollable explanation panel at both sizes,
  changed `aria-expanded` to `true`, and closed it without changing either
  overflow measurement; at 899×599 the shell resolved
  to `display:none` and the named minimum-window refusal to `display:block`,
  also with 0 overflow.

  **This record predates the contained project lifecycle (sceneaxi#224), the
  contained project/asset browser, the typed scene-property edit (sceneaxi#225),
  and the current composed-instance breadth, and has not been re-run for them.**
  It observed the left dock already showing the active
  `scene.json` and a title-bar control labelled `Open`; today that panel starts
  as the unbound launcher, the title-bar control reads `Reload`, reaching the
  authoring loop takes a New/Open/Recent choice first, and an opened project adds
  the canonical file selector, detail card, three file actions, admitted Assets
  cards, the composed-instance selector, nine transform fields, Stage,
  local-copy Add, and leaf Remove, none of which this run saw. The refusal, profile, and
  overflow readings above stand for the document as it was on 2026-08-05; the
  lifecycle's own behaviour is gate evidence in
  `tests/e2e/desktop-project-lifecycle-golden.test.ts`, the browser's in
  `tests/e2e/desktop-project-browser-golden.test.ts`, and the scene edits' in
  `tests/e2e/desktop-scene-property-golden.test.ts` and
  `tests/e2e/desktop-product-loop-golden.test.ts`, not a browser record.

- **Real browser, re-recorded 2026-07-28 against this branch's final HEAD.**
  Not inherited: the previous record was taken before the inert state stopped
  being an `opacity` and before the palette's dismiss action stopped being gated
  on render-time kind, it was re-run after the inert hover paint and the drawer
  reset below, and this run is a full re-measurement against the head that
  carries the status-bar profile pin through the switch. Every figure below was
  re-measured; the element counts in the contrast sweep are **higher** than the
  previous record's for the same documents because this sweep measures every
  visible text-bearing element rather than the narrower set the earlier harness
  walked — the ratios, which are the claim, are unchanged. **Every visibility
  claim below is
  `getComputedStyle(...).display`**, not a `hidden` property, and **every
  contrast figure is composited** — each element's own group `opacity` and every
  ancestor's are folded into both sides of the ratio. Chrome via
  `chrome-devtools-axi` in an isolated session, documents rendered by
  `node apps/desktop-shell/bin/sceneaxi-desktop.mjs chrome`, opened from
  `file://`, at 1680×1000 unless a size is named. The sweep covers six window
  shapes rather than one: 1680×1000, 1280×800 (the drawer tier), 1920×700 and
  1920×620 (**wide but short** — tiers the model reaches on height alone),
  1024×700 (the Kids drawer tier), and 800×560, and it exercises the Kids switch
  at the drawer tiers, not only at 1680×1000.

  **This sweep predates the assistant product controls, the project lifecycle,
  the contained project/asset browser, the typed scene-property edit and its
  current breadth, and the Change Review rework, and has not been re-run for any
  of them.** sceneaxi#192 later added, to
  the documents that render the assistant panel and the viewport, eight further
  buttons — `Retry`, the three provider-route chips, and the four artifact
  manipulators — plus the modelled prompt `<textarea>`; sceneaxi#224 then added
  the four project-lifecycle buttons and the recent-project `<select>` to every
  document, along with the unbound launcher this sweep never saw; sceneaxi#225
  then added scene selection, Stage, and Translation X. This breadth vertical
  replaces that selection button with one composed-instance `<select>`, expands
  the field to nine transform `<input>` elements, and adds local-copy Add and
  leaf Remove; every document emits the Build inspector that carries them. sceneaxi#227
  then replaced the fixture Change Review queue with the active proposal,
  removing its three rows and the bulk accept/reject pair and adding a focusable
  diff region. The contained browser slice later added one file `<select>`, three
  file action buttons, a selected-file detail region, and host-populated asset
  cards. Everything
  below therefore describes the document as it stood on 2026-07-28, and four
  claims in it are stale by name:

  - **The control counts.** `build`'s "58 buttons, 53 focus stops, 17 inert" and
    `kids`'s "the same 58 with 47 inert" were taken before the later controls
    existed and before #227 removed the queue's own, so each figure is wrong in
    both directions, and "buttons" is no longer even a count of
    the document's interactive elements, because the prompt is a `<textarea>`,
    the recent and instance choosers are `<select>` elements, the transforms use
    nine `<input>` elements, and the rendered diff is a focusable `<pre>`
    scroll region rather than buttons. The **live controls on `kids`** enumerated
    beside those counts are unaffected by any of this: that list is the model's
    own outside-the-refusal set (`outsideRefusal` in `visual-model.ts`), not a
    browser observation, and none of #192, #224, #225, or #227 added an entry to
    it or removed one. #227's Accept and Reject are minted `live` through the
    central `control()` mint, and the one dismissal
    `DESKTOP_OVERLAY_DISMISSALS` ships declares no `productAction`, so it stays
    exempt exactly as it was; the
    project-lifecycle and scene-property controls are likewise minted through the
    refusal path. That enumeration is stale for a different reason, recorded with
    the addendum below: #226 retired the `refused` and `conflict` dialogs it
    names. The inert count
    sitting next to it is a count of this document, and it is stale.
  - **The Change Review interaction reading.** The recorded "deciding one row
    moved the badge `3 → 2`", the **Accept all** sweep to `0`, and the bulk
    actions resolving to `display: none` all describe the fixture queue #227
    deleted. There is no row to decide and no bulk pair to hide; the badge is
    `1` while one proposal is under review and `0` otherwise, and Accept now
    writes. Nothing was re-derived to replace those readings — they need a real
    browser, like the rest of this sweep.
  - **The composited contrast sweep.** Its per-document element totals (99 on
    `build`, 63 on `kids`, and every other figure in that list) are counts of a
    smaller document than the chrome emits today, so its "0 failures below 4.5:1"
    is a result about that smaller document. The added controls' own text
    pairings were never measured: the route chips at `font-size:9px`, in both
    their `--dim` rest state and their pressed `--accent` state on the accent
    surface fill; the prompt's placeholder and its `--inert` label in the
    read-only state; the manipulator labels over the viewport; and the progress
    line and the result region it reveals — none of them at rest, and none under
    the pointer.
  - **The inert-under-the-pointer reading.** Its enumeration of the visible
    inert controls, and its count of stylesheet `:hover` rules that repaint a
    label, both predate `.assistant-manipulator:hover` and the `.is-inert`
    answer shipped beside it, so the rule count is low and the manipulators
    were never the control under the pointer.

  No figure here was re-derived from the model instead, and no measurement was
  extrapolated onto a control the browser never saw: a count computed from the
  emitted bytes is not a browser observation, and a ratio computed from the token
  table is not a composited one. Re-record this whole sweep in a real browser
  before citing any figure in it for the current chrome.

  **Current-control addendum, recorded 2026-08-05.** Chromium 148 through
  `chrome-devtools-axi` re-measured the current generated `build` and `kids`
  documents at 1680×1000, then the refusal-help interaction at 1000×700,
  900×600, and 899×599. This addendum owns the button, focus-stop, inert,
  Kids-live-control, disclosure, and short-window figures below; the geometry,
  contrast, and hover sweep remains the 2026-07-28 full run.

  That addendum was recorded against documents built before the assistant
  product controls of sceneaxi#192 landed beside this work, so it predates them
  exactly as the full run does: it re-derives no figure for the prompt
  `<textarea>`, `Retry`, the three provider-route chips, or the four artifact
  manipulators, and the caveat above stands for all of them. It predates
  sceneaxi#224 the same way: its button and focus-stop counts — and the `kids`
  inert count, since the refuse-only profile demotes all five — were taken before
  the four project-lifecycle buttons and the recent-project `<select>` existed,
  so each of those figures is low and none of those controls was measured. It
  predates sceneaxi#225 and this breadth vertical identically: the composed-instance
  selector, Stage, Add, Remove, and nine transform inputs — all demoted on `kids`
  by the central mint — came after it, so the same figures are low
  again and none of those controls was measured either. The contained browser's
  file selector, three file action buttons, detail region, and Assets cards also
  postdate the addendum, so none of their text or control states was measured.

  **It predates sceneaxi#226 as well, which reshaped the chrome it measured.**
  Nothing in this addendum has been re-run against the current document, and the
  claims below are readings of a document that no longer exists in that shape:

  - **The button, focus-stop, and inert counts** were taken when the menu bar
    held eight inert buttons and no menu items, when the palette held seven rows
    naming CLI verbs, and when two dialogs contributed four dismiss buttons. The
    current document renders three menu triggers with five menu items under them,
    five palette rows, and one dismissal, so every count here is a count of the
    earlier document.
  - **The twelve live controls on `kids`** enumerated below are the pre-#226
    outside-the-refusal set. It is now **seven** — `profile-game`, `profile-web`,
    `profile-kids`, `overlay-open-palette`, `status-overlay-palette`,
    `status-refusal-help`, `overlay-close-outcome-dismiss` — because the Refused
    and Conflict dialogs and their two status shortcuts are gone. That figure is
    a model fact (`outsideRefusal` in `visual-model.ts`), stated here only to
    mark the enumeration below as superseded; it is not a browser observation
    and this addendum does not own it.
  - **The composited contrast sweep** includes a `palette` overlay measurement
    (122 elements, 5.11:1) of a palette that had a search field and CLI-verb
    rows, so that row is a result about markup the chrome no longer emits.
  - **The worst inert-label readings** — `build` **5.22:1** on `File` in the menu
    bar, `kids` **4.97:1** on the `Assistant` toggle and the `Panels` drawer
    toggle — were read when the menu bar was inert. `File`, `Edit`, and `Run` now
    open real command menus and are no longer inert, so the `build` figure names
    a control that has changed state; the `kids` figure is unaffected by that but
    was still read on the earlier document.
  - **Chrome the sweep never saw at all.** The dropdown `.menu-panel` (`--raised`
    fill, shadow, `z-index:45`) and its `.menu-command` rows, the `--dim`
    accelerator `kbd` at `font-size:9px` on that raised fill, the `.menu-command`
    hover and focus states, and the outcome dialog's `[data-outcome-code]` /
    `[data-outcome-message]` body. None of them has a composited reading, at rest
    or under the pointer. The token contrast suite measures the token pairings
    they are built from, which is not the same as a composited reading of the
    shipped element.

  Re-record this addendum against the current chrome before citing any figure in
  it. What the gate proves in the meantime belongs to the suites named under
  "What is verified where", not to this block.

  **A second correction, on the same axis.** The earlier record read every
  control **at rest**, and a resting read cannot see a `:hover` rule. A
  single-class `:hover` outranks `button.is-inert`, so an inert `.ghost-button`
  repainted to the live `--text` `#EDEFF2` and the live `--line-hover` border
  under the pointer — visually identical to a live control, on the two Kids
  drawer toggles that are the only inert ghost buttons a viewport ever shows.
  Nothing recorded here was wrong about the resting state; the state was simply
  never measured. It now is, with the pointer actually over the control.

  **A correction to the previous record, stated rather than quietly improved.**
  It reported "0 failures below 4.5:1" across every state. *That claim did not
  hold for inert controls.* The cause was the measurement, not a rounding
  disagreement: the sweep read `getComputedStyle(el).color`, which returns the
  **declared** colour, so the `opacity:.72` on every inert button and the
  `opacity:.5` on a Kids rail label were never folded in — and the recorded
  "`build` worst 5.42:1" was the *un*-composited `--faint` figure, on a document
  that rendered 17 inert controls. Composited, the shipped values were **3.67:1**
  on an inert view tab, **4.07:1** on an inert primary button, and **2.16:1** on
  a Kids rail label, which is a refusal nobody could read. The token gate was
  blind in the same way and for the same reason: it compares `TEXT` against
  `SURFACE`, and compositing happens after both look. The fix is not a larger
  fraction — the dimmed state is now a painted token (`INERT`), the token gate
  measures it directly, and it asserts the document declares no `opacity` at all
  outside `@keyframes`. The figures below are the re-measurement, with
  compositing folded in.

  - **Region geometry at 1680×1000 is the archive's own, to the pixel**:
    title bar `36`, mode rail `56`, left dock `274`, inspector `326`, assistant
    `344`, view tabs `32`, dock `228`, status bar `27`, shell `1680×1000`.
  - **The adopted language is what the browser resolved**: `--accent` `#FF6B2C`,
    `--info` `#5B9CFF`, `--inert` `#7D8694`, `--inert-on-accent` `#331A07`, shell
    `rgb(7, 8, 10)` (`#07080A`), title bar `rgb(13, 15, 18)`, panel header
    `rgb(18, 21, 26)`, body font resolved to `Archivo`. A Kids rail label
    resolved to `rgb(125, 134, 148)` — the painted `--inert`, at full opacity —
    and its `aria-hidden` glyph to `rgb(51, 58, 68)`, which is the one part of an
    inert control that is still allowed to be a line colour.
  - **Exactly one network request** — the document itself
    (`GET file://…/build.html [200]`, and `performance.getEntriesByType(
    'resource')` empty). No font, script, style, or image was fetched.
  - **Every button came from the helper.** Across the thirteen document/size
    combinations audited, **0** buttons lacked the `id` + `data-kind` pair and
    **0** `aria-describedby` references dangled, in every state and after every
    interaction below. `build` renders 64 buttons, 59 focus stops, **0
    unlabelled**, 19 inert. `kids` renders the same 64 with **52** inert: the
    live twelve were exactly the controls not behind the refusal —
    `profile-game`, `profile-web`, `profile-kids`, `overlay-open-palette`,
    `status-overlay-conflict`, `status-overlay-palette`,
    `status-overlay-refused`, `status-refusal-help`,
    `overlay-close-conflict-discard`, `overlay-close-conflict-review`,
    `overlay-close-refused-edit-brief`, and
    `overlay-close-refused-keep-draft`. That set is superseded by #226 and again
    by #227 — see the caveat above; the `refused` and `conflict` dialogs it names
    no longer exist, and the counts beside it are this document's and are stale.
    The only inert
    controls outside the plain Tab order are `viewport-source-game` and
    `viewport-source-sculpt-preview` on `build` (roving tabindex, and the arrow
    keys reach them), joined on `kids` by the non-active dock tabs.
  - **Every `role="tablist"` owned only `role="tab"` children** in every document
    measured, so the bulk accept/reject and the spacer are outside it.
    *(Superseded by sceneaxi#227, not re-recorded: the bulk accept/reject pair
    was removed with the fixture queue, so the structural spacer is now the only
    non-tab sibling. The tablist property itself is asserted in
    `apps/desktop-shell/test/chrome.test.ts`; the browser reading is owed.)*
  - **The viewport carries one note**, `VIEWPORT_INERT_NOTE`; the archive's
    "not the final choice" line is nowhere in the document (`indexOf` `-1`).
  - **Rendered contrast sweep, composited.** Each visible text-bearing element's
    colour against its resolved background, with `aria-hidden` subtrees skipped
    and **element `opacity` folded into both sides** — the step whose absence is
    corrected above. **0 failures below 4.5:1** in all thirteen measurements:
    `build` (99 elements, worst 5.22:1), `sculpt` running (119, 5.22:1), `run`
    (72, 5.22:1), `animate` (76, 5.22:1), the `palette` overlay (122, 5.11:1),
    `kids` (63, **4.60:1** — the `refuse-only` chip at 8.5px, still the worst on
    the surface), `build` at 1280×800 and 1920×700 (89, 5.22:1 each) and at
    1024×700 (71, 5.22:1), and `kids` at 1280×800 (63, 4.60:1) and at 1024×700
    and 1920×620 (56, 4.60:1 each). At 800×560 the shell is the refusal, so it
    contributes no shell text: the 20 elements measured there are the refusal's
    own, worst 6.33:1.
  - **The inert state is measured, not assumed.** In every one of those
    measurements the sweep found **0** elements with a group `opacity` other than
    `1`, and enumerating the live stylesheet's rules found **0** `opacity`
    declarations outside `@keyframes`. The worst *inert* label composited to
    **5.22:1** on `build` (`File`, on the menu bar — a control #226 has since
    made live) and **4.97:1** on `kids` (the
    `Assistant` toggle at 1680×1000, the `Panels` drawer toggle at the drawer
    tiers) — the values the previous record could not see were 3.67, 4.07, and
    2.16.
  - **An inert control stays inert under the pointer.** Measured with a real
    mouse move, not at rest. At 1024×700 on `kids` all **11** visible inert
    controls — both drawer toggles, the assistant toggle, its ✕, and the seven
    rail modes — resolve to `rgb(125, 134, 148)` (`--inert`), and hovering each
    of them left every one of the eleven at that colour, the two ghost buttons
    keeping the resting `rgb(32, 38, 46)` (`--line-control`) border. The control
    for the reading is the live case at the same size: hovering the `game`
    document's `Panels` resolved it to `rgb(237, 239, 242)` (`--text`) with a
    `rgb(51, 58, 68)` (`--line-hover`) border, **15.88:1** — which is exactly
    what the inert one showed before the fix, at the same size and on the same
    control. Enumerating the live stylesheet found **6** rules with a `:hover`
    that sets a colour; three of them (`.ghost-button`, `.primary-button`,
    `.decision`) can match an inert control, and each now ships its `.is-inert`
    answer beside it, while `.state-shortcut` and the palette rows never go
    inert (`outsideRefusal`) and `.rail-mode:hover` sets only a background.
  - **A palette row keeps its action through a profile switch.** Opened
    on `--overlay palette`, `palette-sculpt-from-reference` rendered
    `data-action="overlay"` in every profile. Clicking the Kids chip made it
    `data-kind="inert" aria-disabled="true"` and clicking it then left the
    overlay open (`data-overlay` still `palette`, the dialog still
    `display: grid`) — the `aria-disabled` guard, not a missing attribute.
    Clicking Game promoted it back and clicking it closed the palette
    (`data-overlay` `none`, `display: none`). Before that fix the attribute was
    emitted only when the control was live at render time, so a Kids-rendered
    document had a row that announced itself live after the switch and did
    nothing. **The reading stands for the promote/demote-through-a-switch
    property, not for the row.** #226 replaced that row: palette rows now carry
    `data-command` and invoke the shared handler rather than dismissing the
    overlay, which `tests/e2e/desktop-command-interactions-golden.test.ts`
    proves by asserting the host call — not a browser observation, and not this
    addendum's to own.
  - **The Kids lock screen is reachable at every tier.** Read from computed
    style at 1680×1000, 1280×800, 1024×700, and 1920×620: the shell body kept
    `mode-rail, profile-refusal, assistant` in flow, the editor refusal resolved
    to `display: grid`, the assistant column to `flex` (never a drawer), its lock
    panel to `flex`, its body and composer to `none`, and the model label to
    `denied`. At 800×560 the shell resolved to `display: none` and the
    `DESKTOP_WINDOW_BELOW_MINIMUM` refusal to `display: block`, naming `900×600`.
  - **A Kids drawer toggle refuses instead of announcing an expansion it cannot
    make.** At 1024×700 and 1920×620 — the tiers where
    `.title-actions .drawer-toggle` resolves to `display: flex` — `drawer-left`
    and `drawer-inspector` render `data-kind="inert"`, `aria-disabled="true"`,
    `data-refusal="OPEN_PATH_KIDS_REFUSED"`, with an `aria-describedby` that
    resolves. Clicking `Panels` from behind the refusal left `data-drawer-left`
    at `closed` and `aria-expanded` at `false`, and `.left-dock` at
    `display: none`. Before the fix both were live `view` buttons that set
    `aria-expanded="true"` on a region the Kids rules keep shut at every size.
  - **A drawer opened before the switch is closed by it.** The other order,
    which the demotion alone did not cover. At 1024×700 on `game`, clicking
    `Panels` gave `data-drawer-left="open"`, `aria-expanded="true"`, and
    `.left-dock` `display: flex`; clicking **Kids** then left `data-drawer-left`
    `closed`, `aria-expanded` `false`, the toggle `data-kind="inert"` with
    `OPEN_PATH_KIDS_REFUSED`, and `.left-dock` `none`. Same at 1920×620 with
    **both** drawers opened first — both reset. Clicking **Game** restored two
    live `view` toggles at `aria-expanded="false"`, and `Panels` opened
    `.left-dock` to `flex` again. Before the fix the attribute survived the
    switch, so an inert toggle announced an expansion over a panel the refusal
    had already taken off screen.
  - **The refuse-only decision holds through a client-side switch, in both
    drawer tiers.** Driven at **1280×800** and at **1024×700** from the default
    `game` document, computed style at each step: clicking the **Kids** chip gave
    `data-assistant="denied"`, the lock `flex` and the column `flex` (not a
    drawer), composer `none`, label `denied`, the editor refusal `grid`, and
    **7 rail modes plus 2 drawer toggles** `aria-disabled` with resolving
    reasons. Clicking a mode and clicking `Panels` from behind the refusal
    changed nothing (`data-mode` stayed `build`, `data-drawer-left` stayed
    `closed`), and clicking the denied toggle changed nothing. Clicking **Game**
    restored a usable column — lock `none`, label `no provider configured`, rail
    and drawer toggles live again — after which `Panels` opened `.left-dock` to
    `flex`, **one** toggle press opened the assistant drawer
    (`flex`, `aria-pressed="true"`, fill `rgb(25, 18, 7)`) and the next closed
    it. **0 dangling `aria-describedby`** at every step, in both tiers.
  - **The status bar names the profile the switch actually landed on.** Driven
    from the `game` document at **1680×1000, 1280×800, 1024×700 and 1920×620**,
    reading the footer's own text node at each step: rendered
    `game profile · core 0.0.0`; clicking **Kids** gave
    `kids profile · refuse-only · separate origin` in the same tick as the editor
    refusal resolved to `grid`, the assistant to `denied`, and the inert count to
    **47**; clicking **Website** gave `web profile · core 0.0.0`; clicking
    **Game** returned to `game profile · core 0.0.0`. **0 dangling
    `aria-describedby`** at every step. Before the fix the pin was rendered
    correctly and then never updated, so the footer read
    `game profile · core 0.0.0` under the full `OPEN_PATH_KIDS_REFUSED` lock
    screen — the one claim on this shell that is a profile assertion rather than
    a panel.
  - **The toggle never claims a column the viewport does not show — including in
    a document rendered for another one.** The 1680×1000 `build.html` bytes ship
    `data-drawer-assistant="closed"`; opened at 1680×1000 the column resolved to
    `flex` with `aria-pressed="true"` and the accent fill `rgb(25, 18, 7)`, and
    the *same bytes* opened at 1280×800, 1920×700, and 1024×700 resolved to
    `none` with `aria-pressed="false"` and the plain `rgb(18, 21, 26)` fill. That
    is the case the previous attribute got wrong: seeded from the render size it
    said `open`, and the drawer sat over the inspector until a script ran.
  - **Interactivity matches the model.** Switching to `animate` rebuilt the dock
    tabs to `["timeline","changes","console"]`, each with an `id`, a `data-kind`,
    and `dock-panel-timeline` the visible panel. *(Superseded by sceneaxi#227,
    not re-recorded: the rest of this reading — deciding one Change Review row
    moving the badge `3 → 2`, **Accept all** taking it to `0`, and the bulk
    actions resolving to `display: none` — was taken against the fixture queue
    that no longer exists. The badge is now `1` while one proposal is under
    review and `0` otherwise, there is no row and no bulk pair, and the
    `pnpm gate` golden drives the real bridge instead; the browser reading is
    owed.)* In `run`, which has no Changes tab, `dock-panel-console` was
    the visible panel.
  - **Roving tabindex is a working pattern.** On the dock strip `ArrowRight`
    moved focus to `dock-assets`, moved `aria-selected` with it, and left
    `dock-panel-assets` as the only visible panel; `End` reached `dock-evidence`
    and `Home` returned to `dock-changes`. On the viewport strip `ArrowRight`
    focused `viewport-source-game`, which reports `data-kind="inert"` and
    `data-refusal="DESKTOP_NO_PRESENTATION_RUNTIME"`, and the selection stayed on
    `viewport-source-scene` — nothing is switched, because nothing can be.
  - **Reduced motion**, in a Chrome launched with `--force-prefers-reduced-motion`:
    `matchMedia('(prefers-reduced-motion: reduce)')` matched, the sculpt sweep
    resolved to `display: none`, and the progress animation collapsed to
    `1e-06s` while the `progressbar` kept `aria-valuenow="64"` and
    `aria-label="Pass 3 of 5"`. The static preview's `sculpt-cancel` stayed on
    screen at `display: flex` with `data-kind="inert"`,
    `data-refusal="DESKTOP_NO_DOCUMENT_BOUND"`, and its accessible refusal.
  - **Window tiers match `WINDOW_TIERS` exactly**, measured as which children of
    `.shell-body` are still in flow: 1680×1000 `mode-rail, left-dock,
    viewport-column, inspector, assistant` with 0 drawer toggles visible;
    1280×800 and 1920×700 `mode-rail, left-dock, viewport-column, inspector` with
    0 toggles; 1024×700 `mode-rail, viewport-column` with 2 toggles visible;
    800×560 the refusal.
  - `<meta name="sceneaxi-pixels-drawn" content="false">` unchanged.


- **Not claimed, and not claimable here**: an installer, a packaged desktop
  application, real renderer finality, live commerce, any file size or hash, and
  any pixel drawn by an engine. None of those exist on this surface. The packaged
  Linux application consumes this chrome unforked from its own tier, where those
  claims are made against real artifacts and a real frame report
  ([`desktop-linux.md`](desktop-linux.md), ADR 0024) — it changes nothing here.

## Extending it

- A new mode means an entry in `DESKTOP_MODE_IDS` **and** `DESKTOP_MODES`, a
  `dockTabsFor()` branch, and a `MODE_PANELS` row; the tests assert every mode
  has all four.
- A new refusal means an entry in `DESKTOP_VISUAL_REFUSALS`, a sentence in
  `DESKTOP_REFUSAL_MESSAGES`, and a state in the reachability test that reaches
  it — the test asserts the registry and the reachable set are equal.
- A new colour means a contrast check: `test/visual-tokens.test.ts` recomputes
  every text token against every surface, so a token added without clearing the
  floor fails there rather than in review.
- A new **control** needs nothing extra to be safe on the refuse-only profile:
  mint it through the projection's own `control()` and it is demoted with
  everything else. Reaching for the exempt `outsideRefusal()` is the deliberate
  act, and it needs a reason the control is not behind the refusal. Rendering it
  through `button(control, …)` is likewise not optional —
  `test/control-accounting.test.ts` fails in both directions, and if the control
  names a region through `aria-controls`, that region needs a row in the test's
  `REGION_CHAINS` or the test fails rather than skipping it.
- A new window tier means a row in `WINDOW_TIERS` alone: the stylesheet
  interpolates its breakpoint from that table, on both axes, and
  `test/control-accounting.test.ts` then checks refusal reachability at the new
  tier without anyone adding a case.
- A new control means adding it to the view **and** rendering it through
  `button(control, …)`. There is no third option: leaving it unrendered fails
  `test/control-accounting.test.ts` from the model side, and drawing a raw
  `<button>` for it fails from the document side.
- A change to Foundations v2 upstream means updating `FOUNDATIONS_V2_COLORS`
  **and** giving any new token a disposition in `FOUNDATIONS_V2_ALIGNMENT`; the
  test asserts the sheet is accounted for in full, so a token added upstream and
  ignored here fails rather than passing quietly. Do **not** resolve that by
  importing `packages/site-kit` — the dependency matrix forbids it here, and the
  duplication is deliberate and recorded above.
