import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  auditMatrixDocument,
  expandInventoryToken,
  parseMarkdownTables,
  resolveRelativeCliVerbs,
} from "./capability-matrix-audit.ts";

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const live = Object.freeze({
  controls: Object.freeze(["scene-play"]),
  injected: Object.freeze(["OpenRouter provider select"]),
  cliVerbs: Object.freeze(["project new"]),
  bridgeActions: Object.freeze(["handshake"]),
  authoringOps: Object.freeze(["status"]),
  assistantOps: Object.freeze(["start"]),
  tools: Object.freeze(["sceneaxi.project.status"]),
  platformTargets: Object.freeze(["Linux project build artifact"]),
});

function document(body: string) {
  return [
    "The GitHub sub-issue graph under #249 is the canonical todo list.",
    "The Electron 43.2.0 local headless graphics crash is a host limitation.",
    body,
  ].join("\n\n");
}

describe("capability matrix audit", () => {
  it("expands brace families and relative CLI verbs", () => {
    expect(expandInventoryToken("scene-property-{translation,rotation}-{x,y}")).toEqual([
      "scene-property-translation-x",
      "scene-property-translation-y",
      "scene-property-rotation-x",
      "scene-property-rotation-y",
    ]);
    expect(resolveRelativeCliVerbs(["project new", "dev", "scene compose"])).toEqual([
      "project new",
      "project dev",
      "scene compose",
    ]);
    expect(parseMarkdownTables("| A | B |\n|---|---|\n| 1 | 2 |\n")[0]?.rows).toEqual([["1", "2"]]);
  });

  it("fails unknown status, missing owner, stale path, and dishonest rows", () => {
    const root = mkdtempSync(join(tmpdir(), "sceneaxi-matrix-audit-"));
    dirs.push(root);
    writeFileSync(join(root, "exists.test.ts"), "export {}\n");
    const markdown = document(`
## Desktop controls and states

| Item(s) | Status | Current behavior and refusal | Evidence owner | Smallest dependency |
|---|---|---|---|---|
| \`scene-play\` | **maybe** | Does something | \`exists.test.ts\` | None |
| \`ghost\` | **real** | Named |  | None |
| \`other-play\` | **real** | Path gone | \`tests/missing.test.ts\` | None |
| extra | **real** | No path at all | prose only | None |
| leftover | **partial** | Gap | \`exists.test.ts\` | |
| silent | **fake** | Looks live | \`exists.test.ts\` | later work |

## Linux-only injected BYOK controls

| Item | Status | Current behavior | Evidence owner | Smallest dependency |
|---|---|---|---|---|
| OpenRouter provider select | **partial** | Real selector | \`exists.test.ts\` | Operator host. |

## CLI, bridge, and assistant inventory

| Surface | Item(s) | Status | Current behavior / gap | Evidence and next dependency |
|---|---|---|---|---|
| CLI | \`project new\` | **real** | Verb | \`exists.test.ts\` |
| Electron bridge actions | \`handshake\` | **real** | Action | \`exists.test.ts\` |
| Authoring operations | \`status\` | **real** | Op | \`exists.test.ts\` |
| Assistant operations | \`start\` | **real** | Op | \`exists.test.ts\` |
| Local-agent tools | \`sceneaxi.project.status\` | **real** | Tool | \`exists.test.ts\` |

## Packaging and runtime surfaces

| Surface | Status | Current evidence and blocker | Smallest dependency |
|---|---|---|---|
| Linux project build artifact | **fake** | No target. \`PROJECT_BUILD_HOST_UNSUPPORTED\` | [#266](https://github.com/Vhailors/sceneaxi/issues/266). |
`);
    const codes = auditMatrixDocument(markdown, root, live).map((finding) => finding.code);
    expect(codes).toEqual(expect.arrayContaining([
      "unknown-status",
      "missing-owner",
      "stale-evidence-path",
      "unsupported-real-claim",
      "partial-missing-dependency",
      "fake-missing-refusal",
      "unaccounted-control",
    ]));
  });

  it("fails when the host limitation or canonical todo sentence is missing", () => {
    const findings = auditMatrixDocument("# empty", process.cwd(), live);
    expect(findings.map((finding) => finding.code)).toEqual(expect.arrayContaining([
      "missing-host-limitation",
      "second-todo-list",
    ]));
  });
});
