#!/usr/bin/env node
/**
 * Executable requirement-to-code/evidence traceability check.
 *
 * The declaration is intentionally data-only. This checker verifies its rows against
 * the independent rendered map and the live repository surfaces so a stale or
 * incomplete audit cannot report coverage as complete.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { exportEntries } from "./lib/package-exports.mjs";

export const TRACEABILITY_STATUSES = Object.freeze([
  "real",
  "partial",
  "refuse-only",
  "dormant",
  "delayed",
  "held",
  "host-blocked",
  "gap",
]);
export const TRACEABILITY_RESULTS = Object.freeze(["mapped", "refuse-only", "gap"]);

const INVENTORY_PATH = "docs/audits/initiation/requirements.json";
const RENDERED_PATH = "docs/audits/initiation/Requirements-Traceability.md";
const AUTHORITY_PATH = "docs/audits/initiation/requirements-authority.json";
const RUNTIME_SURFACES_PATH = "docs/audits/initiation/runtime-surfaces.json";
const MATRIX_PATH = "docs/dependency-matrix.json";
const BROWSER_EVIDENCE_CATALOG_PATH = "docs/runnable-surfaces.md";
const RELEASE_OWNER_CATALOG_PATH = "docs/publish-readiness.md";
const RUNTIME_TEST_PATH = "tests/docs/traceability-runtime-surfaces.test.ts";

function displayPath(root, path) {
  return relative(root, path).replaceAll("\\", "/") || ".";
}

function loadJson(root, path, errors) {
  try {
    return JSON.parse(readFileSync(join(root, path), "utf8"));
  } catch (error) {
    errors.push(`[declaration-load] cannot load ${path}: ${error.message}`);
    return undefined;
  }
}

function loadText(root, path, errors) {
  try {
    return readFileSync(join(root, path), "utf8");
  } catch (error) {
    errors.push(`[evidence-load] cannot load ${path}: ${error.message}`);
    return "";
  }
}

function unique(values) {
  return [...new Set(values)].sort();
}

function missing(expected, actual) {
  const actualSet = new Set(actual);
  return expected.filter((value) => !actualSet.has(value));
}

function extra(expected, actual) {
  const expectedSet = new Set(expected);
  return actual.filter((value) => !expectedSet.has(value));
}

function arraysEqual(left, right) {
  return JSON.stringify([...left].sort()) === JSON.stringify([...right].sort());
}

function rejectDuplicates(values, label, errors) {
  if (!Array.isArray(values)) return;
  const duplicates = values.filter((value, index) => values.indexOf(value) !== index);
  if (duplicates.length > 0) {
    errors.push(`[surface-duplicate] ${label} contains duplicate entries: ${unique(duplicates).join(", ")}`);
  }
}

function walkFiles(root, directory, predicate) {
  const absolute = join(root, directory);
  if (!existsSync(absolute)) return [];
  const found = [];
  const visit = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name === "dist" || entry.name === "coverage") continue;
      const path = join(current, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (predicate(path, entry.name)) found.push(displayPath(root, path));
    }
  };
  visit(absolute);
  return found.sort();
}

function resolveProperty(object, propertyPath) {
  return propertyPath.split(".").reduce((value, key) => {
    if (value === null || typeof value !== "object") return undefined;
    return value[key];
  }, object);
}

function wildcardReferenceExists(root, reference) {
  const star = reference.indexOf("*");
  if (star === -1) return false;
  const prefix = reference.slice(0, star);
  const suffix = reference.slice(star + 1);
  const parent = prefix.slice(0, prefix.lastIndexOf("/"));
  const before = prefix.slice(parent.length).replace(/^\/+/, "");
  if (!existsSync(join(root, parent))) return false;
  return readdirSync(join(root, parent), { withFileTypes: true }).some((entry) =>
    entry.isDirectory() && existsSync(join(root, parent, `${before}${entry.name}${suffix}`)),
  );
}

function walkPaths(root, directory) {
  const absolute = join(root, directory);
  if (!existsSync(absolute)) return [];
  const found = [];
  const visit = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name === "dist" || entry.name === "coverage") continue;
      const path = join(current, entry.name);
      found.push(displayPath(root, path));
      if (entry.isDirectory()) visit(path);
    }
  };
  visit(absolute);
  return found.sort();
}

function wildcardReferencePaths(root, reference) {
  const firstStar = reference.indexOf("*");
  const parentEnd = reference.lastIndexOf("/", firstStar);
  const parent = parentEnd === -1 ? "." : reference.slice(0, parentEnd);
  const escaped = reference.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replaceAll("*", "[^/]*");
  const pattern = new RegExp(`^${escaped}$`);
  return walkPaths(root, parent).filter((path) => pattern.test(path));
}

function packageReferencePaths(root, reference) {
  for (const top of ["packages", "apps", "sites", "desktop"]) {
    const absolute = join(root, top);
    if (!existsSync(absolute)) continue;
    for (const entry of readdirSync(absolute, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const directory = `${top}/${entry.name}`;
      const manifestPath = `${directory}/package.json`;
      if (!existsSync(join(root, manifestPath))) continue;
      const manifest = loadJson(root, manifestPath, []);
      if (manifest?.name !== reference) continue;
      const target = typeof manifest.exports === "string"
        ? manifest.exports
        : manifest.exports?.["."];
      if (typeof target === "string") {
        return [`${directory}/${target.replace(/^\.\//, "")}`];
      }
      return existsSync(join(root, directory, "src/index.ts"))
        ? [`${directory}/src/index.ts`]
        : [];
    }
  }
  return [];
}

function resolveDeclaredReference(root, reference) {
  if (typeof reference !== "string" || reference.length === 0) return [];
  if (reference.startsWith("pnpm ")) {
    const script = reference.slice("pnpm ".length).trim();
    return resolveReference(root, reference) ? [`package.json#scripts.${script}`] : [];
  }
  if (reference.startsWith("@sceneaxi/")) return packageReferencePaths(root, reference);
  if (reference.includes("*")) return wildcardReferencePaths(root, reference);
  if (reference.endsWith("/")) return walkFiles(root, reference.slice(0, -1), () => true).slice(0, 8);
  return resolveReference(root, reference) ? [reference] : [];
}

function resolveReference(root, reference) {
  if (typeof reference !== "string" || reference.length === 0) return false;
  if (reference.includes("*")) return wildcardReferenceExists(root, reference);
  if (reference.startsWith("pnpm ")) {
    const script = reference.slice("pnpm ".length).trim();
    const manifest = loadJson(root, "package.json", []);
    return typeof resolveProperty(manifest, `scripts.${script}`) === "string";
  }
  const hash = reference.indexOf("#");
  const file = hash === -1 ? reference : reference.slice(0, hash);
  const target = hash === -1 ? undefined : reference.slice(hash + 1);
  if (file.length === 0) return false;
  if (target !== undefined && file.endsWith(".json")) {
    const value = loadJson(root, file, []);
    if (value === undefined) return false;
    if (target.startsWith("/")) return resolveJsonPointer(value, target) !== undefined;
    return resolveProperty(value, target) !== undefined || Object.hasOwn(value, target);
  }
  if (target !== undefined && file === "package.json") {
    const value = loadJson(root, file, []);
    return resolveProperty(value, target) !== undefined;
  }
  return existsSync(join(root, file));
}

function resolveJsonPointer(value, pointer) {
  if (pointer === "") return value;
  if (!pointer.startsWith("/")) return undefined;
  return pointer
    .slice(1)
    .split("/")
    .map((part) => part.replaceAll("~1", "/").replaceAll("~0", "~"))
    .reduce((current, part) => {
      if (current === null || typeof current !== "object") return undefined;
      return current[part];
    }, value);
}

function markdownSlug(heading) {
  return heading
    .replace(/[`*_~]/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s/g, "-");
}

function markdownAnchors(markdown) {
  const anchors = new Set();
  for (const line of markdown.split("\n")) {
    const match = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (match) anchors.add(markdownSlug(match[2]));
  }
  return anchors;
}

function ownerAnchorExists(root, owner, errors) {
  if (!owner || typeof owner.path !== "string" || typeof owner.anchor !== "string") {
    errors.push("[owner-anchor] every requirement needs an owner path and anchor");
    return;
  }
  if (!resolveReference(root, owner.path)) {
    errors.push(`[owner-path] owner path is stale: ${owner.path}`);
    return;
  }
  if (owner.path.endsWith(".json")) {
    const value = loadJson(root, owner.path, errors);
    const pointer = owner.anchor.startsWith("#") ? owner.anchor.slice(1) : owner.anchor;
    if (resolveJsonPointer(value, pointer) === undefined && resolveProperty(value, pointer) === undefined) {
      errors.push(`[owner-anchor] ${owner.path}${owner.anchor} does not resolve`);
    }
    return;
  }
  const markdown = loadText(root, owner.path, errors);
  const anchor = owner.anchor.replace(/^#/, "");
  if (!markdownAnchors(markdown).has(anchor)) {
    errors.push(`[owner-anchor] ${owner.path}${owner.anchor} does not name a heading`);
  }
}

function validateReferenceEntries(root, entries, label, errors) {
  if (!Array.isArray(entries) || entries.length === 0) {
    errors.push(`[${label}-link] ${label} links must not be empty`);
    return;
  }
  for (const entry of entries) {
    if (!entry || typeof entry.ref !== "string" || typeof entry.kind !== "string" || entry.present !== true) {
      errors.push(`[${label}-link] malformed ${label} link`);
      continue;
    }
    if (!Array.isArray(entry.resolved)) {
      errors.push(`[${label}-link] ${entry.ref} has no resolved path list`);
      continue;
    }
    rejectDuplicates(entry.resolved, `${label} resolution for ${entry.ref}`, errors);
    const independentlyResolved = resolveDeclaredReference(root, entry.ref);
    if (!arraysEqual(independentlyResolved, entry.resolved)) {
      errors.push(`[${label}-resolution] ${entry.ref} resolution differs (declared: ${entry.resolved.join(", ") || "none"}; actual: ${independentlyResolved.join(", ") || "none"})`);
    }
    if (entry.resolved.length === 0 && !entry.ref.includes("*")) {
      errors.push(`[${label}-link] ${entry.ref} has no resolved path`);
      continue;
    }
    for (const path of entry.resolved) {
      if (!resolveReference(root, path)) errors.push(`[${label}-path] ${entry.ref} resolves to stale path ${path}`);
    }
    if (entry.resolved.length === 0 && !resolveReference(root, entry.ref)) {
      errors.push(`[${label}-path] ${entry.ref} wildcard resolves to no live path`);
    }
  }
}

function parseRenderedRows(markdown) {
  const rows = new Map();
  for (const line of markdown.split("\n")) {
    const match = /^\|\s*([A-Z][A-Z0-9-]*)\s*\|\s*`([^`]+)`\s*\|/.exec(line);
    if (match) rows.set(match[1], match[2]);
  }
  return rows;
}

function parseMarkedPathCatalog(markdown, name, errors) {
  const start = `<!-- traceability:${name}:start -->`;
  const end = `<!-- traceability:${name}:end -->`;
  const startIndex = markdown.indexOf(start);
  const endIndex = markdown.indexOf(end);
  if (startIndex === -1 || endIndex <= startIndex) {
    errors.push(`[${name}] missing marked catalog`);
    return [];
  }
  return markdown
    .slice(startIndex + start.length, endIndex)
    .split("\n")
    .map((line) => /^\|\s*`([^`]+)`\s*\|$/.exec(line)?.[1])
    .filter(Boolean)
    .sort();
}

function checkRequirements(root, declaration, rendered, authority, errors) {
  const rows = declaration?.requirements;
  if (!Array.isArray(rows)) {
    errors.push("[requirements-shape] requirements must be an array");
    return;
  }
  const ids = rows.map((row) => row?.id);
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  if (duplicates.length > 0) errors.push(`[requirements-id] duplicate requirement ID(s): ${unique(duplicates).join(", ")}`);

  const expectedIds = authority?.expectedRequirementIds;
  if (authority?.schemaVersion !== 1) {
    errors.push("[requirements-authority] unsupported authority baseline schema version");
  }
  if (!Array.isArray(expectedIds) || !expectedIds.every((id) => typeof id === "string")) {
    errors.push("[requirements-authority] expectedRequirementIds must be an array of stable IDs");
  } else if (new Set(expectedIds).size !== expectedIds.length) {
    errors.push("[requirements-authority] expectedRequirementIds contains duplicates");
  } else if (!arraysEqual(expectedIds, ids.filter(Boolean))) {
    errors.push(`[requirements-authority] declaration differs from the reviewed authority baseline (missing: ${missing(expectedIds, ids).join(", ") || "none"}; extra: ${extra(expectedIds, ids).join(", ") || "none"})`);
  }

  const classifications = authority?.protectedClassifications;
  if (classifications === null || typeof classifications !== "object" || Array.isArray(classifications)) {
    errors.push("[requirements-authority] protectedClassifications must be an object");
  } else {
    const byId = new Map(rows.map((row) => [row?.id, row?.classification]));
    for (const [id, classification] of Object.entries(classifications)) {
      if (byId.get(id) !== classification) {
        errors.push(`[authority-classification] ${id} must remain ${classification}; the declaration reports ${byId.get(id) ?? "missing"}`);
      }
    }
  }

  const renderedRows = parseRenderedRows(rendered);
  const missingRendered = missing(unique(ids.filter(Boolean)), [...renderedRows.keys()]);
  const extraRendered = extra(unique(ids.filter(Boolean)), [...renderedRows.keys()]);
  if (missingRendered.length > 0 || extraRendered.length > 0) {
    errors.push(`[requirements-accounting] rendered map differs (missing: ${missingRendered.join(", ") || "none"}; extra: ${extraRendered.join(", ") || "none"})`);
  }

  for (const row of rows) {
    if (!row || typeof row !== "object") {
      errors.push("[requirements-shape] every requirement must be an object");
      continue;
    }
    if (typeof row.id !== "string" || row.id.length === 0) errors.push("[requirements-id] requirement has no stable ID");
    if (!TRACEABILITY_STATUSES.includes(row.classification)) {
      errors.push(`[classification] ${row.id ?? "<unknown>"} has unknown classification ${JSON.stringify(row.classification)}`);
    }
    if (!TRACEABILITY_RESULTS.includes(row.coverageResult)) {
      errors.push(`[coverage-result] ${row.id ?? "<unknown>"} has unknown coverage result ${JSON.stringify(row.coverageResult)}`);
    }
    if (row.id && renderedRows.has(row.id) && renderedRows.get(row.id) !== row.classification) {
      errors.push(`[classification-drift] ${row.id} differs from the rendered traceability map`);
    }
    ownerAnchorExists(root, row.owner, errors);
    validateReferenceEntries(root, row.liveImplementation, "implementation", errors);
    validateReferenceEntries(root, row.liveProofs, "proof", errors);
    if (row.classification !== "real" && (typeof row.classificationReason !== "string" || row.classificationReason.trim() === "")) {
      errors.push(`[classification-reason] ${row.id} non-real classification needs an explicit reason`);
    }
    if (row.classification === "real" && row.coverageResult !== "mapped") {
      errors.push(`[coverage-result] ${row.id} real classification must be mapped`);
    }
    if (row.classification === "gap" && row.coverageResult !== "gap") {
      errors.push(`[coverage-result] ${row.id} gap classification must have gap coverage`);
    }
    if (row.classification === "refuse-only" && row.coverageResult !== "refuse-only") {
      errors.push(`[coverage-result] ${row.id} refuse-only classification must have refuse-only coverage`);
    }
    if (row.classification === "real" && (!Array.isArray(row.liveImplementation) || row.liveImplementation.length === 0 || !Array.isArray(row.liveProofs) || row.liveProofs.length === 0)) {
      errors.push(`[real-coverage] ${row.id} needs implementation and proof links`);
    }
    if (Array.isArray(row.liveRefusals) && row.liveRefusals.some((value) => typeof value !== "string" || value.length === 0)) {
      errors.push(`[refusal-link] ${row.id} has a malformed named refusal`);
    }
  }
}

function checkPackages(root, inventory, matrix, errors) {
  const expected = Object.keys(matrix?.packages ?? {}).concat(Object.keys(matrix?.delayed ?? {})).sort();
  const rows = inventory?.packages;
  if (!Array.isArray(rows)) {
    errors.push("[package-accounting] liveInventory.packages must be an array");
    return;
  }
  const actual = rows.map((row) => row?.name).filter(Boolean);
  rejectDuplicates(actual, "packages", errors);
  if (!arraysEqual(expected, actual)) errors.push(`[package-accounting] package set differs (missing: ${missing(expected, actual).join(", ") || "none"}; extra: ${extra(expected, actual).join(", ") || "none"})`);
  for (const row of rows) {
    const delayed = matrix?.delayed?.[row.name] !== undefined;
    if (delayed) {
      if (row.status !== "delayed" || row.directory !== null || row.manifest !== null || row.seam !== null || row.exports.length !== 0) {
        errors.push(`[package-accounting] delayed package ${row.name} must remain an unmaterialized slot`);
      }
      continue;
    }
    const matrixEntry = matrix?.packages?.[row.name];
    if (!matrixEntry || typeof matrixEntry.dir !== "string") {
      errors.push(`[package-accounting] ${row.name} is not a live matrix package`);
      continue;
    }
    const manifestPath = row.manifest;
    const manifest = typeof manifestPath === "string" ? loadJson(root, manifestPath, errors) : undefined;
    if (!manifest || manifest.name !== row.name || manifestPath !== `${matrixEntry.dir}/package.json`) {
      errors.push(`[package-accounting] ${row.name} manifest does not match the dependency matrix`);
      continue;
    }
    if (!row.seam || row.seam.name !== row.name || !resolveReference(root, row.seam.path)) errors.push(`[package-accounting] ${row.name} typed seam is stale or misnamed`);
    const exports = exportEntries(manifest.exports);
    const declared = (row.exports ?? []).map((entry) => [entry[0], entry[1]]);
    if (JSON.stringify(exports) !== JSON.stringify(declared)) errors.push(`[package-accounting] ${row.name} public export map is stale`);
    for (const [, target] of exports) if (!resolveReference(root, `${matrixEntry.dir}/${target.replace(/^\.\//, "")}`)) errors.push(`[package-accounting] ${row.name} export target is stale: ${target}`);
  }
}

function checkInventorySurface(root, inventory, runtimeSurfaces, errors) {
  if (runtimeSurfaces?.schemaVersion !== 1) errors.push("[surface-accounting] unsupported runtime surface schema version");
  const declaredCli = inventory?.cli?.verbs ?? [];
  const heldCommands = (inventory?.cli?.heldKeyEntries ?? []).map((entry) => entry?.command);
  const editor = inventory?.editor;
  for (const [label, values] of [
    ["CLI verbs", declaredCli],
    ["held-key commands", heldCommands],
    ["editor commands", editor?.commands],
    ["desktop controls", editor?.controls],
    ["bridge actions", inventory?.bridge?.actions],
    ["authoring operations", inventory?.bridge?.authoringOperations],
    ["assistant operations", inventory?.bridge?.assistantOperations],
    ["local-agent tools", inventory?.bridge?.localAgentTools],
    ["routes", inventory?.routes],
    ["migrations", inventory?.migrations],
    ["workflows", inventory?.workflows],
    ["golden tests", inventory?.goldenTests],
  ]) rejectDuplicates(values, label, errors);
  const runtimeCli = runtimeSurfaces?.cliVerbs ?? [];
  if (runtimeCli.length !== inventory?.cli?.verbCount || !arraysEqual(runtimeCli, declaredCli)) errors.push("[surface-accounting] CLI verb inventory is stale or incomplete");
  const runtimeHeldCommands = (runtimeSurfaces?.heldKeyEntries ?? []).map((entry) => entry?.command);
  if (!arraysEqual(runtimeHeldCommands, declaredCli)) errors.push("[surface-accounting] held-key command map is stale or incomplete");
  if (!arraysEqual(heldCommands, declaredCli)) errors.push("[surface-accounting] held-key entries do not cover every CLI verb");
  if (JSON.stringify(runtimeSurfaces?.heldKeyEntries ?? []) !== JSON.stringify(inventory?.cli?.heldKeyEntries ?? [])) errors.push("[surface-accounting] held-key entry semantics differ from the runtime surface");

  const editorIds = runtimeSurfaces?.editorCommands ?? [];
  if (editorIds.length !== inventory?.editor?.commandCount || !arraysEqual(editorIds, inventory?.editor?.commands ?? [])) errors.push("[surface-accounting] editor command inventory is stale or incomplete");

  if (!Array.isArray(editor?.controls) || new Set(editor.controls).size !== editor.controls.length || editor.controls.length !== editor.controlCount || editor.controlCount !== inventory?.counts?.desktopControls) {
    errors.push("[surface-accounting] desktop control inventory is stale, duplicated, or incomplete");
  }
  if (!arraysEqual(runtimeSurfaces?.desktopControls ?? [], editor?.controls ?? [])) errors.push("[surface-accounting] desktop control inventory is stale or incomplete");

  const bridgeActions = runtimeSurfaces?.bridgeActions ?? [];
  const authoringOps = runtimeSurfaces?.authoringOperations ?? [];
  const assistantOps = runtimeSurfaces?.assistantOperations ?? [];
  if (!arraysEqual(bridgeActions, inventory?.bridge?.actions ?? []) || !arraysEqual(authoringOps, inventory?.bridge?.authoringOperations ?? []) || !arraysEqual(assistantOps, inventory?.bridge?.assistantOperations ?? [])) errors.push("[surface-accounting] desktop bridge operation inventory is stale or incomplete");
  const toolNames = runtimeSurfaces?.localAgentTools ?? [];
  if (!arraysEqual(toolNames, inventory?.bridge?.localAgentTools ?? [])) errors.push("[surface-accounting] local-agent tool inventory is stale or incomplete");

  const expectedRoutes = walkFiles(root, "sites", (path, name) => name === "page.tsx" || name === "route.ts").filter((path) => path.includes("/src/app/"));
  const expectedMigrations = walkFiles(root, "db/migrations", (path, name) => name.endsWith(".sql"));
  const expectedWorkflows = walkFiles(root, ".github/workflows", (path, name) => name.endsWith(".yml") || name.endsWith(".yaml"));
  const expectedGoldens = walkFiles(root, "tests/e2e", (path, name) => name.endsWith("-golden.test.ts"));
  for (const [label, expected, actual] of [
    ["routes", expectedRoutes, inventory?.routes ?? []],
    ["migrations", expectedMigrations, inventory?.migrations ?? []],
    ["workflows", expectedWorkflows, inventory?.workflows ?? []],
    ["golden tests", expectedGoldens, inventory?.goldenTests ?? []],
  ]) {
    if (!arraysEqual(expected, actual)) errors.push(`[surface-accounting] ${label} inventory is stale (missing: ${missing(expected, actual).join(", ") || "none"}; extra: ${extra(expected, actual).join(", ") || "none"})`);
  }
  const counts = inventory?.counts ?? {};
  const countChecks = {
    matrixPackages: (inventory?.packages ?? []).filter((row) => row?.status !== "delayed").length,
    delayedPackages: (inventory?.packages ?? []).filter((row) => row?.status === "delayed").length,
    cliVerbs: declaredCli.length,
    editorCommands: editor?.commands?.length ?? 0,
    desktopControls: editor?.controls?.length ?? 0,
    bridgeActions: inventory?.bridge?.actions?.length ?? 0,
    authoringOperations: inventory?.bridge?.authoringOperations?.length ?? 0,
    assistantOperations: inventory?.bridge?.assistantOperations?.length ?? 0,
    localAgentTools: inventory?.bridge?.localAgentTools?.length ?? 0,
    routes: inventory?.routes?.length ?? 0,
    migrations: inventory?.migrations?.length ?? 0,
    workflows: inventory?.workflows?.length ?? 0,
    goldenTests: inventory?.goldenTests?.length ?? 0,
  };
  for (const [key, value] of Object.entries(countChecks)) if (counts[key] !== value) errors.push(`[surface-count] liveInventory.counts.${key} is ${counts[key]}, expected ${value}`);
}

function checkEvidenceAndRegistries(root, inventory, runtimeSurfaces, browserCatalog, releaseCatalog, errors) {
  for (const [label, values] of [
    ["provider entrypoints", inventory?.providerEntrypoints],
    ["installed provider entrypoints", inventory?.installedProviderEntrypoints],
    ["browser evidence", inventory?.browserEvidence],
    ["release artifacts", inventory?.releaseArtifacts],
    ["refusal registry paths", inventory?.refusalRegistryPaths],
  ]) rejectDuplicates(values, label, errors);
  for (const entry of [...(inventory?.providerEntrypoints ?? []), ...(inventory?.installedProviderEntrypoints ?? []), ...(inventory?.browserEvidence ?? []), ...(inventory?.releaseArtifacts ?? [])]) {
    if (!resolveReference(root, entry)) errors.push(`[evidence-path] stale evidence or provider path: ${entry}`);
  }
  const browserEvidenceCatalog = parseMarkedPathCatalog(browserCatalog, "browser-evidence", errors);
  if (!arraysEqual(browserEvidenceCatalog, inventory?.browserEvidence ?? [])) {
    errors.push(`[browser-evidence] inventory differs from the marked catalog (missing: ${missing(browserEvidenceCatalog, inventory?.browserEvidence ?? []).join(", ") || "none"}; extra: ${extra(browserEvidenceCatalog, inventory?.browserEvidence ?? []).join(", ") || "none"})`);
  }
  const releaseOwnerCatalog = parseMarkedPathCatalog(releaseCatalog, "release-owners", errors);
  if (!arraysEqual(releaseOwnerCatalog, inventory?.releaseArtifacts ?? [])) {
    errors.push(`[release-owners] inventory differs from the marked catalog (missing: ${missing(releaseOwnerCatalog, inventory?.releaseArtifacts ?? []).join(", ") || "none"}; extra: ${extra(releaseOwnerCatalog, inventory?.releaseArtifacts ?? []).join(", ") || "none"})`);
  }
  const runtimeProviders = runtimeSurfaces?.providerEntrypoints ?? [];
  if (!arraysEqual(runtimeProviders, inventory?.providerEntrypoints ?? [])) {
    errors.push(`[provider-entrypoint] provider inventory differs from the executable catalog (missing: ${missing(runtimeProviders, inventory?.providerEntrypoints ?? []).join(", ") || "none"}; extra: ${extra(runtimeProviders, inventory?.providerEntrypoints ?? []).join(", ") || "none"})`);
  }
  const installedProviders = inventory?.installedProviderEntrypoints ?? [];
  if (installedProviders.some((path) => (inventory?.providerEntrypoints ?? []).includes(path))) {
    errors.push("[provider-entrypoint] installed provider entrypoints must not duplicate root-runtime entries");
  }
  const registries = inventory?.refusalRegistries ?? [];
  const seen = new Set();
  for (const entry of registries) {
    const key = `${entry?.path}#${entry?.symbol}`;
    if (seen.has(key)) errors.push(`[refusal-registry] duplicate refusal registry ${key}`);
    seen.add(key);
    if (!entry || !resolveReference(root, entry.path)) errors.push(`[refusal-registry] stale refusal registry path: ${entry?.path}`);
  }
  const runtimeRegistries = (runtimeSurfaces?.refusalRegistries ?? []).map((entry) => `${entry?.path}#${entry?.symbol}`);
  if (!arraysEqual([...seen], runtimeRegistries)) errors.push("[refusal-registry] refusal registry inventory differs from the executable runtime surface");
  const registryPaths = registries.map((entry) => entry?.path).filter(Boolean);
  if (!arraysEqual(unique(registryPaths), inventory?.refusalRegistryPaths ?? [])) errors.push("[refusal-registry] refusal registry path catalog is stale or incomplete");
}

export function checkTraceability(root = resolve(dirname(fileURLToPath(import.meta.url)), "..")) {
  const errors = [];
  const declaration = loadJson(root, INVENTORY_PATH, errors);
  const rendered = loadText(root, RENDERED_PATH, errors);
  const authority = loadJson(root, AUTHORITY_PATH, errors);
  const runtimeSurfaces = loadJson(root, RUNTIME_SURFACES_PATH, errors);
  const matrix = loadJson(root, MATRIX_PATH, errors);
  const browserCatalog = loadText(root, BROWSER_EVIDENCE_CATALOG_PATH, errors);
  const releaseCatalog = loadText(root, RELEASE_OWNER_CATALOG_PATH, errors);
  if (!declaration || !authority || !runtimeSurfaces || !matrix) return errors;
  if (!arraysEqual(declaration.statusVocabulary, TRACEABILITY_STATUSES)) errors.push("[declaration-vocabulary] status vocabulary must match the checker vocabulary");
  checkRequirements(root, declaration, rendered, authority, errors);
  checkPackages(root, declaration.liveInventory, matrix, errors);
  checkInventorySurface(root, declaration.liveInventory, runtimeSurfaces, errors);
  checkEvidenceAndRegistries(root, declaration.liveInventory, runtimeSurfaces, browserCatalog, releaseCatalog, errors);
  return errors;
}

function checkLiveRuntimeSurfaces(root) {
  const runner = join(root, "node_modules/vitest/vitest.mjs");
  if (!existsSync(runner)) return "[runtime-surface] Vitest runner is unavailable";
  const result = spawnSync(
    process.execPath,
    [runner, "run", RUNTIME_TEST_PATH, "--reporter=dot"],
    { cwd: root, encoding: "utf8" },
  );
  if (result.status === 0) return undefined;
  const detail = (result.stderr || result.stdout || "runtime validation failed").trim();
  return `[runtime-surface] live registry validation failed\n${detail}`;
}

function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const errors = checkTraceability(root);
  const runtimeError = checkLiveRuntimeSurfaces(root);
  if (runtimeError !== undefined) errors.push(runtimeError);
  if (errors.length > 0) {
    console.error(`traceability check FAILED (${errors.length} error${errors.length === 1 ? "" : "s"})`);
    for (const error of errors) console.error(error);
    process.exitCode = 1;
    return;
  }
  const declaration = JSON.parse(readFileSync(join(root, INVENTORY_PATH), "utf8"));
  console.log(`traceability check OK — ${declaration.requirements.length} requirements and live surfaces accounted`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
