import { mkdtempSync, readFileSync, existsSync, mkdirSync, symlinkSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createAuthoringV1Adapter, validateDocument } from "@sceneaxi/authoring-core";

type CyclicFixture = { value?: CyclicFixture };

const document = { schemaVersion: 1, kind: "sceneaxi.document", id: "legacy", data: { greeting: "hello", value: 1 } };

describe("root-bound v1 compatibility adapter", () => {
  it("retains valid two-argument writes and propose/apply roundtrip through canonical modern authority", () => {
    const cwd = mkdtempSync(join(tmpdir(), "sceneaxi-legacy-v1-"));

    try {
      const adapter = createAuthoringV1Adapter(cwd);
      expect(Object.isFrozen(adapter)).toBe(true);
      expect(adapter.writeDocumentFile("document.json", document).ok).toBe(true);
      expect(validateDocument(JSON.parse(readFileSync(join(cwd, "document.json"), "utf8")))).toMatchObject({ ok: true, document });
      const proposal = adapter.propose({ documentPath: "document.json", jsonPointer: "/data/value", newValue: 2 });
      expect(proposal.ok).toBe(true);

      if (!proposal.ok) throw new Error("Valid v1 proposal refused");
      expect(adapter.apply(proposal.proposal).ok).toBe(true);
      expect(JSON.parse(readFileSync(join(cwd, "document.json"), "utf8")).data.value).toBe(2);
      expect(adapter.apply(proposal.proposal).ok).toBe(false);
    } finally { rmSync(cwd, { recursive: true, force: true }); }
  });
  it("does not infer authority from document paths or revive unsafe v1 payloads", () => {
    const cwd = mkdtempSync(join(tmpdir(), "sceneaxi-legacy-authority-"));

    try {
      const root = join(cwd, "root"); mkdirSync(root);
      const outside = join(cwd, "outside"); mkdirSync(outside);
      symlinkSync(outside, join(root, "escape"));
      const adapter = createAuthoringV1Adapter(root);
      expect(adapter.writeDocumentFile("../outside/traversal.json", document).ok).toBe(false);
      expect(adapter.writeDocumentFile("escape/symlink.json", document).ok).toBe(false);
      expect(existsSync(join(outside, "traversal.json"))).toBe(false);
      expect(existsSync(join(outside, "symlink.json"))).toBe(false);
      let reads = 0;
      const invalid = { ...document, data: {} };
      Object.defineProperty(invalid.data, "value", { enumerable: true, get() { reads += 1; throw new Error("Accessor evaluated"); } });
      expect(adapter.writeDocumentFile("bad.json", invalid).ok).toBe(false);
      expect(reads).toBe(0);
      const cycle: CyclicFixture = {}; cycle.value = cycle;
      expect(adapter.writeDocumentFile("cycle.json", { ...document, data: cycle }).ok).toBe(false);
      expect(existsSync(join(root, "bad.json"))).toBe(false);
      expect(existsSync(join(root, "cycle.json"))).toBe(false);
    } finally { rmSync(cwd, { recursive: true, force: true }); }
  });
});
