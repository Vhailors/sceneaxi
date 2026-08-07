import { describe, expect, it } from "vitest";
import {
  ACCENT,
  DESKTOP_DOCK_TAB_IDS,
  WINDOW_TIERS,
  createDesktopVisualState,
  desktopVisualView,
  renderDesktopChrome,
  resolveWindowTier,
  type DesktopControl,
  type DesktopVisualState,
  type DesktopVisualView,
  type DesktopWindowSize,
} from "@sceneaxi/desktop-shell";

/**
 * The executable form of the model/renderer contract.
 *
 * `visual-model.ts` decides and `chrome.ts` draws, but until this file nothing
 * *enforced* that split, so review round after review round found the next call
 * site where it had quietly been broken: a control the model built and the
 * renderer never drew, a button the renderer drew that no control accounted for,
 * a named refusal the stylesheet hid at a window size nobody had rendered at,
 * and a control declaring itself live over a region its own profile removes.
 *
 * The properties below close that class rather than those instances:
 *
 * 1. Every control the view can produce is rendered, with the kind it declares,
 *    and `view.controls` is exactly the set the view holds. The enumeration is
 *    derived by walking the view, so a newly modelled control is covered the
 *    moment it exists — there is no list here to forget.
 * 2. Every interactive element in the document came from `button(control, …)`,
 *    which is the only thing that emits the id and `data-kind` pair, and every
 *    such id is one the model minted.
 * 3. Every named refusal is reachable at every window tier, resolved through the
 *    emitted stylesheet's own cascade rather than by reading an attribute.
 * 4. A control's declared kind tells the truth: nothing declares itself live
 *    over a region this profile keeps shut, and the assistant toggle never
 *    claims a column the viewport it is opened at does not show.
 *
 * What it does **not** cover, stated so the claim is not read wider than it is:
 * markup a renderer conditions on a control's kind *at render time*. Property 4
 * probes `aria-controls` targets, so an attribute a row is given only while its
 * control happens to be live — and which the browser-side switch cannot add back
 * when it promotes that control — is outside every probe here. Nothing else in
 * this file reaches it either.
 */

const render = (state: DesktopVisualState): string =>
  renderDesktopChrome(desktopVisualView(state));

/* -------------------------------------------------------------------------- */
/* Modelled controls                                                           */
/* -------------------------------------------------------------------------- */

const CONTROL_KINDS: ReadonlySet<string> = new Set([
  "view",
  "review",
  "live",
  "inert",
]);

/**
 * The two subtrees the walk deliberately skips.
 *
 * Each profile chip carries the assistant projection that profile *would* get,
 * which the renderer serializes into the script's switch table instead of
 * drawing; those controls reuse the active column's ids with a different kind,
 * so requiring them here would demand two elements with one id. And
 * `view.controls` is the mint's own index of everything below it — walking it
 * would make the index-vs-tree comparison compare a set with itself.
 */
const NOT_RENDERED = [/^profiles\[\d+\]\.assistant(\.|$)/, /^controls(\[|$)/];

const isControl = (value: unknown): value is DesktopControl => {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate["id"] === "string" &&
    typeof candidate["label"] === "string" &&
    typeof candidate["kind"] === "string" &&
    CONTROL_KINDS.has(candidate["kind"]) &&
    "refusal" in candidate &&
    "refusalMessage" in candidate
  );
};

/** A control's identity for set comparison: neither part can contain a pipe. */
const key = (control: DesktopControl): string => `${control.id}|${control.kind}`;

function collectControls(
  node: unknown,
  path = "",
  found: Map<string, DesktopControl> = new Map(),
): Map<string, DesktopControl> {
  if (NOT_RENDERED.some((pattern) => pattern.test(path))) return found;
  if (isControl(node)) {
    found.set(key(node), node);
    return found;
  }
  if (Array.isArray(node)) {
    node.forEach((item, index) => collectControls(item, `${path}[${index}]`, found));
    return found;
  }
  if (typeof node === "object" && node !== null) {
    for (const [field, value] of Object.entries(node)) {
      collectControls(value, path === "" ? field : `${path}.${field}`, found);
    }
  }
  return found;
}

const STATES: ReadonlyArray<readonly [string, DesktopVisualState]> = [
  ["default", createDesktopVisualState()],
  ["assistant:runtime", createDesktopVisualState({ assistantRuntime: "local" })],
  [
    "assistant:runtime-kids",
    createDesktopVisualState({ assistantRuntime: "local", profile: "kids" }),
  ],
  ["profile:kids", createDesktopVisualState({ profile: "kids" })],
  ["profile:web", createDesktopVisualState({ profile: "web" })],
  ["mode:run", createDesktopVisualState({ mode: "run" })],
  ["mode:animate", createDesktopVisualState({ mode: "animate" })],
  ["mode:ship", createDesktopVisualState({ mode: "ship" })],
  ["overlay:palette", createDesktopVisualState({ overlay: "palette" })],
  ["overlay:refused", createDesktopVisualState({ overlay: "refused" })],
  ["overlay:conflict", createDesktopVisualState({ overlay: "conflict" })],
  ["assistant:closed", createDesktopVisualState({ assistant: "closed" })],
  ["assistant:thinking", createDesktopVisualState({ assistantThinking: true })],
  ["sculpt:idle", createDesktopVisualState({ mode: "sculpt" })],
  ["sculpt:running", createDesktopVisualState({ mode: "sculpt", sculpt: "running" })],
  ["tier:compact", createDesktopVisualState({ window: { width: 1280, height: 800 } })],
  ["tier:narrow", createDesktopVisualState({ window: { width: 1000, height: 700 } })],
  [
    "kids:narrow",
    createDesktopVisualState({ profile: "kids", window: { width: 1024, height: 700 } }),
  ],
  [
    "kids:wide-but-short",
    createDesktopVisualState({ profile: "kids", window: { width: 1920, height: 620 } }),
  ],
  ["tier:minimum", createDesktopVisualState({ window: { width: 800, height: 560 } })],
];

describe("engine desktop chrome — control accounting (model → document)", () => {
  it("indexes exactly the controls the view holds", () => {
    // `view.controls` is what the renderer serializes for the browser-side
    // profile switch, so an index that is a subset of the view is a control the
    // switch would silently skip.
    for (const [label, state] of STATES) {
      const view = desktopVisualView(state);
      const walked = new Set([...collectControls(view).keys()]);
      const indexed = new Set(view.controls.map(key));
      expect(indexed.size, label).toBe(view.controls.length);
      expect([...indexed].sort(), label).toEqual([...walked].sort());
    }
  });

  it("renders every control the view builds, with the kind it declares", () => {
    for (const [label, state] of STATES) {
      const view: DesktopVisualView = desktopVisualView(state);
      const html = renderDesktopChrome(view);
      const controls = [...collectControls(view).values()];
      expect(controls.length, label).toBeGreaterThan(0);
      for (const control of controls) {
        expect(html, `${label} ${control.id}`).toContain(
          `id="${control.id}" data-kind="${control.kind}"`,
        );
      }
    }
  });

  it("keeps an inert control's reason resolvable wherever it is rendered", () => {
    for (const [label, state] of STATES) {
      const view = desktopVisualView(state);
      const html = renderDesktopChrome(view);
      for (const control of collectControls(view).values()) {
        if (control.kind !== "inert") {
          expect(control.refusal, `${label} ${control.id}`).toBeNull();
          continue;
        }
        expect(html, `${label} ${control.id}`).toContain(
          `id="${control.id}" data-kind="inert" aria-disabled="true" data-refusal="${control.refusal}"`,
        );
        expect(html, `${label} ${control.id}`).toContain(
          `id="refusal-${control.refusal}"`,
        );
      }
    }
  });
});

describe("engine desktop chrome — control accounting (document → model)", () => {
  it("routes every action button through the one button helper", () => {
    for (const [label, state] of STATES) {
      const html = render(state);
      const buttons = [...html.matchAll(/<button\b[^>]*>/g)].map(([tag]) => tag);
      expect(buttons.length, label).toBeGreaterThan(0);
      for (const tag of buttons) {
        // `button(control, …)` is the only thing that emits this pair, so a raw
        // `<button>` written into the markup fails here rather than at review.
        expect(tag, `${label} ${tag}`).toMatch(/\sid="[^"]+"\sdata-kind="(view|review|live|inert)"/);
      }
    }
  });

  it("mints every rendered control id in the model", () => {
    for (const [label, state] of STATES) {
      const view = desktopVisualView(state);
      const html = renderDesktopChrome(view);
      const modelled = new Set(
        [...collectControls(view).values()].map((control) => control.id),
      );
      for (const [tag] of html.matchAll(/<button\b[^>]*>/g)) {
        const id = /\sid="([^"]+)"/.exec(tag)?.[1] ?? "";
        expect(modelled.has(id), `${label} ${id}`).toBe(true);
      }
    }
  });

  it("adds no interactive element the button helper cannot own", () => {
    for (const [label, state] of STATES) {
      const html = render(state);
      expect(html, label).not.toMatch(/<(a|details|summary)\b/i);
      const inputs = html.match(/<input\b[^>]*>/g) ?? [];
      expect(inputs, label).toHaveLength(1);
      expect(inputs[0], label).toMatch(
        /id="scene-property-translation-x" data-kind="(live|inert)"/,
      );
      const selects = html.match(/<select\b[^>]*>/g) ?? [];
      expect(selects, label).toHaveLength(1);
      expect(selects[0], label).toMatch(
        /id="project-recent-select" data-kind="(view|inert)"/,
      );
      const textareas = html.match(/<textarea\b[^>]*>/g) ?? [];
      expect(textareas, label).toHaveLength(1);
      expect(textareas[0], label).toMatch(
        /id="assistant-prompt" data-kind="(live|inert)"/,
      );
      expect(html, label).not.toMatch(/\son[a-z]+=/i);
      // A focus stop outside a <button> would be an interactive element with no
      // control behind it; the tabs' roving `tabindex` sits on buttons.
      for (const [tag] of html.matchAll(/<[a-z][^>]*\stabindex="[^"]*"[^>]*>/gi)) {
        expect(tag, `${label} ${tag}`).toMatch(/^<(button|input|textarea|select)\b/);
      }
    }
  });
});

/* -------------------------------------------------------------------------- */
/* Stylesheet cascade                                                          */
/* -------------------------------------------------------------------------- */

type StyleRule = Readonly<{
  selector: string;
  body: string;
  media: string | null;
  order: number;
}>;

type VirtualElement = Readonly<{
  classes: ReadonlySet<string>;
  attributes: Readonly<Record<string, string>>;
}>;

function parseRules(css: string, media: string | null, sink: StyleRule[]): void {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, "");
  let index = 0;
  while (index < clean.length) {
    const brace = clean.indexOf("{", index);
    if (brace === -1) break;
    const prelude = clean.slice(index, brace).trim();
    let depth = 0;
    let end = brace;
    for (; end < clean.length; end++) {
      if (clean[end] === "{") depth += 1;
      else if (clean[end] === "}") {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    const body = clean.slice(brace + 1, end);
    index = end + 1;
    if (prelude.startsWith("@keyframes")) continue;
    if (prelude.startsWith("@media")) {
      const condition = prelude.slice("@media".length).trim();
      parseRules(body, media === null ? condition : `${media} and ${condition}`, sink);
      continue;
    }
    if (prelude.startsWith("@")) continue;
    sink.push({ selector: prelude, body, media, order: sink.length });
  }
}

/** Evaluate one `@media` condition list against a viewport. Comma is OR. */
function mediaApplies(condition: string | null, size: DesktopWindowSize): boolean {
  if (condition === null) return true;
  return condition.split(",").some((clause) =>
    clause.split(/\band\b/).every((term) => {
      const bound = /\((max|min)-(width|height):(\d+)px\)/.exec(term);
      // Anything else (prefers-reduced-motion) is not a size condition and is
      // treated as not applying, which is what a default browser reports.
      if (bound === null) return false;
      const measured = bound[2] === "width" ? size.width : size.height;
      const limit = Number(bound[3]);
      return bound[1] === "max" ? measured <= limit : measured >= limit;
    }),
  );
}

/** Split one compound selector into its `.class`, `[attr]`, and `:not()` parts. */
function splitCompound(compound: string): string[] {
  const parts: string[] = [];
  let current = "";
  let depth = 0;
  for (const char of compound) {
    if (char === "(") depth += 1;
    if (char === ")") depth -= 1;
    if (depth === 0 && (char === "." || char === "[" || char === ":") && current !== "") {
      parts.push(current);
      current = char;
      continue;
    }
    current += char;
  }
  if (current !== "") parts.push(current);
  return parts;
}

function matchesCompound(compound: string, element: VirtualElement): boolean {
  return splitCompound(compound).every((part) => {
    if (part.startsWith(".")) return element.classes.has(part.slice(1));
    if (part.startsWith(":not(")) {
      return !matchesCompound(part.slice(5, -1), element);
    }
    if (part.startsWith("[")) {
      const pair = /^\[([\w-]+)(?:=["']?([^"'\]]*)["']?)?\]$/.exec(part);
      if (pair === null) throw new Error(`unsupported attribute selector: ${part}`);
      const name = pair[1] ?? "";
      const value = pair[2];
      if (value === undefined) return name in element.attributes;
      return element.attributes[name] === value;
    }
    if (part.startsWith(":")) return false;
    // A type selector: the virtual tree carries no tag names, so nothing matches.
    return false;
  });
}

function specificity(selector: string): number {
  const parts = selector
    .trim()
    .split(/\s+/)
    .flatMap((compound) => splitCompound(compound));
  let score = 0;
  for (const part of parts) {
    if (part.startsWith(":not(")) score += specificity(part.slice(5, -1));
    else if (part.startsWith(".") || part.startsWith("[") || part.startsWith(":")) score += 1;
  }
  return score;
}

/**
 * Does `selector` match `chain[chain.length - 1]`, given its ancestors?
 *
 * Descendant combinators only — which is every selector in this sheet.
 */
function matchesChain(selector: string, chain: ReadonlyArray<VirtualElement>): boolean {
  const compounds = selector.trim().split(/\s+/);
  const last = chain[chain.length - 1];
  if (last === undefined) return false;
  const target = compounds[compounds.length - 1];
  if (target === undefined || !matchesCompound(target, last)) return false;
  let remaining = compounds.slice(0, -1);
  for (let i = chain.length - 2; i >= 0 && remaining.length > 0; i -= 1) {
    const ancestor = chain[i];
    const candidate = remaining[remaining.length - 1];
    if (ancestor !== undefined && candidate !== undefined && matchesCompound(candidate, ancestor)) {
      remaining = remaining.slice(0, -1);
    }
  }
  return remaining.length === 0;
}

/** The winning value of one property, or `""` when the sheet sets none. */
function computedValue(
  rules: ReadonlyArray<StyleRule>,
  chain: ReadonlyArray<VirtualElement>,
  size: DesktopWindowSize,
  property: string,
): string {
  const declaration = new RegExp(`(?:^|;)\\s*${property}:([^;]+)`);
  let winner = "";
  let bestScore = -1;
  let bestOrder = -1;
  let important = false;
  for (const rule of rules) {
    if (!mediaApplies(rule.media, size)) continue;
    const found = declaration.exec(rule.body);
    if (found === null) continue;
    const value = (found[1] ?? "").trim();
    const isImportant = value.endsWith("!important");
    for (const selector of rule.selector.split(",")) {
      if (!matchesChain(selector, chain)) continue;
      const score = specificity(selector);
      const wins = important && !isImportant
        ? false
        : (!important && isImportant) ||
          score > bestScore ||
          (score === bestScore && rule.order > bestOrder);
      if (!wins) continue;
      winner = value.replace("!important", "").trim();
      bestScore = score;
      bestOrder = rule.order;
      important = isImportant;
    }
  }
  return winner;
}

const computedDisplay = (
  rules: ReadonlyArray<StyleRule>,
  chain: ReadonlyArray<VirtualElement>,
  size: DesktopWindowSize,
): string => computedValue(rules, chain, size, "display");

const stylesheet = (html: string): StyleRule[] => {
  const css = /<style>([\s\S]*?)<\/style>/.exec(html)?.[1] ?? "";
  expect(css.length).toBeGreaterThan(0);
  const rules: StyleRule[] = [];
  parseRules(css, null, rules);
  return rules;
};

const element = (
  className: string,
  attributes: Readonly<Record<string, string>> = {},
): VirtualElement => ({ classes: new Set([className]), attributes });

const shellElement = (html: string): VirtualElement => {
  const tag = /<div class="shell"[^>]*>/.exec(html)?.[0] ?? "";
  const attributes: Record<string, string> = {};
  for (const [, name, value] of tag.matchAll(/\s(data-[\w-]+)="([^"]*)"/g)) {
    attributes[name ?? ""] = value ?? "";
  }
  return { classes: new Set(["shell"]), attributes };
};

const body: VirtualElement = { classes: new Set(), attributes: {} };

/** One size on each tier boundary, plus a wide-but-short one on each. */
const TIER_SIZES: ReadonlyArray<readonly [string, DesktopWindowSize]> =
  WINDOW_TIERS.filter((tier) => tier.id !== "minimum").flatMap((tier) => [
    [`${tier.id} at its boundary`, { width: tier.minWidth, height: tier.minHeight }] as const,
    [`${tier.id} wide but short`, { width: 1920, height: tier.minHeight }] as const,
  ]);

const REGULAR = WINDOW_TIERS.find((tier) => tier.id === "regular");

describe("engine desktop chrome — refusal reachability at every tier", () => {
  it("resolves a hidden region as hidden, so the check is not vacuous", () => {
    // The docked assistant on a non-refusing profile is exactly what the drawer
    // gate hides below the regular tier. If this ever reported `flex`, every
    // assertion below would be meaningless.
    const compact = { width: 1280, height: 800 };
    const drawer = render(createDesktopVisualState({ window: compact }));
    expect(
      computedDisplay(stylesheet(drawer), [body, shellElement(drawer), element("assistant")], compact),
    ).toBe("none");

    const regular = { width: 1680, height: 1000 };
    const docked = render(createDesktopVisualState({ window: regular }));
    expect(
      computedDisplay(stylesheet(docked), [body, shellElement(docked), element("assistant")], regular),
    ).toBe("flex");
  });

  it("keeps the Kids lock screen and refusal region on screen at every tier", () => {
    for (const [label, size] of TIER_SIZES) {
      const state = createDesktopVisualState({ profile: "kids", window: size });
      expect(resolveWindowTier(size), label).not.toBe("minimum");
      const html = render(state);
      const rules = stylesheet(html);
      const shell = shellElement(html);
      expect(shell.attributes["data-assistant"], label).toBe("denied");

      const assistant = element("assistant");
      expect(computedDisplay(rules, [body, shell], size), `${label} shell`).not.toBe("none");
      expect(
        computedDisplay(rules, [body, shell, element("profile-refusal")], size),
        `${label} profile-refusal`,
      ).not.toBe("none");
      expect(
        computedDisplay(rules, [body, shell, assistant], size),
        `${label} assistant`,
      ).not.toBe("none");
      expect(
        computedDisplay(rules, [body, shell, assistant, element("assistant-denied")], size),
        `${label} assistant-denied`,
      ).not.toBe("none");
      // And the panel's own named refusal is in those bytes.
      expect(html, label).toContain("THIRD_PARTY_LLM_DENIED_BY_DEFAULT");
    }
  });

  it("keeps the product loop's own status on screen at every tier", () => {
    // Open, Save, Stage, and Play all refuse by writing the product status. The
    // title centre is display:none below the compact tier and the left dock is a
    // closed drawer there, so those two alone would leave a refusal unreadable at
    // 1000x700 and at the 900x600 minimum — both in the recorded browser
    // evidence. The status bar is the region no tier removes.
    for (const [label, size] of TIER_SIZES) {
      for (const profile of ["game", "web", "kids"] as const) {
        const state = createDesktopVisualState({ profile, window: size });
        const html = render(state);
        const rules = stylesheet(html);
        const shell = shellElement(html);
        const chain = [body, shell, element("status-bar"), element("status-project")];
        expect(
          computedDisplay(rules, chain, size),
          `${label} ${profile} status-project`,
        ).not.toBe("none");
        expect(html, `${label} ${profile}`).toContain(
          'class="status-project" data-project-status aria-live="polite"',
        );
      }
    }
  });

  it("refuses the whole chrome below the minimum, and shows that refusal", () => {
    const size = { width: 800, height: 560 };
    const html = render(createDesktopVisualState({ window: size }));
    const rules = stylesheet(html);
    const shell = shellElement(html);
    expect(computedDisplay(rules, [body, shell], size)).toBe("none");
    expect(computedDisplay(rules, [body, element("window-refusal")], size)).toBe("block");
  });
});

/* -------------------------------------------------------------------------- */
/* A declared kind has to tell the truth                                       */
/* -------------------------------------------------------------------------- */

/**
 * The region each `aria-controls` target sits in, outermost first.
 *
 * Hand-written, but not forgettable: the test below fails on an `aria-controls`
 * whose target is missing from here, so a new one has to be placed rather than
 * silently skipped.
 */
const REGION_CHAINS: Readonly<Record<string, ReadonlyArray<string>>> = Object.freeze({
  "left-dock": ["left-dock"],
  inspector: ["inspector"],
  "refusal-legend": ["status-bar", "refusal-legend-panel"],
  ...Object.fromEntries(
    DESKTOP_DOCK_TAB_IDS.map((id) => [
      `dock-panel-${id}`,
      ["viewport-column", "dock", "dock-tabpanel"],
    ]),
  ),
});

/**
 * The shell after this control has done what it announces.
 *
 * A drawer opener names a region the stylesheet keeps shut until it opens it —
 * that is the control working, not a region the profile removed — so the region
 * is judged with the opener's own effect applied.
 */
const afterAction = (shell: VirtualElement, tag: string): VirtualElement => {
  const action = /\sdata-action="([^"]+)"/.exec(tag)?.[1];
  const value = /\sdata-value="([^"]+)"/.exec(tag)?.[1];
  if (action !== "drawer" || value === undefined) return shell;
  return {
    classes: shell.classes,
    attributes: { ...shell.attributes, [`data-drawer-${value}`]: "open" },
  };
};

describe("engine desktop chrome — a declared kind tells the truth", () => {
  it("never declares a control live over a region its profile keeps shut", () => {
    for (const [label, state] of STATES) {
      // Below the minimum the whole chrome refuses, which its own test covers;
      // this one is about what a *profile* removes.
      if (resolveWindowTier(state.window) === "minimum") continue;
      const html = render(state);
      const rules = stylesheet(html);
      const shell = shellElement(html);
      for (const [tag] of html.matchAll(/<button\b[^>]*>/g)) {
        const target = /\saria-controls="([^"]+)"/.exec(tag)?.[1];
        if (target === undefined) continue;
        const chain = REGION_CHAINS[target];
        expect(chain, `${label} ${target} names no known region`).toBeDefined();
        if (/\sdata-kind="inert"/.test(tag)) continue;
        let path: VirtualElement[] = [body, afterAction(shell, tag)];
        for (const region of chain ?? []) {
          path = [...path, element(region)];
          expect(
            computedDisplay(rules, path, state.window),
            `${label} ${target} via .${region}`,
          ).not.toBe("none");
        }
      }
    }
  });

  it("never lights or presses the assistant toggle over a hidden column", () => {
    const toggle = (shell: VirtualElement): VirtualElement[] => [
      body,
      shell,
      element("title-actions"),
      element("assistant-toggle"),
    ];
    for (const [renderLabel, renderSize] of TIER_SIZES) {
      const html = render(createDesktopVisualState({ window: renderSize }));
      const rules = stylesheet(html);
      const shell = shellElement(html);
      // The bytes always ship a closed drawer, whatever tier they were rendered
      // at: the document can be opened at a viewport the render never saw, and
      // a drawer nobody opened must not sit on the panel it undocked from
      // before any script has run.
      expect(shell.attributes["data-drawer-assistant"], renderLabel).toBe("closed");
      for (const [openLabel, openSize] of TIER_SIZES) {
        const at = `${renderLabel} opened at ${openLabel}`;
        const shown =
          computedDisplay(rules, [body, shell, element("assistant")], openSize) !== "none";
        const drawerTier =
          openSize.width < (REGULAR?.minWidth ?? 0) ||
          openSize.height < (REGULAR?.minHeight ?? 0);
        expect(shown, at).toBe(!drawerTier);
        // The lit styling is decided at the viewport, not at the render size.
        expect(
          computedValue(rules, toggle(shell), openSize, "background") === ACCENT.surface,
          `${at} lit`,
        ).toBe(shown);
        if (renderLabel !== openLabel) continue;
        expect(/id="assistant-toggle"[^>]*aria-pressed="true"/.test(html), at).toBe(shown);
      }
    }
  });
});
