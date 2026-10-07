/**
 * Framework-neutral state-panel component contract.
 *
 * A site owns the React adapter because only its own `src/app` tree may import React,
 * while this module owns the status mapping, semantic structure, refusal label, and
 * neutral element tree shared by every site. The compact storefront treatment and
 * the diagnostic umbrella treatment are two presentations of the same model.
 *
 * v6 (docs/redesign-v6/DIRECTION.md §3): **density is chosen by placement, never
 * inherited** from a global `.state` rule. v5 tied spacing to the `compact` variant,
 * so the storefront refusal rendered at editor-dock density inside a comfortable
 * acquire block. `variant` now decides only the tree's structure; `density`
 * (`comfortable` | `compact`) decides spacing, and is written on the panel itself as
 * `data-density` so the shared `.sx-interlock` rules read it from the element, not
 * from an ancestor. Passing `density` opts a caller into the v6 interlock tree
 * (plate = label + icon + paint); omitting it keeps the legacy tree byte-for-byte
 * until that site's lane migrates.
 */
import {
  FOUNDATION_STATUSES,
  SIGNAL_ICONS,
  signalState,
  type FoundationStatus,
  type SignalState,
  type SignalStateId,
} from "./design-tokens.js";
import { el, type SiteElement } from "./site-element.js";

export const STATE_PANEL_TONES = Object.freeze(["ok", "warn", "deny", "iso"] as const);

export type StatePanelTone = (typeof STATE_PANEL_TONES)[number];

export type StatePanelVariant = "compact" | "diagnostic";

/** Spacing density. Kids is not offered: Kids imports no package (DIRECTION §3). */
export type StatePanelDensity = "comfortable" | "compact";

export const STATE_PANEL_DENSITIES = Object.freeze(["comfortable", "compact"] as const);

export type StatePanelEvidence = {
  readonly term: string;
  readonly value: string;
};

export type StatePanelInput = {
  readonly tone: StatePanelTone;
  readonly title: string;
  readonly level?: 2 | 3;
  readonly reason?: string | undefined;
  readonly evidence?: readonly StatePanelEvidence[] | undefined;
  readonly variant?: StatePanelVariant;
  /** Set by the placement (an acquire block is comfortable even inside a compact grid). */
  readonly density?: StatePanelDensity;
};

export type StatePanelModel = {
  readonly tone: StatePanelTone;
  readonly variant: StatePanelVariant;
  readonly sectionClassName: string;
  readonly headingTag: "h2" | "h3";
  readonly title: string;
  readonly status: FoundationStatus;
  readonly reason: string | null;
  readonly evidence: readonly StatePanelEvidence[];
  /** Resolved density; `comfortable` when the caller did not place it. */
  readonly density: StatePanelDensity;
  /** Whether the caller placed a density, i.e. opted into the v6 interlock tree. */
  readonly placed: boolean;
  /** The v6 state: plate label + icon + paint, never paint alone. */
  readonly state: SignalState;
  /** v6 class list: the legacy classes plus `sx-interlock`. */
  readonly interlockClassName: string;
  /** Attributes a v6 adapter writes on the panel itself. */
  readonly attributes: Readonly<{ "data-density": StatePanelDensity; "data-state": SignalStateId }>;
};

const STATUS_ID_BY_TONE = Object.freeze({
  ok: "validated",
  warn: "needs-review",
  deny: "refused",
  iso: "isolated",
} as const);

const SIGNAL_STATE_BY_TONE = Object.freeze({
  ok: "verified",
  warn: "pending",
  deny: "refused",
  iso: "isolated",
} as const satisfies Record<StatePanelTone, SignalStateId>);

function statusFor(tone: StatePanelTone): FoundationStatus {
  const status = FOUNDATION_STATUSES.find((candidate) => candidate.id === STATUS_ID_BY_TONE[tone]);

  if (status === undefined) {
    throw new Error(`Foundations status is missing for state-panel tone: ${tone}`);
  }

  return status;
}

/** Resolve the canonical semantic model a framework adapter renders. */
export function createStatePanelModel(input: StatePanelInput): StatePanelModel {
  const evidence = Object.freeze(
    (input.evidence ?? []).map((entry) =>
      Object.freeze({ term: entry.term, value: entry.value }),
    ),
  );

  const density = input.density ?? "comfortable";
  const state = signalState(SIGNAL_STATE_BY_TONE[input.tone]);

  return Object.freeze({
    tone: input.tone,
    variant: input.variant ?? "compact",
    sectionClassName: `state state-${input.tone}`,
    headingTag: input.level === 2 ? "h2" : "h3",
    title: input.title,
    status: statusFor(input.tone),
    reason: input.reason ?? null,
    evidence,
    density,
    placed: input.density !== undefined,
    state,
    interlockClassName: `state state-${input.tone} sx-interlock`,
    attributes: Object.freeze({ "data-density": density, "data-state": state.id }),
  });
}

/** The state plate: label + icon + paint. The icon is decorative; the label is the text. */
export function statePlateElement(state: SignalState): SiteElement {
  const icon = el(
    "svg",
    {
      className: "sx-icon",
      attributes: { viewBox: "0 0 24 24", "aria-hidden": "true", focusable: "false" },
    },
    SIGNAL_ICONS[state.icon].map((d) => el("path", { attributes: { d } })),
  );

  return el("span", { className: "sx-plate", attributes: { "data-state": state.id } }, [
    icon,
    el("span", { text: state.plate }),
  ]);
}

/**
 * The v6 interlock tree. Same structure at both densities (the CSS reads
 * `data-density` on this element): plate + heading, body, reason code, evidence.
 */
function interlockElement(model: StatePanelModel, body: readonly SiteElement[]): SiteElement {
  const head = el("div", { className: "sx-interlock-head" }, [
    statePlateElement(model.state),
    el(model.headingTag, { text: model.title }),
  ]);

  const bodyElement = body.length === 0 ? [] : [el("div", { className: "state-body" }, body)];

  const reason =
    model.reason === null
      ? []
      : [
          el("code", { className: "reason sx-interlock-reason" }, [
            el("span", { className: "sx-visually-hidden", text: "reason " }),
            el("span", { text: model.reason }),
          ]),
        ];

  const evidence =
    model.evidence.length === 0
      ? []
      : [
          el(
            "dl",
            { className: "sx-interlock-evidence" },
            model.evidence.flatMap((entry) => [
              el("dt", { text: entry.term }),
              el("dd", {}, [el("code", { text: entry.value })]),
            ]),
          ),
        ];

  return el("section", { className: model.interlockClassName, attributes: model.attributes }, [
    head,
    ...bodyElement,
    ...reason,
    ...evidence,
  ]);
}

const reasonElement = (reason: string): SiteElement =>
  el("code", { className: "reason" }, [
    el("span", { className: "reason-label", text: "reason" }),
    el("span", { text: reason }),
  ]);

/**
 * Build the package's canonical neutral tree.
 *
 * React sites use the model when their body contains framework nodes such as links or
 * canvases. Fully neutral consumers can render this tree directly.
 */
export function statePanelElement(
  input: StatePanelInput,
  body: readonly SiteElement[] = [],
): SiteElement {
  const model = createStatePanelModel(input);

  if (model.placed) return interlockElement(model, body);
  const heading = el(model.headingTag, { text: model.title });
  const reason = model.reason === null ? [] : [reasonElement(model.reason)];
  const bodyElement = body.length === 0 ? [] : [el("div", { className: "state-body" }, body)];

  if (model.variant === "compact") {
    return el("section", { className: model.sectionClassName }, [heading, ...body, ...reason]);
  }

  const status = el("span", { className: `chip chip-${model.status.id}` }, [
    el("span", { className: "dot", attributes: { "aria-hidden": "true" } }),
    el("span", { text: model.status.label }),
  ]);

  const head = el("div", { className: "state-head" }, [status, heading, ...reason]);

  const evidence =
    model.evidence.length === 0
      ? []
      : [
          el(
            "dl",
            { className: "dl state-evidence" },
            model.evidence.flatMap((entry) => [
              el("dt", { text: entry.term }),
              el("dd", {}, [el("code", { text: entry.value })]),
            ]),
          ),
        ];

  return el("section", { className: model.sectionClassName }, [
    head,
    ...bodyElement,
    ...evidence,
  ]);
}
