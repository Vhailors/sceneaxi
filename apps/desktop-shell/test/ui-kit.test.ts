import { afterAll, afterEach, describe, expect, expectTypeOf, it } from "vitest";
import { Window } from "happy-dom";
import {
  AXIS_TEXT, DENSITY, RADIUS, SPACE,
  badge, cardHeader, chip, emptyState, iconButton, propertyRow,
  segmentedControl, splitter, tabs, uiKitStyles, vec3Row,
  type DesktopControl, type DesktopControlKind,
} from "@sceneaxi/desktop-shell";

const window = new Window();
const document = window.document;
afterEach(() => { document.body.innerHTML = ""; });
afterAll(() => { window.close(); });

function control(id: string, kind: DesktopControlKind = "view"): DesktopControl {
  return {
    id, label: `Label ${id}`, kind,
    refusal: kind === "inert" ? "DESKTOP_NO_DOCUMENT_BOUND" : null,
    refusalMessage: kind === "inert" ? "Open a project first." : null,
  };
}

const builders = [iconButton, segmentedControl, chip, badge, cardHeader, propertyRow, vec3Row, tabs, splitter, emptyState] as const;
const axes = ["x", "y", "z"] as const;

function samples(kind: DesktopControlKind): string[] {
  return [
    iconButton(control("move", kind), "move", "W"),
    segmentedControl(control("tools", kind), [
      { control: control("select", kind), selected: true, binding: "Q" },
      { control: control("rotate", kind), selected: false, binding: "E" },
    ]),
    chip(control("selection", kind), true),
    badge(control("count", kind), "3"),
    cardHeader(control("transform", kind), true, "transform-panel"),
    propertyRow(control("mass", kind), "1.5", "kg"),
    vec3Row(control("position", kind), [
      { control: control("position-x", kind), value: 1 },
      { control: control("position-y", kind), value: 2 },
      { control: control("position-z", kind), value: 3 },
    ], "m"),
    tabs(control("views", kind), [
      { control: control("scene", kind), panelId: "scene-panel", selected: true, binding: null },
      { control: control("game", kind), panelId: "game-panel", selected: false, binding: null },
    ]),
    splitter(control("resize", kind), { orientation: "vertical", panelId: "inspector", min: 280, max: 560, value: 320 }),
    emptyState(control("empty", kind), "No scene open", chip(control("open", kind))),
  ];
}

describe("desktop shared controls", () => {
  it("requires a modelled control kind at every builder boundary", () => {
    for (const builder of builders) {
      expectTypeOf(builder).parameter(0).toEqualTypeOf<DesktopControl>();
      expectTypeOf<Pick<Parameters<typeof builder>[0], "kind">>().toEqualTypeOf<{ readonly kind: DesktopControlKind }>();
    }
    for (const kind of ["view", "live", "inert"] as const) {
      for (const markup of samples(kind)) {
        document.body.innerHTML = markup;
        expect(document.querySelector("[data-kind]")?.getAttribute("data-kind")).toBe(kind);
        for (const element of document.querySelectorAll("button,input,[tabindex]")) {
          expect(element.id).not.toBe("");
          expect(element.getAttribute("data-kind")).toBe(kind);
        }
      }
    }
  });

  it("keeps inert controls focusable, describes their refusal, and makes fields read-only", () => {
    document.body.innerHTML = samples("inert").join("");
    for (const element of document.querySelectorAll("button,input,[role=separator]")) {
      expect(element.hasAttribute("disabled")).toBe(false);
      expect(element.getAttribute("aria-disabled")).toBe("true");
      expect(element.getAttribute("data-refusal")).toBe("DESKTOP_NO_DOCUMENT_BOUND");
      const description = document.getElementById(element.getAttribute("aria-describedby") ?? "");
      expect(description?.textContent).toContain("DESKTOP_NO_DOCUMENT_BOUND");
      expect(description?.textContent).toContain(control("ignored", "inert").refusalMessage);
    }
    for (const input of document.querySelectorAll("input")) expect(input.readOnly).toBe(true);
    const ids = [...document.querySelectorAll("[id]")].map((element) => element.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("gives icon buttons accessible names and binding tooltips even when refused", () => {
    for (const kind of ["view", "live", "inert"] as const) {
      const ctrl = control("move", kind);
      document.body.innerHTML = iconButton(ctrl, "move", "W", true);
      const button = document.querySelector("button");
      expect(button?.getAttribute("aria-label")).toBe(ctrl.label);
      expect(button?.getAttribute("title")).toContain(`${ctrl.label} (W)`);
      expect(button?.getAttribute("aria-pressed")).toBe("true");
      expect(document.getElementById(button?.getAttribute("aria-describedby") ?? "")?.textContent).toContain(`${ctrl.label} (W)`);
      expect(document.querySelector("use")?.getAttribute("href")).toBe("#i-move");
      expect(document.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    }
    document.body.innerHTML = iconButton(control("plus"), "plus", null);
    expect(document.querySelector("button")?.getAttribute("title")).toBe(control("plus").label);
    expect(document.querySelector("button")?.hasAttribute("aria-pressed")).toBe(false);
  });

  it("renders selected segments, tabs, disclosure and splitter state without inventing behavior", () => {
    document.body.innerHTML = samples("view").join("");
    expect(document.querySelector("#tools")?.getAttribute("role")).toBe("group");
    expect(document.querySelector("#select")?.getAttribute("aria-pressed")).toBe("true");
    expect(document.querySelector("#rotate")?.getAttribute("aria-pressed")).toBe("false");
    expect(document.querySelector("#select")?.getAttribute("title")).toContain("(Q)");
    expect(document.querySelector("#views")?.getAttribute("role")).toBe("tablist");
    expect(document.querySelector("#scene")?.getAttribute("aria-selected")).toBe("true");
    expect(document.querySelector("#game")?.getAttribute("aria-selected")).toBe("false");
    expect(document.querySelector("#scene")?.getAttribute("aria-controls")).toBe("scene-panel");
    expect(document.querySelector("#scene")?.getAttribute("tabindex")).toBe("0");
    expect(document.querySelector("#game")?.getAttribute("tabindex")).toBe("-1");
    expect(document.querySelector("#transform")?.getAttribute("aria-expanded")).toBe("true");
    expect(document.querySelector("#transform")?.getAttribute("aria-controls")).toBe("transform-panel");
    const handle = document.querySelector("#resize");
    for (const [name, value] of Object.entries({ role: "separator", tabindex: "0", "aria-orientation": "vertical", "aria-controls": "inspector", "aria-valuemin": "280", "aria-valuemax": "560", "aria-valuenow": "320" })) {
      expect(handle?.getAttribute(name)).toBe(value);
    }
    expect(document.querySelector("#empty #open")?.getAttribute("data-kind")).toBe("view");
    expect(document.querySelector("script,[onclick],[onkeydown]")).toBeNull();
  });

  it("labels scalar and vec3 fields with their model identities, axes and unit suffixes", () => {
    for (const unit of ["m", "\u00b0", "\u00d7"]) {
      const fields = [
        { control: control("position-x", "live"), value: -1 },
        { control: control("position-y", "live"), value: 0 },
        { control: control("position-z", "live"), value: 1 },
      ] as const;
      document.body.innerHTML = vec3Row(control("position"), fields, unit);
      expect([...document.querySelectorAll(".ui-axis")].map((element) => element.textContent)).toEqual([...axes]);
      for (const [index, input] of [...document.querySelectorAll("input")].entries()) {
        expect(input.id).toBe(fields[index]?.control.id);
        expect(input.type).toBe("number");
        expect(input.value).toBe(String(index - 1));
        expect(input.getAttribute("step")).toBe("any");
        expect(input.getAttribute("aria-label")).toBe(`${fields[index]?.control.label} (${unit})`);
      }
      expect(document.querySelector(".ui-unit")?.textContent).toBe(unit);
    }
    document.body.innerHTML = propertyRow(control("name"), "Crate");
    expect(document.querySelector("label")?.htmlFor).toBe("name");
    expect(document.querySelector("input")?.value).toBe("Crate");
  });

  it("escapes user text and attributes but preserves explicitly trusted action markup", () => {
    const hostile = '"><img src=x onerror="bad()"> & \'unsafe\'';
    const ctrl = { ...control(hostile, "inert"), label: hostile, refusalMessage: hostile };
    document.body.innerHTML = iconButton(ctrl, "move", hostile) + propertyRow(control("field"), hostile, hostile) + emptyState(control("empty"), hostile, chip(control("action")));
    expect(document.querySelector("img,[onerror]")).toBeNull();
    expect(document.getElementById(hostile)?.getAttribute("aria-label")).toBe(hostile);
    expect(document.querySelector("input")?.value).toBe(hostile);
    expect(document.querySelector(".ui-unit")?.textContent).toBe(hostile);
    expect(document.querySelector("#empty #action")).not.toBeNull();
  });
});

describe("desktop shared control styles", () => {
  it("uses only declared spacing variables and radius variables", () => {
    const css = uiKitStyles();
    const radii = [...css.matchAll(/border-radius\s*:\s*([^;}]+)/g)];
    const spacing = [...css.matchAll(/(?:^|[;{])\s*(?:padding|gap|margin)(?:-[a-z]+)?\s*:\s*([^;}]+)/g)];
    expect(radii.length).toBeGreaterThan(0);
    expect(spacing.length).toBeGreaterThan(0);
    for (const [, value] of radii) expect(value).toMatch(/^var\(--r-(xs|sm|md|lg|pill)\)$/);
    for (const [, value] of spacing) expect(value).toMatch(/^(?:var\(--space-[1-68]\)|calc\(var\(--space-1\) \* 0\))(?: var\(--space-[1-68]\))*$/);
    for (const [name, value] of Object.entries(SPACE)) expect(css).toContain(`--space-${name}:${value}px`);
    for (const [name, value] of Object.entries(RADIUS)) expect(css).toContain(`--r-${name}:${value}px`);
  });

  it("uses contrast-gated axis text, density metrics and focus paint without opacity", () => {
    const css = uiKitStyles();
    for (const axis of axes) expect(css).toContain(`.ui-axis-${axis}{color:${AXIS_TEXT[axis]}}`);
    for (const density of Object.values(DENSITY)) {
      expect(css).toContain(`--ui-control:${density.control}px`);
      expect(css).toContain(`--ui-icon:${density.toolbarIcon}px`);
      expect(css).toContain(`--ui-body:${density.body}px`);
    }
    expect(css).toContain('.shell[data-density="compact"]');
    expect(css).toContain(":focus-visible");
    expect(css).toContain("outline-offset:2px");
    expect(css).toContain("outline-offset:-2px");
    expect(css).not.toMatch(/opacity\s*:|rgba?\(|https?:|@import|@font-face/);
    for (const [, size] of css.matchAll(/font-size:(\d+)px/g)) expect(Number(size)).toBeGreaterThanOrEqual(11);
  });
});
