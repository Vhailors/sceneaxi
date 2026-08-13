import { describe, expect, it } from "vitest";
import {
  EXTENSION_SEAM_CAPABILITY_IDS,
  EXTENSION_SEAM_IDS,
  EXTENSION_SEAM_REFUSALS,
  inspectExtensionSeams,
  refuseUndeclaredExtensionGrant,
  startExtensionSeam,
} from "@sceneaxi/schemas";

describe("desktop extension seams", () => {
  it("declares the four advanced capabilities as disabled without starting them", () => {
    const inspected = inspectExtensionSeams({ profile: "game" });
    expect(inspected).toMatchObject({
      ok: true,
      seams: EXTENSION_SEAM_IDS.map((id) => ({
        id,
        capabilityId: EXTENSION_SEAM_CAPABILITY_IDS[id],
        status: "disabled",
        reason: EXTENSION_SEAM_REFUSALS.adapterAbsent,
        startsListener: false,
        startsSession: false,
        startsTransaction: false,
        startsChannel: false,
        adapterIssueRequired: true,
      })),
    });
  });

  it("refuses Kids and undeclared package grants", () => {
    expect(inspectExtensionSeams({ profile: "kids" })).toMatchObject({
      ok: false,
      reason: EXTENSION_SEAM_REFUSALS.kidsDenied,
    });
    expect(refuseUndeclaredExtensionGrant("sceneaxi.networking.v1")).toMatchObject({
      ok: false,
      reason: EXTENSION_SEAM_REFUSALS.undeclaredGrant,
    });
    expect(startExtensionSeam({ profile: "game", seamId: "networking" })).toMatchObject({
      ok: false,
      reason: EXTENSION_SEAM_REFUSALS.adapterAbsent,
    });
  });
});
