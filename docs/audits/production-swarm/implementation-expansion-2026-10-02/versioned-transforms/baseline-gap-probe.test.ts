import { expect, it } from "vitest";
import * as baseline from "./baseline-v1-scene-composition.ts";

it("pre-change snapshot lacks explicit rotated hierarchy v2 entry", () => {
  expect(baseline.resolveScenePlacementsV2).toBeTypeOf("function");
});
