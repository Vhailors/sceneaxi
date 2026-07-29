/**
 * Framework-neutral state-panel component contract.
 *
 * A site owns the React adapter because only its own `src/app` tree may import React,
 * while this module owns the status mapping, semantic structure, refusal label, and
 * neutral element tree shared by every site. The compact storefront treatment and
 * the diagnostic umbrella treatment are two presentations of the same model.
 */
import {
  FOUNDATION_STATUSES,
  type FoundationStatus,
} from "./design-tokens.js";
import { el, type SiteElement } from "./site-element.js";

export const STATE_PANEL_TONES = Object.freeze(["ok", "warn", "deny", "iso"] as const);

export type StatePanelTone = (typeof STATE_PANEL_TONES)[number];
export type StatePanelVariant = "compact" | "diagnostic";

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
};

const STATUS_ID_BY_TONE = Object.freeze({
  ok: "validated",
  warn: "needs-review",
  deny: "refused",
  iso: "isolated",
} as const);

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
  return Object.freeze({
    tone: input.tone,
    variant: input.variant ?? "compact",
    sectionClassName: `state state-${input.tone}`,
    headingTag: input.level === 2 ? "h2" : "h3",
    title: input.title,
    status: statusFor(input.tone),
    reason: input.reason ?? null,
    evidence,
  });
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
