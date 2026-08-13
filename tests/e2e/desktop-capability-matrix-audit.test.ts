import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  DESKTOP_LOCAL_BRIDGE_TOOLS,
  EDITOR_COMMAND_REGISTRY,
} from "@sceneaxi/schemas";
import {
  DESKTOP_MODE_IDS,
  DESKTOP_PROFILE_IDS,
  createDesktopVisualState,
  desktopVisualView,
  type DesktopControl,
} from "@sceneaxi/desktop-shell";
import {
  DESKTOP_BRIDGE_ACTIONS,
  DESKTOP_BRIDGE_ASSISTANT_OPS,
  DESKTOP_BRIDGE_AUTHORING_OPS,
} from "../../desktop/linux/src/lib/bridge-contract.ts";
import { ROOT_COMMANDS, type CommandNode } from "../../packages/cli/src/commands.ts";
import {
  EDITOR_CHILD_ISSUES,
  HOST_GRAPHICS_LIMITATION,
  auditMatrixDocument,
} from "../docs/capability-matrix-audit.ts";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const matrix = readFileSync(resolve(repoRoot, "docs/full-editor-v1-capability-matrix.md"), "utf8");

const CONTROL_KINDS = new Set(["view", "live", "inert"]);
const NOT_RENDERED = [/^profiles\[\d+\]\.assistant(\.|$)/, /^controls(\[|$)/];

function isControl(value: unknown): value is DesktopControl {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate["id"] === "string" &&
    typeof candidate["label"] === "string" &&
    typeof candidate["kind"] === "string" &&
    CONTROL_KINDS.has(candidate["kind"])
  );
}

function collectControlIds(
  node: unknown,
  path = "",
  found: Set<string> = new Set(),
): Set<string> {
  if (NOT_RENDERED.some((pattern) => pattern.test(path))) return found;
  if (isControl(node)) {
    found.add(node.id);
    return found;
  }
  if (Array.isArray(node)) {
    node.forEach((item, index) => collectControlIds(item, `${path}[${index}]`, found));
    return found;
  }
  if (typeof node === "object" && node !== null) {
    for (const [field, value] of Object.entries(node)) {
      collectControlIds(value, path === "" ? field : `${path}.${field}`, found);
    }
  }
  return found;
}

function uniqueControlIds() {
  const ids = new Set<string>();
  for (const mode of DESKTOP_MODE_IDS) {
    for (const profile of DESKTOP_PROFILE_IDS) {
      collectControlIds(desktopVisualView(createDesktopVisualState({ mode, profile })), "", ids);
    }
  }
  return [...ids].sort();
}

function verbPaths(node: CommandNode, prefix: readonly string[]): string[] {
  if (node.kind === "verb") return [prefix.join(" ")];
  return Object.entries(node.children).flatMap(([name, child]) =>
    verbPaths(child, [...prefix, name]),
  );
}

const live = Object.freeze({
  controls: uniqueControlIds(),
  injected: Object.freeze([
    "OpenRouter provider select",
    "Password input",
    "Save/Replace key",
    "Remove key",
  ]),
  cliVerbs: Object.entries(ROOT_COMMANDS).flatMap(([name, node]) => verbPaths(node, [name])),
  bridgeActions: [...DESKTOP_BRIDGE_ACTIONS],
  authoringOps: [...DESKTOP_BRIDGE_AUTHORING_OPS],
  assistantOps: [...DESKTOP_BRIDGE_ASSISTANT_OPS],
  tools: DESKTOP_LOCAL_BRIDGE_TOOLS.map((tool) => tool.name),
  platformTargets: Object.freeze([
    "Linux editor application build (`AppImage`, `.deb`)",
    "macOS editor packaging",
    "Windows editor packaging",
    "Linux project build artifact",
    "macOS project build artifact",
    "Windows project build artifact",
  ]),
});

describe("full-editor capability-matrix evidence", () => {
  it("fails for dishonest inventory rows and unaccounted public seams", () => {
    const findings = auditMatrixDocument(matrix, repoRoot, live);
    expect(findings, findings.map((finding) => `${finding.code}: ${finding.message}`).join("\n")).toEqual([]);
  });

  it("keeps the host graphics limitation and agrees the child graph is the only todo list", () => {
    expect(matrix).toContain(HOST_GRAPHICS_LIMITATION);
    expect(matrix).toMatch(/host limitation/i);
    expect(matrix).toContain("The GitHub sub-issue graph under #249 is the canonical todo list");
    expect(matrix).toMatch(/Matrix-to-evidence enforcement \| \*\*real\*\*/);
    for (const issue of EDITOR_CHILD_ISSUES) {
      expect(matrix, `#${issue}`).toContain(`#${issue}`);
    }
    expect(EDITOR_COMMAND_REGISTRY.length).toBeGreaterThan(0);
    expect(live.controls).toHaveLength(112);
    expect(live.cliVerbs).toHaveLength(21);
    expect(live.tools.length).toBe(DESKTOP_LOCAL_BRIDGE_TOOLS.length);
  });
});
