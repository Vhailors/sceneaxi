/**
 * Pre-evaluation package isolation checks (ADR 0005).
 * Uses only descriptor + inspectable package metadata/artifacts — never evaluates
 * the plugin entrypoint.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

const SCENEAXI_SPEC_RE =
  /(?:from\s+|require\s*\(\s*|import\s*\(\s*|^\s*import\s+)["']([^"']+)["']/gm;

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

  const absolute = resolve(packageRoot, normalized);
  if (!isUnderPackageRoot(packageRoot, absolute)) {
    return refuse(
      "entrypoint-escape",
      `Entrypoint "${entrypoint}" resolves outside the package root.`,
    );
  }

  if (!existsSync(absolute) || !statSync(absolute).isFile()) {
    return refuse(
      "entrypoint-missing",
      `Entrypoint "${entrypoint}" does not exist under the package root.`,
    );
  }

  return { ok: true, absolutePath: absolute };
}

function walkSourceFiles(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (entry === "node_modules" || entry === "dist") continue;
      walkSourceFiles(p, out);
    } else if (/\.(m?[jt]s|cjs|tsx)$/.test(entry)) {
      out.push(p);
    }
  }
  return out;
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

  if (!isUnderPackageRoot(packageRoot, entrypointAbsolute)) {
    return refuse(
      "entrypoint-escape",
      "Resolved entrypoint is outside the plugin package root.",
    );
  }

  const declared = collectDeclaredSceneaxiDeps(packageRoot);
  if (!declared.ok) return declared;
  for (const dep of declared.deps ?? []) {
    if (!authorizedSceneaxiPackages.has(dep)) {
      return refuse(
        "forbidden-sceneaxi-import",
        `Package declares dependency on ${dep}, which is not authorized by claimed capabilities.`,
      );
    }
  }

  // Scan entrypoint file and sibling sources under the package root.
  const files = new Set<string>([
    entrypointAbsolute,
    ...walkSourceFiles(packageRoot),
  ]);

  for (const file of files) {
    if (!isUnderPackageRoot(packageRoot, file)) {
      return refuse(
        "entrypoint-escape",
        `Source file ${relative(packageRoot, file)} escapes the package root.`,
      );
    }
    let text: string;
    try {
      text = readFileSync(file, "utf8");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "read failed";
      return refuse(
        "isolation-unverifiable",
        `Cannot read ${relative(packageRoot, file)} for isolation check: ${message}`,
      );
    }

    for (const match of text.matchAll(SCENEAXI_SPEC_RE)) {
      const spec = match[1];
      if (spec === undefined) continue;

      if (spec.startsWith("@sceneaxi/")) {
        const pkg = sceneaxiPackageName(spec);
        if (pkg === null || !authorizedSceneaxiPackages.has(pkg)) {
          return refuse(
            "forbidden-sceneaxi-import",
            `${relative(packageRoot, file)} imports ${spec}, which is not authorized by claimed capabilities.`,
          );
        }
        // Private/deep internal source paths under SceneAxi packages refuse.
        // Public contract JSON subpaths (contracts/*.json) under an authorized
        // package remain allowed; bare package root and contracts/ are OK.
        const segments = spec.split("/");
        if (segments.length > 2) {
          const rest = segments.slice(2).join("/");
          const allowedSub =
            rest.startsWith("contracts/") && rest.endsWith(".json");
          if (!allowedSub) {
            return refuse(
              "forbidden-sceneaxi-import",
              `${relative(packageRoot, file)} imports private/non-public subpath ${spec}.`,
            );
          }
        }
        continue;
      }

      if (spec.startsWith(".")) {
        const resolved = resolve(dirname(file), spec);
        // Extensionless relative specs may point at a file or directory; check containment of the resolved path prefix.
        if (!isUnderPackageRoot(packageRoot, resolved)) {
          return refuse(
            "entrypoint-escape",
            `${relative(packageRoot, file)} relative import '${spec}' escapes the package root.`,
          );
        }
      }
    }
  }

  return { ok: true };
}
