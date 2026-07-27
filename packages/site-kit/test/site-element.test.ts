/**
 * The framework-neutral element tree.
 *
 * Small surface, one load-bearing property: nothing a view model carries — a
 * document path, a JSON Pointer, a proposed value — can reach a page as markup.
 */
import { describe, expect, it } from "vitest";
import { el, escapeHtml, renderSiteElementHtml } from "@sceneaxi/site-kit";

describe("site element tree", () => {
  it("freezes what it builds", () => {
    const element = el("div", { className: "a" }, [el("span", { text: "b" })]);
    expect(Object.isFrozen(element)).toBe(true);
    expect(Object.isFrozen(element.children)).toBe(true);
    expect(Object.isFrozen(element.attributes)).toBe(true);
  });

  it("defaults to a childless, textless, classless element", () => {
    const element = el("div");
    expect(element).toEqual({
      tag: "div",
      className: null,
      attributes: {},
      text: null,
      children: [],
    });
  });

  it("renders classes, attributes, text, and nesting", () => {
    const html = renderSiteElementHtml(
      el("section", { className: "panel", attributes: { role: "table" } }, [
        el("span", { text: "hello" }),
      ]),
    );
    expect(html).toBe('<section class="panel" role="table"><span>hello</span></section>');
  });

  it("escapes text and attribute values", () => {
    const html = renderSiteElementHtml(
      el("div", { attributes: { "aria-label": 'a "quoted" & <angled>' }, text: "<b>x</b>" }),
    );
    expect(html).toBe(
      '<div aria-label="a &quot;quoted&quot; &amp; &lt;angled&gt;">&lt;b&gt;x&lt;/b&gt;</div>',
    );
  });

  it("escapes the five characters that can break out of markup", () => {
    expect(escapeHtml(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&#39;");
  });

  it("drops an attribute name that escaping could not make safe", () => {
    const element = el("div", {
      attributes: { 'x" onmouseover="alert(1)': "y", "data-sx-row": "0", "aria-hidden": "true" },
    });
    expect(element.attributes).toEqual({ "data-sx-row": "0", "aria-hidden": "true" });
    expect(renderSiteElementHtml(element)).toBe('<div data-sx-row="0" aria-hidden="true"></div>');
  });

  it("refuses a tag name that escaping could not make safe", () => {
    expect(() => el('div onload="alert(1)"')).toThrow(/Invalid SiteElement tag name/);
    expect(() => el("")).toThrow(/Invalid SiteElement tag name/);
    expect(() => el("sx-change-review")).not.toThrow();
  });

  it("does not close a void element", () => {
    expect(renderSiteElementHtml(el("br"))).toBe("<br>");
    expect(renderSiteElementHtml(el("img", { attributes: { alt: "" } }))).toBe('<img alt="">');
  });

  it("prefers text over children when both are supplied", () => {
    const html = renderSiteElementHtml(el("p", { text: "leaf" }, [el("span", { text: "ignored" })]));
    expect(html).toBe("<p>leaf</p>");
  });
});
