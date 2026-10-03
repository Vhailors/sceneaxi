# Proof media provenance

> Historical record retained from maintenance source 23413eb7889ad2cdb41ab8d729c32c7512917394. These 2026-09-28 captures are not current runtime, native, browser, release, or deployment proof. Crop-source verification below records historical checks, not checks re-executed during branch reconciliation. Original PNG bytes and IHDR are independently checked by the reconciliation tests; original raw crop sources remain unavailable. Do not execute the prose reproduction recipe as part of reconciliation.


The four PNGs in `public/proof/` are the umbrella's only raster product imagery
(DEC-05; design spec sections 3.4 and 3.6; roster row U-24). Each one is a
pixel-identical region of an unedited Engine Desktop capture. This file is their
record: where each image came from, the exact crop, its hashes, the caption it may
carry, the INDEX line that caption relies on, and the limitation chips it must always
carry. `PROOF_MEDIA` in `src/lib/site-content.ts` is built from
[the values block below](#proof_media-values).

- **Produced:** 2026-09-28 by redesign lane L2M on Opus 5.5 (`claude-opus-5-5`).
- **Status:** an implementation record, not a critic verdict. Rows U-21, U-24 and
  U-37 each still need their own Opus critic PASS on the rendered page.
- **Sources:** the raw captures in `.omo/redesign/engine-screens-hero/`, described by
  that folder's `INDEX.md` and `desktop-capture-log.json`. They are untracked working
  files; the source sha256 column below pins the exact bytes.
- **Catalogs never use these images.** A capture beside a listing would read as its
  preview (spec section 3.6).

## Processing rules, as verified

- **Scale 1:1.** Nothing is resampled, retouched, recoloured, composited or upscaled.
  No downscaled `srcSet` variants exist yet; the budget below leaves room for them.
- **Lossless PNG, 8-bit RGB.** Each file holds only `IHDR`, `IDAT` and `IEND` chunks,
  with no gamma, ICC, text or time chunk. The sources carry none either, so every
  image displays exactly as captured.
- **Pixel identity.** Decoded output equals the source region, with 0 differing
  pixels. This was checked twice: by the crop script through Pillow, and by a separate
  decoder that does not use Pillow.
- **Byte budget.** 793,375 bytes in total, against a cap of 1,200,000 bytes.

## Files

| Output (served path) | Source file | Crop box x, y, w, h (source px) | Scale | Output px | Bytes |
|---|---|---|---|---|---|
| `/proof/desktop-run-viewport.png` | `desktop-run-14.png` | 330, 370, 920, 575 | 1:1 | 920 × 575 | 150,590 |
| `/proof/desktop-change-review.png` | `desktop-change-review-17.png` | 330, 625, 920, 575 | 1:1 | 920 × 575 | 122,653 |
| `/proof/desktop-local-build.png` | `desktop-assistant-build-16.png` | 1250, 78, 670, 419 | 1:1 | 670 × 419 | 59,142 |
| `/proof/desktop-run-window.png` | `desktop-run-14.png` | 0, 0, 1920, 1200 (full frame) | 1:1 | 1920 × 1200 | 460,990 |

All sources are 1920 × 1200 RGB. The crop box is the top-left corner plus width and
height, in source pixels.

## Hashes

| Output | Source sha256 | Output file sha256 | Decoded RGB sha256 |
|---|---|---|---|
| `desktop-run-viewport.png` | `d4ceb01da22e7c6704aa774ae4b0590bf412e527de66c6a3c725cb766529c16e` | `5f9b3a4ef6e21949e5da52eac0d03953ce6c8d50f4a18e3b96ea9af1d8eb6ee0` | `0a676ad2f7b51aa2ab1c751b5e83d9105a5f5a09587f07c9f11a17efd9cf14c3` |
| `desktop-change-review.png` | `a098d8cf68bd4f9540188e4b4d025ee52f5434a0518899dc75616f43ddc9c511` | `670ccdb01add10432452a4e085bf5085f6c48c2873c10244b4d9568d8f422828` | `9e398dff87bcf74df3241c6559fa9666065ece69bdca6c871e9d74a4c2200401` |
| `desktop-local-build.png` | `e3287c5dc27f4ded4bf9a3cc4360873110d3b4de79878c24024c16f43663a9f2` | `ca17e1f15079921d7424e4e719aeec220202ce90a06a36bea69538243c136776` | `97d1989e44ab25beb30f1684939af5e63912cf1b2e74e97b61e127b783dcf89a` |
| `desktop-run-window.png` | `d4ceb01da22e7c6704aa774ae4b0590bf412e527de66c6a3c725cb766529c16e` | `f5567d1b1fd439583225e5672b02b2f206697cca827a74b93092fc87cef0fb75` | `3b087f2a6e694fc1aa4599e7a535a62e02d3b86a0a3fa576ef9731ee84cc3fa1` |

The decoded RGB sha256 hashes the raw 8-bit RGB pixel rows, top to bottom. It does not
depend on the PNG encoder, so it proves pixel identity on any toolchain. The output file
sha256 proves byte identity on the recorded toolchain only (see
[Reproduce and verify](#reproduce-and-verify)).

## Per image

### A. `desktop-run-viewport.png`: home gallery, first card

**Shows.** The Run-room viewport of the Linux developer build after one Play: the
starter crates and the assistant's magenta objects on the grid. Below them are the
app's own two evidence lines: `kernel playback acknowledged: 4 ticks advanced · digest
sha256:dc74a5b6878… → sha256:54298459e2c… · composed scene redrawn at viewport frame
12` and `backend three · label Three presentation core · surface webgl-canvas ·
pixelsDrawn true · drawCalls 18 · mounted … · scene desktop-linux-open-scene`.

**Crop decision.** The spec rect 345, 380, 890, 556 became 330, 370, 920, 575.

- The spec rect cut the first two glyph columns (x 343 and 344) off all three evidence
  lines.
- It also ended on the last descender row (y 935), leaving no margin.
- The new box is the viewport canvas's full inner width (its borders sit at x 329 and
  x 1250) and ends on the last canvas row above the dock border (y 945).
- The lines now read whole, with a 13 px left inset and a 9 px bottom margin, and the
  box is exactly 16:10.
- No edge moved more than 15 px; the spec allows 64. What the image shows is unchanged.

**Caption relies on (INDEX, verbatim).**

> All desktop shots are the real `SceneAxi Engine Desktop` window (1920×1200
> content) with a bound project (`scene.json · open`), the real desktop viewport
> mounted (`meta[name=sceneaxi-pixels-drawn] = "true"`), and — for shots 11–15 —
> after a real **Play** of the composed scene: the app's own status line reads
> "Played composed scene · 4 ticks · viewport frame 12 · session closed" and the
> open-path line reads "kernel playback acknowledged: 4 ticks advanced · digest
> sha256:… → sha256:… · composed scene redrawn at viewport frame 12". The scene is
> the starter composition (three placed service-crate instances) grown during this
> capture session by assistant Build artifacts that the assistant mounted and saved
> into the scene.

> `desktop-run-14.png` | Run room with Run inspector and console dock; status line
> still reports the played session's ticks and redraw

**Limitation chips (always shown).** `Partial · one-shot Play` and
`Developer build · software rasterizer`.

**Must not be used to claim.** Persistent Play; GPU rendering (it is SwiftShader
under Xvfb); any other window, dock or document; a signed installer; macOS or Windows.

### B. `desktop-change-review.png`: home gallery, second card

**Shows.** The Changes dock tab with badge `1`, and the dock caption "One active E1
proposal at a time. Accept applies the whole proposal through the shared authoring
session; Reject discards it without writing." Below the caption are the document
`scene.json`, its base content hash, the header of the proposed-change diff, and the
Reject and Accept buttons. At the bottom is the app's own status line `rarity proposal
staged · review before Save`. Above the dock is the lower viewport with the same two
evidence lines (`drawCalls 19`).

**Crop decision.** The spec rect 330, 615, 917, 573 became 330, 625, 920, 575.

- The spec rect's bottom row (y 1187) sliced through the status-bar text (y 1183 to
  1192).
- Its right edge (x 1246) cut the dock scrollbar track (x 1235 to 1249).
- The new box spans the column's full inner width (x 330 to 1249) and runs down to the
  window's last row (y 1199). The status line reads whole with a 7 px margin, and the
  box is exactly 16:10. No edge moved more than 12 px.
- Known sub-visible artifact: column x 330 holds the 1 px anti-aliased edge of the
  `·` that follows `scene.json` (x 328 to 330, y 1186 to 1187; red channel 34 and 55
  over a background of 7). Starting at x 331 would break the exact 16:10 box, so it
  stays.

**Truth note.** The capture log records that this session's review Accept and
top-bar Save were both refused with `invalid-proposal`. The image therefore shows a
review that is staged and not applied, and nothing in the frame says otherwise.

The claim sentence describes what the two buttons do, never that this proposal was
accepted. It follows the dock caption visible in the frame and
`docs/engine-desktop-surface.md`, which says that Accept applies the whole proposal
through the shared authoring session, that Reject discards it without writing, and
that no per-row or partial acceptance exists. The limitation chip `Staged, not
applied` stays on the image, and the status line inside the frame says the same.

**Caption relies on (INDEX, verbatim).**

> `desktop-change-review-17.png` | Populated **Change Review**: Changes dock tab
> active, change badge `1`, the staged proposal inspector ("=== SceneAxi inspector —
> proposed change (review before accept) === --- a/scene.json +++ b/scene.json"),
> status "rarity proposal staged · review before Save"

> **Desktop images may not claim:** […] a completed Save of the staged review — in
> this capture session both the review Accept and the top-bar Save were refused with
> `invalid-proposal` (recorded in `desktop-capture-log.json`), so shots 16–17 show a
> review that is staged but not committed

**Limitation chip (always shown).** `Staged, not applied`.

**Must not be used to claim.** That the proposal was accepted, applied or saved;
partial accept.

### C. `desktop-local-build.png`: home gallery, third card

**Shows.** The inspector, with the mounted assistant artifact selected (`Object
assistant-6f23b0b1515d-artifact · Insta…`, its transform fields and its Stage control).
Beside it is the assistant result:

- the status "Mounted and saved into the current scene. The assistant artifact is now
  part of the game.";
- MATERIALS (read-only) `surface: #6f23b0, metal 0.15, rough 0.65`;
- PHYSICS (read-only) `assistant-6f23b0b1515d-root-collider: box collider`;
- SETTINGS (read-only) `@sceneaxi/authoring-core · emitSculptProcedural` and
  `ASSISTANT_SCULPT_INSPECTION_EDIT_UNSUPPORTED`.

The collider id and the selected object name the same artifact, `6f23b0b1515d`.

**Crop decision.** The spec rect 1250, 36, 670, 419 became 1250, 78, 670, 419: the box
moved down 42 px and its size is unchanged.

- **The header row is out.** The spec rect included the panel header row (y 36 to 70),
  whose chip reads `OpenCode Flash`. That label is the configured BYOK model name,
  shown whenever a local runtime is bound (`modelLabel` in
  `apps/desktop-shell/src/visual-model.ts`). It does not name the route that produced
  this result. Placed directly above "Mounted and saved…", it would read as a provider
  success, and the provider path in this capture could not run (see the source trace
  below).
- **Where the edges land.** The box starts under both header borders (y 64 and 71). It
  ends between the inspector paragraph (last text row 493) and the Mutation JSON box
  (y 508).
- **Why the margins are tight.** At this width a 16:10 box is 419 rows tall, and no
  looser window exists: the text-free top band is y 72 to 81, and the bottom must land
  at or after y 494. The cost is 4 px above the first inspector line and 3 px below the
  last.
- **The left border stays.** The box keeps the 1 px column border at x 1250, so the
  flush-left `physics` heading reads as the panel edge and not as a cut.

**Why "Local route · no provider" is true (source trace).**

1. **The Local route was never selected.** The capture script's attempt to select it
   timed out. `desktop-capture-log.json` records `route local: timeout waiting for
   visible [data-action="assistant-route"][data-value="local"]`.
2. **Why it timed out.** The route group is hidden unless details are open
   (`.assistant-routes{display:none}` in `apps/desktop-shell/src/chrome.ts`). Non-Kids
   profiles are also forced onto the BYOK route (`synchronizeVisibility` in
   `desktop/linux/src/renderer/byo-configuration.ts`). So Send dispatched
   `assistant-byo-build`.
3. **The BYOK attempt stopped before any provider session.** The secure runner reads
   the stored key before it creates a provider session, and throws when the read fails
   (`createSecureDesktopByoAssistantRunner` in
   `desktop/linux/src/lib/byo-configuration.ts`). This session's key store was locked:
   `DESKTOP_PROVIDER_KEY_STORE_LOCKED` is visible lower in the same capture.
4. **The renderer fell back to a Local Build.** The runner's refusal ends the BYOK job
   without a result, so `poll` returns `false`. The renderer then prints "Flash did
   not return a usable object. Making one locally…" and re-runs as a forced Local
   Build (`start(true)` in `desktop/linux/src/renderer/viewport.ts`, with route
   `local` and mode `build`). In the bridge that run is
   `runAssistantSculptAction({ route: "local" })` (`desktop/linux/src/lib/bridge.ts`).
5. **The result is that Local Build's.** "Mounted and saved into the current scene…"
   is the status that follows a successful whole-proposal accept of that build
   (`persistReadyBuild` in the same renderer file).

No provider session was ever created, so no provider call was made.
`docs/runnable-surfaces.md` records the same capability: "Assistant Build's Local
route compiles and mounts a typed sculpt without a provider". The panel's static copy
("Flash does the work", "What Flash makes appears in the scene") is the assistant's
name in its instructions. It is not a record of which route ran.

**INDEX correction.** INDEX gives this shot's material as `surface: #ea11f5`. The
pixels and `desktop-capture-log.json` both read `#6f23b0` for shot 16; `#ea11f5`
belongs to shot 17. The caption quotes neither value.

**Caption relies on (INDEX, verbatim).**

> `desktop-assistant-build-16.png` | Assistant panel populated by a real **Local**
> Build run (deterministic compiler, no provider, no key, no network): result card
> with read-only MATERIALS (`surface: #ea11f5, metal 0.15, rough 0.65`), PHYSICS (box
> collider), SETTINGS (`@sceneaxi/authoring-core · emitSculptProced…`), status
> "Mounted and saved into the current scene…", project status "rarity proposal staged
> · review before Save"

> **Desktop images may not claim:** any provider/network AI call (Local route is the
> deterministic offline compiler; the Agent pass is the checked-in no-network rarity
> fixture)

**Limitation chip (always shown).** `Local route · no provider`.

**Must not be used to claim.**

- Provider AI.
- A general agent.
- A general sculpt editor.
- Output quality.
- That the artifact was saved to disk. The caption says it mounts; the app's own
  "saved into the current scene" is its status text, and this session's later
  top-bar Save was refused.

### D. `desktop-run-window.png`: `/engine` full-window figure

**Shows.** The whole 1920 × 1200 Engine Desktop window in the Run room after Play.
The window contains:

- **Top bar:** the session status `Played composed scene · 4 ticks · viewport frame
  12 · session closed`.
- **Objects dock:** a project-browser refusal, "Project-browser rename and delete
  are not permitted by the current project lifecycle contract".
- **Centre:** the viewport with its evidence lines, and the Console dock with the
  `run-play` event JSON.
- **Live values panel:** the Stop and Reset controls.
- **Assistant panel:** the refusal `DESKTOP_NO_PRESENTATION_RUNTIME` and the locked key
  store (`OpenCode Flash key`, `Unavailable`, `DESKTOP_PROVIDER_KEY_STORE_LOCKED`).

The top bar's profile tabs read `Engine`, `Website` and `Kids safe`. The active profile
is Game (the status bar reads `game profile · core 0.0.0`). That tab label is desktop
chrome, not Kids-surface content, and nothing in an image is a link.

**Crop decision.** The full frame, 1:1, as spec section 3.6 specifies. It is
re-encoded rather than byte-copied: 460,990 bytes against the source file's 482,529,
with identical pixels.

**Caption relies on (INDEX, verbatim).** The same desktop introduction and
`desktop-run-14.png` row quoted for image A, plus:

> Every PNG in this folder is a screenshot of a **real SceneAxi surface actually
> rendering content** through the real Three presentation core (`WebGLRenderer`)
> […] Nothing here is a mockup, a composite, an upscale, or generated art.

**Limitation chips (always shown).** `Developer build`, `Software rasterizer` and
`Linux only`.

**Must not be used to claim.** A finished product; hosted or entitled features;
working key storage; cross-platform.

## `PROOF_MEDIA` values

These are the exact strings for `PROOF_MEDIA`. The field list is the one in spec
section 3.5. The object shape is a suggestion; the strings are the record.

- **Home cards** read `placement: "home"`.
- **Titles and claims** are verbatim from spec section 3.6. The `/engine` claim is the
  spec section 3.4 "can claim" sentence for that image.
- **Level** uses the `docs/runnable-surfaces.md` vocabulary as spec section 3.5 assigns
  it. `startable` renders as a `validated` chip and `partial` as a `dormant` chip.
  U-37 renders no level chip, so the `/engine` figure has `level: null`.
- **Limitation chips** always render `dormant`. Each entry is one chip, and every
  image carries at least one.
- **Proof links** go only to served routes: `/engine` shows the recorded Linux build,
  and `/docs` lists the `sceneaxi project propose` and `sceneaxi project apply` verbs
  (its `#free-path` section). The `/engine` figure sits on `/engine`, so it has no proof
  link.
- **Banned strings.** No string below contains an en or em dash, `monthly`, a 64-hex
  digest, `available` (in any case, so not `unavailable` either), `This page` or
  `subscribe`.

```ts
[
  {
    id: "desktop-run-viewport",
    placement: "home",
    src: "/proof/desktop-run-viewport.png",
    width: 920,
    height: 575,
    alt: "Engine Desktop viewport on the Linux developer build after one Play: crates and magenta objects on a grid, with the app's own playback and frame lines below.",
    level: "partial",
    title: "Play runs the saved scene",
    claim: "One kernel session opens over the composed scene; the viewport redraws and prints the engine's own frame line.",
    limitation: ["Partial · one-shot Play", "Developer build · software rasterizer"],
    proofHref: "/engine",
    proofLabel: "See the recorded Linux build",
  },
  {
    id: "desktop-change-review",
    placement: "home",
    src: "/proof/desktop-change-review.png",
    width: 920,
    height: 575,
    alt: "Change Review dock in Engine Desktop with one staged proposal: document scene.json, its base content hash, the proposed diff, and Reject and Accept buttons. The status line reads rarity proposal staged, review before Save.",
    level: "startable",
    title: "Changes wait for review",
    claim: "An edit is staged as one proposal with its base hash; Accept applies it whole, Reject discards it.",
    limitation: ["Staged, not applied"],
    proofHref: "/docs",
    proofLabel: "Read the propose and apply verbs",
  },
  {
    id: "desktop-local-build",
    placement: "home",
    src: "/proof/desktop-local-build.png",
    width: 670,
    height: 419,
    alt: "Engine Desktop inspector and assistant panels after a Local Build: the assistant artifact is selected in the inspector, and the result card lists read-only materials, a box collider and authoring-core settings.",
    level: "startable",
    title: "Local Build without a provider",
    claim: "The assistant's Local route compiles a typed sculpt and mounts it; materials and collider stay read-only.",
    limitation: ["Local route · no provider"],
    proofHref: "/engine",
    proofLabel: "See the recorded Linux build",
  },
  {
    id: "desktop-run-window",
    placement: "engine",
    src: "/proof/desktop-run-window.png",
    width: 1920,
    height: 1200,
    alt: "The whole Engine Desktop window on the Linux developer build, in the Run room after one Play: object list, viewport with crates, console output, and side panels showing the build's own refusal lines.",
    level: null,
    title: "Engine Desktop, Linux developer build, Run room after Play",
    claim: "The whole developer-build window in the Run room after Play. Refusal lines visible in its panels are the build's own.",
    limitation: ["Developer build", "Software rasterizer", "Linux only"],
    proofHref: null,
    proofLabel: null,
  },
]
```

### Display notes for the consuming rows

These figures follow from the natural sizes. They are not defects in the files.

- **U-21 (three cards at about 389 CSS px, "at most natural width / 2 at DPR 2").**
  Cards A and B meet it, since 920 / 2 = 460. Card C cannot: 670 / 2 = 335, so at DPR 2
  its image is upsampled about 1.16 times. No clean 16:10 crop of these panels is wider
  than 670 px, because widening would pull in viewport chrome, and upscaling is not
  allowed.
- **U-23 (358 × 224 CSS px at 390).** At DPR 2, A and B downsample and C upsamples
  about 1.07 times. At DPR 3, all three upsample.
- **U-37 (at most 1216 CSS px).** Sharp at DPR 1. Shown at the full 1216 px, a DPR 2
  screen upsamples it about 1.27 times; a width of 960 CSS px or less stays sharp at
  DPR 2.

## Reproduce and verify

1. **Check the sources.** Hash the three source captures; each must equal the source
   sha256 column. The script refuses to run otherwise.
2. **Run the script.** From the repository root, run
   `python3 make_proof_media.py "$PWD"` (the script is below). It crops, writes, and
   re-decodes each output against its source region. It checks the chunk list, the
   16:10 ratio and the byte cap, then prints a JSON manifest.
3. **Check the outputs.** `sha256sum sites/umbrella/public/proof/*.png` must equal the
   output file sha256 column. Byte identity holds for the recorded toolchain: Python
   3.14.7, Pillow 12.1.1 and zlib-ng 1.3.1. Another zlib may compress differently, so
   on a different toolchain compare the decoded RGB sha256 instead.

Recorded on 2026-09-28: two consecutive runs wrote byte-identical files, and the
decoder that does not use Pillow found 0 differing pixels in all four.

The script is reproduced verbatim below. The file's sha256 is
`09c6a8cba8bf6ddd5ccb1b9fd0247267858b45c3d8e6db522921e1386afa3610`. It lives outside
the repository; this copy is the durable record.

```python
#!/usr/bin/env python3
"""SceneAxi umbrella proof media: deterministic, lossless crops (lane L2M, DEC-05).

Usage: python3 make_proof_media.py <repo-root>

Every output is a pixel-identical region of a pinned source capture, re-encoded as a
plain PNG (IHDR/IDAT/IEND only). Nothing is resampled, recoloured, composited or
retouched. The run fails closed when a source hash, a pixel comparison, the chunk
list, the aspect ratio or the byte budget disagrees.
"""
import hashlib
import json
import struct
import sys
import zlib
from pathlib import Path

import PIL
from PIL import Image

SOURCE_DIR = Path(".omo/redesign/engine-screens-hero")
OUTPUT_DIR = Path("sites/umbrella/public/proof")
BYTE_CAP = 1_200_000
PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"

# output, source, pinned source sha256, crop box (x, y, w, h) in source pixels, 16:10 card
JOBS = (
    ("desktop-run-viewport.png", "desktop-run-14.png",
     "d4ceb01da22e7c6704aa774ae4b0590bf412e527de66c6a3c725cb766529c16e",
     (330, 370, 920, 575), True),
    ("desktop-change-review.png", "desktop-change-review-17.png",
     "a098d8cf68bd4f9540188e4b4d025ee52f5434a0518899dc75616f43ddc9c511",
     (330, 625, 920, 575), True),
    ("desktop-local-build.png", "desktop-assistant-build-16.png",
     "e3287c5dc27f4ded4bf9a3cc4360873110d3b4de79878c24024c16f43663a9f2",
     (1250, 78, 670, 419), True),
    ("desktop-run-window.png", "desktop-run-14.png",
     "d4ceb01da22e7c6704aa774ae4b0590bf412e527de66c6a3c725cb766529c16e",
     (0, 0, 1920, 1200), False),
)


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def chunk_types(path: Path) -> list:
    data = path.read_bytes()
    if not data.startswith(PNG_SIGNATURE):
        raise SystemExit(f"{path}: not a PNG")
    types, offset = [], len(PNG_SIGNATURE)
    while offset < len(data):
        (length,) = struct.unpack(">I", data[offset:offset + 4])
        types.append(data[offset + 4:offset + 8].decode("ascii"))
        offset += 12 + length
    return types


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("usage: make_proof_media.py <repo-root>")
    repo = Path(sys.argv[1]).resolve()
    out_dir = repo / OUTPUT_DIR
    out_dir.mkdir(parents=True, exist_ok=True)
    expected = {job[0] for job in JOBS}
    strays = sorted(p.name for p in out_dir.iterdir() if p.name not in expected)
    if strays:
        raise SystemExit(f"unexpected files in {OUTPUT_DIR}: {strays}")

    manifest = []
    for name, source_name, pinned, (x, y, w, h), card in JOBS:
        source_path = repo / SOURCE_DIR / source_name
        digest = sha256(source_path)
        if digest != pinned:
            raise SystemExit(f"{source_name}: sha256 {digest} != pinned {pinned}")
        with Image.open(source_path) as opened:
            source = opened.convert("RGB") if opened.mode != "RGB" else opened.copy()
        if source.size != (1920, 1200):
            raise SystemExit(f"{source_name}: size {source.size}")
        if x < 0 or y < 0 or x + w > source.width or y + h > source.height:
            raise SystemExit(f"{name}: box outside the source")
        if card and abs(w / h - 1.6) > 0.002:
            raise SystemExit(f"{name}: {w}x{h} is not 16:10")

        region = source.crop((x, y, x + w, y + h))
        out_path = out_dir / name
        region.save(out_path, format="PNG", compress_level=9)

        with Image.open(out_path) as written:
            written.load()
            if written.mode != "RGB" or written.size != (w, h):
                raise SystemExit(f"{name}: wrote {written.mode} {written.size}")
            if written.tobytes() != region.tobytes():
                raise SystemExit(f"{name}: decoded pixels differ from the source region")
        chunks = chunk_types(out_path)
        if set(chunks) != {"IHDR", "IDAT", "IEND"}:
            raise SystemExit(f"{name}: unexpected chunks {chunks}")

        manifest.append({
            "output": f"{OUTPUT_DIR}/{name}",
            "source": f"{SOURCE_DIR}/{source_name}",
            "box": [x, y, w, h],
            "scale": "1:1",
            "width": w,
            "height": h,
            "source_sha256": digest,
            "output_sha256": sha256(out_path),
            "bytes": out_path.stat().st_size,
            "pixel_diff": 0,
        })

    total = sum(entry["bytes"] for entry in manifest)
    if total > BYTE_CAP:
        raise SystemExit(f"total {total} bytes exceeds {BYTE_CAP}")
    print(json.dumps({
        "toolchain": {
            "python": sys.version.split()[0],
            "pillow": PIL.__version__,
            "zlib": zlib.ZLIB_RUNTIME_VERSION,
        },
        "total_bytes": total,
        "byte_cap": BYTE_CAP,
        "outputs": manifest,
    }, indent=2))


if __name__ == "__main__":
    main()
```
