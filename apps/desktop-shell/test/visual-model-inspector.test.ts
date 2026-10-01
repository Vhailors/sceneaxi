import { describe, expect, it } from "vitest";
import {
  DESKTOP_VISUAL_REFUSALS,
  createDesktopVisualState,
  desktopVisualView,
} from "@sceneaxi/desktop-shell";

describe("desktop visual model — Run and scene catalogs", () => {
  it("declares live desktop-control actions for Run and catalog inspection/staging", () => {
    const view = desktopVisualView(createDesktopVisualState());
    expect([view.product.runStop, view.product.runReset].map(({ id, kind }) => [id, kind])).toEqual([
      ["run-stop", "live"],
      ["run-reset", "live"],
    ]);
    expect(view.product.inspectors.map(({ kind, inspect, mutation, stage, inspectCommand, applyCommand }) => [
      kind, inspect.id, inspect.kind, mutation.id, mutation.kind, stage.id, stage.kind, inspectCommand, applyCommand,
    ])).toEqual([
      ["physics", "physics-inspect", "live", "physics-mutation", "live", "physics-stage", "live", "physics-inspect", "physics-apply"],
      ["environment", "environment-inspect", "live", "environment-mutation", "live", "environment-stage", "live", "environment-inspect", "environment-apply"],
      ["material", "material-inspect", "live", "material-mutation", "live", "material-stage", "live", "material-inspect", "material-apply"],
      ["effect", "effect-inspect", "live", "effect-mutation", "live", "effect-stage", "live", "effect-inspect", "effect-apply"],
    ]);
  });

  it("names the Kids refusal on every new Run and catalog action", () => {
    const product = desktopVisualView(createDesktopVisualState({ profile: "kids" })).product;
    expect([product.runStop, product.runReset, ...product.inspectors.flatMap(({ inspect, mutation, stage }) => [inspect, mutation, stage])]
      .every((control) => control.kind === "inert" && control.refusal === DESKTOP_VISUAL_REFUSALS.kidsRefuseOnly)).toBe(true);
  });
});
