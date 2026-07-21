# Stage 1 — counting and adjudication worksheet

> ## ⚠️ Double gate — read first
>
> Stage 1 of the engine-core proof program
> ([factories-helpers#41](https://github.com/Vhailors/factories-helpers/issues/41))
> may be **executed** only when **both** gates are satisfied:
>
> 1. the **tier-3 captain decisions** are recorded, **and**
> 2. a **separate, explicit run authorization** is granted.
>
> **This document is not a run authorization.** It is a preparation worksheet:
> presence, review status, or merge grants no authority of any kind. Arm C
> (hosted/editor surface), if ever run, additionally requires separate account
> authorization and enters no ratio in any decision rule.
>
> Index and house banner: [`docs/proof/README.md`](README.md).

**Status:** recommendation-only worksheet. **Nothing in this file is locked or
decided.**  
**Tracked by:** [sceneaxi#14](https://github.com/Vhailors/sceneaxi/issues/14)
(`transferred-from: factories-helpers#51`).  
**Proof program source of truth:** factories-helpers
[#41](https://github.com/Vhailors/factories-helpers/issues/41)
(pointer: [`docs/program/spec-41.md`](../program/spec-41.md)).  
**Depends on:** Stage 0 unlocked template
([`stage-0-acceptance-contract-template.md`](stage-0-acceptance-contract-template.md),
sceneaxi#13).

---

## 0. Explicit non-answer (read before using any number below)

This worksheet is the **recommended-answer artifact** for the open captain hold
`first-proof-kill-rubric`. It turns the precommitted Stage 1 counting rules into
a mechanically executable worksheet so adjudication is **arithmetic, not
argument**.

| Role | Owner |
|---|---|
| Author / review / merge this recommendation | docs ticket sceneaxi#14 |
| **Approve, amend, or lock** rubric / human-eligibility values | captain hold **`first-proof-kill-rubric`** only |
| Stage 0 lock of the filled acceptance contract | separate Stage 0 authorization + recorded tier-3 decisions |
| Stage 1 run execution | double gate (tier-3 decisions **and** explicit run authorization) |

**This document decides nothing.** Recommended thresholds and procedures below
are **not** captain resolutions. Do not treat merge of this file as hold
approval, Stage 0 lock, or Stage 1 authorization.

---

## 1. Purpose

When an authorized Stage 1 run completes, adjudicators fill this worksheet with
measured values and walk the decision-rule flowchart in order. Every branch
yields a **final valid outcome** (material winner, split verdict, no material
winner, arm kill, arm downgrade, or void). No mid-flight reweighting.

Primary arms only:

| Arm | Role in ratios |
|---|---|
| **A** | Direct Three Kernel composition — primary, pairwise with B |
| **B** | Standalone PlayCanvas engine — primary, pairwise with A |
| **C** | Hosted/editor surface — **descriptive only; appears in no ratio anywhere** |

Qualification gates for a replicate (fresh-checkout reproducibility, 100-seed
digest across 30/60/120, named-device WebGL2) live in the Stage 0 template §5.
This worksheet assumes those gates have already been applied per arm.

---

## 2. Work-Class commit taxonomy

Every commit that contributes logged agent time must carry exactly one
`Work-Class` trailer:

| Trailer | Meaning |
|---|---|
| `Work-Class: product` | Gameplay / product surface for the brief |
| `Work-Class: glue` | Arm-specific integration, adapter, or engine-binding work |
| `Work-Class: harness` | Measurement, logging, evidence, or proof-infra only |
| `Work-Class: fix(<class>)` | Repair of a prior defect in `<class>` ∈ {product, glue, harness} |

### 2.1 Path-rule template (per arm)

Before the run, each arm publishes a **precommitted path-rule table** mapping
path prefixes (or globs) to a Work-Class. Example shape (paths are illustrative;
lock-time tables come from the run-sheet / Stage 0 pin — sceneaxi#15 owns the
run-sheet, not this ticket):

| Path pattern (example) | Class |
|---|---|
| `src/game/**`, `assets/**` | product |
| `src/adapters/**`, `src/backend/**` | glue |
| `harness/**`, `evidence/**`, `scripts/proof/**` | harness |

### 2.2 Dispute and override rules

1. **Precommitted path rules override trailers on dispute.** If a trailer and
   the path-rule table disagree, the path rule wins for the disputed lines.
2. **`fix(<class>)` commits name the repaired class.** Time on a
   `fix(product)` commit counts as product (and likewise for glue/harness).
   A bare `fix` without a class is a **classification defect** — stop and
   surface before any ratio (see §7 audit).
3. **Mixed commits** (files spanning more than one class) are split
   **proportionally to per-class changed lines** (insertions + deletions), not
   by file count and not by author intent prose.

### 2.3 Mixed-commit splitting — worked arithmetic example

**Commit `abc1234`** changes 200 lines total across classes:

| Class (after path-rule resolve) | Changed lines | Share |
|---|---:|---:|
| product | 120 | 120/200 = 0.60 |
| glue | 50 | 50/200 = 0.25 |
| harness | 30 | 30/200 = 0.15 |
| **Total** | **200** | **1.00** |

Harness-logged wall time for the commit window: **2.0 agent-hours**.

| Class | Attributed hours |
|---|---:|
| product | 2.0 × 0.60 = **1.20 h** |
| glue | 2.0 × 0.25 = **0.50 h** |
| harness | 2.0 × 0.15 = **0.30 h** |

If the trailer said `Work-Class: product` but path rules classify 50 lines as
glue, those 50 lines still count as glue (path rules win). Recompute shares from
the path-resolved line table, then apply the same proportional split.

---

## 3. Time, accepted work, and throughput

### 3.1 Time source

| Rule | Value |
|---|---|
| Eligible time | **Harness-logged agent-hours only** |
| Self-reported time | **Never** eligible for throughput or glue share |
| Missing harness log for a window | Treat window hours as **incomplete** (§5 / §6 edge handling pattern: incomplete dimension cannot support a "no-worse" claim favoring the incomplete arm — see §5.2) |

### 3.2 Accepted product work

```text
accepted_criteria(replicate) =
  count of locked weight-1 criteria that PASS
  AND are not vetoed by the blind human verdict for that replicate
```

Human eligibility dimensions (craft / fun / originality / comfort) bind at
adjudication per Stage 0 / hold `first-proof-kill-rubric`. The median floor
gates **eligibility**; it never alone picks the winner (§8 hard kills).

### 3.3 Throughput (per replicate)

```text
throughput(replicate) =
  accepted_criteria(replicate)
  ÷ (logged_product_hours(replicate) + logged_glue_hours(replicate))
```

- Denominator is **product + glue only** (harness hours excluded from throughput
  denominator).
- If denominator is **0**, throughput is **undefined** → replicate cannot
  contribute a numeric throughput; treat as **incomplete** for mean/dispersion
  unless the arm already fails a hard kill.

### 3.4 Arm value and publication

| Quantity | Definition |
|---|---|
| Arm mean throughput | Mean of `throughput(replicate)` over **qualifying** replicates only |
| Publication | **Per-replicate** accepted criteria, product hours, glue hours, throughput, and human medians are **always published** — means never hide dispersion |

### 3.5 Glue-share pooling — worked arithmetic example

Pooled glue share is computed **across all replicate authoring time for the
arm**, with the **upgrade drill excluded** (drill hours/files live only on the
migration counters in §6).

**Arm A — two replicates, drill excluded:**

| Window | product h | glue h | harness h | Notes |
|---|---:|---:|---:|---|
| Replicate A1 authoring | 5.0 | 2.0 | 1.0 | |
| Replicate A2 authoring | 4.0 | 3.0 | 0.5 | |
| Upgrade drill (excluded) | 0.0 | 0.0 | 0.0 | drill product/glue not in pool; drill tracked in §6 |
| **Pool** | **9.0** | **5.0** | (harness not in glue pool) | |

```text
pooled_glue_share(A) = glue_pool / (product_pool + glue_pool)
                     = 5.0 / (9.0 + 5.0)
                     = 5.0 / 14.0
                     ≈ 0.3571 (35.71%)
```

Hard kill threshold (recommendation): **pooled glue share > 35%** kills that
arm (§8). Here 35.71% > 35% → **Arm A hard-killed on glue share** (example only;
do not invent run data from this illustration).

---

## 4. Six dependency / security counters

Compare primary arms on lockfile / SBOM / OSV evidence for the **final
qualifying replicate builds** (or the Stage-0-pinned comparison package — same
rule both arms).

| # | Counter | Unit / source |
|---|---|---|
| D1 | Direct dependencies | count (top-level declared deps) |
| D2 | Transitive dependencies | count (resolved tree, unique) |
| D3 | Installed bytes | bytes (production install footprint as pinned) |
| D4 | Script-enabled packages | count (packages with install/lifecycle scripts enabled) |
| D5 | Native / WASM artifacts | count (native addons + shipped WASM modules) |
| D6 | OSV advisories | count (open advisories on the resolved tree at evidence time) |

### 4.1 "Worse" rule (dependency/security)

```text
arm X is WORSE than arm Y on dependency/security
  iff X is >25% higher than Y on at least 2 of the 6 counters
```

"No-worse" for a candidate winner W vs loser L means: W is **not** worse than L
under this rule (W may be equal or better; ties on a counter are not "higher").

### 4.2 Zero / incomplete handling (precommitted)

| Situation | Handling |
|---|---|
| Counter legitimately **0** on both arms | Counter is **comparable**; 0 is not incomplete |
| Counter **0** on one arm, positive on the other | Comparable; relative "% higher" uses the positive side as baseline only when the other is higher — a zero is not ">25% higher" than a positive; a positive **is** higher than zero (and if positive > 0, the ratio is treated as exceeding 25% for that counter) |
| Counter **missing / incomplete** on either arm | That counter is **dropped from the ≥2 tally** for *both* arms; record the drop. If fewer than **2** counters remain comparable, dependency/security **cannot** support a material-winner claim (outcome falls to split / no-winner paths that require no-worse — see §8) |
| Divergent measurement method between arms | **Classification / evidence defect** → stop at adjudication audit; do not invent crosswalks mid-flight |

---

## 5. Three migration counters

| # | Counter | Unit / source |
|---|---|---|
| M1 | Backend-import share | share of import sites (or equivalent LOC import weight) that bind the arm-specific backend vs total imports in the replicate tree — same measurement recipe both arms |
| M2 | Drill files touched | count of files changed in the upgrade / migration drill |
| M3 | Drill logged hours | harness-logged agent-hours on the upgrade / migration drill only |

### 5.1 "Worse" rule (migration)

```text
arm X is WORSE than arm Y on migration
  iff X is >25% higher than Y on at least 2 of the 3 counters
```

### 5.2 Zero / incomplete handling (precommitted)

| Situation | Handling |
|---|---|
| Counter **0** both arms | Comparable |
| Counter **0** one arm only | Same as §4.2 relative rule |
| Drill not run / hours missing | M2/M3 **incomplete** → drop those counters for both arms; if fewer than **2** migration counters remain comparable, migration **cannot** support a material-winner claim |
| Backend-import measurement undefined for an arm | M1 incomplete → same drop rule |

---

## 6. Within-arm dispersion gate

For each primary arm with two qualifying replicates:

```text
dispersion(arm) =
  (max(throughput_r) - min(throughput_r)) / mean(throughput_r)
```

**Gate (recommendation):** dispersion must be **≤ 40%**. Failing the gate is a
**final valid outcome** for that arm's material-winner path (the arm cannot be
declared a material winner). Do not re-run or reweight mid-flight to pass.

With only one qualifying replicate, the arm is already on the **throughput
downgrade** path (Stage 0 §5 / §8 below) — dispersion is not computed as a
pass condition for material winner.

---

## 7. Pre-ratio adjudication audit

**Before any cross-arm ratio, kill comparison, or "no-worse" tally is
computed**, an adjudicator who did **not** author either arm performs this
audit and records a signed checklist:

1. Work-Class trailers present; `fix(<class>)` names a valid class.
2. Path-rule tables applied; disputes resolved per §2.2.
3. Mixed commits split by changed-line proportion (§2.3); arithmetic checked.
4. Harness logs complete for all windows used in throughput and glue share.
5. Upgrade-drill time excluded from glue pool; present on migration counters.
6. Human medians recorded blind; eligibility floor applied without winner pick.
7. Six dependency/security and three migration counters measured with the same
   recipe both arms; zero/incomplete handling applied per §4.2 / §5.2.
8. Qualifying-replicate set frozen (Stage 0 gates); no post-hoc disqualification
   to steer a ratio.
9. Arm C data, if any, **quarantined** from every ratio field.

Audit **fail** → stop. Outcome is **void** or "return to classification," not a
steered winner. Audit **pass** → proceed to §8 in order.

---

## 8. Decision-rule flowchart (ordered)

Walk **top to bottom**. First matching terminal leaf wins. Arm C never appears
in a ratio, kill condition comparing A vs B throughput, or no-worse tally.

```text
[0] Adjudication audit (§7) passed?
    NO  → VOID / return to classification (final until re-audit)
    YES → continue

[1] HARD KILLS (per primary arm, independently)
    1a. Zero qualifying replicates?
        YES → that arm KILLED (final)
    1b. Pooled glue share > 35%?
        YES → that arm KILLED (final)
    1c. Blind human craft/fun/originality/comfort median < 3?
        (exactly 3.0 passes; <3 fails)
        YES → that arm KILLED on human eligibility (final)
    1d. Source-first arm requires a hosted service/account to meet the brief?
        YES → that arm KILLED (final)
    If both arms killed → NO MATERIAL WINNER (double kill; final)
    If one arm killed → remaining arm is NOT auto-winner; still must clear
        material-winner gates below against a killed peer? NO — a lone
        surviving arm without a living peer records NO MATERIAL WINNER
        (peer absent), unless program rules later authorize a one-arm pilot
        (out of scope here). Default: NO MATERIAL WINNER (final).

[2] Both primary arms have ≥ 2 qualifying replicates?
    NO  → for any arm with <2 qualifying replicates:
          THROUGHPUT DOWNGRADED TO NON-DECISIVE PILOT EVIDENCE (final for
          that arm's winner path). No material winner from Stage 1 ratios.
    YES → continue

[3] Both arms pass ≤ 40% within-arm dispersion (§6)?
    NO  → dispersion failure is FINAL; no material winner
    YES → continue

[4] Mean throughput comparison
    Let r = mean_throughput(A) / mean_throughput(B)   (B/A symmetric)
    Candidate W = arm with higher mean; L = the other.

    4a. Is max(mean_A, mean_B) / min(mean_A, mean_B) ≥ 1.25
        AND replicate throughput ranges non-overlapping?
        NO  → if ratio < 1.25 in both directions → NO MATERIAL WINNER (final)
        YES → continue with candidate W

[5] No-worse on BOTH counted dimensions
    5a. Is W no-worse than L on dependency/security (§4)?
    5b. Is W no-worse than L on migration (§5)?
    BOTH yes → MATERIAL WINNER = W (final)
    Either no → SPLIT VERDICT — NO OVERALL WINNER (final)
               (throughput favored W; counted dimension blocked overall win)
```

### 8.1 Terminal outcomes (all final and valid)

| Outcome | Meaning |
|---|---|
| **Material winner = A or B** | Cleared hard kills, 2+ quals each, dispersion, ≥1.25× non-overlapping means, no-worse on both dimensions |
| **Split verdict — no overall winner** | Throughput candidate exists but fails no-worse on dependency/security and/or migration |
| **No material winner** | <1.25× both ways, peer absent after kill, dispersion fail, or double kill |
| **Arm killed** | Hard kill 1a–1d |
| **Throughput downgraded (pilot only)** | <2 qualifying replicates on that arm |
| **Void** | Rules defect, audit fail, or Stage 0 hash drift |

### 8.2 Arm C exclusion (restated)

Arm C measurements may be filed as descriptive evidence under separate
authorization. **No** throughput ratio, glue share kill, dependency tally,
migration tally, or material-winner claim may include Arm C.

---

## 9. Finality rules

1. **No dimension may be added, dropped, or reweighted after Stage 0 lock.**
   A rules defect **voids the run** rather than being patched mid-flight.
2. **Adjudication is audited before any cross-arm ratio** (§7).
3. **Downgrade, dispersion failure, range overlap, split, and no-winner
   outcomes are final** — not mid-flight repair opportunities.
4. **Overscope stop** (both block-1 replicates accept under 50% of locked
   criteria → "contract defect — rerun required") is owned by Stage 0 §3.2; it
   is a no-fault contract outcome, not an arm failure under this worksheet.
5. Thresholds in this file are **recommendations** for hold
   `first-proof-kill-rubric` until the captain approves or amends them.

---

## 10. Fill-in tables (blank — for authorized runs only)

### 10.1 Replicate qualification and throughput

| Arm | Rep | Qualifying? (Y/N) | Accepted criteria | Product h | Glue h | Throughput | Human median (C/F/O/Comfort) |
|---|---|---|---:|---:|---:|---:|---|
| A | 1 | | | | | | |
| A | 2 | | | | | | |
| B | 1 | | | | | | |
| B | 2 | | | | | | |

### 10.2 Glue pool

| Arm | Product pool h | Glue pool h | Pooled glue share | >35% kill? |
|---|---:|---:|---:|---|
| A | | | | |
| B | | | | |

### 10.3 Dependency / security

| Counter | Arm A | Arm B | A >25% higher? | B >25% higher? | Incomplete? |
|---|---:|---:|---|---|---|
| D1 Direct deps | | | | | |
| D2 Transitive deps | | | | | |
| D3 Installed bytes | | | | | |
| D4 Script-enabled pkgs | | | | | |
| D5 Native/WASM | | | | | |
| D6 OSV advisories | | | | | |
| **Worse on ≥2?** | — | — | A worse? | B worse? | |

### 10.4 Migration

| Counter | Arm A | Arm B | A >25% higher? | B >25% higher? | Incomplete? |
|---|---:|---:|---|---|---|
| M1 Backend-import share | | | | | |
| M2 Drill files touched | | | | | |
| M3 Drill logged hours | | | | | |
| **Worse on ≥2 of 3?** | — | — | A worse? | B worse? | |

### 10.5 Flowchart result

| Step | Result |
|---|---|
| Audit §7 | pass / fail |
| Hard kills | |
| Qualifying counts | A: _ B: _ |
| Dispersion | A: _ B: _ |
| Mean throughput ratio | |
| Range overlap? | yes / no |
| No-worse dep/sec | yes / no |
| No-worse migration | yes / no |
| **Terminal outcome** | |

---

## 11. What this document deliberately omits

| Artifact | Owner |
|---|---|
| Stage 0 engine-neutral acceptance-contract template | sceneaxi#13 (in tree) |
| Stage 1 paired-replicate run-sheet + pinned-config manifest | sceneaxi#15 (factories-helpers#52) — **not this ticket** |
| Readiness ladder and evidence policy | factories-helpers#44 |
| Untrusted-asset ingestion / supply-chain security requirements | factories-helpers#48 |
| Proof program Stages 0–8 normative body | factories-helpers#41 |
| Product scope | sceneaxi#1 / `docs/program/SPEC.md` |

---

## 12. Authorization boundaries (restated)

| Action | Authorized by this worksheet? |
|---|---|
| Author / review / merge the recommendation | Yes (docs-only) |
| Approve `first-proof-kill-rubric` values | **No** — captain hold only |
| Stage 0 lock | **No** |
| Stage 1 execution or adjudication of a real run | **No** — double-gated |
| Arm C run | **No** — account authorization + still no ratios |
| Installs, accounts, spend, deploy, publication | **No** |

Symmetric and backend-neutral throughout: no arm holds a discretionary veto the
other lacks, and nothing here presumes either primary arm wins.
