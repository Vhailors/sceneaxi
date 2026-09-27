#!/usr/bin/env node
/**
 * Surface map — the go-live graphmap: every endpoint and feature, by area, with state.
 *
 * Inputs (all committed, none network):
 * - `docs/audits/surface-probe.json` from `scripts/probe-surfaces.mjs` (site routes, CLI)
 * - `docs/audits/initiation/runtime-surfaces.json` (editor commands, desktop controls,
 *   local-agent tools, bridge actions)
 * - `docs/full-editor-v1-capability-matrix.md` (real / partial / fake per desktop control)
 * - mounted-chrome goldens (which editor commands have validated GUI dispatch evidence)
 * - `docs/audits/go-live-backlog.json` (the go-live item behind a gap, and why it is parked)
 *
 * Outputs: `docs/audits/surface-map.json`, `surface-map.html` (self-contained, no remote
 * asset), and `surface-map.md` (a Mermaid overview GitHub renders).
 *
 * States: working · unconfigured (needs provider config in this run) · refused (by-design
 * boundary) · partial · gap (a go-live backlog item owns it) · parked (a captain decision
 * owns it) · broken. Nothing is rounded up: a node is `working` only on evidence.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as nodeModule from "node:module";
import { RESOLVER_URL, resolve as workspaceResolve } from "./workspace-dist-resolver.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const read = (path) => readFileSync(join(root, path), "utf8");

const json = (path) => JSON.parse(read(path));

const probePath = "docs/audits/surface-probe.json";

if (!existsSync(join(root, probePath))) {
  process.stderr.write("surface map: run `node scripts/probe-surfaces.mjs` first\n");
  process.exit(1);
}

const probe = json(probePath);

const surfaces = json("docs/audits/initiation/runtime-surfaces.json");

const backlog = json("docs/audits/go-live-backlog.json").items;

const backlogItem = (id) => backlog.find((item) => item.id === id);

/** A node's go-live item, if any: `gap` while open, `parked` when a decision owns it. */
function fromBacklog(id) {
  const item = backlogItem(id);

  if (!item || item.status === "done") return null;

  return { state: item.status === "parked" ? "parked" : "gap", item: id, note: item.parkedReason ?? item.title };
}

// --- desktop control states from the capability matrix -----------------------------
/** `a-{b,c}-{x,y}` → the four ids, which is how the matrix writes control families. */
function expandBraces(pattern) {
  const open = pattern.indexOf("{");

  if (open < 0) return [pattern];
  const close = pattern.indexOf("}", open);

  return pattern
    .slice(open + 1, close)
    .split(",")
    .flatMap((option) => expandBraces(pattern.slice(0, open) + option + pattern.slice(close + 1)));
}

const matrixState = new Map();

for (const line of read("docs/full-editor-v1-capability-matrix.md").split("\n")) {
  const cells = line.split("|").map((cell) => cell.trim());
  const status = cells[3]?.match(/\*\*([a-z -]+)\*\*/)?.[1];

  if (!status) continue;

  for (const id of cells[1].matchAll(/`([a-zA-Z0-9{},*-]+)`/g)) {
    for (const expanded of expandBraces(id[1])) matrixState.set(expanded, status);
  }
}

const controlState = (id) => {
  const status = matrixState.get(id) ?? [...matrixState].find(([key]) => key.endsWith("*") && id.startsWith(key.slice(0, -1)))?.[1];

  if (status === "real") return { state: "working" };

  if (status === "partial") return { state: "partial" };

  // Item 57 turned fake controls into visibly inert ones that name their refusal up
  // front; once it is done they are a by-design refusal, not an open gap.
  if (status === "fake") {
    return fromBacklog(57) ?? { state: "refused", note: "inert: no product operation behind it (capability matrix: fake)" };
  }

  if (status?.startsWith("deliberately")) return { state: "refused", note: status };

  return { state: "unknown", note: "no capability-matrix row" };
};

// --- editor commands: only golden-proven GUI dispatch counts as working ------------

const registryModule = join(root, "packages/schemas/dist/src/editor-command-registry.js");

if (!existsSync(registryModule)) {
  process.stderr.write("surface map: run `pnpm build` first (reads the built editor command registry)\n");
  process.exit(1);
}

if (typeof nodeModule.registerHooks === "function") {
  nodeModule.registerHooks({ resolve: workspaceResolve });
} else {
  nodeModule.register(RESOLVER_URL);
}

const { EDITOR_COMMAND_REGISTRY } = await import(registryModule);
const interactionModule = join(root, "apps/desktop-shell/dist/src/interaction-commands.js");
if (!existsSync(interactionModule)) {
  process.stderr.write("surface map: run `pnpm build` first (reads desktop interaction commands)\n");
  process.exit(1);
}
const { DESKTOP_INTERACTION_COMMANDS } = await import(interactionModule);

const acceptsDesktop = (id) =>
  EDITOR_COMMAND_REGISTRY.find((command) => command.id === id)?.acceptedClients.includes("desktop-control") ?? false;

// The real-bridge golden explicitly asserts these GUI dispatches and registry clients.
const formsGolden = read("tests/e2e/desktop-editor-command-forms-golden.test.ts");
const formsIds = formsGolden.match(/const GUI_WORKING_COMMANDS = new Set\(\[([\s\S]*?)\]\);/)?.[1];
if (formsIds === undefined || !formsGolden.includes("GUI_WORKING_COMMANDS.size).toBe(14") ||
    !formsGolden.includes('acceptedClients).toContain("desktop-control")')) {
  process.stderr.write("surface map: explicit GUI_WORKING_COMMANDS coverage missing from real-bridge golden\n");
  process.exit(1);
}
const guiWorkingCommands = new Set([...formsIds.matchAll(/"([a-z0-9-]+)"/g)].map((match) => match[1]));
const interactionsGolden = read("tests/e2e/desktop-command-interactions-golden.test.ts");
if (!interactionsGolden.includes("for (const command of DESKTOP_INTERACTION_COMMANDS)") ||
    !interactionsGolden.includes("validateEditorCommandInvocation(payload)")) {
  process.stderr.write("surface map: command interaction golden no longer validates dispatch\n");
  process.exit(1);
}
const guiWorkingInteractions = new Set(DESKTOP_INTERACTION_COMMANDS.map(({ id }) => id));
const realBridgeGolden = read("tests/e2e/desktop-control-dispatch-real-bridge-golden.test.ts");
const realBridgeIds = realBridgeGolden.match(/export const GUI_REAL_BRIDGE_COMMANDS = \[([\s\S]*?)\] as const;/)?.[1];
if (realBridgeIds === undefined || !realBridgeGolden.includes("for (const commandId of GUI_REAL_BRIDGE_COMMANDS)") ||
    !realBridgeGolden.includes("validateEditorCommandInvocation") || !realBridgeGolden.includes("bridge.handle")) {
  process.stderr.write("surface map: mounted-chrome real-bridge dispatch golden coverage missing\n");
  process.exit(1);
}
const guiRealBridgeCommands = new Set([...realBridgeIds.matchAll(/"([a-z0-9-]+)"/g)].map((match) => match[1]));
if (guiRealBridgeCommands.size === 0 || [...guiRealBridgeCommands].some((id) => !acceptsDesktop(id))) {
  process.stderr.write("surface map: real-bridge golden lists unknown or unaccepted command\n");
  process.exit(1);
}

const editorCommandState = (id) => {
  if (guiWorkingCommands.has(id) || guiWorkingInteractions.has(id) || guiRealBridgeCommands.has(id)) return { state: "working", note: "GUI dispatch validated by mounted-chrome golden" };

  // Accepting `desktop-control` is not a GUI: without a control that dispatches it, the
  // command is reachable only through the desktop bridge and local agents.
  if (acceptsDesktop(id)) return { state: "unknown", note: "desktop-control accepted; no matching GUI registry-validation golden" };

  return { state: "refused", note: "CLI / local-agent only by registry" };
};

// --- assemble -----------------------------------------------------------------------
const areas = [];

for (const site of probe.sites) {
  areas.push({
    area: `site: ${site.site}`,
    group: "HTTP routes",
    skipped: site.skipped,
    // A site the probe could not start has no evidence, so it is `unknown`, never green.
    nodes: site.skipped ? [{ id: "(not probed)", state: "unknown", note: site.skipped }] : site.routes.map((route) => ({
      id: route.request,
      state: route.state,
      note: [route.status, ...route.reasons].join(" "),
      source: route.file,
    })),
  });
}

areas.push({
  area: "CLI",
  group: "verbs",
  nodes: probe.cli.map((verb) => ({ id: verb.verb, state: verb.state, note: `exit ${verb.exitCode}` })),
});

areas.push({
  area: "desktop",
  group: "editor commands",
  nodes: surfaces.editorCommands.map((id) => ({ id, ...editorCommandState(id) })),
});

areas.push({
  area: "desktop",
  group: "controls",
  nodes: surfaces.desktopControls.map((id) => ({ id, ...controlState(id) })),
});

areas.push({
  area: "desktop",
  group: "local-agent tools",
  nodes: surfaces.localAgentTools.map((id) => ({ id, state: "working", note: "desktop-cli-local-bridge golden" })),
});

areas.push({
  area: "go-live backlog",
  group: "items",
  nodes: backlog.map((item) => ({
    id: `#${item.id} ${item.title}`,
    state: item.status === "done" ? "working" : item.status === "parked" ? "parked" : "gap",
    note: item.parkedReason ?? `${item.severity}${item.wave ? ` · wave ${item.wave}` : ""}`,
  })),
});

const STATES = ["working", "partial", "unconfigured", "refused", "gap", "parked", "unknown", "broken"];

const tally = (nodes) => Object.fromEntries(STATES.map((s) => [s, nodes.filter((n) => n.state === s).length]).filter(([, n]) => n));

const map = {
  schemaVersion: 1,
  probe: { probedAt: probe.probedAt, commit: probe.commit, configuration: probe.configuration },
  totals: tally(areas.flatMap((a) => a.nodes)),
  areas: areas.map((a) => ({ ...a, totals: tally(a.nodes) })),
};

writeFileSync(join(root, "docs/audits/surface-map.json"), JSON.stringify(map, null, 2) + "\n");

// --- HTML ---------------------------------------------------------------------------
const COLORS = {
  working: "#1f8f4e", partial: "#b7791f", unconfigured: "#5a6b85", refused: "#6b5aa6",
  gap: "#c05621", parked: "#8a8f98", unknown: "#444c56", broken: "#c53030",
};

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

const legend = STATES.map((s) => `<span class="chip" style="background:${COLORS[s]}">${s} ${map.totals[s] ?? 0}</span>`).join(" ");

const sections = map.areas.map((a) => `
<section><h2>${esc(a.area)} · ${esc(a.group)}</h2>
<p class="totals">${Object.entries(a.totals).map(([s, n]) => `${s} ${n}`).join(" · ")}${a.skipped ? ` · <b>skipped:</b> ${esc(a.skipped)}` : ""}</p>
<div class="nodes">${a.nodes.map((n) => `<span class="node" style="border-color:${COLORS[n.state]}" title="${esc([n.state, n.note, n.item ? `backlog #${n.item}` : "", n.source].filter(Boolean).join(" — "))}"><i style="background:${COLORS[n.state]}"></i>${esc(n.id)}</span>`).join("")}</div>
</section>`).join("");

writeFileSync(join(root, "docs/audits/surface-map.html"), `<!doctype html><html lang="en"><meta charset="utf-8"><title>SceneAxi surface map</title>
<style>body{font:14px/1.4 system-ui,sans-serif;background:#0d1117;color:#e6edf3;margin:24px}h1{margin:0 0 4px}h2{font-size:15px;margin:24px 0 4px}
.chip{display:inline-block;padding:2px 8px;border-radius:10px;color:#fff;margin:2px}.totals{color:#8b949e;margin:0 0 8px}
.nodes{display:flex;flex-wrap:wrap;gap:4px}.node{border:1px solid;border-radius:6px;padding:2px 6px;font:12px ui-monospace,monospace;display:inline-flex;align-items:center;gap:5px}
.node i{width:8px;height:8px;border-radius:50%;display:inline-block}</style>
<h1>SceneAxi surface map</h1><p>Probe ${esc(map.probe.commit)} at ${esc(map.probe.probedAt)} — ${esc(map.probe.configuration)}. Hover a node for its evidence.</p>
<p>${legend}</p>${sections}</html>
`);

// --- Mermaid overview -----------------------------------------------------------------
const mermaidId = (s) => s.replace(/[^a-zA-Z0-9]/g, "_");

const lines = ["flowchart LR", '  SA["SceneAxi"]'];

for (const a of map.areas) {
  const id = mermaidId(`${a.area}_${a.group}`);
  const label = `${a.area} · ${a.group}<br/>${Object.entries(a.totals).map(([s, n]) => `${s} ${n}`).join(" · ")}`;
  const worst = STATES.slice().reverse().find((s) => a.totals[s] && ["broken", "gap", "unknown"].includes(s)) ?? (a.totals.partial ? "partial" : "working");
  lines.push(`  SA --> ${id}["${label}"]`, `  class ${id} ${worst}`);
}

for (const [state, color] of Object.entries(COLORS)) lines.push(`  classDef ${state} fill:${color},color:#fff,stroke:#222`);

writeFileSync(join(root, "docs/audits/surface-map.md"), `# SceneAxi surface map

Generated by \`node scripts/surface-map.mjs\` from probe \`${map.probe.commit}\` (${map.probe.probedAt}).
${map.probe.configuration}. Each box is coloured by its worst open state; the per-node view is
[surface-map.html](surface-map.html), the data [surface-map.json](surface-map.json).

Totals: ${Object.entries(map.totals).map(([s, n]) => `${s} ${n}`).join(" · ")}

\`\`\`mermaid
${lines.join("\n")}
\`\`\`
`);

process.stdout.write(`surface map — ${JSON.stringify(map.totals)}\n`);
