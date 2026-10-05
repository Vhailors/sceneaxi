/**
 * Change Review — the design system's signature component, over the real
 * propose/apply contract.
 *
 * Foundations §05 states the product rule this implements: *"Nothing an agent or
 * generator produces mutates the project silently. Every change arrives as a
 * proposal, renders as a diff a human can read, and waits for accept or reject."*
 * The repository already has that machinery — `Proposal` in `@sceneaxi/schemas`
 * and propose/apply in `@sceneaxi/authoring-core` (E1, `docs/authoring-contracts.md`)
 * — and nothing in the `sites/` tier rendered it. This module is that renderer,
 * and it invents no second edit model: every row is one `ProposalEdit`.
 *
 * The sheet's four numbered sub-rules land as executable behaviour, not styling:
 *
 * | Rule | Here |
 * |---|---|
 * | 01 the leaf never truncates | the pointer is split into a dim `path` and a bright `leaf`; only `path` may ellipsize |
 * | 02 old in stale bronze, new in mint — never red/green | `--stale` / `--ok`; `--danger` appears only on a refusal |
 * | 03 document hash before and after, always visible | `beforeDigest` is the proposal's own `baseContentHash`; `afterDigest` is *projected* from the supplied document, so it is a computed fact rather than a mock string |
 * | 04 a stale proposal is refused, never merged | `CHANGE_REVIEW_PROPOSAL_STALE`, the same base-hash check `apply()` enforces |
 *
 * Two places where the design source and the contract disagree, resolved the way
 * the lane requires — contracts win, and the difference is recorded rather than
 * papered over (see `docs/design-foundations.md`):
 *
 * - The mockup shows an `+` (added) badge. E1 `propose()` refuses a pointer that
 *   does not already resolve, so an "add" is not a proposal E1 can produce. The
 *   badge vocabulary here is exactly what the contract can express.
 * - The mockup shows per-row accept alongside accept-all. Apply is all-or-nothing
 *   across a proposal's edits, so a mixed decision refuses by name instead of
 *   silently authoring a narrowed proposal — authoring belongs to
 *   `@sceneaxi/authoring-core`, not to a presentation primitive.
 *
 * This module decides and describes. It draws nothing, holds no state between
 * calls, and needs no browser or framework: the view model is data, and
 * `changeReviewElement()` returns a `SiteElement` tree the sites render.
 */
import { applyPointerEditInMemory, contentHash, serializeDocument } from "@sceneaxi/authoring-core";
import {
  validateProposal,
  type JsonValue,
  type Proposal,
  type ProposalEdit,
  type SceneDocument,
} from "@sceneaxi/schemas";
import { ok, refuse, type SiteResult } from "./refusals.js";
import { el, type SiteElement } from "./site-element.js";

/**
 * Badge vocabulary, bounded by what E1 can propose.
 *
 * `modify` is the only shape `propose()` produces for a value that changes;
 * `unchanged` exists so a no-op edit cannot be presented as a modification.
 */
export type ChangeReviewBadge = "modify" | "unchanged";

export const CHANGE_REVIEW_BADGE_GLYPHS: Readonly<Record<ChangeReviewBadge, string>> = Object.freeze(
  { modify: "M", unchanged: "=" },
);

export type ChangeReviewRow = {
  /** Index into the proposal's `edits`, and the id a decision names. */
  readonly index: number;
  readonly badge: ChangeReviewBadge;
  readonly badgeGlyph: string;
  readonly documentPath: string;
  readonly jsonPointer: string;
  /** Dim object path — everything above the leaf. Empty for a root-level pointer. */
  readonly path: string;
  /** Bright leaf. Never truncated; it is what tells two changes apart (rule 01). */
  readonly leaf: string;
  /** The value being replaced, rendered in stale bronze and struck through. */
  readonly before: string;
  /** The replacing value, rendered in mint. */
  readonly after: string;
};

/** Before → after digests for one document the proposal touches (rule 03). */
export type ChangeReviewDocument = {
  readonly documentPath: string;
  readonly beforeDigest: string;
  readonly afterDigest: string;
  readonly beforeShort: string;
  readonly afterShort: string;
  readonly editCount: number;
};

export type ChangeReview = {
  /** "3 proposed changes" — the count is the proposal's, never a label. */
  readonly title: string;
  /** Caller-supplied provenance line (for example `assistant · field_drone`). */
  readonly origin: string | null;
  readonly rows: readonly ChangeReviewRow[];
  readonly documents: readonly ChangeReviewDocument[];
  /**
   * The exact proposal reviewed, so an accepted review hands `apply()` the same
   * bytes. Deeply frozen: a holder of the review cannot rewrite an edit between
   * the rows being read and the decision being resolved.
   */
  readonly proposal: Proposal;
};

export type ChangeReviewInput = {
  /** Unknown on purpose: the contract validator is the only gate. */
  readonly proposal: unknown;
  /** Every document the proposal edits, keyed by the edit's `documentPath`. */
  readonly documents: ReadonlyMap<string, SceneDocument>;
  readonly origin?: string;
};

export type ChangeReviewDecision = "accepted" | "rejected";

export type ChangeReviewResolution =
  /** Rows still awaiting a human. The accent is still on screen because work is. */
  | { readonly outcome: "pending"; readonly undecided: readonly number[] }
  /** Every row accepted: hand this exact proposal to `apply()`. */
  | { readonly outcome: "apply"; readonly proposal: Proposal }
  /** Every row rejected: nothing is applied and nothing is written. */
  | { readonly outcome: "discard" };

const DIGEST_HEAD = 4;
const DIGEST_TAIL = 4;

/** `sha256:a4f2…9c1e` → `a4f2…9c1e`, the form the sheet prints. */
export function shortDigest(digest: string): string {
  const hex = digest.startsWith("sha256:") ? digest.slice("sha256:".length) : digest;
  if (hex.length <= DIGEST_HEAD + DIGEST_TAIL) return hex;
  return `${hex.slice(0, DIGEST_HEAD)}…${hex.slice(-DIGEST_TAIL)}`;
}

/**
 * Split an RFC 6901 pointer into the dim path and the bright leaf.
 *
 * The leaf keeps its leading slash, matching the sheet's `objects/field_drone` +
 * `/position` pairing. A whole-document pointer has no leaf to brighten, so the
 * document itself is the leaf.
 */
export function splitPointer(jsonPointer: string): { readonly path: string; readonly leaf: string } {
  if (jsonPointer === "") return { path: "", leaf: "/" };
  const lastSlash = jsonPointer.lastIndexOf("/");
  return {
    path: jsonPointer.slice(0, lastSlash).replace(/^\//, ""),
    leaf: jsonPointer.slice(lastSlash),
  };
}

/**
 * Render a JSON value for the diff columns.
 *
 * Arrays of primitives read as the sheet prints a vector (`0, 1.85, -2.30`);
 * anything structural falls back to canonical JSON so no value is silently lost.
 */
export function formatProposalValue(value: JsonValue): string {
  if (value === null) return "null";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    const primitives = value.every(
      (entry) => entry === null || typeof entry !== "object",
    );
    if (primitives) return value.map((entry) => formatProposalValue(entry)).join(", ");
  }
  return JSON.stringify(value);
}

/** Freeze a value and everything under it, arrays and nested JSON included. */
function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  for (const nested of Object.values(value) as unknown[]) deepFreeze(nested);
  return Object.freeze(value);
}

function badgeOf(edit: ProposalEdit): ChangeReviewBadge {
  return JSON.stringify(edit.oldValue) === JSON.stringify(edit.newValue) ? "unchanged" : "modify";
}

/**
 * Build the review for a proposal against the documents it edits.
 *
 * Refuses a proposal that fails the contract, one whose documents were not
 * supplied, one that has gone stale, and one that no longer projects. Nothing is
 * written and nothing is applied — this is the surface a human decides on.
 */
export function reviewProposal(input: ChangeReviewInput): SiteResult<ChangeReview> {
  const validated = validateProposal(input.proposal);
  if (!validated.ok) return refuse("CHANGE_REVIEW_PROPOSAL_INVALID");
  const proposal = deepFreeze(validated.proposal);

  const editsByDocument = new Map<string, ProposalEdit[]>();
  for (const edit of proposal.edits) {
    const bucket = editsByDocument.get(edit.documentPath);
    if (bucket === undefined) editsByDocument.set(edit.documentPath, [edit]);
    else bucket.push(edit);
  }

  const documents: ChangeReviewDocument[] = [];
  for (const [documentPath, edits] of editsByDocument) {
    const document = input.documents.get(documentPath);
    if (document === undefined) return refuse("CHANGE_REVIEW_DOCUMENT_MISSING");

    // Rule 04, and the same check `apply()` makes: the proposal is only reviewable
    // against the bytes it was proposed from.
    const beforeDigest = contentHash(serializeDocument(document));
    if (edits.some((edit) => edit.baseContentHash !== beforeDigest)) {
      return refuse("CHANGE_REVIEW_PROPOSAL_STALE");
    }

    // Rule 03: the resulting digest is projected from the real edits, in order, so
    // the "after" hash on screen is computed rather than promised.
    let projected: SceneDocument = document;
    let projectedText = "";
    for (const edit of edits) {
      const step = applyPointerEditInMemory(projected, edit.jsonPointer, edit.newValue);
      if (!step.ok) return refuse("CHANGE_REVIEW_PROJECTION_FAILED");
      projected = step.document;
      projectedText = step.text;
    }
    const afterDigest = contentHash(projectedText);

    documents.push(
      Object.freeze({
        documentPath,
        beforeDigest,
        afterDigest,
        beforeShort: shortDigest(beforeDigest),
        afterShort: shortDigest(afterDigest),
        editCount: edits.length,
      }),
    );
  }

  const rows = proposal.edits.map((edit, index) => {
    const { path, leaf } = splitPointer(edit.jsonPointer);
    const badge = badgeOf(edit);
    return Object.freeze({
      index,
      badge,
      badgeGlyph: CHANGE_REVIEW_BADGE_GLYPHS[badge],
      documentPath: edit.documentPath,
      jsonPointer: edit.jsonPointer,
      path,
      leaf,
      before: formatProposalValue(edit.oldValue),
      after: formatProposalValue(edit.newValue),
    });
  });

  const count = rows.length;
  return ok(
    Object.freeze({
      title: `${count} proposed ${count === 1 ? "change" : "changes"}`,
      origin: input.origin ?? null,
      rows: Object.freeze(rows),
      documents: Object.freeze(documents),
      proposal,
    }),
  );
}

/**
 * Turn a set of per-row decisions into the one thing that may happen next.
 *
 * A mixed decision refuses: `apply()` is all-or-nothing across a proposal's edits,
 * so honouring "accept these two, drop that one" would mean authoring a new,
 * narrower proposal — which is `@sceneaxi/authoring-core`'s job, not a view's. The
 * refusal is the honest surface: the operator re-proposes what they want.
 */
export function resolveChangeReview(
  review: ChangeReview,
  decisions: ReadonlyMap<number, ChangeReviewDecision>,
): SiteResult<ChangeReviewResolution> {
  const indexes = new Set(review.rows.map((row) => row.index));
  for (const index of decisions.keys()) {
    if (!indexes.has(index)) return refuse("CHANGE_REVIEW_DECISION_UNKNOWN_ROW");
  }

  const undecided = review.rows
    .filter((row) => !decisions.has(row.index))
    .map((row) => row.index);
  if (undecided.length > 0) {
    return ok(Object.freeze({ outcome: "pending" as const, undecided: Object.freeze(undecided) }));
  }

  const accepted = review.rows.filter((row) => decisions.get(row.index) === "accepted").length;
  if (accepted === review.rows.length) {
    return ok(Object.freeze({ outcome: "apply" as const, proposal: review.proposal }));
  }
  if (accepted === 0) return ok(Object.freeze({ outcome: "discard" as const }));
  return refuse("CHANGE_REVIEW_PARTIAL_ACCEPT_UNSUPPORTED");
}

/** Decide every row the same way — the sheet's `Accept all` / `Reject all`. */
export function decideAllRows(
  review: ChangeReview,
  decision: ChangeReviewDecision,
): ReadonlyMap<number, ChangeReviewDecision> {
  return new Map(review.rows.map((row) => [row.index, decision]));
}

// ---------------------------------------------------------------------------
// Presentation
// ---------------------------------------------------------------------------

/**
 * The Change Review panel as a framework-neutral element tree.
 *
 * Roles are explicit (`table`/`row`/`cell`) because the layout is a CSS grid: an
 * implicit table role would not survive `display: grid`, and the diff has to stay
 * navigable. Action buttons carry `data-sx-action` / `data-sx-row` so a site binds
 * behaviour without this package importing a framework or owning an event model.
 */
export function changeReviewElement(review: ChangeReview): SiteElement {
  const header = el("div", { className: "sx-cr-header" }, [
    el("div", { className: "sx-cr-heading" }, [
      el("span", { className: "sx-cr-dot", attributes: { "aria-hidden": "true" } }),
      el("span", { className: "sx-cr-title", text: review.title }),
      ...(review.origin === null
        ? []
        : [el("span", { className: "sx-cr-origin", text: review.origin })]),
    ]),
    el("div", { className: "sx-cr-bulk" }, [
      el("button", {
        className: "sx-cr-button sx-cr-button-quiet",
        attributes: { type: "button", "data-sx-action": "reject-all" },
        text: "Reject all",
      }),
      el("button", {
        className: "sx-cr-button sx-cr-button-accent",
        attributes: { type: "button", "data-sx-action": "accept-all" },
        text: "Accept all",
      }),
    ]),
  ]);

  const rows = review.rows.map((row) =>
    el("div", { className: "sx-cr-row", attributes: { role: "row", "data-sx-row": String(row.index) } }, [
      el("div", { className: `sx-cr-badge sx-cr-badge-${row.badge}`, attributes: { role: "cell", "aria-label": row.badge } }, [
        el("span", { attributes: { "aria-hidden": "true" }, text: row.badgeGlyph }),
      ]),
      el("div", { className: "sx-cr-property", attributes: { role: "cell" } }, [
        el("span", { className: "sx-cr-path", text: row.path }),
        el("span", { className: "sx-cr-leaf", text: row.leaf }),
      ]),
      el("div", {
        className: "sx-cr-before",
        attributes: { role: "cell", "aria-label": `previous value ${row.before}` },
        text: row.before,
      }),
      el("div", { className: "sx-cr-arrow", attributes: { role: "cell", "aria-hidden": "true" }, text: "→" }),
      el("div", {
        className: "sx-cr-after",
        attributes: { role: "cell", "aria-label": `proposed value ${row.after}` },
        text: row.after,
      }),
      el("div", { className: "sx-cr-actions", attributes: { role: "cell" } }, [
        el("button", {
          className: "sx-cr-icon sx-cr-icon-reject",
          attributes: {
            type: "button",
            "data-sx-action": "reject",
            "data-sx-row": String(row.index),
            "aria-label": `Reject ${row.jsonPointer}`,
          },
          text: "✕",
        }),
        el("button", {
          className: "sx-cr-icon sx-cr-icon-accept",
          attributes: {
            type: "button",
            "data-sx-action": "accept",
            "data-sx-row": String(row.index),
            "aria-label": `Accept ${row.jsonPointer}`,
          },
          text: "✓",
        }),
      ]),
    ]),
  );

  const footers = review.documents.map((document) =>
    el("div", { className: "sx-cr-footer" }, [
      el("span", { className: "sx-cr-footer-label", text: "DOCUMENT" }),
      el("span", { className: "sx-cr-footer-path", text: document.documentPath }),
      el("span", {
        className: "sx-cr-digest-before",
        attributes: { title: document.beforeDigest },
        text: document.beforeShort,
      }),
      el("span", { className: "sx-cr-arrow", attributes: { "aria-hidden": "true" }, text: "→" }),
      el("span", {
        className: "sx-cr-digest-after",
        attributes: { title: document.afterDigest },
        text: document.afterShort,
      }),
    ]),
  );

  return el("section", { className: "sx-change-review", attributes: { "aria-label": review.title } }, [
    header,
    el("div", { className: "sx-cr-rows", attributes: { role: "table", "aria-label": "Proposed changes" } }, rows),
    ...footers,
  ]);
}

/**
 * Change Review styling, in Foundations v2 tokens only.
 *
 * The desktop grid track list is the sheet's own. The mobile reflow below 720px is
 * *not* in the archive — the Foundations sheet is a fixed 1560px canvas — so it is
 * a stated decision, taken to keep the panel free of horizontal overflow at the
 * 390px reference width the umbrella mockup does honour.
 *
 * Redesign 2026-10 (`docs/redesign/DIRECTION.md` §5, §6.3 rows 1–5, 10, 14):
 *
 * - Spacing snaps to the 4px scale and no text renders below 11px (DV-F1, DV-F9).
 * - Every button has rest, hover (a `currentColor` state layer, only under
 *   `@media (hover: hover)` so it never sticks after a tap), focus-visible (2px
 *   `--accent-hi` ring), active (press scale, deeper layer), disabled (painted:
 *   dashed line and `--fg-2` label, never opacity) and loading (`aria-busy="true"`:
 *   label kept, a 2px indeterminate bar after `--motion-delay-loading`, R-1).
 * - The ✕/✓ marks stay text glyphs with their existing `aria-label` (ruling R-4).
 * - Resolution is the signature motion. A site that records a decision sets
 *   `data-sx-decision="accepted" | "rejected"` on the row, and
 *   `data-sx-outcome="apply" | "discard"` on the panel once `resolveChangeReview`
 *   answers. Accepting draws the old value's strike solid, left to right, and wipes
 *   the new value in; rejecting strikes the proposed value in `--fg-2`. These are
 *   CSS hooks only: this module still sets no state and binds no event.
 * - Every token read carries its literal as a fallback, so the primitive still
 *   renders if a site serves it without `foundationsCss()`.
 */
export function changeReviewCss(): string {
  return `.sx-change-review { border: 1px solid var(--line-strong); border-radius: var(--radius-lg); background: #0B0D10; overflow: hidden; font-family: var(--font-ui); }
.sx-cr-header { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); padding: var(--space-3) var(--space-4); background: var(--bg-raised); border-bottom: 1px solid var(--line); flex-wrap: wrap; }
.sx-cr-heading { display: flex; align-items: center; gap: var(--space-2); min-width: 0; }
.sx-cr-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--accent); flex: none; }
.sx-change-review[data-sx-outcome="apply"] .sx-cr-dot { background: var(--ok); }
.sx-change-review[data-sx-outcome="discard"] .sx-cr-dot { background: var(--fg-2); }
.sx-cr-title { font-size: 13px; font-weight: 600; line-height: 1.4; color: var(--fg); }
.sx-cr-origin { min-width: 0; font-size: 12px; color: var(--fg-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sx-cr-bulk { display: flex; gap: var(--space-2); }
.sx-cr-button, .sx-cr-icon { position: relative; isolation: isolate; overflow: hidden; font-family: inherit; cursor: pointer; transition: transform var(--motion-duration-micro, 160ms) var(--motion-ease-out-quart, cubic-bezier(0.25, 1, 0.5, 1)); }
.sx-cr-button::before, .sx-cr-icon::before { content: ""; position: absolute; inset: 0; z-index: -1; background: color-mix(in srgb, currentColor 8%, transparent); opacity: 0; pointer-events: none; transition: opacity var(--motion-duration-micro, 160ms) var(--motion-ease-out-quart, cubic-bezier(0.25, 1, 0.5, 1)); }
.sx-cr-button:active, .sx-cr-icon:active { transform: scale(var(--motion-scale-press, 0.97)); transition-duration: var(--motion-duration-press, 120ms); }
.sx-cr-button:active::before, .sx-cr-icon:active::before { opacity: 1; background: color-mix(in srgb, currentColor 12%, transparent); }
.sx-cr-button { font-size: 12px; font-weight: 500; height: 30px; padding: 0 var(--space-3); border-radius: var(--radius-md); }
.sx-cr-button-quiet { color: var(--fg-2); background: transparent; border: 1px solid #262C34; }
.sx-cr-button-accent { font-weight: 600; color: var(--bg-base); background: var(--accent); border: 1px solid var(--accent); }
.sx-cr-row { display: grid; grid-template-columns: 22px minmax(0, 1fr) 118px 16px 150px 84px; gap: var(--space-3); align-items: center; padding: var(--space-2) var(--space-4); border-bottom: 1px solid var(--line-soft); }
.sx-cr-badge { width: 20px; height: 20px; border-radius: var(--radius-sm); display: grid; place-items: center; font-family: var(--font-mono); font-size: 11px; font-weight: 700; }
.sx-cr-badge-modify { background: #241A0F; color: var(--accent); }
.sx-cr-badge-unchanged { background: var(--bg-row); color: var(--fg-2); }
.sx-cr-property { display: flex; align-items: baseline; min-width: 0; font-family: var(--font-mono); font-size: 12px; }
.sx-cr-path { min-width: 0; color: var(--fg-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sx-cr-leaf { color: var(--fg); white-space: nowrap; flex: none; }
.sx-cr-before, .sx-cr-after { position: relative; justify-self: start; max-width: 100%; min-width: 0; font-family: var(--font-mono); font-size: 12px; font-variant-numeric: tabular-nums; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sx-cr-before { font-weight: 500; color: var(--stale); text-decoration: line-through; text-decoration-color: color-mix(in srgb, currentColor 55%, transparent); }
.sx-cr-after { color: var(--ok); }
.sx-cr-before::after, .sx-cr-after::after { content: ""; position: absolute; left: 0; right: 0; top: 50%; height: 1px; background: currentColor; clip-path: inset(0 100% 0 0); pointer-events: none; }
.sx-cr-row[data-sx-decision="accepted"] .sx-cr-before { text-decoration-color: transparent; }
.sx-cr-row[data-sx-decision="accepted"] .sx-cr-before::after { clip-path: inset(0); animation: sx-cr-draw var(--motion-duration-state, 200ms) var(--motion-ease-out-expo, cubic-bezier(0.16, 1, 0.3, 1)) backwards; }
.sx-cr-row[data-sx-decision="accepted"] .sx-cr-after { animation: sx-cr-draw var(--motion-duration-state, 200ms) var(--motion-ease-out-expo, cubic-bezier(0.16, 1, 0.3, 1)) backwards; }
.sx-cr-row[data-sx-decision="rejected"] .sx-cr-before { text-decoration: none; }
.sx-cr-row[data-sx-decision="rejected"] .sx-cr-after { color: var(--fg-2); }
.sx-cr-row[data-sx-decision="rejected"] .sx-cr-after::after { clip-path: inset(0); animation: sx-cr-draw var(--motion-duration-state, 200ms) var(--motion-ease-out-expo, cubic-bezier(0.16, 1, 0.3, 1)) backwards; }
.sx-cr-arrow { color: var(--fg-2); font-size: 11px; }
.sx-cr-actions { display: flex; gap: var(--space-2); justify-content: flex-end; }
.sx-cr-icon { width: 30px; height: 30px; border-radius: var(--radius-sm); display: grid; place-items: center; font-size: 13px; line-height: 1; background: transparent; }
.sx-cr-icon-reject { border: 1px solid #262C34; color: var(--fg-2); }
.sx-cr-icon-accept { border: 1px solid #1E4A45; background: #0D2422; color: var(--ok); }
@media (hover: hover) {
  .sx-cr-button:hover::before, .sx-cr-icon:hover::before { opacity: 1; }
  .sx-cr-button-quiet:hover { color: var(--fg); border-color: var(--line-strong); }
  .sx-cr-button-accent:hover { background: var(--accent-hi); border-color: var(--accent-hi); }
  .sx-cr-icon-reject:hover { border-color: var(--danger); color: var(--danger); }
  .sx-cr-icon-accept:hover { border-color: var(--ok); }
}
.sx-cr-row[data-sx-decision="accepted"] .sx-cr-icon-accept:not(:disabled):not([aria-disabled="true"]) { border-color: var(--ok); }
.sx-cr-row[data-sx-decision="rejected"] .sx-cr-icon-reject:not(:disabled):not([aria-disabled="true"]) { border-color: var(--danger); color: var(--danger); }
.sx-cr-icon:focus-visible, .sx-cr-button:focus-visible { outline: 2px solid var(--accent-hi); outline-offset: 2px; }
.sx-cr-button:disabled, .sx-cr-button[aria-disabled="true"], .sx-cr-icon:disabled, .sx-cr-icon[aria-disabled="true"] { cursor: not-allowed; color: var(--fg-2); background: transparent; border: 1px dashed var(--line-strong); transform: none; }
.sx-cr-button:disabled::before, .sx-cr-button[aria-disabled="true"]::before, .sx-cr-icon:disabled::before, .sx-cr-icon[aria-disabled="true"]::before { opacity: 0; }
.sx-cr-button[aria-busy="true"], .sx-cr-icon[aria-busy="true"] { pointer-events: none; cursor: progress; }
.sx-cr-button[aria-busy="true"]::after, .sx-cr-icon[aria-busy="true"]::after { content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 2px; background: currentColor; pointer-events: none; animation: sx-cr-progress var(--motion-duration-loop, 1200ms) var(--motion-ease-out-quart, cubic-bezier(0.25, 1, 0.5, 1)) var(--motion-delay-loading, 300ms) infinite backwards; }
.sx-cr-footer { display: flex; align-items: center; gap: var(--space-3); flex-wrap: wrap; padding: var(--space-2) var(--space-4); background: var(--bg-field); font-family: var(--font-mono); }
.sx-cr-footer-label { font-size: 11px; letter-spacing: 0.08em; color: var(--fg-2); }
.sx-cr-footer-path { min-width: 0; font-size: 12px; color: var(--fg-2); overflow-wrap: anywhere; }
.sx-cr-digest-before, .sx-cr-digest-after { font-size: 12px; font-variant-numeric: tabular-nums; }
.sx-cr-digest-before { color: var(--fg-2); }
.sx-cr-digest-after { color: var(--ok); }
.sx-change-review[data-sx-outcome="apply"] .sx-cr-digest-after { animation: sx-cr-draw var(--motion-duration-state, 200ms) var(--motion-ease-out-expo, cubic-bezier(0.16, 1, 0.3, 1)) backwards; }
@keyframes sx-cr-draw { from { clip-path: inset(0 100% 0 0); } to { clip-path: inset(0); } }
@keyframes sx-cr-progress { from { transform: translateX(-100%); } to { transform: translateX(100%); } }
@media (max-width: 720px) {
  .sx-cr-row { grid-template-columns: 22px minmax(0, 1fr) auto; grid-template-areas: "badge property actions" "before before before" "after after after"; row-gap: var(--space-1); }
  .sx-cr-badge { grid-area: badge; }
  .sx-cr-property { grid-area: property; }
  .sx-cr-actions { grid-area: actions; }
  .sx-cr-before { grid-area: before; }
  .sx-cr-after { grid-area: after; }
  .sx-cr-arrow { display: none; }
  .sx-cr-icon { width: 44px; height: 44px; }
  .sx-cr-button { min-height: 44px; }
}
@media (prefers-reduced-motion: reduce) {
  .sx-cr-button, .sx-cr-icon { transition: none; }
  .sx-cr-button:active, .sx-cr-icon:active { transform: none; }
  .sx-change-review .sx-cr-row[data-sx-decision] .sx-cr-before::after, .sx-change-review .sx-cr-row[data-sx-decision] .sx-cr-after, .sx-change-review .sx-cr-row[data-sx-decision] .sx-cr-after::after, .sx-change-review[data-sx-outcome] .sx-cr-digest-after { animation: none; }
  .sx-cr-button[aria-busy="true"]::after, .sx-cr-icon[aria-busy="true"]::after { animation: none; right: auto; width: 40%; }
}
`;
}
