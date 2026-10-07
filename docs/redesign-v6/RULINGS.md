# SceneAxi v6: gate rulings

Each ruling records who decided, the pick, the reasons, and the rejected options. Later gates (G3–G5) are appended here.

---

## G1: three concepts → two finalists

| Field | Value |
|---|---|
| Decided by | conductor on autopilot, from the G1 council (no user pick was taken) |
| Pick | **A "Interlocking" (signal box)** first. **B "Revision Block" (drawing sheet)** second. |
| Dropped | **C "Press Proof"** |

**Reasons**
- **A:** every seat's top pick.
- **B:** took the second slot 2-of-3 (architect, a11y) over C.
- **C dropped** for two reasons:
  - Its Overprint render path is risky.
  - It replaced the required button ids with action hooks (`concepts/c/inspector.html:99-101`), which breaks the frozen web-shell DOM contract.

**Must-fix carried into the slices**
- **Both:**
  - Production Change Review wrote `#diff.textContent` (`apps/web-shell/src/inspector-app.ts:976-979`). It must become structured before/after rows without breaking the ids or `apps/web-shell/test/inspector-accessibility.test.ts`.
  - Nobody had visually signed off. Shots at 1440, 390 and 200% must be viewed.
- **A:**
  - Scope the global `[hidden]` fix.
  - Keep the slate-green panel crisp at 390.
- **B:**
  - Static zone refs (no JS layout measurement in Operate).
  - 13px drafting lettering readable at 200%.
  - 28px compact controls meet WCAG 2.5.8.
  - Kids stays in the family core.

**Outcome in the slices**
- **Before/after rows:** A delivered them (`#rows`, tests 12/12 unchanged). B delivered them too (`#review-rows`, 25/25, but B edited two test files).
- **`[hidden]`:** A scoped it to `.il [hidden]`.
- **B's conditions:** static zone refs and 28px controls passed. 13px lettering was checked by OCR only (0.775 vs 0.847).
- **Visual sign-off:** still not done for either.

**Brand-commitment override** (BRIEF §4, §10.1): replacing the world overrides the `PRODUCT.md` §Brand Commitments accents: signal orange (umbrella), red/teal (stores), violet (Kids) and cyan (desktop). Under A, those accents survive only as:
- the **store token block** (Forge `#D9A066` / Vitrine `#9DBBF2`)
- the **Kids hue** (`#1E4FBF` on sky)

This overrides captain-accepted authorities (Foundations v2, Cinematic Pro), so it **needs the user's confirmation**. A5 then updates `PRODUCT.md`.

---

## G2: lock one direction

| Field | Value |
|---|---|
| Decided by | conductor on autopilot, from the G2 council's final positions, **2–1** |
| Pick | **A "signal box" LOCKED, pending human visual sign-off** |
| Votes (final round) | design director: A · UX + a11y lead: A · frontend architect: B |
| Rejected | **B "drawing sheet"** (worktree `../sceneaxi-slice-2`) |
| Direction file | `docs/redesign-v6/DIRECTION.md` |

### How the council moved

| Round | Design director | UX + a11y lead | Frontend architect |
|---|---|---|---|
| Opening | B | B | A |
| Round 1 | **A** | B | **B** |
| Round 2 | A, narrowly (will not block B) | **A** | B |

All three seats said none of them could open the PNGs. Every visual claim rests on OCR, pixel sampling and computed styles.

### Why A

1. **The identity is structural.** WHERE / BEFORE / AFTER rows, a status plate with label + icon, and the raw `#diff` below. That carries unchanged to Store, Kids, the web-shell DOM-string UI and Electron.
2. **B depends on its drafting font.** The font reads worse at 13px (OCR 0.775 vs 0.847 for Public Sans). The fix every seat agreed on (drafting face only at display sizes) leaves B plain.
3. **A's Change Review is visible at 390.** The demo plate reaches the first mobile viewport. B's sits below the fold and needed an unbuilt sticky summary.
4. **B's script cost is measured.** B adds mobile TBT of 2,647 ms against a 2,015 ms baseline, inherited by every lane reusing `hero-review.tsx`.
   - The verdict asked for A's TBT, which nobody had read: it is **998 ms** (`concepts/a/slice/lighthouse-umbrella-mobile.json`, at load average 73). It is below baseline even on a loaded host.
   - TBT is therefore a real point against B, not machine noise.
5. **Ties and void measurements:**
   - CSS is a tie: A's own sheet is 17,376 B, B's is 18,423 B. A's 106 KB shipped figure includes v5 `globals.css`, which A5 retires either way.
   - A's 3,350 ms mobile LCP was measured at load average 73 and **does not count**.
   - B's runs were also taken while slice-1's server on :3421 was running.

### What B had going for it (recorded so the record is honest)

- **Measured mobile LCP 2,260 ms** (passes), desktop LCP 1,121 ms, CLS 0.
- **Fresh evidence:** re-measured after its last code change. A's was not.
- **28px compact controls pass WCAG 2.5.8** without the spacing exception. Adopted into A.
- **No layout-measurement JS** in Change Review. Adopted into A as a rule.

### Rulings made while writing DIRECTION.md (direction author)

1. **3D:** dropped from the v6 release hero. `hero-viewport.tsx` was never built. The static Change Review hero is the hero and the mandatory fallback for any later diorama (DIRECTION §7).
2. **Refusal text on dark** is `--refused-lamp` #FF9A8C on iron surfaces (7.16 pair), or #FFB3A8 on the panel (5.62 pair). `#FF4D5E` is retired (DIRECTION §5.2).
3. **"Public Sans" vs Atkinson Hyperlegible Next.** The G2 verdict's must-carry 3 says "Public Sans is the body and label face on every surface".
   - Public Sans is **B's** prose face and was the OCR control in the font comparison. Concept A ships Atkinson Hyperlegible Next / Mono, and every A contrast and keyboard measurement was taken with it.
   - **Ruling:** keep Atkinson Hyperlegible Next as A's body and label face, which honours the condition's intent: a legible workhorse sans for all body and labels, never the display face at small sizes.
   - Gate it with the same OCR test: Atkinson Mono at 13px and Big Shoulders at 15px caps must each score ≥ 0.847 at 100% and 200%. On failure, the role falls back as DIRECTION §6 states.
   - **The user may overrule** and switch to Public Sans. That is a token-only change for A5.
4. **Digest copy buttons** sit after Accept/Reject in DOM order, so "Accept within 5 Tab stops" holds (DIRECTION §4.1).
5. **Desktop window background:** `#111113` → `#1E2B28` (iron).

### Must-fix conditions carried (owners in DIRECTION §13)

1. At 1280px and 200% zoom, the umbrella nav must not clip ("Acco"). Account and Download must stay visible or keyboard-reachable through a disclosure menu (WCAG 1.4.10).
2. Dark refusal note ≥ 5.5:1 (was 4.98).
3. 390 inspector:
   - Remove the repeated help sentence.
   - Shorten the sha256 digest and add a Copy button, with the full value in the accessible label.
   - No 3-line wrap.
4. 390 above the fold: status plate + first WHERE/BEFORE/AFTER row inside 390×844 without scrolling. Accept within 5 tab stops. Status text announced first.
5. Measure WCAG 1.4.11 3:1 on boundaries and rules, and light-mode disabled contrast.
6. Keep A's `[hidden]` fix scoped. Keep the slate-green panel crisp at 390.
7. Re-run mobile Lighthouse for the pilot on a quiet machine (load average < 4): LCP ≤ 2.5 s, TBT ≤ 2,015 ms.
8. Check the licences of the self-hosted fonts.
   - **Done:** all three are SIL OFL 1.1 per their name tables. Big Shoulders Display 2.002, Atkinson Hyperlegible Next 2.001, Atkinson Hyperlegible Mono 2.001.
   - **Open:** `OFL.txt` must ship beside the files (A5).
9. Housekeeping on nested lockfiles. See below.
10. **Visual veto open.** See below.

### VISUAL VETO: open, pending human sign-off

**A is locked pending human visual sign-off.** No agent in this run can open PNGs. A person should view these six shots:

| # | Shot | Path |
|---|---|---|
| 1 | A umbrella at 390 | `docs/redesign-v6/concepts/a/slice/umbrella-390.png` (full page: `umbrella-390-full.png`) |
| 2 | B umbrella at 390 | `docs/redesign-v6/concepts/b/slice/umbrella-390-fold.png` (full page: `umbrella-390.png`) |
| 3 | A umbrella at 200% | `docs/redesign-v6/concepts/a/slice/umbrella-zoom200.png` |
| 4 | B umbrella at 200% | `docs/redesign-v6/concepts/b/slice/umbrella-zoom200-fold.png` (full page: `umbrella-zoom200.png`) |
| 5 | A Change Review at 390 | `docs/redesign-v6/concepts/a/slice/inspector-dark-390-review.png` (light: `inspector-light-390-review.png`) |
| 6 | B Change Review at 390 | `docs/redesign-v6/concepts/b/slice/webshell-dark-390-pending.png` (light: `webshell-light-390-pending.png`) |

**What reopens G2 in favour of B:**
- the person finds A generic, full of template tells, or broken;
- **or** the quiet-machine re-run shows A's mobile LCP above 2.5 s with no hero-only fix.

Both worktrees are kept until the veto is cleared and the pilot has ported from slice-1.

---

## Housekeeping (G2 condition 9)

| Action | Status |
|---|---|
| Revert `sites/umbrella/pnpm-lock.yaml` in `../sceneaxi-slice-1` | **done** (`git checkout --`; status no longer lists it) |
| Revert `sites/umbrella/pnpm-lock.yaml` in `../sceneaxi-slice-2` | **done** |
| Delete `sites/{umbrella,kids,catalog-game,catalog-web}/pnpm-lock.yaml` in the main repo | **NOT done: held for a user ruling** |

**Why the deletion is held**
- The condition calls these files "untracked", but they are **tracked and committed**:
  - umbrella and catalog-game/web since `ec09b27b` (#125)
  - kids since `6bf5cd0b` (#216)
  - all clean against HEAD at `759adfe9`
- Deleting them is a tracked change to the deploy surface, not cleanup.
- `sites/kids` is **not** in `pnpm-workspace.yaml`. It is an isolated origin, so its lockfile is probably its only lockfile, and deleting it may break the Kids install or deploy.
- The other three sit inside the workspace and are likely vestigial, but a per-site deploy may still read them.

The user decides whether to delete all four, the three workspace ones only, or none. Whatever the choice, the hard rule "no *new* nested lockfile changes" holds for every lane.

---

## G3: foundation (A5) acceptance

| Field | Value |
|---|---|
| Decided by | conductor, under the gate rule in `GATE-BASELINE.md` |
| Outcome | **Foundation ACCEPTED under the baseline rule** |
| Reviewed | `packages/site-kit/src/design-tokens.ts` (layered, v5 global `a:hover` removed), `state-panel.ts`, `apps/desktop-shell/src/visual-tokens.ts`, `DESIGN.md`, `.impeccable/` |
| Evidence | `GATE-BASELINE.md`; `~/Documents/Reports/sceneaxi-redesign-v6/a5b/REPORT.md`, `a5b/_work/gate-{main,v6}/`; `foundation/` |

**What the review found**
- The G3 review returned **3 FAILs**. All three were FAILs **only because `pnpm run gate` was red**.
- Every failing gate step and test is **pre-existing at main HEAD `2cef2033`**, as listed in `GATE-BASELINE.md`:
  - the ADR-0024 workspace checks: `check:sites`, `check:desktop`, `check:publish-ready`
  - `check:traceability`
  - the desktop command-plane goldens
  - the desktop/linux renderer harness
  - the lint errors in `docs/audits` and `scripts/fix-trace-entries.mjs`
  - the identity and provider-adapter tests
- The v6 vitest failing set is a **strict subset** of main's: 16 files / 199 tests against 20 / 210, with only removals in the diff.
- `check:boundaries` was fixed on the branch.
- **The token checks passed.** `check:syntax`, `check:boundaries`, `check:contracts`, `build`, `node --test`, `tsc` for site-kit / desktop-shell / umbrella, and eslint on the touched files are all green. No failing test touches site-kit, desktop-shell, design tokens, visual tokens, the state panel, or the catalog and umbrella visual tests.

**Ruling**
- The conductor accepted the foundation under the baseline rule. `pnpm run gate` may show **no failure beyond `GATE-BASELINE.md`**. Every check touching site-kit, desktop-shell tokens, boundaries, syntax and typecheck/build must be green.
- Lanes may only keep failures that are already on that list. They never touch the ADR-0024 checks, `pnpm-workspace.yaml`, the root lockfile, or tests to make them pass. That conflict is the owner's to decide in a separate change.
- A lane that runs the gate writes the full output to `docs/redesign-v6/gate-latest.log` and reports a "new vs baseline" diff.

---

## Operator's visual feedback on A (in substance)

The operator viewed A and gave feedback, applied as binding input to `concepts/a-rich/` (`SPEC-DELTA.md` header).

**Keep**
- the green palette
- the Propose / Inspect / Commit hero as the signature

**Fix**
1. **The green field below the hero is flat:** one panel colour, the same density, text rows only. It reads as too simple.
2. **The gallery boxes are empty.**
3. **One supporting accent is missing.** Green, cream and the state paints alone are not enough.
4. **The motion should tell the story:** propose → inspect → commit, with a proper reduced-motion form.

**Measured cause of item 2.** The cause was not missing assets.
- The three `concepts/a/assets/desktop-*.png` files exist and are byte-identical to `sites/umbrella/public/proof/`.
- A used `loading="lazy"`, and its full-page shots were taken without scrolling, so the images never loaded.
- `a-rich/shots/metrics.json → originalLazy` shows all three as `complete:false, naturalWidth:0`. The gallery rects in A's committed shot have luminance variance 0.

---

## A-rich: the enrichment

`docs/redesign-v6/concepts/a-rich/` is a copy of A with an enrichment layer. `concepts/a/` stays untouched. Full spec: `concepts/a-rich/SPEC-DELTA.md`. It is folded into `DIRECTION.md` §4.6–4.7, §5.8, §6, §7.1–7.2, §8, §11, §13 and §14.

1. **The hero composition is unchanged**, so the signature is kept. It gains:
   - one phase bar per act
   - a lunar ring and a `Differs` tag (label + icon) on the after-value
   - a lunar ring on the edited leaf station
   - a commit-yellow Accept
   - a Replay control
   - a three-still strip under reduced motion
2. **Second accent: lunar** #C4B4FF, the railway calling-on aspect ("examine the line").
   - Its exclusive role is **inspect**. Yellow stays the **commit** signal.
   - Pairs: panel 5.18, iron 7.91, band 6.02, well 8.71, `--on-lunar` 9.81, `--lunar-deep` on enamel 5.74. In light: #5B3FD0 at 6.61 / 5.60.
   - On the raised plate it measures 4.10, so it is **UI / large only** there.
3. **Depth by material.** Four elevation levels (L−1 bed/well, L0 field, L+1 plate/frame, L+2 enamel plaque) and six planes covering ≥ 2 % of the area, against A's 2 and 4.
   - Soft offset and inset shadows; no glow or blur.
   - `--hair` #9AB8B0 is ≥ 3:1 on every plane it bounds.
4. **Below the hero:**
   - a full-bleed capture band of **real captures** with provenance and limitation chips
   - dense spec rows on a raised plate
   - an editorial pull on an enamel plaque (`ENGINE_NOTES[1]`, verbatim)
5. **Sequence:** propose 0–0.9s, inspect 1.15–1.9s, commit (armed) 2.25–2.8s. Running animations go 15 → 8 → 2 → 0. It does not loop.
   - Change Review gets a one-shot echo of about 1.4s.
   - Under reduced motion there are 0 animations on both the hero and Change Review.
6. **Measured** (Chromium, `lib.mjs`, one verify round + one confirm round):
   - every page: 0 text-contrast failures and 0 boundary checks below 3:1
   - control-state minimum 5.83
   - axe: 0 violations on 5 pages at 1440
   - no horizontal overflow at 1440 or 390
   - luminance variance below the hero 4.6× A at 1440 and 2.9× at 390
   - all 4 captures decode, and each has limitation chips
   - cost: `a.css` +3,693 B gzip, because the layer was appended

---

## A-rich decision: locked under delegation (NOT a human visual sign-off)

| Field | Value |
|---|---|
| Decided by | **the conductor**, under explicit operator delegation ("do your own best recommendation") |
| Pick | **A-rich ("signal box", enriched) LOCKED** as the v6 direction. It replaces A's look; A's G2 structural lock stands underneath. |
| Human visual sign-off | **None.** Nobody viewed the images: no person and no agent opened any A-rich PNG. This is a delegated decision on measured evidence, **not** a human visual sign-off. |
| Direction file | `docs/redesign-v6/DIRECTION.md` (amended) |

**Why.** The measured evidence answers every operator point:
- **Empty gallery:** all 4 real captures decode, each with limitation chips. The cause (lazy images in unscrolled shots) is fixed in both the markup and the harness.
- **Flat field:** below the hero there are now 4 elevation levels and 6 planes (A had 2 and 4), with 4.6× the luminance variance.
- **One supporting accent:** lunar, with the exclusive INSPECT role. Yellow stays COMMIT.
- **Motion that tells the story:** propose 0–0.9s, inspect 1.15–1.9s, commit 2.25–2.8s, with a three-still reduced-motion form.
- **A's G2 advantages over B are kept:** structural identity, and Change Review visible at 390.

**Carries (binding on every lane; see `DIRECTION.md` §13 items 11–16)**
1. The hero autoplay ends **ARMED, not committed**, because that is product truth. The commit act plays only on Accept.
2. The home shows only the **3 captures with `placement: "home"`** in `sites/umbrella/src/lib/site-content.ts`. `desktop-run-window` belongs on `/engine`.
3. Lunar on the raised plate (4.10:1) is for **UI and large use only**.
4. When porting, **merge** the A-rich layer into the base rules. Never append override piles.
5. The **minimum font is ≥ 13px**. The 4-refusals screen was at 12.19px.
6. **Itemise every sub-24px target** against WCAG 2.5.8 (A-rich counts below 24px: umbrella 2, refusals 1, store 1).

The G2 must-fix conditions still apply:
- The umbrella nav does not clip at 1280px width and 200% zoom, and Account and Download stay reachable.
- The dark refusal note is ≥ 5.5:1.
- On the 390 inspector:
  - the repeated help sentence is dropped;
  - the sha256 digest is shortened behind a copy button, with the full value in the accessible label.
- At 390×844:
  - the status plate and the first WHERE/BEFORE/AFTER row are visible without scrolling;
  - Accept is within 5 tab stops.
- WCAG 1.4.11: 3:1 on boundaries.
- The `[hidden]` fix stays scoped.
- Mobile Lighthouse runs on a quiet machine (load average < 4 checked first), with LCP ≤ 2.5 s and TBT ≤ the 2,015 ms baseline.
- Font licences are checked.

**Effect on the G2 visual veto.** The open veto (§G2) is closed **for the pipeline** by this delegated decision. It is not closed by a person. If a human later views the A-rich shots (`concepts/a-rich/shots/`) and finds the result generic or broken, the operator may reopen it. B (`../sceneaxi-slice-2`) stays available until the pilot has ported.

**Rejected at this step:** A as it stood (the operator found it flat, with empty gallery boxes and a single accent), and reopening G2 for B. B's G2 deficits are unchanged: Change Review below the fold at 390, and 2,647 ms TBT.

---

## G4–G5

Not yet held.

- 2026-10-07: owner authorized the Kids palette pin edit ("I allow you to break the rule with the kids pallet"). `tests/sites/kids-surface.test.ts` now pins the exact 18-token light Kids set (sky #D6ECF4, ink #13302A, Play #1E4FBF, table #EAF5F9, tray #BFDDE8, ...), asserts #A78BFA is absent, and asserts the real Kids ink is >=4.5:1 on every .world-* stop, plus 3:1 for the focus/edge colours. Every other assertion is unchanged (A8b, lanes/kids.md).
- 2026-10-07 12:45: A8b retry. The Kids "Picked" tag is no longer aria-hidden. It is a visible text sibling of the world button, so the button's name equals its visible label (WCAG 2.5.3) and aria-pressed carries the state. axe 0 at 1440/768/390, including label-content-name-mismatch. The Kids pin is unchanged (lanes/kids.md).
