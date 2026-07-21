import { describe, expect, it } from "vitest";
import {
  DOCUMENT_KIND,
  DOCUMENT_SCHEMA_VERSION,
  PROPOSAL_KIND,
  PROPOSAL_SCHEMA_VERSION,
  contracts,
  createDocument,
  createProposal,
  parseDocumentText,
  parseProposalText,
  serializeDocument,
  serializeProposal,
  validateDocument,
  validateProposal,
} from "@sceneaxi/schemas";

describe("document contract", () => {
  it("accepts a valid v1 document and serializes canonically", () => {
    const doc = createDocument({
      id: "demo-scene",
      title: "Demo",
      data: { entities: [{ id: "a", x: 1 }] },
    });
    const v = validateDocument(doc);
    expect(v.ok).toBe(true);
    expect(doc.schemaVersion).toBe(DOCUMENT_SCHEMA_VERSION);
    expect(doc.kind).toBe(DOCUMENT_KIND);
    const text = serializeDocument(doc);
    expect(text).toMatch(/^\{\n/);
    expect(text.endsWith("\n")).toBe(true);
    const again = parseDocumentText(text);
    expect(again.ok).toBe(true);
  });

  it("refuses major schema mismatch", () => {
    const r = validateDocument({
      schemaVersion: 2,
      kind: DOCUMENT_KIND,
      id: "x",
      data: {},
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe("schema-major-mismatch");
      expect(r.foundSchemaVersion).toBe(2);
    }
  });

  it("refuses invalid id and unexpected properties", () => {
    expect(
      validateDocument({
        schemaVersion: 1,
        kind: DOCUMENT_KIND,
        id: "BAD_ID",
        data: {},
      }).ok,
    ).toBe(false);
    expect(
      validateDocument({
        schemaVersion: 1,
        kind: DOCUMENT_KIND,
        id: "ok",
        data: {},
        extra: true,
      }).ok,
    ).toBe(false);
  });
});

describe("proposal contract", () => {
  it("accepts a valid v1 proposal", () => {
    const proposal = createProposal({
      edits: [
        {
          documentPath: "scene.json",
          baseContentHash:
            "sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
          jsonPointer: "/data/x",
          oldValue: 0,
          newValue: 1,
        },
      ],
      diffs: [
        {
          documentPath: "scene.json",
          unifiedDiff: "--- a/scene.json\n+++ b/scene.json\n",
        },
      ],
    });
    const v = validateProposal(proposal);
    expect(v.ok).toBe(true);
    expect(proposal.schemaVersion).toBe(PROPOSAL_SCHEMA_VERSION);
    expect(proposal.kind).toBe(PROPOSAL_KIND);
    const text = serializeProposal(proposal);
    expect(parseProposalText(text).ok).toBe(true);
  });

  it("refuses major schema mismatch and bad hashes", () => {
    const mismatch = validateProposal({
      schemaVersion: 9,
      kind: PROPOSAL_KIND,
      edits: [
        {
          documentPath: "a.json",
          baseContentHash:
            "sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
          jsonPointer: "/data/x",
          oldValue: 0,
          newValue: 1,
        },
      ],
      diffs: [{ documentPath: "a.json", unifiedDiff: "" }],
    });
    expect(mismatch.ok).toBe(false);
    if (!mismatch.ok) expect(mismatch.code).toBe("schema-major-mismatch");

    const badHash = validateProposal({
      schemaVersion: 1,
      kind: PROPOSAL_KIND,
      edits: [
        {
          documentPath: "a.json",
          baseContentHash: "not-a-hash",
          jsonPointer: "/data/x",
          oldValue: 0,
          newValue: 1,
        },
      ],
      diffs: [{ documentPath: "a.json", unifiedDiff: "" }],
    });
    expect(badHash.ok).toBe(false);
  });

  it("registers document and proposal contracts on the public contracts map", () => {
    expect(contracts.document).toBe("contracts/document.schema.json");
    expect(contracts.proposal).toBe("contracts/proposal.schema.json");
  });
});
