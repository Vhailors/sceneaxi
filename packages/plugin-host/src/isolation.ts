/**
 * Pre-evaluation package isolation checks (ADR 0005).
 * Uses only descriptor + inspectable package metadata/artifacts — never evaluates
 * the plugin entrypoint.
 */

import {
  existsSync,
  readFileSync,
  realpathSync,
  statSync,
} from "node:fs";
import { builtinModules, createRequire } from "node:module";
import {
  dirname,
  extname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parse } from "acorn";
import { resolve as resolveImportSpecifier } from "import-meta-resolve";

const PLUGIN_MANIFEST_PATH = "sceneaxi.plugin.manifest.json";
const INSPECTABLE_MODULE_EXTENSIONS = new Set([
  "",
  ".cjs",
  ".cts",
  ".js",
  ".jsx",
  ".mjs",
  ".mts",
  ".ts",
  ".tsx",
]);
const BUILTIN_SPECIFIERS = new Set([
  ...builtinModules,
  ...builtinModules.map((name) => `node:${name}`),
]);
const MODULE_BUILTIN_SPECIFIERS = new Set(["module", "node:module"]);
const MODULE_LOADER_EXPORTS = new Set([
  "Module",
  "createRequire",
  "default",
  "register",
  "registerHooks",
]);

const DEP_FIELDS = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
] as const;

export type IsolationOk = { readonly ok: true };
export type IsolationRefuse = {
  readonly ok: false;
  readonly reason:
    | "entrypoint-escape"
    | "entrypoint-missing"
    | "forbidden-sceneaxi-import"
    | "isolation-unverifiable";
  readonly message: string;
};
export type IsolationResult = IsolationOk | IsolationRefuse;

function refuse(
  reason: IsolationRefuse["reason"],
  message: string,
): IsolationRefuse {
  return { ok: false, reason, message };
}

function sceneaxiPackageName(spec: string): string | null {
  if (!spec.startsWith("@sceneaxi/")) return null;
  const parts = spec.split("/");
  if (parts.length < 2) return null;
  return `${parts[0]}/${parts[1]}`;
}

function isUnderPackageRoot(packageRoot: string, candidate: string): boolean {
  const rel = relative(packageRoot, candidate);
  return rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function canonicalDirectory(path: string): string | null {
  try {
    const canonical = realpathSync(path);
    return statSync(canonical).isDirectory() ? canonical : null;
  } catch {
    return null;
  }
}

function canonicalFile(path: string): string | null {
  try {
    const canonical = realpathSync(path);
    return statSync(canonical).isFile() ? canonical : null;
  } catch {
    return null;
  }
}

/**
 * Resolve a package-relative entrypoint under the package root.
 * Refuses absolute paths, parent escapes, and missing files.
 */
export function resolveEntrypointPath(
  packageRoot: string,
  entrypoint: string,
): IsolationResult & { readonly absolutePath?: string } {
  if (
    entrypoint.includes("\0") ||
    entrypoint.includes("\\") ||
    entrypoint.startsWith("/") ||
    /^[A-Za-z]:/.test(entrypoint)
  ) {
    return refuse(
      "entrypoint-escape",
      `Entrypoint "${entrypoint}" is not a safe package-relative path.`,
    );
  }

  const normalized = entrypoint.startsWith("./")
    ? entrypoint.slice(2)
    : entrypoint;
  if (
    normalized.length === 0 ||
    normalized.startsWith("/") ||
    normalized.split("/").some((s) => s === ".." || s === "." || s.length === 0)
  ) {
    return refuse(
      "entrypoint-escape",
      `Entrypoint "${entrypoint}" escapes or is invalid under the package root.`,
    );
  }

  const canonicalRoot = canonicalDirectory(packageRoot);
  if (canonicalRoot === null) {
    return refuse(
      "isolation-unverifiable",
      "Plugin package root cannot be canonicalized as a directory.",
    );
  }

  const absolute = resolve(canonicalRoot, normalized);
  if (!isUnderPackageRoot(canonicalRoot, absolute)) {
    return refuse(
      "entrypoint-escape",
      `Entrypoint "${entrypoint}" resolves outside the package root.`,
    );
  }

  if (!existsSync(absolute)) {
    return refuse(
      "entrypoint-missing",
      `Entrypoint "${entrypoint}" does not exist under the package root.`,
    );
  }

  const canonicalEntrypoint = canonicalFile(absolute);
  if (canonicalEntrypoint === null) {
    return refuse(
      "entrypoint-missing",
      `Entrypoint "${entrypoint}" is not a readable file under the package root.`,
    );
  }
  if (!isUnderPackageRoot(canonicalRoot, canonicalEntrypoint)) {
    return refuse(
      "entrypoint-escape",
      `Entrypoint "${entrypoint}" resolves outside the package root.`,
    );
  }

  return { ok: true, absolutePath: canonicalEntrypoint };
}

function collectDeclaredSceneaxiDeps(
  packageRoot: string,
): IsolationResult & { readonly deps?: readonly string[] } {
  const manifestPath = join(packageRoot, "package.json");
  if (!existsSync(manifestPath)) {
    // No package.json: isolation can still be checked via source scan.
    return { ok: true, deps: [] };
  }
  let json: unknown;
  try {
    json = JSON.parse(readFileSync(manifestPath, "utf8")) as unknown;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "package.json parse failed";
    return refuse(
      "isolation-unverifiable",
      `Cannot parse package.json for isolation check: ${message}`,
    );
  }
  if (json === null || typeof json !== "object" || Array.isArray(json)) {
    return refuse(
      "isolation-unverifiable",
      "package.json must be an object for isolation check.",
    );
  }
  const record = json as Record<string, unknown>;
  const deps: string[] = [];
  for (const field of DEP_FIELDS) {
    const block = record[field];
    if (block === undefined) continue;
    if (block === null || typeof block !== "object" || Array.isArray(block)) {
      return refuse(
        "isolation-unverifiable",
        `package.json field "${field}" must be an object.`,
      );
    }
    for (const name of Object.keys(block as Record<string, unknown>)) {
      if (name.startsWith("@sceneaxi/")) deps.push(name);
    }
  }
  return { ok: true, deps };
}

type ModuleEdge = {
  readonly kind: "cjs" | "esm";
  readonly specifier: string;
};

type ModuleInspection =
  | { readonly ok: true; readonly edges: readonly ModuleEdge[] }
  | { readonly ok: false; readonly message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function literalString(value: unknown): string | null {
  if (!isRecord(value) || value["type"] !== "Literal") return null;
  return typeof value["value"] === "string" ? value["value"] : null;
}

function identifierName(value: unknown): string | null {
  if (!isRecord(value)) return null;
  if (value["type"] === "Identifier" && typeof value["name"] === "string") {
    return value["name"];
  }
  return literalString(value);
}

function isRequireCallee(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (value["type"] === "Identifier" && value["name"] === "require") {
    return true;
  }
  if (value["type"] !== "MemberExpression") return false;
  const object = value["object"];
  const property = value["property"];
  return (
    isRecord(object) &&
    object["type"] === "Identifier" &&
    object["name"] === "module" &&
    ((value["computed"] === false &&
      isRecord(property) &&
      property["type"] === "Identifier" &&
      property["name"] === "require") ||
      (value["computed"] === true && literalString(property) === "require"))
  );
}

function staticEdgeAccessesModuleLoader(value: Record<string, unknown>): boolean {
  if (value["type"] === "ExportAllDeclaration") return true;
  const specifiers = value["specifiers"];
  if (!Array.isArray(specifiers)) return true;
  return specifiers.some((specifier) => {
    if (!isRecord(specifier)) return true;
    if (
      specifier["type"] === "ImportDefaultSpecifier" ||
      specifier["type"] === "ImportNamespaceSpecifier"
    ) {
      return true;
    }
    return (
      (specifier["type"] === "ImportSpecifier" &&
        MODULE_LOADER_EXPORTS.has(identifierName(specifier["imported"]) ?? "")) ||
      (specifier["type"] === "ExportSpecifier" &&
        MODULE_LOADER_EXPORTS.has(identifierName(specifier["local"]) ?? ""))
    );
  });
}

function inspectModuleSource(file: string, text: string): ModuleInspection {
  let ast: unknown;
  try {
    ast = parse(text, {
      allowAwaitOutsideFunction: true,
      allowHashBang: true,
      allowReturnOutsideFunction: true,
      ecmaVersion: "latest",
      sourceType: "module",
    });
  } catch (moduleError) {
    try {
      ast = parse(text, {
        allowAwaitOutsideFunction: true,
        allowHashBang: true,
        allowReturnOutsideFunction: true,
        ecmaVersion: "latest",
        sourceType: "commonjs",
      });
    } catch {
      return {
        ok: false,
        message: `Cannot parse ${file} for isolation check: ${errorMessage(moduleError, "parse failed")}`,
      };
    }
  }

  const edges = new Map<string, ModuleEdge>();
  let failure: string | null = null;

  const addStaticSource = (
    value: unknown,
    syntax: string,
    kind: ModuleEdge["kind"],
  ): string | null => {
    const specifier = literalString(value);
    if (specifier === null) {
      failure = `${file} contains ${syntax} with a non-literal module specifier.`;
      return null;
    }
    edges.set(`${kind}\0${specifier}`, { kind, specifier });
    return specifier;
  };

  const visit = (
    value: unknown,
    parent: Record<string, unknown> | null = null,
    parentKey: string | null = null,
  ): void => {
    if (failure !== null) return;
    if (Array.isArray(value)) {
      for (const child of value) visit(child, parent, parentKey);
      return;
    }
    if (!isRecord(value)) return;

    const type = value["type"];
    if (type === "Identifier" && value["name"] === "require") {
      const directCall =
        parent?.["type"] === "CallExpression" && parentKey === "callee";
      const propertyName =
        parentKey === "property" &&
        parent?.["type"] === "MemberExpression" &&
        parent["computed"] === false;
      const objectKey =
        parentKey === "key" &&
        (parent?.["type"] === "Property" ||
          parent?.["type"] === "MethodDefinition") &&
        parent["computed"] === false;
      if (!directCall && !propertyName && !objectKey) {
        failure = `${file} contains an unsupported indirect reference to require.`;
        return;
      }
    }
    if (type === "MemberExpression" && isRequireCallee(value)) {
      const directCall =
        parent?.["type"] === "CallExpression" && parentKey === "callee";
      if (!directCall) {
        failure = `${file} contains an unsupported indirect reference to module.require.`;
        return;
      }
    }

    if (
      type === "ImportDeclaration" ||
      type === "ExportAllDeclaration" ||
      type === "ExportNamedDeclaration"
    ) {
      if (value["source"] !== null && value["source"] !== undefined) {
        const specifier = addStaticSource(
          value["source"],
          "an import or re-export",
          "esm",
        );
        if (
          specifier !== null &&
          MODULE_BUILTIN_SPECIFIERS.has(specifier) &&
          staticEdgeAccessesModuleLoader(value)
        ) {
          failure = `${file} exposes unsupported module-loader APIs from ${specifier}.`;
        }
      }
    } else if (type === "ImportExpression") {
      const specifier = addStaticSource(
        value["source"],
        "a dynamic import",
        "esm",
      );
      if (
        specifier !== null &&
        MODULE_BUILTIN_SPECIFIERS.has(specifier)
      ) {
        failure = `${file} dynamically imports unsupported module-loader APIs from ${specifier}.`;
      }
    } else if (type === "CallExpression" && isRequireCallee(value["callee"])) {
      const args = value["arguments"];
      if (!Array.isArray(args) || args.length !== 1) {
        failure = `${file} contains require() with an unverifiable module specifier.`;
      } else {
        const specifier = addStaticSource(args[0], "require()", "cjs");
        if (
          specifier !== null &&
          MODULE_BUILTIN_SPECIFIERS.has(specifier)
        ) {
          failure = `${file} requires unsupported module-loader APIs from ${specifier}.`;
        }
      }
    }

    for (const [key, child] of Object.entries(value)) {
      visit(child, value, key);
    }
  };

  visit(ast);
  return failure === null
    ? { ok: true, edges: [...edges.values()] }
    : { ok: false, message: failure };
}

type ModuleResolution =
  | { readonly kind: "builtin" }
  | { readonly kind: "file"; readonly path: string }
  | { readonly kind: "unsupported"; readonly target: string };

function resolveModuleEdge(
  importer: string,
  edge: ModuleEdge,
): ModuleResolution | null {
  try {
    const resolved =
      edge.kind === "esm"
        ? resolveImportSpecifier(edge.specifier, pathToFileURL(importer).href)
        : createRequire(pathToFileURL(importer)).resolve(edge.specifier);
    if (BUILTIN_SPECIFIERS.has(resolved) || resolved.startsWith("node:")) {
      return { kind: "builtin" };
    }
    if (edge.kind === "esm") {
      if (!resolved.startsWith("file:")) {
        return { kind: "unsupported", target: resolved };
      }
      const canonical = canonicalFile(fileURLToPath(resolved));
      return canonical === null ? null : { kind: "file", path: canonical };
    }
    const canonical = canonicalFile(resolved);
    return canonical === null ? null : { kind: "file", path: canonical };
  } catch {
    return null;
  }
}

type PackageIdentity = {
  readonly name: string;
  readonly root: string;
  readonly manifest: Readonly<Record<string, unknown>>;
};

function readPackageIdentity(root: string): PackageIdentity | null {
  const manifest = canonicalFile(join(root, "package.json"));
  if (manifest === null || !isUnderPackageRoot(root, manifest)) return null;
  try {
    const value = JSON.parse(readFileSync(manifest, "utf8")) as unknown;
    if (
      !isRecord(value) ||
      Array.isArray(value) ||
      typeof value["name"] !== "string"
    ) {
      return null;
    }
    return { name: value["name"], root, manifest: value };
  } catch {
    return null;
  }
}

function mappingUsesUnsupportedConditions(
  value: unknown,
  edgeKind: ModuleEdge["kind"],
): boolean {
  if (edgeKind === "cjs") return false;
  if (Array.isArray(value)) {
    return value.some((child) =>
      mappingUsesUnsupportedConditions(child, edgeKind),
    );
  }
  if (!isRecord(value)) return false;
  const entries = Object.entries(value);
  const subpathMap = entries.every(
    ([key]) => key.startsWith(".") || key.startsWith("#"),
  );
  const allowedConditions = new Set(["default", "import", "node"]);
  if (
    !subpathMap &&
    entries.some(([key]) => !allowedConditions.has(key))
  ) {
    return true;
  }
  return entries.some(([, child]) =>
    mappingUsesUnsupportedConditions(child, edgeKind),
  );
}

function packageUsesUnsupportedConditions(
  identity: PackageIdentity,
  edgeKind: ModuleEdge["kind"],
): boolean {
  return (
    mappingUsesUnsupportedConditions(identity.manifest["exports"], edgeKind) ||
    mappingUsesUnsupportedConditions(identity.manifest["imports"], edgeKind)
  );
}

function barePackageName(specifier: string): string | null {
  const parts = specifier.split("/");
  if (specifier.startsWith("@")) {
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : null;
  }
  return parts[0] && !specifier.startsWith(".") && !specifier.startsWith("#")
    ? parts[0]
    : null;
}

function findBarePackageRoot(options: {
  readonly importer: string;
  readonly packageRoot: string;
  readonly specifier: string;
}): string | null {
  const requestedName = barePackageName(options.specifier);
  if (requestedName === null) return null;

  const ownIdentity = readPackageIdentity(options.packageRoot);
  if (ownIdentity?.name === requestedName) return options.packageRoot;

  const packageSegments = requestedName.split("/");
  let current = dirname(options.importer);
  while (true) {
    const candidate = canonicalDirectory(
      join(current, "node_modules", ...packageSegments),
    );
    if (
      candidate !== null &&
      canonicalFile(join(candidate, "package.json")) !== null
    ) {
      return candidate;
    }
    const parent = dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

function packageBoundaryFor(options: {
  readonly edge: ModuleEdge;
  readonly file: string;
  readonly packageRoot: string;
  readonly resolved: string;
}):
  | { readonly ok: true; readonly identity: PackageIdentity }
  | { readonly ok: false; readonly refusal: IsolationRefuse } {
  const boundary = findBarePackageRoot({
    importer: options.file,
    packageRoot: options.packageRoot,
    specifier: options.edge.specifier,
  });
  if (
    boundary === null ||
    !isUnderPackageRoot(boundary, options.resolved)
  ) {
    return {
      ok: false,
      refusal: refuse(
        "isolation-unverifiable",
        `${relative(options.packageRoot, options.file)} import ${options.edge.specifier} has an ambiguous package boundary.`,
      ),
    };
  }

  const identity = readPackageIdentity(boundary);
  if (identity === null) {
    return {
      ok: false,
      refusal: refuse(
        "isolation-unverifiable",
        `${relative(options.packageRoot, options.file)} import ${options.edge.specifier} has no verifiable package identity.`,
      ),
    };
  }
  if (packageUsesUnsupportedConditions(identity, options.edge.kind)) {
    return {
      ok: false,
      refusal: refuse(
        "isolation-unverifiable",
        `${relative(options.packageRoot, options.file)} import ${options.edge.specifier} uses unsupported resolution conditions.`,
      ),
    };
  }

  let current = dirname(options.resolved);
  while (current !== boundary) {
    if (!isUnderPackageRoot(boundary, current)) {
      return {
        ok: false,
        refusal: refuse(
          "isolation-unverifiable",
          `${relative(options.packageRoot, options.file)} import ${options.edge.specifier} escapes its package boundary.`,
        ),
      };
    }
    if (existsSync(join(current, PLUGIN_MANIFEST_PATH))) {
      return {
        ok: false,
        refusal: refuse(
          "isolation-unverifiable",
          `${relative(options.packageRoot, options.file)} import ${options.edge.specifier} resolves through a nested plugin package.`,
        ),
      };
    }
    if (existsSync(join(current, "package.json"))) {
      const nested = readPackageIdentity(current);
      return {
        ok: false,
        refusal: refuse(
          nested !== null && sceneaxiPackageName(nested.name) !== null
            ? "forbidden-sceneaxi-import"
            : "isolation-unverifiable",
          `${relative(options.packageRoot, options.file)} import ${options.edge.specifier} resolves through nested package ${nested?.name ?? current}.`,
        ),
      };
    }
    const parent = dirname(current);
    if (parent === current) {
      return {
        ok: false,
        refusal: refuse(
          "isolation-unverifiable",
          `${relative(options.packageRoot, options.file)} import ${options.edge.specifier} has an ambiguous package boundary.`,
        ),
      };
    }
    current = parent;
  }

  const boundaryIsCurrentPlugin = boundary === options.packageRoot;
  if (
    !boundaryIsCurrentPlugin &&
    existsSync(join(boundary, PLUGIN_MANIFEST_PATH))
  ) {
    return {
      ok: false,
      refusal: refuse(
        "isolation-unverifiable",
        `${relative(options.packageRoot, options.file)} imports another plugin package via ${options.edge.specifier}.`,
      ),
    };
  }

  current = dirname(boundary);
  while (
    current !== options.packageRoot &&
    current !== dirname(current)
  ) {
    if (existsSync(join(current, PLUGIN_MANIFEST_PATH))) {
      return {
        ok: false,
        refusal: refuse(
          "isolation-unverifiable",
          `${relative(options.packageRoot, options.file)} import ${options.edge.specifier} is nested beneath another plugin package.`,
        ),
      };
    }
    if (existsSync(join(current, "package.json"))) {
      const ancestor = readPackageIdentity(current);
      if (ancestor === null) {
        return {
          ok: false,
          refusal: refuse(
            "isolation-unverifiable",
            `${relative(options.packageRoot, options.file)} import ${options.edge.specifier} has an ambiguous ancestor package boundary.`,
          ),
        };
      }
      if (sceneaxiPackageName(ancestor.name) !== null) {
        return {
          ok: false,
          refusal: refuse(
            "forbidden-sceneaxi-import",
            `${relative(options.packageRoot, options.file)} import ${options.edge.specifier} is nested beneath package ${ancestor.name}.`,
          ),
        };
      }
    }
    current = dirname(current);
  }

  return { ok: true, identity };
}

function validateSceneaxiSpecifier(
  packageRoot: string,
  file: string,
  specifier: string,
  authorizedSceneaxiPackages: ReadonlySet<string>,
): IsolationResult {
  const pkg = sceneaxiPackageName(specifier);
  if (pkg === null || !authorizedSceneaxiPackages.has(pkg)) {
    return refuse(
      "forbidden-sceneaxi-import",
      `${relative(packageRoot, file)} imports ${specifier}, which is not authorized by claimed capabilities.`,
    );
  }

  const segments = specifier.split("/");
  if (segments.length <= 2) return { ok: true };
  const rest = segments.slice(2).join("/");
  if (rest.startsWith("contracts/") && rest.endsWith(".json")) {
    return { ok: true };
  }
  return refuse(
    "forbidden-sceneaxi-import",
    `${relative(packageRoot, file)} imports private/non-public subpath ${specifier}.`,
  );
}

function validateResolvedPackageIdentity(options: {
  readonly edge: ModuleEdge;
  readonly file: string;
  readonly identity: PackageIdentity;
  readonly packageRoot: string;
  readonly authorizedSceneaxiPackages: ReadonlySet<string>;
}): IsolationResult {
  const {
    edge,
    file,
    identity,
    packageRoot,
    authorizedSceneaxiPackages,
  } = options;
  const spelledSceneaxiPackage = sceneaxiPackageName(edge.specifier);
  const actualSceneaxiPackage = sceneaxiPackageName(identity.name);

  if (
    spelledSceneaxiPackage !== null &&
    spelledSceneaxiPackage !== actualSceneaxiPackage
  ) {
    return refuse(
      "forbidden-sceneaxi-import",
      `${relative(packageRoot, file)} import ${edge.specifier} resolves to package ${identity.name}.`,
    );
  }
  if (actualSceneaxiPackage === null) return { ok: true };
  if (
    spelledSceneaxiPackage === null ||
    !authorizedSceneaxiPackages.has(actualSceneaxiPackage)
  ) {
    return refuse(
      "forbidden-sceneaxi-import",
      `${relative(packageRoot, file)} import ${edge.specifier} resolves to unauthorized package ${actualSceneaxiPackage}.`,
    );
  }
  return { ok: true };
}

function inspectModuleGraph(options: {
  readonly packageRoot: string;
  readonly entrypointAbsolute: string;
  readonly authorizedSceneaxiPackages: ReadonlySet<string>;
}): IsolationResult {
  const pending = [options.entrypointAbsolute];
  const inspected = new Set<string>();

  while (pending.length > 0) {
    const next = pending.pop();
    if (next === undefined) continue;
    const file = canonicalFile(next);
    if (file === null) {
      return refuse(
        "isolation-unverifiable",
        `Cannot resolve ${relative(options.packageRoot, next)} for isolation check.`,
      );
    }
    if (!isUnderPackageRoot(options.packageRoot, file)) {
      return refuse(
        "entrypoint-escape",
        `${relative(options.packageRoot, next)} resolves outside the plugin package root.`,
      );
    }
    if (inspected.has(file)) continue;
    inspected.add(file);

    const extension = extname(file);
    if (extension === ".json") continue;
    if (!INSPECTABLE_MODULE_EXTENSIONS.has(extension)) {
      return refuse(
        "isolation-unverifiable",
        `${relative(options.packageRoot, file)} is not an inspectable JavaScript module artifact.`,
      );
    }

    let text: string;
    try {
      text = readFileSync(file, "utf8");
    } catch (error) {
      return refuse(
        "isolation-unverifiable",
        `Cannot read ${relative(options.packageRoot, file)} for isolation check: ${errorMessage(error, "read failed")}`,
      );
    }

    const inspection = inspectModuleSource(
      relative(options.packageRoot, file),
      text,
    );
    if (!inspection.ok) {
      return refuse("isolation-unverifiable", inspection.message);
    }

    for (const edge of inspection.edges) {
      const { specifier } = edge;
      if (specifier.startsWith("@sceneaxi/")) {
        const sceneaxi = validateSceneaxiSpecifier(
          options.packageRoot,
          file,
          specifier,
          options.authorizedSceneaxiPackages,
        );
        if (!sceneaxi.ok) return sceneaxi;
      }

      if (BUILTIN_SPECIFIERS.has(specifier)) continue;
      if (
        isAbsolute(specifier) ||
        specifier.startsWith("file:") ||
        specifier.startsWith("/")
      ) {
        return refuse(
          "entrypoint-escape",
          `${relative(options.packageRoot, file)} imports ${specifier} outside the plugin package root.`,
        );
      }
      if (/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(specifier)) {
        return refuse(
          "isolation-unverifiable",
          `${relative(options.packageRoot, file)} imports unsupported URL specifier ${specifier}.`,
        );
      }
      if (specifier.startsWith("#")) {
        const ownIdentity = readPackageIdentity(options.packageRoot);
        if (
          ownIdentity === null ||
          packageUsesUnsupportedConditions(ownIdentity, edge.kind)
        ) {
          return refuse(
            "isolation-unverifiable",
            `${relative(options.packageRoot, file)} import ${specifier} uses unverifiable package resolution conditions.`,
          );
        }
      }

      const resolution = resolveModuleEdge(file, edge);
      if (resolution === null) {
        return refuse(
          "isolation-unverifiable",
          `${relative(options.packageRoot, file)} imports unresolvable specifier ${specifier}.`,
        );
      }
      if (resolution.kind === "builtin") continue;
      if (resolution.kind === "unsupported") {
        return refuse(
          "isolation-unverifiable",
          `${relative(options.packageRoot, file)} import ${specifier} resolves to unsupported target ${resolution.target}.`,
        );
      }

      const resolved = resolution.path;
      if (specifier.startsWith(".") || specifier.startsWith("#")) {
        if (!isUnderPackageRoot(options.packageRoot, resolved)) {
          return refuse(
            "entrypoint-escape",
            `${relative(options.packageRoot, file)} import ${specifier} resolves outside the plugin package root.`,
          );
        }
        pending.push(resolved);
        continue;
      }

      const packageBoundary = packageBoundaryFor({
        edge,
        file,
        packageRoot: options.packageRoot,
        resolved,
      });
      if (!packageBoundary.ok) return packageBoundary.refusal;
      const { identity } = packageBoundary;

      const identityCheck = validateResolvedPackageIdentity({
        edge,
        file,
        identity,
        packageRoot: options.packageRoot,
        authorizedSceneaxiPackages: options.authorizedSceneaxiPackages,
      });
      if (!identityCheck.ok) return identityCheck;

      const identityRoot = identity.root;
      if (identityRoot === options.packageRoot) {
        if (!isUnderPackageRoot(options.packageRoot, resolved)) {
          return refuse(
            "entrypoint-escape",
            `${relative(options.packageRoot, file)} self import ${specifier} resolves outside the plugin package root.`,
          );
        }
        pending.push(resolved);
        continue;
      }
    }
  }

  return { ok: true };
}

/**
 * Enforce SceneAxi import boundary and package-root containment using only
 * inspectable artifacts (package.json + source text). Does not evaluate modules.
 */
export function checkPackageIsolation(options: {
  readonly packageRoot: string;
  readonly entrypointAbsolute: string;
  /** SceneAxi packages authorized by claimed capability registry rows. */
  readonly authorizedSceneaxiPackages: ReadonlySet<string>;
}): IsolationResult {
  const { packageRoot, entrypointAbsolute, authorizedSceneaxiPackages } =
    options;
  const canonicalRoot = canonicalDirectory(packageRoot);
  const canonicalEntrypoint = canonicalFile(entrypointAbsolute);

  if (canonicalRoot === null || canonicalEntrypoint === null) {
    return refuse(
      "isolation-unverifiable",
      "Plugin package root or entrypoint cannot be canonicalized.",
    );
  }
  if (!isUnderPackageRoot(canonicalRoot, canonicalEntrypoint)) {
    return refuse(
      "entrypoint-escape",
      "Resolved entrypoint is outside the plugin package root.",
    );
  }

  const declared = collectDeclaredSceneaxiDeps(canonicalRoot);
  if (!declared.ok) return declared;
  for (const dep of declared.deps ?? []) {
    if (!authorizedSceneaxiPackages.has(dep)) {
      return refuse(
        "forbidden-sceneaxi-import",
        `Package declares dependency on ${dep}, which is not authorized by claimed capabilities.`,
      );
    }
  }

  return inspectModuleGraph({
    packageRoot: canonicalRoot,
    entrypointAbsolute: canonicalEntrypoint,
    authorizedSceneaxiPackages,
  });
}
