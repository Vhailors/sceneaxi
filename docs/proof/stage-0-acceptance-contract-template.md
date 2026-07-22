# Stage 0 — engine-neutral acceptance-contract template

> ## ⚠️ Double gate — read first
>
> Stage 1 of the engine-core proof program
> ([factories-helpers#41](https://github.com/Vhailors/factories-helpers/issues/41))
> may be **executed** only when **both** gates are satisfied:
>
> 1. the **tier-3 captain decisions** are recorded, **and**
> 2. a **separate, explicit run authorization** is granted.
>
> **This document is not a run authorization.** It is a preparation template:
> presence, review status, or merge grants no authority of any kind. Arm C
> (hosted/editor surface), if ever run, additionally requires separate account
> authorization and enters no ratio in any decision rule.
>
> Index and house banner: [`docs/proof/README.md`](README.md).

**Status:** unlocked template. **Nothing in this file is locked.**  
**Tracked by:** [sceneaxi#13](https://github.com/Vhailors/sceneaxi/issues/13)
(`transferred-from: factories-helpers#50`).  
**Proof program source of truth:** factories-helpers
[#41](https://github.com/Vhailors/factories-helpers/issues/41)
(pointer: [`docs/program/spec-41.md`](../program/spec-41.md)).

---

## 1. Purpose

This is the **document skeleton** both primary proof arms will be authored
against under one engine-neutral acceptance contract:

| Arm | Role | Adjudication |
|---|---|---|
| **A** | Direct Three Kernel composition (falsifiable hypothesis) | Primary — pairwise with B |
| **B** | Standalone PlayCanvas engine (counterfactual) | Primary — pairwise with A |
| **C** | PlayCanvas hosted/editor surface | Descriptive-only, non-gating; own gates; no ratio anywhere |

When the tier-3 captain decisions are recorded, a **separately authorized
Stage 0 lock** fills every held field below, records a content hash, and freezes
the contract. **Zero new design is allowed at lock time.** Drift after the
recorded hash **voids the run**.

### This template never locks itself

Locking happens **only** at a separately authorized Stage 0 event with
**recorded** tier-3 captain decisions. Merging, reviewing, or updating this
template file does **not** lock the contract, start Stage 1, allocate workers,
create accounts, install engines, or authorize spend.

---

## 2. Held-value convention

Every captain-owned value is written as an explicitly flagged held field:

```text
**HELD** (`decision-key`): <what must be filled; no invented answer>
```

Rules for this template (and any fill-in derived from it):

1. Every held value carries its decision key.
2. **Zero invented answers** — no placeholder numbers, genre choices, rubric
   scores, device names, or budget-derived sizes may be treated as decided.
3. Working names from the program ("Browser Game Factory", "Three Kernel") are
   recommended answers of open holds used for readability only, not decisions.
4. Cross-repo methodology/policy stays on factories-helpers and is **cited by
   reference**, not duplicated as a gating edge here:
   - readiness ladder / evidence policy → factories-helpers#44
   - untrusted-asset ingestion / supply-chain requirements → factories-helpers#48

---

## 3. Acceptance-criteria structure

### 3.1 Criteria slots

The contract carries **12–20 weight-1 acceptance criteria**. Criterion
*count*, *wording*, and *pass/fail evidence* are not authored here.

| Slot | Field | Status |
|---|---|---|
| C01–C20 | Criteria list (12–20 weight-1 items; unused slots remain empty) | **HELD** (`first-proof-brief`) |
| Genre / loop shape | Disposable single-room stylized 3D micro-loop shape and brief sizing for the ≤7 h replicate cap | **HELD** (`first-proof-brief`) |
| Human eligibility dimensions | Craft / fun / originality / comfort binding used at adjudication | **HELD** (`first-proof-kill-rubric`) — values incorporated by reference only |

**HELD** (`first-proof-brief`): fill the ordered criteria list (exactly 12–20
weight-1 items) and the genre/loop shape. Do not invent criteria content in
this template.

**HELD** (`first-proof-kill-rubric`): incorporate the precommitted numeric
rubric and human-verdict floor by reference (worksheet recommendation lives
under sceneaxi#14 when authored; approval stays on the captain hold). Do not
invent rubric numbers here.

**HELD** (`first-proof-budget`): any budget-derived sizing that affects
criterion scope, asset package bounds, or device/performance envelopes
committed at Stage 0 lock. Do not invent sizes here.

### 3.2 Overscope-stop clause (slot)

Precommitted no-fault stop when the brief is wrongly sized:

| Condition | Recorded outcome |
|---|---|
| Both **block-1** replicates (one per primary arm in the first paired block) accept **under 50%** of the locked criteria | **"contract defect — rerun required"** — recorded no-fault outcome; not a mid-flight brief patch; not an arm failure |

This clause is structural and engine-neutral. It does not favor either arm.
Threshold and wording above are program-encoded (factories-helpers#41); any
change requires a rules defect / void, not an in-flight edit.

---

## 4. Engine-neutral behavioral requirements

These requirements are **symmetric**: identical text binds Arm A and Arm B.
No requirement may be satisfied only by Three-specific or PlayCanvas-specific
APIs in the *contract* — backends hide behind their own seams; the contract
tests **player- and evidence-visible behavior**.

Each requirement is a slot the locked contract will treat as mandatory for
both primary arms. Criteria that instantiate them are still
**HELD** (`first-proof-brief`).

### 4.1 Accessible essential UI

Essential game UI lives in the **accessible DOM** (not canvas-only chrome for
essential controls). Both arms must support:

- keyboard **focus** order for essential controls
- input **rebinding**
- **touch** input
- **gamepad** input

### 4.2 Reduced-motion and reduced-flash

Both arms expose **reduced-motion** and **reduced-flash** modes inside the
acceptance contract so accessibility is never a post-proof retrofit.

### 4.3 Versioned settings and saves

Settings and saves persist with **schema versioning**. Schema/kernel/BOM
versions travel with saves and replays so migrations are explicit. (Later-stage
PWA atomic update/rollback is out of Stage 0/1 scope unless the locked brief
explicitly includes it.)

### 4.4 Deterministic replay with complete reset

Authoritative simulation supports **deterministic replay** and a **complete
reset** to a known initial state. Only the simulation advance path mutates
authoritative state; presentation never does.

### 4.5 100-seed determinism digest (three schedules)

Every qualifying replicate build produces a **100-seed determinism digest**
that survives all three render schedules:

| Schedule | Required |
|---|---|
| 30 Hz (or equivalent fixed step mapping) | yes |
| 60 Hz | yes |
| 120 Hz | yes |

Digest equality across seeds/schedules is mechanical eligibility evidence, not
a human craft claim.

### 4.6 Fresh-checkout reproducibility

Every replicate build must reproduce from a **fresh checkout** with no
undocumented warm-workspace rescue, hidden caches, or unrecorded manual steps.

### 4.7 Named real-device WebGL2 gate

Every replicate includes a **named real-device WebGL2** run. Desktop-only
evidence cannot claim mobile/device behavior.

**HELD** (`first-proof-budget` and/or `first-proof-brief`): the **named device**
identity and any performance envelope committed at lock. Do not invent a device
name here.

**Presentation-only-scaling recovery** is allowed: quality knobs may scale
presentation only; they must **not** alter simulation truth.

### 4.8 Same legal Asset Package in both lanes

Both primary arms consume the **same legal Asset Package** definition for the
run (authoring source + manifest + provenance + evidence as canonical truth;
glTF/GLB as derived interchange). Rights/provenance gates apply identically;
neither arm may substitute an undeclared asset set.

### 4.9 Verified captures and accurate claims

Captures used as evidence are **verified**. Frame-rate, download-size, and
memory claims in the evidence packet must be **accurate** (measured, not
aspirational). Missing or unverifiable measurements demote the related claim;
they never round up
([factories-helpers#44](https://github.com/Vhailors/factories-helpers/issues/44)
by reference).

### 4.10 Ingestion quota compliance

Untrusted-asset ingestion and supply-chain controls are **normative
requirements** on every proof arm, by reference to factories-helpers
[#48](https://github.com/Vhailors/factories-helpers/issues/48) — not restated
as a forked policy here. Stage 0 **precommits numeric quotas** at lock time
from that policy's recommended table (recommendation ≠ lock).

**HELD** (`first-proof-budget`): numeric quota values locked at Stage 0
(compressed/decompressed size, compression ratio, texture dimensions,
geometry/animation complexity, and any other #48-table fields the captain
adopts). Do not invent quota numbers in this template.

---

## 5. Replicate qualification gates

A replicate **qualifies** only if its build passes **all** of the following:

1. **Fresh-checkout reproducibility** (§4.6)
2. **100-seed determinism digest** across **all three** schedules (§4.5)
3. **Named-device WebGL2 gate**, with presentation-only-scaling recovery allowed
   (§4.7)

### Throughput downgrade (structural)

| Condition | Consequence |
|---|---|
| Fewer than **two** qualifying replicates in an arm | That arm's **throughput is downgraded to non-decisive pilot evidence** |

Downgrade is a **final valid outcome**, not a mid-flight repair opportunity.
Adjudication arithmetic and decision-rule flowchart are owned by the Stage 1
worksheet ([sceneaxi#14](https://github.com/Vhailors/sceneaxi/issues/14)) —
recommendation only; not authored in this ticket.

---

## 6. Held-field manifest

Every field that **only** a tier-3 captain decision may fill. This template
lists the surface; it does **not** answer any row.

| # | Field | Filled by decision key | Notes |
|---|---|---|---|
| H1 | Acceptance criteria list (12–20 weight-1) | `first-proof-brief` | Content, order, pass evidence |
| H2 | Genre / loop shape / brief sizing to ≤7 h cap | `first-proof-brief` | Disposable single-room stylized 3D micro-loop |
| H3 | Named real-device identity (+ any brief-tied envelope) | `first-proof-brief` / `first-proof-budget` | No invented device |
| H4 | Budget-derived sizing (scope, package bounds, envelopes) | `first-proof-budget` | Caps are not spend authority |
| H5 | Numeric asset-ingestion quotas (Stage 0 precommit) | `first-proof-budget` | From #48 recommendations; lock does not invent |
| H6 | Kill-rubric / human-verdict values (by reference) | `first-proof-kill-rubric` | Worksheet may recommend; hold decides |
| H7 | Any other budget-derived lock-time scalar the brief requires | `first-proof-budget` | Still no invented numbers |

If a future Stage 0 discovers a captain-owned field missing from this table,
**stop and surface a hold** — do not invent the answer into the locked
contract.

### Open tier-3 holds (must remain open in this ticket)

| Key | Role |
|---|---|
| `first-proof-brief` | Criteria, genre/loop, brief-tied envelopes |
| `first-proof-budget` | Budget-derived sizing and Stage 0 quota lock values |
| `first-proof-kill-rubric` | Numeric rubric / human eligibility values by reference |

This ticket **must not** answer them.

---

## 7. Stage 0 lock procedure

Performed only under **separate Stage 0 authorization** after the tier-3
decisions are recorded. The procedure is mechanical:

1. **Fill** every row in the held-field manifest from the recorded captain
   decisions (and #48 recommended quotas as adopted under `first-proof-budget`).
2. **Hash** the fully filled contract bytes with a collision-resistant digest
   (algorithm recorded beside the hash). Include pinned worker-configuration
   identity when the run-sheet ([sceneaxi#15](https://github.com/Vhailors/sceneaxi/issues/15))
   is in force — config hash is part of the Stage 0 freeze per the program.
3. **Record** hash, algorithm, filled-contract URI/path, decision-key versions /
   backlog references, and lock timestamp in the evidence-facing lock record.
4. **Freeze:** any drift from the hashed bytes **voids the run**. No dimension
   may be added, dropped, or reweighted after Stage 0; a rules defect voids
   rather than patching mid-flight.

### What Stage 0 lock is not

- Not Stage 1 execution
- Not worker spawn, install, account creation, or spend
- Not approval of Arm C
- Not a substitute for the separate explicit **run authorization** gate
- Not performed by merging this template

---

## 8. What this document deliberately omits

Owned by sibling tickets / repos — **not** in scope for sceneaxi#13:

| Artifact | Owner |
|---|---|
| Stage 1 counting and adjudication worksheet | sceneaxi#14 (factories-helpers#51) |
| Stage 1 paired-replicate run-sheet + pinned-config manifest | sceneaxi#15 (factories-helpers#52) |
| Readiness ladder and evidence policy | factories-helpers#44 |
| Untrusted-asset ingestion / supply-chain security requirements | factories-helpers#48 |
| Proof program Stages 0–8 normative body | factories-helpers#41 |
| Product scope | sceneaxi#1 / `docs/program/SPEC.md` |

---

## 9. Authorization boundaries (restated)

| Action | Authorized by this template? |
|---|---|
| Author / review / merge the unlocked template | Yes (docs-only) |
| Fill held fields with invented answers | **No** |
| Stage 0 lock | **No** — separate authorization + recorded tier-3 decisions |
| Stage 1 execution | **No** — double-gated (tier-3 decisions **and** explicit run authorization) |
| Arm C run | **No** — additionally requires account authorization |
| Installs, accounts, spend, deploy, publication | **No** |

The Three Kernel remains a **falsifiable hypothesis**. This template must read
identically fair to both primary arms; nothing here presumes either arm wins.
