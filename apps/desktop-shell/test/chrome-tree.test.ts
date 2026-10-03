import { it } from "vitest";
import { regionControls } from "./helpers/desktop-chrome-golden.js";

it("renders a tree landmark whose controls all declare a kind", () => {
  regionControls(".left-dock");
});
