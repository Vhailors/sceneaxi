import { describe, expect, it } from "vitest";
import {
  STATE_PANEL_TONES,
  createStatePanelModel,
  statePanelElement,
} from "@sceneaxi/site-kit/state-panel";
import { el, renderSiteElementHtml } from "@sceneaxi/site-kit";

describe("shared state panel", () => {
  it.each([
    ["ok", "validated", "Validated"],
    ["warn", "needs-review", "Needs review"],
    ["deny", "refused", "Refused"],
    ["iso", "isolated", "Isolated"],
  ] as const)("maps %s onto the Foundations %s status", (tone, id, label) => {
    const model = createStatePanelModel({ tone, title: "State" });
    expect(model.status).toMatchObject({ id, label });
    expect(model.sectionClassName).toBe(`state state-${tone}`);
    expect(Object.isFrozen(model)).toBe(true);
  });

  it("publishes exactly the four site tones", () => {
    expect(STATE_PANEL_TONES).toEqual(["ok", "warn", "deny", "iso"]);
    expect(Object.isFrozen(STATE_PANEL_TONES)).toBe(true);
  });

  it("builds the compact storefront tree with the refusal in the open", () => {
    const html = renderSiteElementHtml(
      statePanelElement(
        { tone: "warn", title: "Held", reason: "CATALOG_COMMERCE_INERT" },
        [el("p", { text: "Evaluation only." })],
      ),
    );
    expect(html).toContain('<section class="state state-warn"><h3>Held</h3>');
    expect(html).toContain("Evaluation only.");
    expect(html).toContain('<code class="reason">');
    expect(html).toContain("CATALOG_COMMERCE_INERT");
  });

  it("builds the diagnostic tree with status, level, and evidence", () => {
    const model = createStatePanelModel({
      tone: "deny",
      title: "Session refused",
      level: 2,
      reason: "IDENTITY_SESSION_EXPIRED",
      evidence: [{ term: "plane", value: "identity" }],
      variant: "diagnostic",
    });
    expect(model.headingTag).toBe("h2");
    expect(Object.isFrozen(model.evidence)).toBe(true);
    expect(Object.isFrozen(model.evidence[0])).toBe(true);

    const html = renderSiteElementHtml(
      statePanelElement({
        tone: "deny",
        title: "Session refused",
        level: 2,
        reason: "IDENTITY_SESSION_EXPIRED",
        evidence: [{ term: "plane", value: "identity" }],
        variant: "diagnostic",
      }),
    );
    expect(html).toContain('class="chip chip-refused"');
    expect(html).toContain("Refused");
    expect(html).toContain("<h2>Session refused</h2>");
    expect(html).toContain('<dl class="dl state-evidence"><dt>plane</dt>');
  });
});
