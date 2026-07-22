# Stage 1 — paired-replicate run-sheet + pinned-config manifest

> ## ⚠️ Double gate — read first
>
> Stage 1 of the engine-core proof program
> ([factories-helpers#41](https://github.com/Vhailors/factories-helpers/issues/41))
> may be **executed** only when **both** gates are satisfied:
>
> 1. the **tier-3 captain decisions** are recorded, **and**
> 2. a **separate, explicit run authorization** is granted.
>
> **This document is not a run authorization.** It is a preparation run-sheet
> and pinned-configuration design: presence, review status, or merge grants no
> authority of any kind. Arm C (hosted/editor surface), if ever run,
> additionally requires separate captain account authorization and enters no
> ratio in any decision rule.
>
> Index and house banner: [`docs/proof/README.md`](README.md).

**Status:** disposable proof-harness *design* (documents only). **Nothing in
this file authorizes a run, spawns a worker, creates an account, installs an
engine, or spends.**  
**Tracked by:** [sceneaxi#15](https://github.com/Vhailors/sceneaxi/issues/15)
(`transferred-from: factories-helpers#52`).  
**Proof program source of truth:** factories-helpers
[#41](https://github.com/Vhailors/factories-helpers/issues/41)
(pointer: [`docs/program/spec-41.md`](../program/spec-41.md)).  
**Depends on:**

| Doc | Role |
|---|---|
| [`stage-0-acceptance-contract-template.md`](stage-0-acceptance-contract-template.md) (sceneaxi#13) | Engine-neutral contract skeleton; qualification gates; Stage 0 hash freeze |
| [`stage-1-counting-adjudication-worksheet.md`](stage-1-counting-adjudication-worksheet.md) (sceneaxi#14) | Counting arithmetic and decision-rule flowchart (recommendation until hold) |

---

## 0. Explicit non-authorization (read before any procedure below)

This run-sheet turns the variance-controlled paired-replicate design into a
**mechanically executable checklist** for a *future* authorized Stage 1 run.
It is design-side preparation only.

| Role | Owner |
|---|---|
| Author / review / merge this harness design | docs ticket sceneaxi#15 |
| Fill held brief / budget / kill-rubric values | captain holds only (see §11) |
| Stage 0 lock (filled contract + pinned-config hash) | separate Stage 0 authorization + recorded tier-3 decisions |
| Stage 1 run execution | **double gate** (tier-3 decisions **and** explicit run authorization) |
| Arm C execution | double gate **plus** separate captain account authorization |

**This document decides nothing and authorizes nothing.** Do not treat merge
of this file as hold approval, Stage 0 lock, Stage 1 authorization, worker
allocation, install permission, or spend.

Symmetric by construction: nothing below advantages Arm A or Arm B, and
nothing presumes the Three Kernel hypothesis wins.

---

## 1. Purpose and design object

When Stage 1 is separately authorized, operators execute this run-sheet to
produce four primary-arm replicates (A1, B1, A2, B2) plus one upgrade drill
per primary arm, under one engine-neutral acceptance contract, with
configuration variance controlled so that a single worker draw cannot
masquerade as a backend effect.

| Arm | Role | In ratios? |
|---|---|---|
| **A** | Direct Three Kernel composition (falsifiable hypothesis) | Yes — pairwise with B |
| **B** | Standalone PlayCanvas engine (source-first; no hosted editor) | Yes — pairwise with A |
| **C** | PlayCanvas hosted/editor surface | **No** — descriptive only (Appendix A) |

Normative Stage 1 contract (budgets, counts, kills, conclusion scope) lives
on factories-helpers#41; this document operationalizes it. Adjudication after
evidence is collected is owned by the Stage 1 worksheet (sceneaxi#14), not
re-derived here.

---

## 2. Pinned worker-configuration manifest

All **four** primary authoring workers (A1, A2, B1, B2) run on one
**byte-identical** pinned configuration. The pin is frozen at Stage 0 lock
and hashed; drift voids the run instead of biasing it.

### 2.1 Manifest field list

Every field below is part of the pinned identity. At lock time, each field is
filled with a concrete, recordable value (version, hash, path, or explicit
"disabled"). **HELD** rows stay empty until the matching captain decision /
Stage 0 pin event — do not invent values into this design doc.

| # | Field | What must be identical | Notes |
|---|---|---|---|
| P1 | **Model / routing** | Model id(s), provider route, temperature/sampling (if any), max-token and tool-loop caps | One route for all four workers |
| P2 | **Tool surface** | Exact allowlisted tools and denied tools; no extra shells or network tools mid-run | Deny-by-default baseline |
| P3 | **Skill / instruction set** | Ordered skill pack ids + versions (or content hashes); system / developer prompt files | Same pack for A and B |
| P4 | **Permissions** | Workspace confinement, secret access, network policy, install rights | No arm-specific elevation |
| P5 | **Prompt scaffold** | Brief delivery template, Work-Class trailer reminder, isolation rules text, stop conditions | Engine-neutral wording only |
| P6 | **Runtime / CLI pins** | Agent CLI version, node/pnpm (or equivalent) version pins used by the harness | Record exact versions |
| P7 | **Harness / evidence tooling** | Logger, digester, capture scripts, device-run recipe ids and versions | Shared measurement stack |
| P8 | **Path-rule table template** | Empty per-arm path-rule skeleton (filled per arm before that arm starts; structure identical) | Class mapping rules in worksheet §2 |
| P9 | **Asset Package pin** | Same legal Asset Package definition id/hash for both primary arms | Stage 0 §4.8 |
| P10 | **Contract pin** | Locked acceptance-contract content hash (algorithm + digest) | Stage 0 lock procedure |
| P11 | **Named-device pin** | Device identity string for the WebGL2 gate | **HELD** (`first-proof-brief` / `first-proof-budget`) |
| P12 | **Quota pin** | Numeric asset-ingestion quotas adopted at Stage 0 | **HELD** (`first-proof-budget`) |

Fields P1–P10 must be filled from recorded decisions and pin artifacts at
Stage 0; P11–P12 remain captain-owned until those holds resolve. Working
names in the program are not answers.

### 2.2 Manifest record shape (at Stage 0 lock)

```text
pinned_worker_config:
  manifest_version: <semver or date-id>
  fields:
    P1..P12: <filled value>
  content_bytes_uri: <path or blob id of canonical serialization>
  content_hash:
    algorithm: <e.g. sha256>
    digest: <hex>
  locked_at: <ISO-8601 timestamp>
  locked_under: <Stage 0 authorization reference>
  decision_key_refs:
    first-proof-brief: <recorded backlog ref + version>
    first-proof-budget: <recorded backlog ref + version>
    first-proof-kill-rubric: <recorded backlog ref + version>
```

Canonical serialization must be **stable** (sorted keys, LF newlines, no
volatile timestamps inside the hashed bytes). Algorithm and digest are
recorded beside the Stage 0 contract hash (Stage 0 template §7). An open
decision key describes a draft, not a completed lock record.

### 2.3 Hash-recording protocol

Performed only under **separate Stage 0 authorization** after tier-3
decisions are recorded:

1. Serialize the filled manifest to the canonical byte form.
2. Compute the collision-resistant digest; record algorithm + digest.
3. Record the same digest in the Stage 0 lock record next to the filled
   acceptance-contract hash.
4. Before **each** authoring-worker or drill start (A1, B1, A2, B2, Drill A,
   Drill B), re-hash the live configuration surface the worker will actually
   use and compare to the pinned digest.
5. **Any mismatch → void the run** (or refuse to start that worker). Do not
   "re-pin mid-flight," patch a worker, or continue with a drifted config.

### 2.4 Configuration drift voids the run

| Event | Outcome |
|---|---|
| Live worker config hash ≠ pinned digest | **Void** (or hard stop before that replicate starts) |
| Mid-run tool/skill/permission change | **Void** |
| Arm-specific model upgrade not in pin | **Void** |
| Silent warm-cache rescue that changes effective tooling | Treat as drift / reproducibility defect → disqualify or void per §5.5 |

Drift is never reinterpreted as "minor" or "favoring neither arm." Void is
final for that authorization; a clean re-run requires a new authorization
and a new Stage 0 freeze if the pin changes.

---

## 3. Worker allocation and blinding

### 3.1 Allocation

| Slot | Arm | Replicate | Worker |
|---|---|---|---|
| W-A1 | A | 1 (block 1) | Fresh authoring worker |
| W-B1 | B | 1 (block 1) | Fresh authoring worker |
| W-A2 | A | 2 (block 2) | Fresh authoring worker |
| W-B2 | B | 2 (block 2) | Fresh authoring worker |

- **Four workers total** for primary-arm authoring. No worker authors more
  than one replicate.
- Upgrade drill (§8) is a **separate timed window** per arm after the arm's
  qualifying replicate builds exist; it may use a fresh worker or a
  post-authoring window under the same pin — either way, drill hours are
  logged separately and **excluded** from glue pooling (worksheet §3.5 / §5).
- Shared engine-neutral scaffolding (if any) is performed **once**, under the
  pin, **before** arm-specific work, and its harness-logged hours are
  **charged equally to both arms** (split 50/50 into each arm's product or
  glue class per the precommitted path-rule table — never free, never
  arm-asymmetric).

### 3.2 Blinding rules

1. **Hypothesis blind:** workers are not told the comparative hypothesis
   ("Three Kernel should win" or any equivalent). Brief and contract text are
   engine-neutral.
2. **Cross-arm isolation:** no code, notes, chat, prompts, evidence drafts,
   or learnings pass from Arm A workers to Arm B workers (or reverse).
3. **Cross-replicate isolation:** no learnings pass from A1→A2, B1→B2, or
   any other pair. Replicate 2 workers start cold relative to replicate 1
   outcomes.
4. **Adjudicator separation:** the human who rates craft/fun/originality/
   comfort is blind to arm labels and to cross-arm throughput until ratings
   are sealed (worksheet §3 / Stage 0 human dimensions).
5. **Operator channel:** only the run operator (not an authoring worker) holds
   the block-order record, pin hashes, and arm assignment map. Authoring
   workers receive only their own arm brief, contract, Asset Package, and
   path-rule table for that arm.

### 3.3 What workers receive

| Input | Identical across arms? |
|---|---|
| Locked acceptance contract (content hash) | Yes (same contract) |
| Pinned worker config (manifest hash) | Yes |
| Legal Asset Package pin | Yes |
| Prompt scaffold / isolation rules | Yes (engine-neutral) |
| Arm identity (A vs B backend allowed APIs) | No — arm-specific backend only |
| Per-arm path-rule table | Structure yes; path prefixes arm-specific |
| Peer arm's repo, logs, or scores | **Never** |

---

## 4. Block randomization

Two paired blocks control ordering effects:

| Block | Replicates | Constraint |
|---|---|---|
| Block 1 | A1 + B1 | Both start only after Stage 0 lock + pin hash recorded |
| Block 2 | A2 + B2 | Starts only after block-1 authoring windows close (or after overscope stop fires) |

### 4.1 Within-block start order

1. Before any authoring in a block, the operator draws a fair coin (or
   equivalent CSPRNG bit) for start order: **A-first** or **B-first**.
2. Record the draw **before** either worker in that block starts:

   ```text
   block: 1 | 2
   order_draw: A-first | B-first
   drawn_at: <ISO-8601>
   draw_method: <coin | CSPRNG id>
   recorded_by: <operator id>
   ```

3. Start the first arm's worker; start the second only after the first has
   been launched under the pin (they may run concurrent after both launched
   if the harness supports concurrent isolation; start *order* is what was
   randomized and recorded).
4. **Do not re-draw** after seeing progress. A lost draw record voids the
   block's ordering claim and requires operator audit (likely void).

### 4.2 Overscope stop (block 1)

Program rule (Stage 0 §3.2): if **both** block-1 replicates accept **under
50%** of the locked weight-1 criteria, record **"contract defect — rerun
required"** — a no-fault outcome, not an arm failure, and not a mid-flight
brief patch. Block 2 does not proceed under the defective contract.

---

## 5. Mechanical hour-logging design

### 5.1 Source of truth

| Rule | Value |
|---|---|
| Eligible time | **Harness-logged agent-hours only** |
| Self-reported time | **Never** eligible for caps, throughput, glue share, or drill counters |
| Missing harness log for a throughput or glue-share window | Adjudication audit cannot pass; stop before cross-arm ratios (worksheet §3.1 / §7) |

The harness starts/stops the clock on defined events (§5.3). Workers cannot
edit their own hour totals.

### 5.2 Caps (hard; not spend authority)

Primary arms A and B, **each**:

| Window | Cap | Counts toward |
|---|---|---|
| Replicate 1 authoring | ≤ **7** harness-logged agent-hours | Per-arm 16 h; throughput / glue pool |
| Replicate 2 authoring | ≤ **7** harness-logged agent-hours | Per-arm 16 h; throughput / glue pool |
| Backend upgrade drill | ≤ **2** harness-logged agent-hours | Per-arm 16 h; **migration counters only** (not glue pool) |
| **Per-arm total** | ≤ **16** harness-logged agent-hours | Hard stop |

Program-level framing (factories-helpers#41): ≤4 agent-days total for A+B
split equally under the per-arm 16 h caps; **2** human review hours for the
primary comparison; local compute; local/free assets; **$0**; no accounts /
multiplayer / wrapper / store for A+B.

Shared engine-neutral scaffolding hours (if any) are split 50/50 into each
arm's logged totals and **do** consume each arm's 16 h budget.

### 5.3 Clock-start and clock-stop

| Event | Clock |
|---|---|
| Worker session begins under pin (after pre-start hash check) | **Start** (or resume) |
| Active agent tool loop / authoring turn | **Running** |
| Operator-declared break / blocked-on-operator (harness pause) | **Stop** (paused; not counted) |
| Waiting on human rating (not authoring) | **Stop** for authoring clock |
| Build / test / digest / device-run automation invoked by harness as measurement | **Harness class** if precommitted path rules say so; still logged |
| Replicate hits 7.0 logged authoring hours | **Hard stop** that replicate's authoring window |
| Arm hits 16.0 logged hours across all windows | **Hard stop** remaining arm work |
| Worker finishes or is terminated | **Stop**; flush log |

Paused time is not retroactively filled with self-report. Clock rules are
symmetric for both arms.

### 5.4 What counts toward which bucket

| Activity | Cap bucket | Work-Class (typical) | Throughput denom? | Glue pool? | Migration? |
|---|---|---|---|---|---|
| Replicate product gameplay work | ≤7 h rep | product | Yes | No (product side) | No |
| Replicate arm-specific integration | ≤7 h rep | glue | Yes | Yes | No |
| Replicate measurement-only work | ≤7 h rep | harness | No | No | No |
| Upgrade drill | ≤2 h drill | product/glue/harness as paths say | No | **No** | Yes (M2/M3) |
| Shared neutral scaffold (50/50) | each arm's 16 h | per path rules | Yes if product/glue | if glue | No |

Work-Class trailers, path-rule override, and mixed-commit splits are owned by
the Stage 1 worksheet (§2); this run-sheet only requires that path-rule
tables exist before each arm starts and that the harness can attribute
windows to product / glue / harness / drill.

### 5.5 Replicate voiding and disqualification

| Condition | Effect |
|---|---|
| Config hash drift (§2.4) | **Void run** (or refuse start) |
| Cross-arm or cross-replicate leakage (§3.2) | **Void** affected replicates / run |
| Self-reported hours used in any ratio field | **Classification defect** — stop; void if already adjudicated on bad data |
| Replicate exceeds 7.0 h without hard stop | Log defect; treat excess as non-eligible; audit |
| Arm exceeds 16.0 h | Hard stop; excess work ineligible |
| Fails fresh-checkout reproducibility | Replicate **does not qualify** (Stage 0 §5) |
| Fails 100-seed digest on any of 30/60/120 | Replicate **does not qualify** |
| Fails named-device WebGL2 gate | Replicate **does not qualify** |
| Missing harness log for throughput window | Adjudication audit fails; stop before cross-arm ratios |
| Block-order draw not recorded before start | Ordering defect → operator audit / likely void |
| Mid-flight brief, rubric, or criteria edit | **Void** (rules defect) |

Qualification ≠ void: a non-qualifying replicate can still exist as pilot
evidence; fewer than two qualifying replicates in an arm **downgrades**
throughput to non-decisive pilot evidence (Stage 0 §5 / worksheet §8).

---

## 6. Evidence capture points (per replicate)

Each primary replicate (A1, B1, A2, B2) produces an evidence packet. Capture
points below map to packet requirements. Measurement recipes must be
**identical across arms** (same harness pins). Missing measurements take only
the qualification, audit, or adjudication disposition owned by the Stage 0
contract and Stage 1 worksheet; they never round up
([factories-helpers#44](https://github.com/Vhailors/factories-helpers/issues/44)
by reference).

### 6.1 Capture checklist

| # | Capture | When | Packet field |
|---|---|---|---|
| E1 | **Contract hash** | Before authoring starts; re-verify at packet seal | `contract.hash` + algorithm |
| E2 | **Pinned-config hash** | Pre-start and at seal | `worker_config.hash` + algorithm |
| E3 | **Block order record** | Before block start | `block.order_draw` |
| E4 | **Work-Class log + path-rule table** | Continuous / at seal | `hours.*`, `path_rules` |
| E5 | **Harness hour log** | Continuous | `hours.product`, `hours.glue`, `hours.harness` |
| E6 | **Fresh-checkout reproduction** | End of authoring | `gates.fresh_checkout` pass/fail + steps |
| E7 | **100-seed determinism digest** | On candidate build | `gates.digest` for 30 / 60 / 120 |
| E8 | **Named-device WebGL2 run** | On candidate build | `gates.device` id + result |
| E9 | **Verified captures** | On candidate build | screenshots / video / traces as required by brief |
| E10 | **Criteria pass/fail matrix** | Against locked contract | `criteria[]` weight-1 rows |
| E11 | **Dependency / security counters** | Final qualifying build (or Stage-0 comparison package) | D1–D6 (worksheet §4) |
| E12 | **Human-verdict binding** | After blind rating sealed | medians craft/fun/originality/comfort |
| E13 | **Limitations** | At seal | explicit non-claims (device, scope, tooling gaps) |
| E14 | **Asset Package pin + ingestion rejects** | Throughout | package hash; quota rejects per #48 |

### 6.2 Packet seal

A replicate packet is **sealed** when E1–E14 are either filled or explicitly
marked incomplete/not-run with reason. Seal does not authorize publication
beyond the proof program's evidence policy. Arm labels for human raters stay
masked until ratings are sealed.

### 6.3 Cross-replicate / cross-arm aggregation

| Artifact | When collected |
|---|---|
| Glue pool per arm (drill excluded) | After both replicates' hour logs sealed |
| Migration counters M1–M3 | After upgrade drill (§8) |
| Mean throughput, dispersion | Adjudication (worksheet) |
| Terminal disposition | Stage 1 worksheet §8, only after its §7 audit |

This run-sheet does **not** adjudicate terminal dispositions. Operators hand
sealed packets to adjudicators using the Stage 1 worksheet.

---

## 7. Run sequence (mechanical)

Execute only under explicit Stage 1 run authorization **and** recorded tier-3
decisions. Stage 0 lock + pin hashes must already exist.

```text
[0] Preconditions
    - Tier-3 holds recorded (or run refuses)
    - Stage 0 filled contract hashed
    - Pinned worker-config manifest hashed
    - Explicit Stage 1 run authorization on record
    - $0 / no accounts for A+B confirmed

[1] Publish per-arm path-rule tables (structure from pin; paths arm-specific)

[2] Block 1
    - Draw and record start order
    - Pre-start config hash check for first worker → start
    - Pre-start config hash check for second worker → start
    - Author to ≤7 h each; capture E1–E14
    - Overscope stop check (both <50% accept?) → maybe stop program path

[3] Block 2 (if no overscope stop / no void)
    - Draw and record start order (independent of block 1)
    - Same pin checks and ≤7 h caps
    - Capture E1–E14

[4] Qualification freeze
    - Mark each replicate qualifying Y/N (Stage 0 §5)
    - Do not post-hoc drop replicates to steer ratios

[5] Upgrade drills (§8) — one ≤2 h window per primary arm

[6] Blind human ratings (if not already sealed per replicate)

[7] Hand packets to independent adjudicator (worksheet §7 audit → §8 flowchart)

[8] Record terminal disposition; no mid-flight reweight
```

---

## 8. Upgrade-drill protocol

### 8.1 Purpose

Each primary arm runs one **backend upgrade / migration drill** that feeds
migration counters only:

| Counter | Source |
|---|---|
| M1 Backend-import share | Measured on the replicate tree (recipe identical both arms) |
| M2 Drill files touched | Files changed **in the drill window** |
| M3 Drill logged hours | Harness-logged agent-hours **in the drill window only** |

### 8.2 Rules

1. **Cap:** ≤ **2.0** harness-logged agent-hours per arm.
2. **Pin:** same pinned worker configuration; pre-start hash check applies.
3. **Timing:** after the arm has at least one candidate build to migrate;
   preferably after both replicates are sealed, unless the authorization
   record states otherwise — but **never** interleaved inside a replicate's
   7 h authoring window without separate clock attribution.
4. **Exclusion:** drill product/glue/harness hours are **excluded** from the
   glue pool and from replicate throughput denominators (worksheet §3.5).
5. **Task shape (engine-neutral):** exercise a backend or dependency upgrade
   path that the arm would face in maintenance (version bump, adapter
   rebind, or equivalent). Exact upgrade target is **HELD** at run
   authorization / Stage 0 pin — do not invent a version in this design doc.
6. **Symmetry:** both arms receive an equivalently scoped drill brief; neither
   arm's drill may assume APIs the other is forbidden to use under the
   contract.
7. **Stop:** at 2.0 h or task complete, whichever first; flush M2/M3.

### 8.3 Drill non-goals

- Not a fifth replicate
- Not a chance to raise acceptance criteria
- Not a hosted-service introduction (source-first hard kill still applies)
- Not Arm C

---

## 9. Human review window

Program budget: **2** human review hours for the primary A/B comparison
(ratings + adjudication support), separate from agent-hour caps. Review time
is not convertible into agent authoring hours. Blind rating procedure and
eligibility floor are owned by Stage 0 / hold `first-proof-kill-rubric` and
the Stage 1 worksheet — this run-sheet only schedules the window after
packets are ready and before cross-arm ratios are computed.

---

## 10. Authorization boundaries (restated)

| Action | Authorized by this run-sheet? |
|---|---|
| Author / review / merge the harness design | Yes (docs-only) |
| Stage 0 lock or pin hash recording | **No** — separate Stage 0 authorization |
| Stage 1 execution | **No** — double-gated |
| Spawn workers / install engines / create repos | **No** |
| Create accounts / multiplayer / wrapper / store | **No** |
| Spend (cash budget remains $0 until separately authorized) | **No** |
| Arm C run | **No** — Appendix A; account authorization required |
| Approve captain holds | **No** |
| Declare a material winner | **No** — worksheet after authorized run |

---

## 11. Held fields (must remain open here)

| Key | Role in this design |
|---|---|
| `first-proof-brief` | Criteria content, genre/loop, brief-tied envelopes, device identity as brief-tied |
| `first-proof-budget` | Budget-derived sizing, quota pin values, device/envelope lock scalars |
| `first-proof-kill-rubric` | Numeric rubric / human eligibility (worksheet may recommend; hold decides) |

This ticket **must not** answer them. Any future run authorization that
finds a missing captain-owned field **stops and surfaces a hold** rather than
inventing a value into the pin.

---

## 12. What this document deliberately omits

| Artifact | Owner |
|---|---|
| Stage 0 engine-neutral acceptance-contract template | sceneaxi#13 (in tree) |
| Stage 1 counting and adjudication worksheet | sceneaxi#14 (in tree) |
| Readiness ladder and evidence policy | factories-helpers#44 |
| Untrusted-asset ingestion / supply-chain security requirements | factories-helpers#48 |
| Proof program Stages 0–8 normative body | factories-helpers#41 |
| Product scope | sceneaxi#1 / `docs/program/SPEC.md` |
| Engine runtime proof execution | **Out of scope** — double-gated elsewhere |

---

## Appendix A — Arm C (descriptive-only)

### A.1 Status

Arm C is a **single descriptive build** of the PlayCanvas hosted/editor
surface. It is **non-gating**: it enters **no** pairwise ratio, **no**
three-arm adjudication, **no** glue-share kill comparing to A/B, and **no**
dependency/migration "no-worse" tally.

### A.2 Extra gate

In addition to the Stage 1 double gate, Arm C requires **separate captain
account authorization**.

### A.3 Admissibility and budgets (if authorized)

| Rule | Value |
|---|---|
| Account | Free plan only |
| Cash | **$0** |
| Agent hours | ≤ **16** harness-logged hours |
| Human review | **1** review hour |
| Replicates | Single descriptive build (not paired-replicate) |
| Decision-rule coupling | **Zero** — no ratio fields |

### A.4 If Arm C does not run

**No claim — positive or negative — may be made about the hosted/editor
surface.** Stage 1 and the Stage 8 extraction gate decide
**standalone-engine claims only**. Any extraction proposal without Arm C must
carry an explicit **"hosted/editor authoring surface untested"** limitation
(factories-helpers#41 conclusion scope).

### A.5 Isolation from A/B

- Separate workspace and credentials from A/B workers
- No shared notes that would un-blind or re-scope A/B
- Evidence filed under an Arm C descriptive packet only
- Adjudicators quarantine Arm C data from every ratio field (worksheet §7.9 /
  §8.2)

### A.6 Non-authorization

This appendix does not create accounts, start Arm C, or interpret silence as
evidence for or against hosted authoring.

---

## Appendix B — Fill-in tables (blank — authorized runs only)

### B.1 Pin freeze

The authoritative Stage 0 lock-record form is in the Stage 0 template §7.
Reference that completed record here instead of copying its fields.

| Field | Value |
|---|---|
| Stage 0 lock-record URI / path | |
| Stage 0 lock-record status | complete / refused |
| Asset Package pin verified against manifest P9? | |
| Stage 1 run authorization ref | |

### B.2 Block draws

| Block | Order draw | Drawn at | Method | Recorded by |
|---|---|---|---|---|
| 1 | A-first / B-first | | | |
| 2 | A-first / B-first | | | |

### B.3 Worker pre-start hash checks

Record digests, not only a pass/fail assertion. The pinned and live values are
the evidence for the comparison required by §2.3.

| Slot | Pinned digest | Live digest | Match? | Checked by | Started at | Stopped at | Logged h |
|---|---|---|---|---|---|---|---:|
| W-A1 | | | | | | | |
| W-B1 | | | | | | | |
| W-A2 | | | | | | | |
| W-B2 | | | | | | | |
| Drill A | | | | | | | |
| Drill B | | | | | | | |

### B.4 Evidence-packet seal

Use `complete`, `incomplete`, or `not-run` for every capture point. Any value
other than `complete` requires a reason in the packet; sealing records the gap
and never upgrades it into evidence.

| Capture point (§6.1) | A1 | B1 | A2 | B2 |
|---|---|---|---|---|
| E1 Contract hash | | | | |
| E2 Pinned-config hash | | | | |
| E3 Block order record | | | | |
| E4 Work-Class log + path rules | | | | |
| E5 Harness hour log | | | | |
| E6 Fresh-checkout reproduction | | | | |
| E7 100-seed digest (30/60/120) | | | | |
| E8 Named-device WebGL2 run | | | | |
| E9 Verified captures | | | | |
| E10 Criteria matrix | | | | |
| E11 Dependency/security counters | | | | |
| E12 Human-verdict binding | | | | |
| E13 Limitations | | | | |
| E14 Asset Package pin + ingestion rejects | | | | |

### B.5 Replicate qualification (operator view)

| Arm | Rep | Fresh checkout | Digest 30/60/120 | Device gate | Qualifying? |
|---|---|---|---|---|---|
| A | 1 | | | | |
| B | 1 | | | | |
| A | 2 | | | | |
| B | 2 | | | | |

### B.6 Overscope stop

| Block-1 A accepted % | Block-1 B accepted % | Both &lt; 50%? | Outcome |
|---|---|---|---|
| | | | continue / contract defect — rerun required |

Adjudication fill-ins remain on the Stage 1 worksheet (§10).
