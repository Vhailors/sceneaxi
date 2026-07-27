/**
 * Change Review over real propose/apply output.
 *
 * Every proposal in this file comes from `propose()`/`proposeMany()` against a real
 * text-canonical document on disk, not from a hand-written literal, so the primitive
 * is proven against what E1 actually produces rather than against a shape invented
 * to match the mockup. The digests it renders are then checked against `contentHash`
 * of the same documents.
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  contentHash,
  propose,
  proposeMany,
  serializeDocument,
  serializeProposal,
} from "@sceneaxi/authoring-core";
import {
  changeReviewCss,
  changeReviewElement,
  decideAllRows,
  formatProposalValue,
  renderSiteElementHtml,
  resolveChangeReview,
  reviewProposal,
  shortDigest,
  splitPointer,
} from "@sceneaxi/site-kit";
import type { ChangeReview, Proposal, SceneDocument } from "@sceneaxi/site-kit";

const dirs: string[] = [];

afterEach(() => {
  while (dirs.length > 0) {
    const dir = dirs.pop();
    if (dir !== undefined) rmSync(dir, { recursive: true, force: true });
  }
});

const DOCUMENT: SceneDocument = {
  schemaVersion: 1,
  kind: "sceneaxi.document",
  id: "scene-field",
  title: "Field scene",
  data: {
    objects: {
      field_drone: { position: [0, 0, 0], label: "field drone" },
    },
    materials: { matte_polymer: { rough: 0.5 } },
  },
};

const workspace = (document: SceneDocument = DOCUMENT): { cwd: string; path: string } => {
  const cwd = mkdtempSync(join(tmpdir(), "sceneaxi-change-review-"));
  dirs.push(cwd);
  const path = "scene.json";
  writeFileSync(join(cwd, path), serializeDocument(document), "utf8");
  return { cwd, path };
};

const proposalFor = (
  edits: readonly { pointer: string; value: unknown }[],
): { proposal: Proposal; cwd: string; path: string } => {
  const { cwd, path } = workspace();
  const result = proposeMany(
    edits.map((edit) => ({ documentPath: path, jsonPointer: edit.pointer, newValue: edit.value, cwd })),
  );
  if (!result.ok) throw new Error(`propose failed: ${JSON.stringify(result.diagnostics)}`);
  return { proposal: result.proposal, cwd, path };
};

const reviewOf = (
  edits: readonly { pointer: string; value: unknown }[],
  document: SceneDocument = DOCUMENT,
): ChangeReview => {
  const { proposal, path } = proposalFor(edits);
  const result = reviewProposal({
    proposal,
    documents: new Map([[path, document]]),
    origin: "assistant · field_drone",
  });
  if (!result.ok) throw new Error(`review refused: ${result.reason}`);
  return result.value;
};

describe("pointer and value presentation", () => {
  it("splits a pointer into a dim path and a leaf that never truncates (rule 01)", () => {
    expect(splitPointer("/data/objects/field_drone/position")).toEqual({
      path: "data/objects/field_drone",
      leaf: "/position",
    });
    expect(splitPointer("/materials")).toEqual({ path: "", leaf: "/materials" });
    expect(splitPointer("")).toEqual({ path: "", leaf: "/" });
  });

  it("renders a vector the way the sheet prints one", () => {
    expect(formatProposalValue([0, 1.85, -2.3])).toBe("0, 1.85, -2.3");
    expect(formatProposalValue(0.74)).toBe("0.74");
    expect(formatProposalValue(null)).toBe("null");
    expect(formatProposalValue("field drone")).toBe("field drone");
    expect(formatProposalValue({ rough: 0.74 })).toBe('{"rough":0.74}');
  });

  it("shortens a digest to the sheet's 4…4 form", () => {
    expect(shortDigest(`sha256:${"a4f2".padEnd(60, "0")}9c1e`)).toBe("a4f2…9c1e");
    expect(shortDigest("abc")).toBe("abc");
  });
});

describe("reviewProposal", () => {
  it("builds one row per proposal edit, with the contract's own badge vocabulary", () => {
    const review = reviewOf([
      { pointer: "/data/objects/field_drone/position", value: [0, 1.85, -2.3] },
      { pointer: "/data/materials/matte_polymer/rough", value: 0.74 },
    ]);

    expect(review.title).toBe("2 proposed changes");
    expect(review.origin).toBe("assistant · field_drone");
    expect(review.rows).toHaveLength(2);
    expect(review.rows[0]).toMatchObject({
      index: 0,
      badge: "modify",
      badgeGlyph: "M",
      path: "data/objects/field_drone",
      leaf: "/position",
      before: "0, 0, 0",
      after: "0, 1.85, -2.3",
    });
    expect(review.rows[1]?.after).toBe("0.74");
  });

  it("singularizes the header for one change", () => {
    expect(reviewOf([{ pointer: "/data/materials/matte_polymer/rough", value: 0.9 }]).title).toBe(
      "1 proposed change",
    );
  });

  it("marks a no-op edit unchanged rather than calling it a modification", () => {
    const review = reviewOf([{ pointer: "/data/materials/matte_polymer/rough", value: 0.5 }]);
    expect(review.rows[0]?.badge).toBe("unchanged");
    expect(review.rows[0]?.badgeGlyph).toBe("=");
  });

  it("shows a computed before → after digest per document (rule 03)", () => {
    const review = reviewOf([{ pointer: "/data/materials/matte_polymer/rough", value: 0.74 }]);
    expect(review.documents).toHaveLength(1);
    const document = review.documents[0];
    if (document === undefined) throw new Error("expected one reviewed document");
    expect(document.beforeDigest).toBe(contentHash(serializeDocument(DOCUMENT)));
    expect(document.afterDigest).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(document.afterDigest).not.toBe(document.beforeDigest);
    expect(document.beforeShort).toBe(shortDigest(document.beforeDigest));
    expect(document.afterShort).toBe(shortDigest(document.afterDigest));
    expect(document.editCount).toBe(1);
  });

  it("projects chained edits on one document in order", () => {
    const review = reviewOf([
      { pointer: "/data/materials/matte_polymer/rough", value: 0.74 },
      { pointer: "/data/objects/field_drone/label", value: "field drone mk2" },
    ]);
    const expected = contentHash(
      serializeDocument({
        ...DOCUMENT,
        data: {
          objects: { field_drone: { position: [0, 0, 0], label: "field drone mk2" } },
          materials: { matte_polymer: { rough: 0.74 } },
        },
      }),
    );
    expect(review.documents[0]?.afterDigest).toBe(expected);
    expect(review.documents[0]?.editCount).toBe(2);
  });

  it("refuses a stale proposal rather than merging it (rule 04)", () => {
    const { proposal, path } = proposalFor([
      { pointer: "/data/materials/matte_polymer/rough", value: 0.74 },
    ]);
    const moved: SceneDocument = {
      ...DOCUMENT,
      data: {
        objects: { field_drone: { position: [1, 0, 0], label: "field drone" } },
        materials: { matte_polymer: { rough: 0.5 } },
      },
    };
    const result = reviewProposal({ proposal, documents: new Map([[path, moved]]) });
    expect(result.ok ? null : result.reason).toBe("CHANGE_REVIEW_PROPOSAL_STALE");
  });

  it("refuses a proposal whose document was not supplied", () => {
    const { proposal } = proposalFor([{ pointer: "/data/materials/matte_polymer/rough", value: 0.74 }]);
    const result = reviewProposal({ proposal, documents: new Map() });
    expect(result.ok ? null : result.reason).toBe("CHANGE_REVIEW_DOCUMENT_MISSING");
  });

  it("refuses anything that is not a contract proposal", () => {
    for (const value of [null, {}, { schemaVersion: 2, kind: "sceneaxi.proposal" }, "nope"]) {
      const result = reviewProposal({ proposal: value, documents: new Map() });
      expect(result.ok ? null : result.reason).toBe("CHANGE_REVIEW_PROPOSAL_INVALID");
    }
  });

  it("refuses when the edits no longer project onto the supplied document", () => {
    const { proposal, path } = proposalFor([
      { pointer: "/data/materials/matte_polymer/rough", value: 0.74 },
    ]);
    // Same bytes at propose time, but the pointer's parent is gone in the copy the
    // review is handed — so the base hash matches and the projection cannot run.
    const stale = { ...proposal, edits: [{ ...proposal.edits[0], jsonPointer: "/data/absent/leaf" }] };
    const result = reviewProposal({
      proposal: stale as unknown,
      documents: new Map([[path, DOCUMENT]]),
    });
    expect(result.ok ? null : result.reason).toBe("CHANGE_REVIEW_PROJECTION_FAILED");
  });

  it("carries the exact proposal through, so an accepted review applies the same bytes", () => {
    const { proposal, path } = proposalFor([
      { pointer: "/data/materials/matte_polymer/rough", value: 0.74 },
    ]);
    const result = reviewProposal({ proposal, documents: new Map([[path, DOCUMENT]]) });
    if (!result.ok) throw new Error(result.reason);
    // The review carries the contract-validated proposal, and it serializes to the
    // same bytes propose() produced — so accepting it applies exactly what was shown.
    expect(serializeProposal(result.value.proposal)).toBe(serializeProposal(proposal));
  });

  it("freezes the carried proposal, so no edit can be rewritten after the rows are read", () => {
    const review = reviewOf([
      { pointer: "/data/objects/field_drone/position", value: [0, 1.85, -2.3] },
    ]);
    const carried = review.proposal;
    const edit = carried.edits[0];
    if (edit === undefined) throw new Error("expected one edit");

    expect(Object.isFrozen(carried)).toBe(true);
    expect(Object.isFrozen(carried.edits)).toBe(true);
    expect(Object.isFrozen(edit)).toBe(true);
    expect(Object.isFrozen(edit.newValue)).toBe(true);
    expect(Object.isFrozen(edit.oldValue)).toBe(true);
    expect(Object.isFrozen(carried.diffs)).toBe(true);
    expect(carried.diffs.every((diff) => Object.isFrozen(diff))).toBe(true);

    const mutable = carried as unknown as { edits: Record<string, unknown>[] };
    expect(() => mutable.edits.push({ ...edit, jsonPointer: "/data/objects/field_drone/label" }))
      .toThrow(TypeError);
    expect(() => {
      const first = mutable.edits[0];
      if (first !== undefined) first["jsonPointer"] = "/data/absent/leaf";
    }).toThrow(TypeError);
    expect(carried.edits).toHaveLength(1);
    expect(carried.edits[0]?.jsonPointer).toBe("/data/objects/field_drone/position");
  });
});

describe("resolveChangeReview", () => {
  const review = (): ChangeReview =>
    reviewOf([
      { pointer: "/data/objects/field_drone/position", value: [0, 1.85, -2.3] },
      { pointer: "/data/materials/matte_polymer/rough", value: 0.74 },
    ]);

  it("stays pending while any row is undecided — the accent is still on screen", () => {
    const result = resolveChangeReview(review(), new Map([[0, "accepted"]]));
    expect(result.ok && result.value).toEqual({ outcome: "pending", undecided: [1] });
  });

  it("hands back the untouched proposal when every row is accepted", () => {
    const current = review();
    const result = resolveChangeReview(current, decideAllRows(current, "accepted"));
    expect(result.ok && result.value.outcome).toBe("apply");
    expect(result.ok && result.value.outcome === "apply" && result.value.proposal).toBe(
      current.proposal,
    );
  });

  it("discards when every row is rejected", () => {
    const current = review();
    const result = resolveChangeReview(current, decideAllRows(current, "rejected"));
    expect(result.ok && result.value).toEqual({ outcome: "discard" });
  });

  it("refuses a mixed decision instead of authoring a narrowed proposal", () => {
    const result = resolveChangeReview(
      review(),
      new Map([
        [0, "accepted" as const],
        [1, "rejected" as const],
      ]),
    );
    expect(result.ok ? null : result.reason).toBe("CHANGE_REVIEW_PARTIAL_ACCEPT_UNSUPPORTED");
  });

  it("refuses a decision naming a row this review does not have", () => {
    const result = resolveChangeReview(review(), new Map([[9, "accepted" as const]]));
    expect(result.ok ? null : result.reason).toBe("CHANGE_REVIEW_DECISION_UNKNOWN_ROW");
  });

  it("is decided by the review's rows, not by a mutable count", () => {
    const single = reviewOf([{ pointer: "/data/materials/matte_polymer/rough", value: 0.74 }]);
    expect(decideAllRows(single, "accepted").size).toBe(1);
  });
});

describe("presentation", () => {
  const rendered = (): string => renderSiteElementHtml(changeReviewElement(reviewOf([
    { pointer: "/data/objects/field_drone/position", value: [0, 1.85, -2.3] },
  ])));

  it("renders the header, the diff grid, and the digest footer", () => {
    const html = rendered();
    expect(html).toContain('class="sx-change-review"');
    expect(html).toContain("1 proposed change");
    expect(html).toContain("assistant · field_drone");
    expect(html).toContain('data-sx-action="accept-all"');
    expect(html).toContain('data-sx-action="reject-all"');
    expect(html).toContain('class="sx-cr-path"');
    expect(html).toContain('class="sx-cr-leaf"');
    expect(html).toContain("DOCUMENT");
  });

  it("keeps the diff navigable under a CSS grid by declaring roles explicitly", () => {
    const html = rendered();
    expect(html).toContain('role="table"');
    expect(html).toContain('role="row"');
    expect(html).toContain('role="cell"');
  });

  it("gives every control an accessible name", () => {
    const html = rendered();
    expect(html).toContain('aria-label="Accept /data/objects/field_drone/position"');
    expect(html).toContain('aria-label="Reject /data/objects/field_drone/position"');
    expect(html).toContain('aria-label="previous value 0, 0, 0"');
    expect(html).toContain('aria-label="proposed value 0, 1.85, -2.3"');
  });

  it("escapes document content so a pointer or value can never become markup", () => {
    const document: SceneDocument = {
      schemaVersion: 1,
      kind: "sceneaxi.document",
      id: "scene-escape",
      data: { objects: { label: "safe" } },
    };
    const { cwd } = workspace(document);
    const result = propose({
      documentPath: "scene.json",
      jsonPointer: "/data/objects/label",
      newValue: "<script>alert(1)</script>",
      cwd,
    });
    if (!result.ok) throw new Error("propose failed");
    const review = reviewProposal({
      proposal: result.proposal,
      documents: new Map([["scene.json", document]]),
    });
    if (!review.ok) throw new Error(review.reason);
    const html = renderSiteElementHtml(changeReviewElement(review.value));
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("styles only in Foundations tokens, and never pairs red with green", () => {
    const css = changeReviewCss();
    expect(css).toContain("color: var(--stale)");
    expect(css).toContain("color: var(--ok)");
    // Rule 02: the old value is stale bronze, not red. `--danger` appears only on
    // the reject affordance, which is a refusal, not a diff colour.
    expect(css).not.toMatch(/\.sx-cr-before[^}]*--danger/);
    expect(css).toMatch(/\.sx-cr-icon-reject:hover \{[^}]*--danger/);
  });

  it("reflows below 720px so the panel cannot overflow a 390px viewport", () => {
    const css = changeReviewCss();
    expect(css).toContain("@media (max-width: 720px)");
    expect(css).toContain("minmax(0, 1fr)");
    expect(css).toContain('grid-template-areas: "badge property actions"');
  });
});
