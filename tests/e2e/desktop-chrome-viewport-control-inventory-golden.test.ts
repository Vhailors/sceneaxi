import { expect, it } from "vitest";
import { mountInventory } from "../helpers/desktop-chrome-golden.js";

it("mounts the viewport landmark with an explicit kind on every control", () => {
  const window = mountInventory();
  const region = window.document.querySelector(".viewport-region");
  expect(region).not.toBeNull();
  const controls = [...(region?.querySelectorAll("button, input, select, textarea") ?? [])];
  expect(controls.length).toBeGreaterThan(0);

  for (const control of controls) {
    expect(["view", "live", "inert"], control.id).toContain(control.getAttribute("data-kind"));
  }
});
