import { expect, it } from "vitest";
import { mountInventory } from "../helpers/desktop-chrome-golden.js";

it("mounts settings forms with an explicit kind on every control", () => {
  const window = mountInventory();
  const regions = [...window.document.querySelectorAll(".editor-command-form")];
  expect(regions.length).toBeGreaterThan(0);
  const controls = regions.flatMap((region) => [...region.querySelectorAll("button, input, select, textarea")]);
  expect(controls.length).toBeGreaterThan(0);

  for (const control of controls) {
    expect(["view", "live", "inert"], control.id).toContain(control.getAttribute("data-kind"));
  }
});
