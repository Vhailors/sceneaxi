import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import DocsPage from "../src/app/docs/page.js";
import { REFUSAL_CODES } from "../src/index.js";

describe("docs page", () => {
  it("renders every public reconstruction refusal", () => {
    const markup = renderToStaticMarkup(DocsPage());
    for (const refusal of REFUSAL_CODES) {
      expect(markup).toContain(refusal.code);
      expect(markup).toContain(refusal.what);
    }
  });
});
