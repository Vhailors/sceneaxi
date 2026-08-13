/** Durable workspace layout stored outside the Scene Document. */
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { atomicWriteFile } from "@sceneaxi/authoring-core";
import {
  applyWorkspaceLayoutMutation,
  inspectWorkspaceLayout,
  parseWorkspaceLayout,
  type WorkspaceLayout,
} from "@sceneaxi/schemas";

export const WORKSPACE_LAYOUT_PATH = ".sceneaxi/workspace-layout.v1.json" as const;

function layoutPath(cwd: string): string {
  return join(cwd, WORKSPACE_LAYOUT_PATH);
}

function loadLayout(cwd: string) {
  const path = layoutPath(cwd);
  if (!existsSync(path)) {
    return parseWorkspaceLayout(undefined);
  }
  try {
    return parseWorkspaceLayout(JSON.parse(readFileSync(path, "utf8")));
  } catch {
    return parseWorkspaceLayout({ invalid: true });
  }
}

function writeLayout(cwd: string, layout: WorkspaceLayout): void {
  const path = layoutPath(cwd);
  mkdirSync(dirname(path), { recursive: true });
  atomicWriteFile(path, `${JSON.stringify(layout, null, 2)}\n`);
}

export function inspectDesktopWorkspaceLayout(cwd: string) {
  const parsed = loadLayout(cwd);
  if (!parsed.ok) return parsed;
  return Object.freeze({
    ok: true as const,
    inspection: inspectWorkspaceLayout(parsed.layout),
    recovered: parsed.recovered,
    ...(parsed.recovered ? { recoveryReason: parsed.reason } : {}),
  });
}

export function applyDesktopWorkspaceLayout(input: Readonly<{
  cwd: string;
  profile: unknown;
  next: Partial<Pick<WorkspaceLayout, "leftVisible" | "inspectorVisible" | "assistantVisible" | "dockHeight" | "layoutId">>;
}>) {
  const parsed = loadLayout(input.cwd);
  if (!parsed.ok) return parsed;
  const applied = applyWorkspaceLayoutMutation({
    layout: parsed.layout,
    profile: input.profile,
    mutation: { kind: "set", next: input.next },
  });
  if (!applied.ok) return applied;
  writeLayout(input.cwd, applied.layout);
  return Object.freeze({
    ok: true as const,
    inspection: inspectWorkspaceLayout(applied.layout),
  });
}

export function resetDesktopWorkspaceLayout(input: Readonly<{ cwd: string; profile: unknown }>) {
  const parsed = loadLayout(input.cwd);
  if (!parsed.ok) return parsed;
  const applied = applyWorkspaceLayoutMutation({
    layout: parsed.layout,
    profile: input.profile,
    mutation: { kind: "reset" },
  });
  if (!applied.ok) return applied;
  writeLayout(input.cwd, applied.layout);
  return Object.freeze({
    ok: true as const,
    inspection: inspectWorkspaceLayout(applied.layout),
  });
}
