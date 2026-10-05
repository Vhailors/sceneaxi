import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import DocsPage from "../src/app/docs/page.js";
import { REFUSAL_CODES } from "../src/index.js";

describe("docs page", () => {
  it("exposes navigable status and truthful legal/support unavailability", () => {
    const markup = renderToStaticMarkup(DocsPage());
    expect(markup).toContain('href="#service-status"');
    expect(markup).toContain('id="service-status"');
    expect(markup).toContain("Live service status is not available here");
    expect(markup).toContain("No verified support contact is published yet");
    expect(markup).toContain("This notice is not a legal policy or approval");
    expect(markup).not.toContain("All systems operational");
  });
  it("renders every public reconstruction refusal", () => {
    const markup = renderToStaticMarkup(DocsPage());

    for (const refusal of REFUSAL_CODES) {
      expect(markup).toContain(refusal.code);
      expect(markup).toContain(refusal.what);
    }
  });
});
