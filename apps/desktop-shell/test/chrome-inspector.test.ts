import { it } from "vitest";
import { regionControls } from "./helpers/desktop-chrome-golden.js";

it("renders an inspector landmark whose controls all declare a kind", () => {
  regionControls(".inspector");
});
