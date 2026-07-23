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
import { pathToFileURL } from "node:url";
import { parse } from "acorn";

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

type ModuleInspection =
  | { readonly ok: true; readonly specifiers: readonly string[] }
  | { readonly ok: false; readonly message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function literalString(value: unknown): string | null {
  if (!isRecord(value) || value["type"] !== "Literal") return null;
  return typeof value["value"] === "string" ? value["value"] : null;
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

  const specifiers = new Set<string>();
  let failure: string | null = null;

  const addStaticSource = (value: unknown, syntax: string): void => {
    const specifier = literalString(value);
    if (specifier === null) {
      failure = `${file} contains ${syntax} with a non-literal module specifier.`;
      return;
    }
    specifiers.add(specifier);
  };

  const visit = (value: unknown): void => {
    if (failure !== null) return;
    if (Array.isArray(value)) {
      for (const child of value) visit(child);
      return;
    }
    if (!isRecord(value)) return;

    const type = value["type"];
    if (
      type === "ImportDeclaration" ||
      type === "ExportAllDeclaration" ||
      type === "ExportNamedDeclaration"
    ) {
      if (value["source"] !== null && value["source"] !== undefined) {
        addStaticSource(value["source"], "an import or re-export");
      }
    } else if (type === "ImportExpression") {
      addStaticSource(value["source"], "a dynamic import");
    } else if (type === "CallExpression" && isRequireCallee(value["callee"])) {
      const args = value["arguments"];
      if (!Array.isArray(args) || args.length !== 1) {
        failure = `${file} contains require() with an unverifiable module specifier.`;
      } else {
        addStaticSource(args[0], "require()");
      }
    }

    for (const child of Object.values(value)) visit(child);
  };

  visit(ast);
  return failure === null
    ? { ok: true, specifiers: [...specifiers] }
    : { ok: false, message: failure };
}

function resolveModuleFile(importer: string, specifier: string): string | null {
  try {
    const require = createRequire(pathToFileURL(importer));
    const resolved = require.resolve(specifier);
    return canonicalFile(resolved);
  } catch {
    return null;
  }
}

function containingPackageRoot(file: string): string | null {
  let current = dirname(file);
  while (true) {
    if (existsSync(join(current, "package.json"))) return current;
    const parent = dirname(current);
    if (parent === current) return null;
    current = parent;
  }
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

    for (const specifier of inspection.specifiers) {
      if (specifier.startsWith("@sceneaxi/")) {
        const sceneaxi = validateSceneaxiSpecifier(
          options.packageRoot,
          file,
          specifier,
          options.authorizedSceneaxiPackages,
        );
        if (!sceneaxi.ok) return sceneaxi;
        continue;
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

      const resolved = resolveModuleFile(file, specifier);
      if (resolved === null) {
        return refuse(
          "isolation-unverifiable",
          `${relative(options.packageRoot, file)} imports unresolvable specifier ${specifier}.`,
        );
      }
      if (isUnderPackageRoot(options.packageRoot, resolved)) {
        pending.push(resolved);
        continue;
      }

      if (specifier.startsWith(".") || specifier.startsWith("#")) {
        return refuse(
          "entrypoint-escape",
          `${relative(options.packageRoot, file)} import ${specifier} resolves outside the plugin package root.`,
        );
      }

      const dependencyRoot = containingPackageRoot(resolved);
      if (
        dependencyRoot !== null &&
        existsSync(join(dependencyRoot, PLUGIN_MANIFEST_PATH))
      ) {
        return refuse(
          "isolation-unverifiable",
          `${relative(options.packageRoot, file)} imports another plugin package via ${specifier}.`,
        );
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
