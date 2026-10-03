import { it } from "vitest";
import { regionControls } from "./helpers/desktop-chrome-golden.js";

it("renders settings forms whose controls all declare a kind", () => {
  regionControls(".editor-command-form");
});
