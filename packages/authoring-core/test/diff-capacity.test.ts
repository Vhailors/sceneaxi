import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { resolve, join } from "node:path";
import { describe, expect, it } from "vitest";
import { transpileModule, ModuleKind, ScriptTarget } from "typescript";
import { unifiedDiff, createDocument, writeDocumentFile, propose, apply, parseDocumentText, serializeDocument } from "@sceneaxi/authoring-core";

function reconstruct(diff: string): { before: string; after: string } {
  const before: string[] = [];
  const after: string[] = [];
  for (const line of diff.split("\n").slice(3)) {
    if (line.startsWith(" ") || line.startsWith("-")) before.push(line.slice(1));
    if (line.startsWith(" ") || line.startsWith("+")) after.push(line.slice(1));
  }
  return { before: before.join("\n"), after: after.join("\n") };
}

describe("AP-PERF bounded canonical review diff", () => {
  it("proposes/applies/reloads a 5000-line asset-like canonical document without changing review or persistence semantics", () => {
    const root = mkdtempSync(join(tmpdir(), "sceneaxi-diff-capacity-"));
    try {
      const before = createDocument({ id: "capacity", data: { positions: Array.from({ length: 5000 }, (_, i) => i) } });
      const path = join(root, "scene.json");
      expect(writeDocumentFile(path, before, { cwd: root }).ok).toBe(true);
      for (const offset of [1, 2]) {
        const accepted = readFileSync(path, "utf8");
        const positions = Array.from({ length: 5000 }, (_, i) => i + offset);
        const review = propose({ cwd: root, documentPath: "scene.json", jsonPointer: "/data/positions", newValue: positions });
        expect(review.ok).toBe(true);
        if (!review.ok) throw new Error("Capacity proposal refused");
        const expected = serializeDocument(createDocument({ id: "capacity", data: { positions } }));
        expect(reconstruct(review.unifiedDiff)).toEqual({ before: accepted.trimEnd(), after: expected.trimEnd() });
        expect(readFileSync(path, "utf8")).toBe(accepted);
        expect(apply({ cwd: root, proposal: review.proposal }).ok).toBe(true);
        expect(readFileSync(path, "utf8")).toBe(expected);
        expect(parseDocumentText(readFileSync(path, "utf8"))).toMatchObject({ ok: true, document: { data: { positions } } });
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("reconstructs both full canonical texts for large sparse and dense changes", () => {
    const before = Array.from({ length: 5000 }, (_, i) => `old-${i}`).join("\n");
    for (const after of [before.replace("old-2500", "changed-2500"), before.replaceAll("old-", "new-")]) {
      const diff = unifiedDiff(before, after, { oldPath: "scene.json", newPath: "scene.json" });
      expect(reconstruct(diff)).toEqual({ before, after });
      expect(unifiedDiff(before, after, { oldPath: "scene.json", newPath: "scene.json" })).toBe(diff);
    }
  });

  it("reviews a 5000-line reload in a fresh 96MiB process without quadratic allocation", () => {
    // Execute the exact current helper, not a possibly stale dist artifact.
    const path = resolve("packages/authoring-core/src/unified-diff.ts");
    const source = readFileSync(path, "utf8");
    const js = transpileModule(source, { compilerOptions: { module: ModuleKind.ESNext, target: ScriptTarget.ES2022 } }).outputText;
    const script = `${js}
const before = Array.from({ length: 5000 }, (_, i) => "old-" + i).join("\\n");
const after = before.replaceAll("old-", "new-");
const started = performance.now();
const diff = unifiedDiff(before, after, { oldPath: "scene.json", newPath: "scene.json" });
if (!diff.includes("-old-4999") || !diff.includes("+new-4999")) process.exit(2);
const durationMs = performance.now()-started;
const maxRssKiB = process.resourceUsage().maxRSS;
if (durationMs > 500 || maxRssKiB > 131072) process.exit(3);
console.log(JSON.stringify({ durationMs, maxRssKiB, diffBytes: Buffer.byteLength(diff) }));`;
    const child = spawnSync(process.execPath, ["--max-old-space-size=96", "--input-type=module", "-e", script], { encoding: "utf8", timeout: 10000, maxBuffer: 16384 });
    expect(child.error).toBeUndefined();
    expect(child.status, child.stderr).toBe(0);
    expect(child.signal).toBeNull();
    console.info(child.stdout.trim());
  });
});
