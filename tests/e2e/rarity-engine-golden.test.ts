/** Public-seam golden for the accepted deterministic rarity engine (sceneaxi#240). */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  bootstrapOpenPath,
  resumeOpenPath,
} from "@sceneaxi/engine-orchestrator";
import {
  RARITY_NAMESPACE_KIND,
  RARITY_SCHEMA_VERSION,
  type RarityOutcome,
  type RarityPolicy,
  type RarityProvenance,
  type RarityRollRequest,
} from "@sceneaxi/schemas";

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
    new URL(
      "../../packages/schemas/contracts/rarity.fixtures.json",
      import.meta.url,
    ),
    "utf8",
  ),
) as Fixture;

const host = Object.freeze({ nowMs: () => 1_700_000_000_000 });

describe("deterministic rarity golden", () => {
  it("opens, resolves boundary vectors, saves, and resumes through public seams", () => {
    const selected = [fixture.vectors[0], fixture.vectors.at(-1)];
    if (selected.some((vector) => vector === undefined)) {
      throw new Error("rarity fixture boundary vectors are missing");
    }
    const opened = bootstrapOpenPath(
      {
        kind: "product",
        productManifest: {
          productId: fixture.scope,
          seed: fixture.projectSeed,
          rarity: {
            schemaVersion: RARITY_SCHEMA_VERSION,
            kind: RARITY_NAMESPACE_KIND,
            policy: fixture.policy,
            rolls: [],
          },
        },
      },
      host,
    );
    if (!opened.ok) throw new Error(opened.detail ?? opened.reason);
    const live = opened.value.session();
    if (!live.ok) throw new Error(live.reason);

    let tick = 0;
    for (const vector of selected) {
      if (vector === undefined) continue;
      live.value.dispatch({
        type: "rarity-roll",
        eventId: vector.eventId,
        request: fixture.request,
      });
      tick += 1;
      live.value.advance({ tick, deltaMs: 16 });
    }

    const terminal = live.value.observe();
    expect(terminal.rarity?.rolls).toEqual(
      selected.map((vector) => ({
        eventId: vector?.eventId,
        request: fixture.request,
        outcome: vector?.outcome,
        provenance: vector?.provenance,
      })),
    );
    const save = live.value.save();
    expect(save.productManifest.rarity).toEqual(terminal.rarity);

    const resumed = resumeOpenPath(
      { kind: "product", save: JSON.parse(JSON.stringify(save)) as typeof save },
      host,
    );
    if (!resumed.ok) throw new Error(resumed.detail ?? resumed.reason);
    const replayed = resumed.value.session();
    if (!replayed.ok) throw new Error(replayed.reason);
    expect(replayed.value.observe()).toEqual(terminal);
    expect(replayed.value.save()).toEqual(save);
  });
});
