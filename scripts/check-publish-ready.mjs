#!/usr/bin/env node
/**
 * Publish-readiness check — proves the library story an outsider would consume,
 * without ever contacting a registry.
 *
 * SceneAxi has no registry publish authority (`docs/bootstrap.md`), so "publish-ready"
 * cannot be proven by publishing. It is proven structurally instead: every public
 * `exports` target resolves to a real file, the version plan on disk matches the
 * version plan in the docs, the pinned engine-SDK archive ships every file the public
 * export maps point at, and nothing in the repository can perform a registry publish.
 *
 * Two directions matter and both are enforced:
 *   - reality → docs: a package, export, or version that drifts fails the gate;
 *   - docs → reality: a claim in `docs/publish-readiness.md` that this script does not
 *     actually implement fails the gate, so the checklist cannot overstate itself.
 *
 * Dependency-free plain ESM on purpose, matching `scripts/build-engine-sdk.mjs`, so CI
 * can run it with no install step.
 *
 * Fail-closed: a missing doc, an unparseable table, an empty surface, or any drift
 * exits 1.
 *
 * Usage: node scripts/check-publish-ready.mjs
 */
import { existsSync, lstatSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { SDK_PACKAGES } from "./build-engine-sdk.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * The version plan, pinned here because it is a captain-level release decision rather
 * than something to infer from whatever happens to be on disk. Every workspace manifest
 * and the documented plan are both checked against these values.
 *
 * `registryPublishAuthorized: false` is load-bearing: it is what makes "every package is
 * private" and "no publish hook exists anywhere" hard failures rather than style notes.
 */
export const PUBLISH_PLAN = Object.freeze({
  bootstrapVersion: "0.0.0",
  bootstrapCorePin: "^0.0.0",
  registryPublishAuthorized: false,
});

/** Workspace tiers that carry a consumable or deployable manifest. */
const MANIFEST_TIERS = Object.freeze(["packages", "apps", "sites"]);

/**
 * Lifecycle script names that can reach a registry, directly or by hook. `prepare` is
 * in the list because npm runs it during both `npm publish` and `npm pack`, so leaving
 * it out would let a publish-time hook hide beside its refused siblings.
 */
const PUBLISH_LIFECYCLE_SCRIPTS = Object.freeze([
  "publish",
  "prepublish",
  "prepublishOnly",
  "postpublish",
  "prepare",
  "prepack",
  "postpack",
  "release",
]);

/** Manifest fields whose values are dependency ranges. */
const DEPENDENCY_FIELDS = Object.freeze([
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
]);

/** Commands that can reach a registry at all. */
const REGISTRY_COMMAND_HEADS = Object.freeze(["npm", "pnpm", "yarn", "bun", "npx", "changeset"]);

/**
 * Registry-mutating verbs. Matched as whole shell tokens anywhere after the command
 * head in the same command, because flags may be interleaved in any order
 * (`pnpm -r publish`, `npm --access public publish`) and a pattern anchored to the
 * token right after the head would miss the canonical recursive form.
 */
const REGISTRY_PUBLISH_VERBS = Object.freeze(["publish", "unpublish", "dist-tag", "deprecate"]);

/** SDK build output must never be committed, so a stale archive cannot ship. */
const SDK_OUTPUT_IGNORES = Object.freeze(["dist-sdk/", "dist-sdk-again/"]);

/** The consumer-facing docs this check reads as machine-readable declarations. */
const CONSUMER_DOC = "docs/web-consumer.md";
const READINESS_DOC = "docs/publish-readiness.md";

/**
 * Every check this script implements. `docs/publish-readiness.md` must list exactly
 * these IDs, so the published checklist and the executable checklist cannot diverge.
 */
export const CHECK_IDS = Object.freeze([
  "manifest-private",
  "manifest-version-plan",
  "manifest-hygiene",
  "exports-resolve",
  "files-resolve",
  "internal-deps-workspace",
  "no-publish-hooks",
  "no-registry-publish",
  "profile-core-pin",
  "sdk-covers-exports",
  "sdk-consumer-packages",
  "sdk-output-ignored",
  "docs-consumer-surface",
  "docs-export-namespaces",
  "docs-version-plan",
  "docs-checklist-ids",
]);

const errors = [];
const fail = (id, message) => errors.push(`[${id}] ${message}`);

/**
 * Run one check, attributing anything it throws — an unreadable doc, an unparseable
 * declaration table — to that check's own ID.
 *
 * Every check runs even when an earlier one throws, so a single broken declaration
 * reports one problem instead of hiding the other fifteen.
 */
function guard(id, run) {
  try {
    return run();
  } catch (error) {
    fail(id, error instanceof Error ? error.message : String(error));
    return undefined;
  }
}

// --- markdown declaration parsing -------------------------------------------------

/**
 * Read the table that follows an explicit `<!-- publish-ready:<key> -->` marker.
 *
 * The marker is the contract between prose and this checker: a doc table only becomes
 * load-bearing when it is deliberately marked, so ordinary illustrative tables in the
 * same document are never parsed by accident.
 *
 * @returns {string[][]} body rows, cells trimmed, header and separator dropped
 */
function markedTable(docPath, key) {
  const text = readFileSync(join(root, docPath), "utf8");
  const marker = `<!-- publish-ready:${key} -->`;
  const markerIndex = text.indexOf(marker);
  if (markerIndex < 0) {
    throw new Error(`${docPath} is missing the '${marker}' declaration marker`);
  }
  if (text.indexOf(marker, markerIndex + marker.length) >= 0) {
    throw new Error(`${docPath} declares '${marker}' more than once — the declaration must be unique`);
  }
  const lines = text.slice(markerIndex + marker.length).split("\n");
  const rows = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "" && rows.length === 0) continue;
    if (!trimmed.startsWith("|")) break;
    rows.push(
      trimmed
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((cell) => cell.trim()),
    );
  }
  const body = rows.filter((row) => !row.every((cell) => /^:?-{2,}:?$/.test(cell)));
  if (body.length < 2) {
    throw new Error(`${docPath}: the '${key}' table has no body rows`);
  }
  return body.slice(1);
}

/** Unwrap a `` `value` `` doc cell; an em dash means "declared absent". */
function cellValue(cell) {
  if (cell === "—" || cell === "") return null;
  const match = /^`([^`]+)`$/.exec(cell);
  return match ? match[1] : cell;
}

/** Every backticked token in a cell, for cells that declare a list. */
function cellList(cell) {
  if (cell === "—" || cell === "") return [];
  return [...cell.matchAll(/`([^`]+)`/g)].map((match) => match[1]);
}

/** `./contracts/*.json` → a regex matching one path segment in place of `*`. */
function namespacePattern(pattern) {
  const literals = pattern.split("*").map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(`^${literals.join("[^/]+")}$`);
}

// --- shell command inspection -----------------------------------------------------

/**
 * The registry publish commands a script or workflow body invokes directly.
 *
 * Shell line continuations are folded away first, because a command wrapped across
 * lines is one command and splitting on raw newlines would separate its head from its
 * verb. Each line is then split into individual commands, so a verb only counts against
 * the command head it actually belongs to, and the verb is matched as a whole token
 * anywhere in that command — flag order is not a way out either.
 *
 * This sees direct invocations only. A verb reached through an interpreter
 * (`bash release.sh`) is out of scan by design — every manifest staying `private: true`
 * is what covers that, and `docs/publish-readiness.md` states the bound.
 *
 * @returns {string[]} the distinct `<head> <verb>` shapes found
 */
function registryPublishCommands(text) {
  const found = new Set();
  for (const line of text.replace(/\\[ \t]*\r?\n/g, " ").split("\n")) {
    for (const command of line.split(/[;&|()`]+/)) {
      const tokens = command
        .split(/\s+/)
        .map((token) => token.replace(/^["']+|["']+$/g, ""))
        .filter((token) => token.length > 0);
      const head = tokens.findIndex((token) => REGISTRY_COMMAND_HEADS.includes(token));
      if (head < 0) continue;
      const verb = tokens.slice(head + 1).find((token) => REGISTRY_PUBLISH_VERBS.includes(token));
      if (verb !== undefined) found.add(`${tokens[head]} ${verb}`);
    }
  }
  return [...found];
}

// --- workspace manifests ----------------------------------------------------------

/** Glob metacharacters an npm `files` pattern may use. */
const GLOB_CHARS = /[*?[\]{}]/;

/**
 * The literal directory a glob pattern can only match inside, so a pattern entry is
 * still checked against the tree instead of being stat'd as though it were a file name.
 */
function globPrefixDir(pattern) {
  const upTo = pattern.slice(0, pattern.search(GLOB_CHARS));
  const cut = upTo.lastIndexOf("/");
  return cut < 0 ? "." : upTo.slice(0, cut);
}

/** Every workspace manifest, keyed by package name. */
function readManifests() {
  const manifests = new Map();
  for (const tier of MANIFEST_TIERS) {
    const tierDir = join(root, tier);
    if (!existsSync(tierDir)) continue;
    for (const entry of readdirSync(tierDir).sort()) {
      const dir = join(tierDir, entry);
      const manifestPath = join(dir, "package.json");
      if (!existsSync(manifestPath)) continue;
      let json;
      try {
        json = JSON.parse(readFileSync(manifestPath, "utf8"));
      } catch (error) {
        fail(
          "manifest-hygiene",
          `${relative(root, manifestPath)} is unreadable: ${error instanceof Error ? error.message : String(error)}`,
        );
        continue;
      }
      const name = json.name;
      if (typeof name !== "string" || name.length === 0) {
        fail("manifest-hygiene", `${relative(root, manifestPath)} has no package name`);
        continue;
      }
      if (manifests.has(name)) {
        fail("manifest-hygiene", `duplicate package name '${name}'`);
        continue;
      }
      manifests.set(name, { name, json, dir, tier, rel: `${tier}/${entry}` });
    }
  }
  return manifests;
}

/**
 * Flatten an `exports` map to `[subpath, target]` pairs.
 *
 * Exported because the engine-SDK archive test asserts the other half of the same
 * claim — that every one of these targets actually ships — and two copies of this
 * walker could disagree about what an export target even is.
 */
export function exportEntries(exportsField) {
  const pairs = [];
  const walk = (value, subpath) => {
    if (typeof value === "string") pairs.push([subpath, value]);
    else if (value !== null && typeof value === "object") {
      for (const [key, nested] of Object.entries(value)) {
        walk(nested, key.startsWith(".") ? key : subpath);
      }
    }
  };
  walk(exportsField ?? {}, ".");
  return pairs;
}

// --- checks -----------------------------------------------------------------------

function checkManifests(manifests) {
  for (const { name, json, dir, rel, tier } of manifests.values()) {
    // The `sites/` tier is deployable, not consumable: each site is its own install
    // root outside the repository workspace (ADR 0018), so it has no library entry
    // point and reaches internal packages by `link:` rather than `workspace:`. Its own
    // structural rules are `pnpm check:sites`; the rules below that still apply to a
    // site apply unchanged.
    const consumable = tier !== "sites";
    if (json.private !== true) {
      fail(
        "manifest-private",
        `${name} is not private — this repository holds no registry publish authority, so every manifest stays private:true`,
      );
    }
    if (json.version !== PUBLISH_PLAN.bootstrapVersion) {
      fail(
        "manifest-version-plan",
        `${name} is version '${json.version}', the pinned plan version is '${PUBLISH_PLAN.bootstrapVersion}'`,
      );
    }
    if (json.type !== "module") fail("manifest-hygiene", `${name} must declare "type": "module"`);
    if (typeof json.license !== "string" || json.license.length === 0) {
      fail("manifest-hygiene", `${name} declares no license`);
    }
    if (typeof json.description !== "string" || json.description.length === 0) {
      fail("manifest-hygiene", `${name} declares no description`);
    }
    if (typeof json.sceneaxi?.releaseGroup !== "string") {
      fail("manifest-hygiene", `${name} declares no sceneaxi.releaseGroup`);
    }

    const entries = exportEntries(json.exports);
    if (entries.length === 0 && consumable) {
      fail("exports-resolve", `${name} declares no exports — an outsider has no entry point`);
    }
    for (const [subpath, target] of entries) {
      if (subpath.includes("*") || target.includes("*")) {
        fail(
          "exports-resolve",
          `${name} export '${subpath}' is a subpath pattern — this contract needs explicit export targets, because a pattern can be proven neither to resolve to a real file nor to ship in the pinned SDK archive`,
        );
        continue;
      }
      if (!target.startsWith("./")) {
        fail("exports-resolve", `${name} export '${subpath}' target '${target}' is not a './' relative path`);
        continue;
      }
      const abs = join(dir, target);
      if (!abs.startsWith(`${dir}/`)) {
        fail("exports-resolve", `${name} export '${subpath}' escapes its package root`);
        continue;
      }
      let stat;
      try {
        stat = lstatSync(abs);
      } catch {
        fail("exports-resolve", `${name} export '${subpath}' points at missing file '${rel}/${target.slice(2)}'`);
        continue;
      }
      if (stat.isSymbolicLink()) {
        fail("exports-resolve", `${name} export '${subpath}' is a symlink — a consumer entry point must be a real file`);
      } else if (!stat.isFile()) {
        fail("exports-resolve", `${name} export '${subpath}' is not a regular file`);
      }
    }

    // `files` is a pattern list, not a path list: a negation prunes rather than
    // claiming anything, and a glob claims only the directory it can match inside.
    for (const file of json.files ?? []) {
      if (file.startsWith("!")) continue;
      const claimed = GLOB_CHARS.test(file) ? globPrefixDir(file) : file;
      if (!existsSync(join(dir, claimed))) {
        const detail = claimed === file ? "" : ` (no '${claimed}' for it to match inside)`;
        fail("files-resolve", `${name} declares files entry '${file}', which does not exist${detail}`);
      }
    }

    for (const field of DEPENDENCY_FIELDS) {
      for (const [dep, range] of Object.entries(json[field] ?? {})) {
        if (!dep.startsWith("@sceneaxi/")) continue;
        const allowed = consumable ? /^workspace:/ : /^link:\.\.\/\.\.\/packages\//;
        if (typeof range !== "string" || !allowed.test(range)) {
          const expected = consumable
            ? "the workspace: protocol"
            : "a link: path into packages/ (a site is its own install root, ADR 0018)";
          fail(
            "internal-deps-workspace",
            `${name} declares ${dep}@'${range}' in ${field} — internal dependencies use ${expected} until a real release exists`,
          );
        }
      }
    }

    if (json.publishConfig !== undefined) {
      fail("no-publish-hooks", `${name} declares publishConfig — no package may carry registry publish configuration`);
    }
    for (const script of PUBLISH_LIFECYCLE_SCRIPTS) {
      if (json.scripts?.[script] !== undefined) {
        fail("no-publish-hooks", `${name} declares a '${script}' script — publish lifecycle hooks are refused`);
      }
    }
  }
}

/**
 * The repository root manifest is not a workspace package, but it is a publishable npm
 * package like any other: flipping its one `private` field would make `npm publish` at
 * the repo root ship the whole monorepo as `sceneaxi@0.0.0`. It carries the publish
 * rules that do not depend on being a consumable library.
 */
function checkRootManifest(rootManifest) {
  const label = `${rootManifest.name ?? "package.json"} (repository root)`;
  if (rootManifest.private !== true) {
    fail(
      "manifest-private",
      `${label} is not private — this repository holds no registry publish authority, so every manifest stays private:true`,
    );
  }
  if (rootManifest.version !== PUBLISH_PLAN.bootstrapVersion) {
    fail(
      "manifest-version-plan",
      `${label} is version '${rootManifest.version}', the pinned plan version is '${PUBLISH_PLAN.bootstrapVersion}'`,
    );
  }
  if (rootManifest.publishConfig !== undefined) {
    fail("no-publish-hooks", `${label} declares publishConfig — no manifest may carry registry publish configuration`);
  }
  for (const script of PUBLISH_LIFECYCLE_SCRIPTS) {
    if (rootManifest.scripts?.[script] !== undefined) {
      fail("no-publish-hooks", `${label} declares a '${script}' script — publish lifecycle hooks are refused`);
    }
  }
}

function checkNoRegistryPublish(manifests, rootManifest) {
  if (PUBLISH_PLAN.registryPublishAuthorized) {
    fail("no-registry-publish", "PUBLISH_PLAN.registryPublishAuthorized is true, which no captain decision grants");
    return;
  }
  const commandSources = [["package.json", Object.values(rootManifest.scripts ?? {}).join("\n")]];
  for (const { rel, json } of manifests.values()) {
    commandSources.push([`${rel}/package.json`, Object.values(json.scripts ?? {}).join("\n")]);
  }
  const workflowDir = join(root, ".github/workflows");
  if (!existsSync(workflowDir)) {
    fail("no-registry-publish", ".github/workflows is missing — CI cannot be proven publish-free");
  } else {
    for (const entry of readdirSync(workflowDir).sort()) {
      if (!/\.ya?ml$/.test(entry)) continue;
      commandSources.push([`.github/workflows/${entry}`, readFileSync(join(workflowDir, entry), "utf8")]);
    }
  }
  for (const [label, text] of commandSources) {
    for (const command of registryPublishCommands(text)) {
      fail("no-registry-publish", `${label} can run a registry publish (${command}) — no publish authority exists`);
    }
  }
}

function checkSdkOutputIgnored() {
  const gitignore = existsSync(join(root, ".gitignore")) ? readFileSync(join(root, ".gitignore"), "utf8") : "";
  for (const ignored of SDK_OUTPUT_IGNORES) {
    if (!gitignore.split("\n").some((line) => line.trim() === ignored)) {
      fail("sdk-output-ignored", `.gitignore does not ignore '${ignored}' — a built archive must never be committed`);
    }
  }
}

function checkProfileCorePins(manifests) {
  let profiles = 0;
  for (const { name, json, dir, rel } of manifests.values()) {
    if (json.sceneaxi?.releaseGroup !== "profile") continue;
    profiles += 1;
    const pin = json.sceneaxi?.corePin;
    if (pin !== PUBLISH_PLAN.bootstrapCorePin) {
      fail(
        "profile-core-pin",
        `${name} pins core '${pin}', the pinned plan value is '${PUBLISH_PLAN.bootstrapCorePin}'`,
      );
      continue;
    }
    const source = join(dir, "src/index.ts");
    if (!existsSync(source)) {
      fail("profile-core-pin", `${name} has no ${rel}/src/index.ts to carry its seam pin`);
      continue;
    }
    const text = readFileSync(source, "utf8");
    const literals = [
      ...[...text.matchAll(/corePin:\s*"([^"]+)"/g)].map((match) => match[1]),
      ...[...text.matchAll(/CORE_PIN\s*=\s*"([^"]+)"/g)].map((match) => match[1]),
    ];
    if (literals.length === 0) {
      fail("profile-core-pin", `${name} declares no core pin literal in its seam source`);
    }
    for (const literal of literals) {
      if (literal !== pin) {
        fail("profile-core-pin", `${name} seam pins '${literal}' but its manifest pins '${pin}'`);
      }
    }
  }
  if (profiles === 0) fail("profile-core-pin", "found zero profile packages — refusing to pass on an empty surface");
}

function checkSdkCoverage(manifests, consumerPackages) {
  const list = JSON.parse(readFileSync(join(root, "scripts/engine-sdk-files.json"), "utf8"));
  if (!Array.isArray(list) || list.length === 0) {
    fail("sdk-covers-exports", "scripts/engine-sdk-files.json is missing or empty");
    return;
  }
  const pinned = new Set(list);
  const sdkDirs = new Set(SDK_PACKAGES);
  const sdkNames = new Set();

  for (const { name, json, rel } of manifests.values()) {
    if (!sdkDirs.has(rel)) continue;
    sdkNames.add(name);
    for (const [subpath, target] of exportEntries(json.exports)) {
      const pinnedPath = `${rel}/${target.replace(/^\.\//, "")}`;
      if (!pinned.has(pinnedPath)) {
        fail(
          "sdk-covers-exports",
          `${name} export '${subpath}' resolves to '${pinnedPath}', which the engine SDK archive does not ship — an outsider unzipping the SDK gets a dangling entry point`,
        );
      }
    }
  }
  for (const dir of SDK_PACKAGES) {
    if (![...manifests.values()].some((manifest) => manifest.rel === dir)) {
      fail("sdk-covers-exports", `engine SDK package '${dir}' has no workspace manifest`);
    }
  }
  for (const file of list) {
    if (/profile-kids|(^|\/)kids/i.test(file)) {
      fail("sdk-consumer-packages", `pinned SDK file '${file}' is Kids content — the Kids boundary is absolute`);
    }
  }
  for (const name of consumerPackages) {
    if (!sdkNames.has(name)) {
      fail(
        "sdk-consumer-packages",
        `${CONSUMER_DOC} documents '${name}' as a consumer entry point, but the engine SDK archive does not ship it`,
      );
    }
  }
}

/** The documented consumer surface, checked against the manifests it names. */
function checkConsumerDoc(manifests) {
  const rows = markedTable(CONSUMER_DOC, "consumer-surface");
  const names = [];
  for (const row of rows) {
    const name = cellValue(row[0]);
    if (name === null) {
      fail("docs-consumer-surface", `${CONSUMER_DOC} has a consumer-surface row with no package name`);
      continue;
    }
    const manifest = manifests.get(name);
    if (manifest === undefined) {
      fail("docs-consumer-surface", `${CONSUMER_DOC} documents '${name}', which is not a workspace package`);
      continue;
    }
    if (manifest.json.exports?.["."] === undefined) {
      fail("docs-consumer-surface", `${name} is documented as a consumer entry point but declares no root export`);
    }
    names.push(name);
  }
  if (names.length === 0) fail("docs-consumer-surface", `${CONSUMER_DOC} documents zero consumer packages`);
  return names;
}

/** Documented subpath namespaces must exactly cover the real non-root export keys. */
function checkExportNamespaceDoc(manifests, consumerPackages) {
  const rows = markedTable(READINESS_DOC, "exports");
  const documented = new Set();
  for (const row of rows) {
    const name = cellValue(row[0]);
    const rootExport = cellValue(row[1]);
    const namespaces = cellList(row[2] ?? "");
    if (name === null) {
      fail("docs-export-namespaces", `${READINESS_DOC} has an exports row with no package name`);
      continue;
    }
    documented.add(name);
    const manifest = manifests.get(name);
    if (manifest === undefined) {
      fail("docs-export-namespaces", `${READINESS_DOC} documents exports for '${name}', which is not a workspace package`);
      continue;
    }
    const entries = exportEntries(manifest.json.exports);
    // One subpath can carry several targets (one per export condition), so the
    // documented root must name one of them rather than whichever comes first.
    const actualRoots = entries.filter(([subpath]) => subpath === ".").map(([, target]) => target);
    const rootMatches = rootExport === null ? actualRoots.length === 0 : actualRoots.includes(rootExport);
    if (!rootMatches) {
      fail(
        "docs-export-namespaces",
        `${name} root export is '${actualRoots.join("', '") || "—"}', ${READINESS_DOC} documents '${rootExport ?? "—"}'`,
      );
    }
    const subpaths = entries.map(([subpath]) => subpath).filter((subpath) => subpath !== ".");
    const patterns = namespaces.map((namespace) => [namespace, namespacePattern(namespace)]);
    for (const subpath of subpaths) {
      if (!patterns.some(([, pattern]) => pattern.test(subpath))) {
        fail(
          "docs-export-namespaces",
          `${name} exports '${subpath}', which no namespace documented in ${READINESS_DOC} covers`,
        );
      }
    }
    for (const [namespace, pattern] of patterns) {
      if (!subpaths.some((subpath) => pattern.test(subpath))) {
        fail(
          "docs-export-namespaces",
          `${READINESS_DOC} documents namespace '${namespace}' for ${name}, which matches no real export`,
        );
      }
    }
  }
  for (const name of consumerPackages) {
    if (!documented.has(name)) {
      fail("docs-export-namespaces", `${name} is a documented consumer package with no export surface row in ${READINESS_DOC}`);
    }
  }
}

/** The documented version plan must name every workspace package, and match it. */
function checkVersionPlanDoc(manifests) {
  const rows = markedTable(READINESS_DOC, "versions");
  const documented = new Set();
  for (const row of rows) {
    const name = cellValue(row[0]);
    if (name === null) {
      fail("docs-version-plan", `${READINESS_DOC} has a version row with no package name`);
      continue;
    }
    if (documented.has(name)) {
      fail("docs-version-plan", `${READINESS_DOC} lists '${name}' more than once`);
      continue;
    }
    documented.add(name);
    const manifest = manifests.get(name);
    if (manifest === undefined) {
      fail("docs-version-plan", `${READINESS_DOC} lists '${name}', which is not a workspace package`);
      continue;
    }
    const expected = [
      ["version", manifest.json.version],
      ["release group", manifest.json.sceneaxi?.releaseGroup ?? null],
      ["core pin", manifest.json.sceneaxi?.corePin ?? null],
    ];
    const declared = [cellValue(row[1]), cellValue(row[2]), cellValue(row[3] ?? "—")];
    expected.forEach(([label, actual], index) => {
      if ((declared[index] ?? null) !== (actual ?? null)) {
        fail(
          "docs-version-plan",
          `${name} ${label} is '${actual ?? "—"}', ${READINESS_DOC} declares '${declared[index] ?? "—"}'`,
        );
      }
    });
  }
  for (const name of manifests.keys()) {
    if (!documented.has(name)) {
      fail("docs-version-plan", `${name} is a workspace package with no row in the ${READINESS_DOC} version plan`);
    }
  }
}

/** The published checklist must list exactly the checks this script runs. */
function checkChecklistDoc() {
  const rows = markedTable(READINESS_DOC, "checklist");
  const documented = rows.map((row) => cellValue(row[0])).filter((id) => id !== null);
  const implemented = new Set(CHECK_IDS);
  for (const id of documented) {
    if (!implemented.has(id)) {
      fail("docs-checklist-ids", `${READINESS_DOC} claims check '${id}', which this script does not implement`);
    }
  }
  const declared = new Set(documented);
  for (const id of CHECK_IDS) {
    if (!declared.has(id)) {
      fail("docs-checklist-ids", `check '${id}' runs but is not listed in ${READINESS_DOC}`);
    }
  }
}

/**
 * Run every publish-readiness check against a repository root.
 *
 * @returns {string[]} problems found; empty means publish-ready
 */
export function checkPublishReady() {
  errors.length = 0;
  for (const doc of [CONSUMER_DOC, READINESS_DOC]) {
    if (!existsSync(join(root, doc))) {
      errors.push(`[docs-consumer-surface] required doc '${doc}' is missing`);
      return [...errors];
    }
  }
  let rootManifest;
  try {
    rootManifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  } catch (error) {
    errors.push(
      `[manifest-hygiene] the repository root package.json is unreadable: ${error instanceof Error ? error.message : String(error)}`,
    );
    return [...errors];
  }
  const manifests = readManifests();
  if (manifests.size === 0) {
    errors.push("[manifest-hygiene] found zero workspace manifests — refusing to pass on an empty surface");
    return [...errors];
  }
  guard("manifest-private", () => checkRootManifest(rootManifest));
  guard("manifest-hygiene", () => checkManifests(manifests));
  guard("no-registry-publish", () => checkNoRegistryPublish(manifests, rootManifest));
  guard("sdk-output-ignored", () => checkSdkOutputIgnored());
  guard("profile-core-pin", () => checkProfileCorePins(manifests));
  const consumerPackages = guard("docs-consumer-surface", () => checkConsumerDoc(manifests)) ?? [];
  guard("docs-export-namespaces", () => checkExportNamespaceDoc(manifests, consumerPackages));
  guard("docs-version-plan", () => checkVersionPlanDoc(manifests));
  guard("docs-checklist-ids", () => checkChecklistDoc());
  guard("sdk-covers-exports", () => checkSdkCoverage(manifests, consumerPackages));
  return [...errors];
}

function main() {
  const problems = checkPublishReady();
  if (problems.length > 0) {
    console.error(`publish-ready check FAILED — ${problems.length} problem(s):`);
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exit(1);
  }
  console.log(
    `publish-ready check OK — ${CHECK_IDS.length} checks over the documented consumer surface, ` +
      `the ${PUBLISH_PLAN.bootstrapVersion} version plan, and the pinned engine SDK archive (no registry publish authority)`,
  );
}

// `pathToFileURL` percent-encodes exactly like `import.meta.url`, so a repository path
// containing a space or a non-ASCII character cannot silently skip every check.
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
