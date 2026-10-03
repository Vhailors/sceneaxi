import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createDesktopSession } from "@sceneaxi/desktop-shell";
import { createDocument, propose, serializeDocument, writeDocumentFile } from "@sceneaxi/authoring-core";

const roots: string[] = [];

afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "sceneaxi-prepared-session-"));
  roots.push(root);
  expect(writeDocumentFile("scene.json", createDocument({ id: "prepared", data: { value: "old" } }), { cwd: root }).ok).toBe(true);
  const before = readFileSync(join(root, "scene.json"), "utf8");
  const prepared = propose({ documentPath: "scene.json", jsonPointer: "/data/value", newValue: "new", cwd: root });

  if (!prepared.ok) throw new Error("fixture proposal failed");

  return { root, before, prepared, session: createDesktopSession({ cwd: root }) };
}

describe("exact prepared E1 session authority", () => {
  it("retains the original cancellation fence when the caller replaces its signal", async () => {
    const f = fixture();
    const cancellation = new AbortController();
    const input = { ...f.prepared, signal: cancellation.signal };
    const pending = f.session.stagePreparedProposal(input);
    cancellation.abort();
    input.signal = new AbortController().signal;
    const review = await pending;
    expect(review.proposal).toBeNull();
    expect(review.diagnostics?.[0]?.code).toBe("invalid-proposal");
    expect(readFileSync(join(f.root, "scene.json"), "utf8")).toBe(f.before);
  });
  it("exposes exact prepared E1 staging through session authority", () => {
    expect(createDesktopSession()).toHaveProperty("stagePreparedProposal", expect.any(Function));
  });
  it("retains exact identity/diff without a write, then accepts and undoes via shared authority", async () => {
    const f = fixture();
    const review = await f.session.stagePreparedProposal(f.prepared);
    expect(review).toMatchObject({ phase: "reviewing", diagnostics: null });
    expect(review.proposal).toBe(f.prepared.proposal);
    expect(review.unifiedDiff).toBe(f.prepared.unifiedDiff);
    expect(Object.isFrozen(review.proposal?.edits[0])).toBe(true);
    expect(readFileSync(join(f.root, "scene.json"), "utf8")).toBe(f.before);
    expect(f.session.accept().phase).toBe("applied");
    expect(f.session.status("scene.json")).toMatchObject({ ok: true, data: { value: "new" } });
    expect(f.session.undo().ok).toBe(true);
    expect(readFileSync(join(f.root, "scene.json"), "utf8")).toBe(f.before);
  });
  it("refuses a tampered display diff without staging or writing", async () => {
    const f = fixture();
    const review = await f.session.stagePreparedProposal({ ...f.prepared, unifiedDiff: "forged display" });
    expect(review.diagnostics?.[0]?.code).toBe("invalid-proposal");
    expect(review.proposal).toBeNull();
    expect(readFileSync(join(f.root, "scene.json"), "utf8")).toBe(f.before);
  });
  it("seals proposal values and display evidence before asynchronous admission", async () => {
    const f = fixture();
    const input = { proposal: f.prepared.proposal, unifiedDiff: f.prepared.unifiedDiff };
    const pending = f.session.stagePreparedProposal(input);
    expect(() => Object.assign(input.proposal.edits[0] ?? {}, { newValue: "tampered" })).toThrow();
    input.unifiedDiff = "late forged display";
    const review = await pending;
    expect(review.proposal).toBe(f.prepared.proposal);
    expect(review.unifiedDiff).toBe(f.prepared.unifiedDiff);
    expect(readFileSync(join(f.root, "scene.json"), "utf8")).toBe(f.before);
  });
  it("refuses a stale document before installing the exact proposal", async () => {
    const f = fixture();
    const changed = serializeDocument(createDocument({ id: "prepared", data: { value: "external" } }));
    writeFileSync(join(f.root, "scene.json"), changed);
    expect((await f.session.stagePreparedProposal(f.prepared)).diagnostics?.[0]?.code).toBe("content-hash-conflict");
    expect(f.session.snapshot().proposal).toBeNull();
    expect(readFileSync(join(f.root, "scene.json"), "utf8")).toBe(changed);
  });
  it("retains apply's stale-base refusal after review instead of overwriting a later edit", async () => {
    const f = fixture();
    await f.session.stagePreparedProposal(f.prepared);
    const changed = serializeDocument(createDocument({ id: "prepared", data: { value: "later" } }));
    writeFileSync(join(f.root, "scene.json"), changed);
    expect(f.session.accept()).toMatchObject({ phase: "reviewing", diagnostics: [{ code: "content-hash-conflict" }] });
    expect(readFileSync(join(f.root, "scene.json"), "utf8")).toBe(changed);
  });
  it("does not replace an existing review", async () => {
    const f = fixture();
    const original = f.session.proposeEdit({ documentPath: "scene.json", jsonPointer: "/data/value", newValue: "first" });
    const rejected = await f.session.stagePreparedProposal(f.prepared);
    expect(rejected.proposal).toBe(original.proposal);
    expect(rejected.diagnostics?.[0]?.code).toBe("invalid-proposal");
    expect(readFileSync(join(f.root, "scene.json"), "utf8")).toBe(f.before);
  });
  it("cancellation during descriptor admission cannot publish a late review or write", async () => {
    const f = fixture();
    const abort = new AbortController();
    const result = f.session.stagePreparedProposal({ ...f.prepared, signal: abort.signal });
    abort.abort();
    expect((await result).proposal).toBeNull();
    expect(f.session.accept().phase).toBe("idle");
    expect(readFileSync(join(f.root, "scene.json"), "utf8")).toBe(f.before);
  });
  it("a reject while admission awaits disk retires the generation", async () => {
    const f = fixture();
    const result = f.session.stagePreparedProposal(f.prepared);
    f.session.reject();
    expect((await result).phase).toBe("rejected");
    expect(f.session.snapshot().proposal).toBeNull();
  });
  it("a new review while admission awaits disk wins without late replacement", async () => {
    const f = fixture();
    const result = f.session.stagePreparedProposal(f.prepared);
    const newer = f.session.proposeEdit({ documentPath: "scene.json", jsonPointer: "/data/value", newValue: "first" });
    expect((await result).proposal).toBe(newer.proposal);
    expect(f.session.snapshot().diagnostics).toBeNull();
  });
  it("refuses symlink redirection and escaped paths", async () => {
    const f = fixture();
    symlinkSync(join(f.root, "scene.json"), join(f.root, "redirect.json"));

    for (const documentPath of ["redirect.json", "../scene.json", join(f.root, "scene.json")]) {
      const proposal = { ...f.prepared.proposal,
        edits: f.prepared.proposal.edits.map(edit => ({ ...edit, documentPath })),
        diffs: f.prepared.proposal.diffs.map(diff => ({ ...diff, documentPath })) };

      expect((await f.session.stagePreparedProposal({ proposal, unifiedDiff: f.prepared.unifiedDiff })).proposal).toBeNull();
    }

    expect(readFileSync(join(f.root, "scene.json"), "utf8")).toBe(f.before);
  });
});
