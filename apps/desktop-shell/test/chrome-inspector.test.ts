import { it } from "vitest";
import { regionControls } from "../../../tests/helpers/desktop-chrome-golden.js";

it("renders an inspector landmark whose controls all declare a kind", () => {
  regionControls(".inspector");
});
