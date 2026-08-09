import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  RARITY_NAMESPACE_KIND,
  RARITY_POLICY_KIND,
  RARITY_REFUSE_CODES,
  RARITY_REQUEST_KIND,
  RARITY_SCHEMA_VERSION,
  type KernelCommand,
  type KernelSessionSaveArtifact,
  type ProductManifest,
  type RarityOutcome,
  type RarityPolicy,
  type RarityProvenance,
  type RarityRollRequest,
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
    new URL("../../schemas/contracts/rarity.fixtures.json", import.meta.url),
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
) {
  return { type: "rarity-roll", eventId, request } as const;
}

function jsonCopy<Value>(value: Value): Value {
  return JSON.parse(JSON.stringify(value)) as Value;
}

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
    session.dispatch(rarityCommand("roll-0015"));
    session.advance({ tick: 2, deltaMs: 16 });
    const terminal = session.observe();
    const save = session.save();
    expect(save.productManifest.rarity).toEqual(terminal.rarity);

    const replayed = replay(jsonCopy(save), fixedHost());
    expect(replayed.observe()).toEqual(terminal);
    expect(replayed.save()).toEqual(save);
  });

  it("makes an identical event/request idempotent and requires a new event id to reroll", () => {
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

    session.dispatch(rarityCommand("reroll-0000", changed));
    session.advance({ tick: 2, deltaMs: 16 });
    expect(session.observe().rarity?.rolls.map((roll) => roll.eventId)).toEqual([
      "roll-0000",
      "reroll-0000",
    ]);
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
