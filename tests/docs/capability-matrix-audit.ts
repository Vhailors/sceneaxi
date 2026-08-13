/**
 * Executable parser for docs/full-editor-v1-capability-matrix.md.
 * Inventory rows must name a known status, an owner, and honest evidence.
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";

export const MATRIX_STATUSES = Object.freeze(["real", "partial", "fake"] as const);
export type MatrixStatus = (typeof MATRIX_STATUSES)[number];

export const EDITOR_CHILD_ISSUES = Object.freeze(
  Array.from({ length: 21 }, (_, index) => 250 + index),
);

export const HOST_GRAPHICS_LIMITATION = "Electron 43.2.0";

export type MatrixTable = Readonly<{
  heading: string;
  headers: readonly string[];
  rows: readonly (readonly string[])[];
}>;

export type MatrixInventoryRow = Readonly<{
  table: string;
  label: string;
  status: MatrixStatus | string;
  evidence: string;
  dependency: string;
  body: string;
  items: readonly string[];
}>;

export type MatrixFinding = Readonly<{
  code:
    | "unknown-status"
    | "missing-owner"
    | "missing-issue-or-pr"
    | "stale-evidence-path"
    | "unsupported-real-claim"
    | "partial-missing-dependency"
    | "fake-missing-refusal"
    | "unaccounted-control"
    | "duplicate-inventory"
    | "missing-host-limitation"
    | "second-todo-list";
  message: string;
}>;

const STATUS_PATTERN = /\*\*(real|partial|fake)\*\*/i;
const ISSUE_OR_PR = /#(\d+)/g;
const PATH_PATTERN =
  /(?:`)?((?:packages|apps|desktop|tests|docs|scripts)\/[A-Za-z0-9._@{}/*-]+\.[A-Za-z0-9]+)(?:`)?/g;
const NAMED_REFUSAL = /\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/;
const KNOWN_EDITOR_ISSUES = new Set([1, 249, ...EDITOR_CHILD_ISSUES]);

export function parseMarkdownTables(markdown: string): MatrixTable[] {
  const lines = markdown.split(/\r?\n/);
  const tables: MatrixTable[] = [];
  let heading = "";
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (line.startsWith("## ")) heading = line.slice(3).trim();
    if (line.startsWith("### ")) heading = line.slice(4).trim();
    if (!/^\|/.test(line) || index + 1 >= lines.length) continue;
    const divider = lines[index + 1] ?? "";
    if (!/^\|[-:\s|]+\|$/.test(divider)) continue;
    const headers = splitRow(line);
    const rows: string[][] = [];
    index += 2;
    while (index < lines.length && /^\|/.test(lines[index] ?? "")) {
      rows.push(splitRow(lines[index] ?? ""));
      index += 1;
    }
    index -= 1;
    tables.push({ heading, headers, rows });
  }
  return tables;
}

export function expandInventoryToken(token: string): string[] {
  const start = token.indexOf("{");
  if (start === -1) return [token];
  let depth = 0;
  let end = -1;
  for (let index = start; index < token.length; index += 1) {
    const character = token[index];
    if (character === "{") depth += 1;
    if (character === "}") {
      depth -= 1;
      if (depth === 0) {
        end = index;
        break;
      }
    }
  }
  if (end === -1) return [token];
  const prefix = token.slice(0, start);
  const suffix = token.slice(end + 1);
  return splitTopLevel(token.slice(start + 1, end), ",").flatMap((choice) =>
    expandInventoryToken(`${prefix}${choice}${suffix}`),
  );
}

export function backtickItems(cell: string): string[] {
  return [...cell.matchAll(/`([^`]+)`/g)].flatMap((match) => expandInventoryToken(match[1] ?? ""));
}

export function inventoryRows(tables: readonly MatrixTable[]): MatrixInventoryRow[] {
  const rows: MatrixInventoryRow[] = [];
  for (const table of tables) {
    if (/status vocabulary/i.test(table.heading) || /todo graph/i.test(table.heading)) continue;
    const statusIndex = table.headers.findIndex((header) => /status|classification/i.test(header));
    if (statusIndex === -1) continue;
    const labelIndex = 0;
    const evidenceIndex = preferredHeaderIndex(table.headers, [
      /evidence owner/i,
      /current owner or evidence/i,
      /current evidence/i,
      /evidence/i,
      /current behavior/i,
      /owner/i,
    ]);
    const dependencyIndex = table.headers.findIndex((header) =>
      /dependency|implementation issue/i.test(header),
    );
    const itemIndex = table.headers.findIndex((header) => /item/i.test(header));
    for (const cells of table.rows) {
      const statusMatch = STATUS_PATTERN.exec(cells.join(" | "));
      rows.push({
        table: table.heading,
        label: cells[labelIndex] ?? "",
        status: statusMatch?.[1]?.toLowerCase() ?? "missing",
        evidence: cells[evidenceIndex] ?? "",
        dependency: cells[dependencyIndex] ?? cells.at(-1) ?? "",
        body: cells.join(" | "),
        items: itemIndex === -1 ? [] : backtickItems(cells[itemIndex] ?? ""),
      });
    }
  }
  return rows;
}

export function resolveRelativeCliVerbs(items: readonly string[]): string[] {
  let prefix = "";
  return items.map((item) => {
    const parts = item.split(/\s+/).filter(Boolean);
    if (parts.length > 1) {
      prefix = parts.slice(0, -1).join(" ");
      return item;
    }
    return prefix.length > 0 ? `${prefix} ${item}` : item;
  });
}

const EVIDENCE_ALIASES: readonly (readonly [RegExp, string])[] = [
  [/command interaction golden/i, "tests/e2e/desktop-command-interactions-golden.test.ts"],
  [/control inventory/i, "tests/e2e/desktop-control-inventory-golden.test.ts"],
  [/product-loop golden/i, "tests/e2e/desktop-product-loop-golden.test.ts"],
  [/hierarchy golden/i, "tests/e2e/desktop-hierarchy-golden.test.ts"],
  [/play-session golden/i, "tests/e2e/desktop-play-session-golden.test.ts"],
  [/animation golden/i, "tests/e2e/desktop-animation-golden.test.ts"],
  [/contained Git golden/i, "tests/e2e/contained-git-golden.test.ts"],
  [/asset-pipeline/i, "tests/e2e/asset-pipeline-golden.test.ts"],
  [/asset-ingestion/i, "tests/e2e/asset-ingestion-golden.test.ts"],
  [/secure-storage/i, "tests/desktop/desktop-byo-secure-storage.test.ts"],
  [/CLI golden/i, "tests/e2e/cli-golden-path.test.ts"],
  [/CLI→local bridge golden/i, "tests/e2e/desktop-cli-local-bridge-golden.test.ts"],
  [/desktop Linux bridge golden/i, "tests/e2e/desktop-linux-bridge-golden.test.ts"],
  [/Web export golden/i, "tests/e2e/desktop-web-export-golden.test.ts"],
  [/held-key/i, "packages/cli/test/held-keys.refusal-table.test.ts"],
  [/ADR 0024/i, "docs/adr/0024-linux-desktop-electron-tier.md"],
  [/check:desktop/i, "scripts/check-desktop.mjs"],
  [/registry unit tests/i, "packages/schemas/test/editor-command-registry.test.ts"],
  [/assistant poll/i, "tests/e2e/assistant-panel-golden.test.ts"],
  [/assistant-ask golden/i, "tests/e2e/desktop-assistant-ask-golden.test.ts"],
  [/parity test/i, "tests/parity/open-path-policy-parity.test.ts"],
  [/project-build tests/i, "tests/e2e/desktop-project-build-golden.test.ts"],
  [/transform golden/i, "tests/e2e/desktop-transform-golden.test.ts"],
  [/project-browser/i, "tests/e2e/desktop-project-browser-golden.test.ts"],
  [/provider-host/i, "tests/e2e/desktop-provider-host-golden.test.ts"],
  [/desktop product-loop tests/i, "apps/desktop-shell/test/product-loop.test.ts"],
  [/CLI protocol tests/i, "packages/cli/test/envelope.snapshot.test.ts"],
  [/registry verb tests/i, "packages/cli/test/registry-verbs.test.ts"],
  [/profile\/open-path tests/i, "packages/cli/test/profile-open-path.test.ts"],
  [/scene composition golden/i, "tests/e2e/scene-composition-golden.test.ts"],
  [/input-action golden/i, "tests/e2e/input-actions-golden.test.ts"],
  [/full-editor transaction golden/i, "tests/e2e/full-editor-transactions-golden.test.ts"],
  [/desktop scene edit contract/i, "packages/schemas/src/desktop-scene-edit.ts"],
];

export function extractEvidencePaths(text: string): string[] {
  const paths = [...text.matchAll(PATH_PATTERN)].map((match) => match[1] ?? "").filter(Boolean);
  for (const [pattern, path] of EVIDENCE_ALIASES) {
    if (pattern.test(text)) paths.push(path);
  }
  return [...new Set(paths)];
}

export function auditMatrixDocument(
  markdown: string,
  repoRoot: string,
  live: Readonly<{
    controls: readonly string[];
    injected: readonly string[];
    cliVerbs: readonly string[];
    bridgeActions: readonly string[];
    authoringOps: readonly string[];
    assistantOps: readonly string[];
    tools: readonly string[];
    platformTargets: readonly string[];
  }>,
): MatrixFinding[] {
  const findings: MatrixFinding[] = [];
  if (!markdown.includes(HOST_GRAPHICS_LIMITATION) || !/host limitation/i.test(markdown)) {
    findings.push({
      code: "missing-host-limitation",
      message: "Matrix must keep the Electron 43.2.0 local headless crash as a host limitation.",
    });
  }
  if (!/GitHub sub-issue graph under #249 is the canonical todo list/i.test(markdown)) {
    findings.push({
      code: "second-todo-list",
      message: "Matrix must keep the #249 graph as the only todo list.",
    });
  }

  const rows = inventoryRows(parseMarkdownTables(markdown));
  const seen = new Map<string, string>();
  const account = (
    kind: string,
    items: readonly string[],
    expected: readonly string[],
  ) => {
    for (const item of items) {
      const key = `${kind}:${item}`;
      const previous = seen.get(key);
      if (previous !== undefined) {
        findings.push({
          code: "duplicate-inventory",
          message: `${kind} ${item} is listed more than once (${previous}).`,
        });
      } else {
        seen.set(key, kind);
      }
    }
    for (const item of expected) {
      if (!items.includes(item)) {
        findings.push({
          code: "unaccounted-control",
          message: `${kind} ${item} is exposed but missing from the matrix.`,
        });
      }
    }
    for (const item of items) {
      if (!expected.includes(item)) {
        findings.push({
          code: "unaccounted-control",
          message: `${kind} ${item} is inventoried but not an exposed control.`,
        });
      }
    }
  };

  const desktopControls = rows
    .filter((row) => row.table === "Desktop controls and states")
    .flatMap((row) => row.items);
  const injected = rows
    .filter((row) => row.table === "Linux-only injected BYOK controls")
    .map((row) => row.label.replace(/^\|?\s*|\s*$/g, "").trim());
  const cliVerbs = rows
    .filter((row) => row.table === "CLI, bridge, and assistant inventory" && /^CLI$/i.test(row.label.trim()))
    .flatMap((row) => resolveRelativeCliVerbs(row.items));
  const bridgeActions = rows
    .filter((row) => /Electron bridge actions/i.test(row.label))
    .flatMap((row) => row.items);
  const authoringOps = rows
    .filter((row) => /Authoring operations/i.test(row.label))
    .flatMap((row) => row.items);
  const assistantOps = rows
    .filter((row) => /Assistant operations/i.test(row.label))
    .flatMap((row) => row.items);
  const tools = rows
    .filter((row) => /Local-agent tools/i.test(row.label))
    .flatMap((row) => row.items);
  const platformTargets = rows
    .filter((row) => row.table === "Packaging and runtime surfaces")
    .map((row) => row.label.trim())
    .filter((label) => /project build artifact|editor (application build|packaging)/i.test(label));

  account("control", desktopControls, live.controls);
  account("injected", injected, live.injected);
  account("cli", cliVerbs, live.cliVerbs);
  account("bridge-action", bridgeActions, live.bridgeActions);
  account("authoring-op", authoringOps, live.authoringOps);
  account("assistant-op", assistantOps, live.assistantOps);
  account("tool", tools, live.tools);
  account("platform-target", platformTargets, live.platformTargets);

  for (const row of rows) {
    if (!MATRIX_STATUSES.includes(row.status as MatrixStatus)) {
      findings.push({
        code: "unknown-status",
        message: `${row.label} has unknown status ${row.status}.`,
      });
      continue;
    }
    if (row.evidence.trim().length === 0) {
      findings.push({
        code: "missing-owner",
        message: `${row.label} is missing an evidence owner.`,
      });
    }
    const cited = [...row.body.matchAll(ISSUE_OR_PR)].map((match) => Number(match[1]));
    if (cited.some((issue) => !KNOWN_EDITOR_ISSUES.has(issue))) {
      findings.push({
        code: "missing-issue-or-pr",
        message: `${row.label} cites an issue outside the editor graph.`,
      });
    }
    const paths = extractEvidencePaths(row.body);
    for (const path of paths) {
      if (path.includes("*") || path.includes("{")) continue;
      if (!existsSync(resolve(repoRoot, path))) {
        findings.push({
          code: "stale-evidence-path",
          message: `${row.label} cites missing path ${path}.`,
        });
      }
    }
    if (row.status === "real") {
      const hasPath = paths.some((path) =>
        path.includes("*") || path.includes("{") || existsSync(resolve(repoRoot, path)),
      );
      if (!hasPath) {
        findings.push({
          code: "unsupported-real-claim",
          message: `${row.label} is real but has no existing evidence path.`,
        });
      }
    }
    if (row.status === "partial" && !namesRemainingDependency(row.dependency, row.body)) {
      findings.push({
        code: "partial-missing-dependency",
        message: `${row.label} is partial but does not name the remaining dependency.`,
      });
    }
    if (row.status === "fake" && !NAMED_REFUSAL.test(row.body)) {
      findings.push({
        code: "fake-missing-refusal",
        message: `${row.label} is fake but has no named refusal.`,
      });
    }
  }

  return findings;
}

function namesRemainingDependency(dependency: string, evidence: string): boolean {
  const text = `${dependency} ${evidence}`;
  return (
    /#\d+/.test(text) ||
    /\bnone\b/i.test(text) ||
    /operator|credential|host|external|authoriz|keep |remains|later /i.test(text)
  );
}

function preferredHeaderIndex(headers: readonly string[], patterns: readonly RegExp[]): number {
  for (const pattern of patterns) {
    const index = headers.findIndex((header) => pattern.test(header));
    if (index !== -1) return index;
  }
  return -1;
}

function splitRow(line: string): string[] {
  return line
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function splitTopLevel(value: string, delimiter: string): string[] {
  const parts: string[] = [];
  let current = "";
  let depth = 0;
  for (const character of value) {
    if (character === "{") depth += 1;
    if (character === "}") depth -= 1;
    if (character === delimiter && depth === 0) {
      parts.push(current.trim());
      current = "";
      continue;
    }
    current += character;
  }
  if (current.length > 0) parts.push(current.trim());
  return parts;
}
