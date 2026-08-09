import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MODEL_PROVIDER_CALL_EVIDENCE_KIND,
  MODEL_PROVIDER_PORT_SCHEMA_VERSION,
  RARITY_FIXTURES_PATH,
  RARITY_NAMESPACE_KIND,
  RARITY_POLICY_KIND,
  RARITY_REFUSE_CODES,
  RARITY_REQUEST_KIND,
  RARITY_SCHEMA_VERSION,
  RARITY_TIERS,
  type KernelCommand,
  type KernelSessionSaveArtifact,
  type ModelProviderCallEvidence,
  type ProductManifest,
  type RarityNamespace,
  type RarityOutcome,
  type RarityPolicy,
  type RarityProvenance,
  type RarityRollRequest,
  type RarityTierId,
} from "@sceneaxi/schemas";
import {
  KernelSessionError,
  open,
  replay,
  resolveRarityRoll,
  type KernelHost,
} from "@sceneaxi/engine-kernel";

type Fixture = {
  readonly projectSeed: number;
  readonly scope: string;
  readonly policy: RarityPolicy;
  readonly request: RarityRollRequest;
  readonly vectors: ReadonlyArray<{
    readonly eventId: string;
    readonly outcome: RarityOutcome;
    readonly provenance: RarityProvenance;
  }>;
};

const fixture = JSON.parse(
  readFileSync(
    new URL(`../../schemas/${RARITY_FIXTURES_PATH}`, import.meta.url),
    "utf8",
  ),
) as Fixture;

function fixedHost(): KernelHost {
  let now = 1_000;
  return { nowMs: () => now++ };
}

function manifest(): ProductManifest {
  return {
    productId: fixture.scope,
    seed: fixture.projectSeed,
    entities: [{ id: "hero", x: 0, y: 0 }],
    rarity: {
      schemaVersion: RARITY_SCHEMA_VERSION,
      kind: RARITY_NAMESPACE_KIND,
      policy: fixture.policy,
      rolls: [],
    },
  };
}

function rarityCommand(
  eventId: string,
  request: RarityRollRequest = fixture.request,
  providerEvidence?: ModelProviderCallEvidence,
) {
  return {
    type: "rarity-roll",
    eventId,
    request,
    ...(providerEvidence === undefined ? {} : { providerEvidence }),
  } as const;
}

function jsonCopy<Value>(value: Value): Value {
  return JSON.parse(JSON.stringify(value)) as Value;
}

/**
 * A deliberately non-uniform policy and candidate pool. The shipped fixture is
 * uniform, so only skewed weights can tell a weighted cumulative interval apart
 * from a positional one. Every expected value below was derived independently
 * of this implementation from the documented algorithm.
 */
const SKEWED_SEED = 20_260_809;
const SKEWED_SCOPE = "skewed-rarity-product";

const SKEWED_POLICY: RarityPolicy = {
  schemaVersion: RARITY_SCHEMA_VERSION,
  kind: RARITY_POLICY_KIND,
  tierWeights: { common: 7, uncommon: 1, rare: 0, epic: 0, legendary: 0 },
};

const SKEWED_REQUEST: RarityRollRequest = {
  schemaVersion: RARITY_SCHEMA_VERSION,
  kind: RARITY_REQUEST_KIND,
  candidates: [
    { candidateId: "skew-common-a", tier: "common", weight: 1 },
    { candidateId: "skew-common-b", tier: "common", weight: 5 },
    { candidateId: "skew-uncommon-a", tier: "uncommon", weight: 3 },
  ],
};

const SKEWED_VECTORS = [
  {
    eventId: "skew-0000",
    tier: "common",
    candidateId: "skew-common-b",
    tierDraw: 1,
    tierTotalWeight: 8,
    candidateDraw: 2,
    candidateTotalWeight: 6,
  },
  {
    eventId: "skew-0002",
    tier: "common",
    candidateId: "skew-common-b",
    tierDraw: 6,
    tierTotalWeight: 8,
    candidateDraw: 3,
    candidateTotalWeight: 6,
  },
  {
    eventId: "skew-0003",
    tier: "uncommon",
    candidateId: "skew-uncommon-a",
    tierDraw: 7,
    tierTotalWeight: 8,
    candidateDraw: 0,
    candidateTotalWeight: 3,
  },
  {
    eventId: "skew-0014",
    tier: "common",
    candidateId: "skew-common-b",
    tierDraw: 2,
    tierTotalWeight: 8,
    candidateDraw: 2,
    candidateTotalWeight: 6,
  },
] as const satisfies ReadonlyArray<{
  readonly eventId: string;
  readonly tier: RarityTierId;
  readonly candidateId: string;
  readonly tierDraw: number;
  readonly tierTotalWeight: number;
  readonly candidateDraw: number;
  readonly candidateTotalWeight: number;
}>;

afterEach(() => {
  vi.restoreAllMocks();
});

describe("pure deterministic rarity resolver", () => {
  it("matches every checked-in tier/candidate interval vector exactly", () => {
    const tierCandidateBoundaries = new Set<string>();
    for (const vector of fixture.vectors) {
      const result = resolveRarityRoll(
        {
          projectSeed: fixture.projectSeed,
          scope: fixture.scope,
          eventId: vector.eventId,
        },
        fixture.policy,
        fixture.request,
      );
      expect(result.ok, vector.eventId).toBe(true);
      if (!result.ok) continue;
      expect(result.value.outcome).toEqual(vector.outcome);
      expect(result.value.provenance).toEqual(vector.provenance);
      tierCandidateBoundaries.add(
        `${String(result.value.provenance.tierDraw)}:${String(result.value.provenance.candidateDraw)}`,
      );
    }
    expect(tierCandidateBoundaries).toEqual(
      new Set(["0:0", "0:1", "1:0", "1:1", "2:0", "2:1", "3:0", "3:1", "4:0", "4:1"]),
    );
  });

  it("does not consult random, clock, provider, filesystem, or process identity", () => {
    vi.spyOn(Math, "random").mockImplementation(() => {
      throw new Error("Math.random must not be called");
    });
    vi.spyOn(Date, "now").mockImplementation(() => {
      throw new Error("Date.now must not be called");
    });
    const vector = fixture.vectors[0];
    if (vector === undefined) throw new Error("rarity fixture is empty");
    const first = resolveRarityRoll(
      {
        projectSeed: fixture.projectSeed,
        scope: fixture.scope,
        eventId: vector.eventId,
      },
      fixture.policy,
      fixture.request,
    );
    const second = resolveRarityRoll(
      {
        projectSeed: fixture.projectSeed,
        scope: fixture.scope,
        eventId: vector.eventId,
      },
      fixture.policy,
      fixture.request,
    );
    expect(first).toEqual(second);
    expect(first).toMatchObject({ ok: true, value: { outcome: vector.outcome } });
  });

  it("selects both intervals by weight rather than by position", () => {
    for (const vector of SKEWED_VECTORS) {
      const result = resolveRarityRoll(
        {
          projectSeed: SKEWED_SEED,
          scope: SKEWED_SCOPE,
          eventId: vector.eventId,
        },
        SKEWED_POLICY,
        SKEWED_REQUEST,
      );
      expect(result.ok, vector.eventId).toBe(true);
      if (!result.ok) continue;
      expect(result.value.outcome.tier, vector.eventId).toBe(vector.tier);
      expect(result.value.outcome.candidateId, vector.eventId).toBe(
        vector.candidateId,
      );
      expect(result.value.provenance, vector.eventId).toMatchObject({
        tierDraw: vector.tierDraw,
        tierTotalWeight: vector.tierTotalWeight,
        candidateDraw: vector.candidateDraw,
        candidateTotalWeight: vector.candidateTotalWeight,
      });
    }
  });

  it("keeps every draw inside the cumulative interval its weights define", () => {
    const policyTotal = RARITY_TIERS.reduce(
      (total, tier) => total + SKEWED_POLICY.tierWeights[tier],
      0,
    );
    for (let index = 0; index < 16; index += 1) {
      const eventId = `skew-${String(index).padStart(4, "0")}`;
      const result = resolveRarityRoll(
        { projectSeed: SKEWED_SEED, scope: SKEWED_SCOPE, eventId },
        SKEWED_POLICY,
        SKEWED_REQUEST,
      );
      expect(result.ok, eventId).toBe(true);
      if (!result.ok) continue;
      const { outcome, provenance } = result.value;

      expect(provenance.tierTotalWeight, eventId).toBe(policyTotal);
      expect(SKEWED_POLICY.tierWeights[outcome.tier], eventId).toBeGreaterThan(0);
      let cumulative = 0;
      let expectedTier: RarityTierId | undefined;
      for (const tier of RARITY_TIERS) {
        cumulative += SKEWED_POLICY.tierWeights[tier];
        if (expectedTier === undefined && provenance.tierDraw < cumulative) {
          expectedTier = tier;
        }
      }
      expect(outcome.tier, eventId).toBe(expectedTier);

      const pool = SKEWED_REQUEST.candidates.filter(
        (candidate) => candidate.tier === outcome.tier,
      );
      expect(provenance.candidateTotalWeight, eventId).toBe(
        pool.reduce((total, candidate) => total + candidate.weight, 0),
      );
      cumulative = 0;
      let expectedCandidate: string | undefined;
      for (const candidate of pool) {
        cumulative += candidate.weight;
        if (
          expectedCandidate === undefined &&
          provenance.candidateDraw < cumulative
        ) {
          expectedCandidate = candidate.candidateId;
        }
      }
      expect(outcome.candidateId, eventId).toBe(expectedCandidate);
    }
  });

  it("refuses an unsafe project seed before hashing", () => {
    expect(
      resolveRarityRoll(
        {
          projectSeed: Number.MAX_SAFE_INTEGER + 1,
          scope: fixture.scope,
          eventId: "unsafe-seed",
        },
        fixture.policy,
        fixture.request,
      ),
    ).toMatchObject({ ok: false, code: RARITY_REFUSE_CODES.seedInvalid });
  });
});

describe("rarity through kernel dispatch, advance, snapshot, save, and replay", () => {
  it("queues on dispatch and resolves only on authoritative advance", () => {
    const session = open(manifest(), fixedHost());
    const initial = session.observe();
    session.dispatch(rarityCommand("roll-0000"));
    expect(session.observe()).toEqual(initial);

    session.advance({ tick: 1, deltaMs: 16 });
    const resolved = session.observe();
    expect(resolved.rarity?.rolls).toHaveLength(1);
    expect(resolved.rarity?.rolls[0]).toEqual({
      eventId: "roll-0000",
      request: fixture.request,
      outcome: fixture.vectors[0]?.outcome,
      provenance: fixture.vectors[0]?.provenance,
    });
    expect(resolved.digest).not.toBe(initial.digest);
  });

  it("stores canonical accepted records in the manifest namespace and replays exactly", () => {
    const session = open(manifest(), fixedHost());
    session.dispatch(rarityCommand("roll-0000"));
    session.advance({ tick: 1, deltaMs: 16 });
    const terminal = session.observe();
    const save = session.save();
    expect(save.productManifest.rarity).toEqual(terminal.rarity);

    const replayed = replay(jsonCopy(save), fixedHost());
    expect(replayed.observe()).toEqual(terminal);
    expect(replayed.save()).toEqual(save);
  });

  it("binds every evidenced command to its stored roll", () => {
    const base = manifest();
    const evidence: ModelProviderCallEvidence = {
      schemaVersion: MODEL_PROVIDER_PORT_SCHEMA_VERSION,
      kind: MODEL_PROVIDER_CALL_EVIDENCE_KIND,
      operation: "tool-call",
      profile: "@sceneaxi/profile-game",
      model: {
        model: "wayfinder-rarity-fixture",
        provider: "sceneaxi-fixture",
        quantization: "deterministic-json",
        version: "2026-08-09",
      },
    };
    const evidenced = open(base, fixedHost());
    evidenced.dispatch(rarityCommand("roll-bound", fixture.request, evidence));
    evidenced.advance({ tick: 1, deltaMs: 16 });
    expect(() => evidenced.dispatch(rarityCommand("roll-unbound"))).toThrow(
      RARITY_REFUSE_CODES.provenanceMismatch,
    );
    expect(() =>
      evidenced.dispatch(
        rarityCommand("roll-conflict", fixture.request, {
          ...evidence,
          model: { ...evidence.model, version: "2026-09-01" },
        }),
      ),
    ).toThrow(RARITY_REFUSE_CODES.provenanceMismatch);

    evidenced.dispatch(rarityCommand("roll-bound-2", fixture.request, evidence));
    evidenced.advance({ tick: 2, deltaMs: 16 });
    const save = evidenced.save();
    const dispatch = save.events.find((event) => event.kind === "dispatch");
    expect(dispatch?.kind === "dispatch" ? dispatch.command : null).toMatchObject({
      type: "rarity-roll",
      eventId: "roll-bound",
      providerEvidence: evidence,
    });
    expect(save.productManifest.rarity?.rolls[0]?.providerEvidence).toEqual(evidence);
  });

  it("refuses provider evidence added without its roll provenance binding", () => {
    const base = manifest();
    const resolved = resolveRarityRoll(
      {
        projectSeed: base.seed,
        scope: base.productId,
        eventId: "roll-retroactive",
      },
      (base.rarity as RarityNamespace).policy,
      fixture.request,
    );
    if (!resolved.ok) throw new Error(resolved.message);
    const providerEvidence: ModelProviderCallEvidence = {
      schemaVersion: MODEL_PROVIDER_PORT_SCHEMA_VERSION,
      kind: MODEL_PROVIDER_CALL_EVIDENCE_KIND,
      operation: "tool-call",
      profile: "@sceneaxi/profile-game",
      model: {
        model: "wayfinder-rarity-fixture",
        provider: "sceneaxi-fixture",
        quantization: "deterministic-json",
        version: "2026-08-09",
      },
    };
    expect(() =>
      open(
        {
          ...base,
          rarity: {
            ...(base.rarity as RarityNamespace),
            rolls: [{ ...resolved.value.record, providerEvidence }],
          },
        },
        fixedHost(),
      ),
    ).toThrow(RARITY_REFUSE_CODES.provenanceMismatch);
  });

  it("refuses stored rarity evidence outside Game or Web tool calls", () => {
    const base = manifest();
    const evidence: ModelProviderCallEvidence = {
      schemaVersion: MODEL_PROVIDER_PORT_SCHEMA_VERSION,
      kind: MODEL_PROVIDER_CALL_EVIDENCE_KIND,
      operation: "tool-call",
      profile: "@sceneaxi/profile-game",
      model: {
        model: "wayfinder-rarity-fixture",
        provider: "sceneaxi-fixture",
        quantization: "deterministic-json",
        version: "2026-08-09",
      },
    };
    for (const invalidEvidence of [
      { ...evidence, operation: "complete" },
      { ...evidence, profile: "@sceneaxi/profile-kids" },
    ] as ModelProviderCallEvidence[]) {
      const resolved = resolveRarityRoll(
        {
          projectSeed: base.seed,
          scope: base.productId,
          eventId: "roll-invalid-evidence",
        },
        (base.rarity as RarityNamespace).policy,
        fixture.request,
      );
      if (!resolved.ok) throw new Error(resolved.message);
      expect(() =>
        open(
          {
            ...base,
            rarity: {
              ...(base.rarity as RarityNamespace),
              rolls: [{ ...resolved.value.record, providerEvidence: invalidEvidence }],
            },
          },
          fixedHost(),
        ),
      ).toThrow(RARITY_REFUSE_CODES.provenanceMismatch);
    }
  });

  it("carries per-roll provider evidence through save and replay", () => {
    const base = manifest();
    const evidence: ModelProviderCallEvidence = {
      schemaVersion: MODEL_PROVIDER_PORT_SCHEMA_VERSION,
      kind: MODEL_PROVIDER_CALL_EVIDENCE_KIND,
      operation: "tool-call",
      profile: "@sceneaxi/profile-game",
      model: {
        model: "wayfinder-rarity-fixture",
        provider: "sceneaxi-fixture",
        quantization: "deterministic-json",
        version: "2026-08-09",
      },
    };
    const session = open(base, fixedHost());
    session.dispatch(rarityCommand("roll-0000", fixture.request, evidence));
    session.advance({ tick: 1, deltaMs: 16 });
    const terminal = session.observe();
    const save = session.save();
    expect(terminal.rarity?.rolls).toHaveLength(1);
    expect(save.productManifest.rarity?.rolls[0]?.providerEvidence).toEqual(evidence);

    const replayed = replay(jsonCopy(save), fixedHost());
    expect(replayed.observe()).toEqual(terminal);
    expect(replayed.observe().rarity?.rolls[0]?.providerEvidence).toEqual(evidence);
    expect(replayed.save()).toEqual(save);

    const stripped = jsonCopy(save);
    const strippedRoll = stripped.productManifest.rarity?.rolls[0];
    if (strippedRoll === undefined) throw new Error("saved rarity roll missing");
    delete (strippedRoll as { providerEvidence?: ModelProviderCallEvidence }).providerEvidence;
    expect(() => replay(stripped, fixedHost())).toThrow(
      RARITY_REFUSE_CODES.provenanceMismatch,
    );
  });

  it("replays evidence-less events but refuses to extend their history", () => {
    const session = open(manifest(), fixedHost());
    session.dispatch(rarityCommand("roll-0000"));
    session.dispatch(rarityCommand("roll-0000"));
    session.advance({ tick: 1, deltaMs: 16 });
    expect(session.observe().rarity?.rolls).toHaveLength(1);
    expect(session.save().events.filter((event) => event.kind === "dispatch")).toHaveLength(1);

    session.dispatch(rarityCommand("roll-0000"));
    expect(() => session.save()).not.toThrow();

    const changed = {
      ...fixture.request,
      candidates: fixture.request.candidates.map((candidate, index) =>
        index === 0 ? { ...candidate, weight: candidate.weight + 1 } : candidate,
      ),
    };
    try {
      session.dispatch(rarityCommand("roll-0000", changed));
      throw new Error("changed rarity request was accepted");
    } catch (error) {
      expect(error).toBeInstanceOf(KernelSessionError);
      expect((error as KernelSessionError).code).toBe(
        RARITY_REFUSE_CODES.eventInputConflict,
      );
    }

    expect(() => session.dispatch(rarityCommand("reroll-0000", changed))).toThrow(
      RARITY_REFUSE_CODES.provenanceMismatch,
    );
    expect(session.observe().rarity?.rolls.map((roll) => roll.eventId)).toEqual(["roll-0000"]);
  });

  it("refuses provider entropy at both request and command boundaries", () => {
    const session = open(manifest(), fixedHost());
    expect(() =>
      session.dispatch({
        type: "rarity-roll",
        eventId: "provider-seed",
        request: { ...fixture.request, seed: 99 },
      } as unknown as KernelCommand),
    ).toThrow(RARITY_REFUSE_CODES.providerEntropyForbidden);
    expect(() =>
      session.dispatch({
        ...rarityCommand("provider-outcome"),
        outcome: { tier: "legendary", candidateId: "legendary-a" },
      } as unknown as KernelCommand),
    ).toThrow(RARITY_REFUSE_CODES.providerEntropyForbidden);
  });

  it("refuses tampered outcome, provenance, request, schema, and terminal digest", () => {
    const session = open(manifest(), fixedHost());
    session.dispatch(rarityCommand("roll-0000"));
    session.advance({ tick: 1, deltaMs: 16 });
    const save = session.save();

    const outcome = jsonCopy(save);
    const outcomeRoll = outcome.productManifest.rarity?.rolls[0];
    if (outcomeRoll === undefined) throw new Error("saved rarity roll missing");
    (outcomeRoll.outcome as { candidateId: string }).candidateId = "common-b";
    expect(() => replay(outcome, fixedHost())).toThrow(
      RARITY_REFUSE_CODES.outcomeMismatch,
    );

    const provenance = jsonCopy(save);
    const provenanceRoll = provenance.productManifest.rarity?.rolls[0];
    if (provenanceRoll === undefined) throw new Error("saved rarity roll missing");
    (provenanceRoll.provenance as { requestDigest: string }).requestDigest =
      `sha256:${"0".repeat(64)}`;
    expect(() => replay(provenance, fixedHost())).toThrow(
      RARITY_REFUSE_CODES.provenanceMismatch,
    );

    const request = jsonCopy(save);
    const dispatch = request.events.find(
      (event) => event.kind === "dispatch" && event.command.type === "rarity-roll",
    );
    if (dispatch?.kind !== "dispatch" || dispatch.command.type !== "rarity-roll") {
      throw new Error("saved rarity dispatch missing");
    }
    const changedCandidates = dispatch.command.request.candidates as Array<{
      candidateId: string;
      tier: "common" | "uncommon" | "rare" | "epic" | "legendary";
      weight: number;
    }>;
    const changedFirst = changedCandidates[0];
    if (changedFirst === undefined) throw new Error("saved rarity candidate missing");
    changedFirst.weight += 1;
    expect(() => replay(request, fixedHost())).toThrow(
      RARITY_REFUSE_CODES.eventInputConflict,
    );

    const schema = jsonCopy(save);
    if (schema.productManifest.rarity === undefined) throw new Error("saved rarity missing");
    (schema.productManifest.rarity as { schemaVersion: number }).schemaVersion = 2;
    expect(() => replay(schema, fixedHost())).toThrow(
      RARITY_REFUSE_CODES.schemaVersionMismatch,
    );

    const digest = {
      ...save,
      terminalDigest: `sha256:${"f".repeat(64)}`,
    } as KernelSessionSaveArtifact;
    expect(() => replay(digest, fixedHost())).toThrow(/replay digest mismatch/);
  });

  it("records the weighted outcome through dispatch, advance, save, and replay", () => {
    const rolls = SKEWED_VECTORS.map((vector) => {
      const session = open(
        {
          productId: SKEWED_SCOPE,
          seed: SKEWED_SEED,
          rarity: {
            schemaVersion: RARITY_SCHEMA_VERSION,
            kind: RARITY_NAMESPACE_KIND,
            policy: SKEWED_POLICY,
            rolls: [],
          },
        },
        fixedHost(),
      );
      session.dispatch(rarityCommand(vector.eventId, SKEWED_REQUEST));
      session.advance({ tick: 1, deltaMs: 16 });
      const roll = session.observe().rarity?.rolls[0];
      if (roll === undefined) throw new Error(`missing weighted roll ${vector.eventId}`);
      expect(replay(jsonCopy(session.save()), fixedHost()).observe().rarity?.rolls[0]).toEqual(roll);
      return roll;
    });
    expect(
      rolls.map((roll) => ({
        eventId: roll.eventId,
        tier: roll.outcome.tier,
        candidateId: roll.outcome.candidateId,
        tierDraw: roll.provenance.tierDraw,
        tierTotalWeight: roll.provenance.tierTotalWeight,
        candidateDraw: roll.provenance.candidateDraw,
        candidateTotalWeight: roll.provenance.candidateTotalWeight,
      })),
    ).toEqual(SKEWED_VECTORS.map((vector) => ({ ...vector })));
  });

  it("names a changed policy rather than reporting an accepted roll as tampered", () => {
    const session = open(manifest(), fixedHost());
    session.dispatch(rarityCommand("roll-0000"));
    session.advance({ tick: 1, deltaMs: 16 });
    const save = jsonCopy(session.save());

    const rolled = save.productManifest.rarity;
    if (rolled === undefined) throw new Error("saved rarity namespace missing");
    const repriced = {
      ...save.productManifest,
      rarity: {
        ...rolled,
        policy: {
          ...rolled.policy,
          tierWeights: { ...rolled.policy.tierWeights, common: 2 },
        },
      },
    };

    for (const attempt of [
      () => open(repriced, fixedHost()),
      () => replay({ ...save, productManifest: repriced }, fixedHost()),
    ]) {
      try {
        attempt();
        throw new Error("a changed rarity policy was accepted");
      } catch (error) {
        expect(error).toBeInstanceOf(KernelSessionError);
        expect((error as KernelSessionError).code).toBe(
          RARITY_REFUSE_CODES.policyChanged,
        );
      }
    }

    expect(replay(jsonCopy(save), fixedHost()).save()).toEqual(save);
  });

  it("refuses a manifest whose productId cannot be the rarity resolution scope", () => {
    const scoped = { ...manifest(), productId: `p${"x".repeat(128)}` };
    try {
      open(scoped, fixedHost());
      throw new Error("an unusable rarity scope was accepted at open");
    } catch (error) {
      expect(error).toBeInstanceOf(KernelSessionError);
      expect((error as KernelSessionError).code).toBe(
        RARITY_REFUSE_CODES.invalidIdentifier,
      );
    }
  });

  it("refuses a save artifact that records one rarity event id twice", () => {
    const session = open(manifest(), fixedHost());
    session.dispatch(rarityCommand("roll-0000"));
    session.advance({ tick: 1, deltaMs: 16 });
    const save = jsonCopy(session.save());
    const [dispatched, advanced] = save.events;
    if (dispatched?.kind !== "dispatch" || advanced?.kind !== "advance") {
      throw new Error("saved rarity event stream is not dispatch-then-advance");
    }

    const duplicated = {
      ...save,
      events: [dispatched, jsonCopy(dispatched), advanced],
    } as KernelSessionSaveArtifact;
    expect(() => replay(duplicated, fixedHost())).toThrow(
      RARITY_REFUSE_CODES.duplicateEvent,
    );
  });

  it("refuses a malformed saved dispatch command as a named kernel refusal", () => {
    const session = open(manifest(), fixedHost());
    session.dispatch(rarityCommand("roll-0000"));
    session.advance({ tick: 1, deltaMs: 16 });
    const save = jsonCopy(session.save());

    for (const command of [null, undefined, "rarity-roll", []]) {
      const malformed = {
        ...save,
        events: [{ kind: "dispatch", command, timestampMs: 1 }],
      } as unknown as KernelSessionSaveArtifact;
      try {
        replay(malformed, fixedHost());
        throw new Error("a malformed saved dispatch command was accepted");
      } catch (error) {
        expect(error, JSON.stringify(command ?? null)).toBeInstanceOf(
          KernelSessionError,
        );
        expect((error as Error).message).toContain("invalid command");
      }
    }
  });

  it("refuses rarity rolls when the existing product manifest has no policy", () => {
    const session = open(
      { productId: "no-rarity-policy", seed: 42 },
      fixedHost(),
    );
    expect(() => session.dispatch(rarityCommand("roll-without-policy"))).toThrow(
      RARITY_REFUSE_CODES.policyAbsent,
    );
  });
});

describe("rarity fixture policy shape", () => {
  it("is the accepted versioned policy rather than a parallel project model", () => {
    expect(fixture.policy).toMatchObject({
      schemaVersion: RARITY_SCHEMA_VERSION,
      kind: RARITY_POLICY_KIND,
    });
    expect(fixture.request).toMatchObject({
      schemaVersion: RARITY_SCHEMA_VERSION,
      kind: RARITY_REQUEST_KIND,
    });
  });
});
