/**
 * Demo provider for the registered capability `sceneaxi.sculpt.intake-source.v1`.
 *
 * A real intake source knows its own reference material and the digest of that
 * material; it does not reach into the engine. This one carries a tiny catalog
 * of reference plates, digests them itself, and answers with an `image+brief`
 * Sculpt Intake. Everything it returns is re-validated by the caller against the
 * public Sculpt Intake contract, so nothing here is trusted on its word.
 */
import { createHash } from "node:crypto";

/** Reference plates this provider can speak for, keyed by intake identity. */
const PLATES = Object.freeze({
  "workshop-lantern": Object.freeze({
    mediaType: "image/png",
    uri: "asset://sceneaxi-demo/workshop-lantern/front.png",
    /** Bytes the provider vouches for; digested below, never asserted blind. */
    content: "sceneaxi demo plate: workshop lantern, front elevation",
    brief:
      "Hand-carried workshop lantern: iron cage, four glass panes, hinged top hatch.",
  }),
  "workshop-anvil": Object.freeze({
    mediaType: "image/png",
    uri: "asset://sceneaxi-demo/workshop-anvil/front.png",
    content: "sceneaxi demo plate: workshop anvil, front elevation",
    brief: "Squat single-horn anvil on a banded oak stump, waist height.",
  }),
});

const SUPPORTED_MODES = Object.freeze(["image+brief"]);

function digestOf(content) {
  return `sha256:${createHash("sha256").update(content, "utf8").digest("hex")}`;
}

function produceIntake(request) {
  if (request === null || typeof request !== "object") {
    return { ok: false, reason: "request-refused", message: "request must be an object." };
  }

  const { intakeId, mode } = request;
  if (!SUPPORTED_MODES.includes(mode)) {
    return {
      ok: false,
      reason: "unsupported-mode",
      message: `This provider only produces ${SUPPORTED_MODES.join(", ")} intakes.`,
    };
  }

  const plate = Object.hasOwn(PLATES, intakeId) ? PLATES[intakeId] : undefined;
  if (plate === undefined) {
    return {
      ok: false,
      reason: "request-refused",
      message: `No reference plate for intake "${intakeId}".`,
    };
  }

  return {
    ok: true,
    intake: {
      schemaVersion: 1,
      kind: "sceneaxi.sculpt-intake",
      intakeId,
      mode: "image+brief",
      image: {
        mediaType: plate.mediaType,
        uri: plate.uri,
        digest: digestOf(plate.content),
      },
      brief: plate.brief,
    },
  };
}

export const capabilities = Object.freeze({
  "sceneaxi.sculpt.intake-source.v1": Object.freeze({
    capabilityId: "sceneaxi.sculpt.intake-source.v1",
    contractVersion: "1.0.0",
    supportedModes: SUPPORTED_MODES,
    produceIntake,
  }),
});
