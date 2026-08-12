#!/usr/bin/env node
/**
 * Boundary check — enforces docs/dependency-matrix.json over every workspace package.
 * Fail-closed: a missing/malformed matrix, an unlisted package, an undeclared or
 * disallowed internal dependency, a cross-package source import, production source
 * reaching a test-only `testing/` seam, a Kids-boundary violation, or a release-group
 * mismatch all exit 1.
 */
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, dirname, resolve, relative, isAbsolute, sep } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const fail = (msg) => errors.push(msg);

// --- load matrix (fail closed) ---
const matrixPath = join(root, "docs", "dependency-matrix.json");
let matrix;
try {
  matrix = JSON.parse(readFileSync(matrixPath, "utf8"));
} catch (e) {
  console.error(`boundary check: cannot load ${relative(root, matrixPath)}: ${e.message}`);
  process.exit(1);
}
if (matrix.schemaVersion !== 1) {
  console.error(`boundary check: unsupported matrix schemaVersion ${matrix.schemaVersion}`);
  process.exit(1);
}
const allowOf = matrix.packages ?? {};
const kids = matrix.kidsBoundary ?? { kidsPackages: [], allowedDependents: [] };
const releaseGroups = matrix.releaseGroups ?? {};

// --- discover packages (packages/*, apps/*) plus the deployable sites/ and desktop/ tiers ---
// `sites/*` and `desktop/*` are separate single-package workspaces outside the
// repository-root workspace, but their @sceneaxi/* edges use the same exhaustive
// allow lists.
const pkgDirs = [];
for (const parent of ["packages", "apps", "sites", "desktop"]) {
  const parentDir = join(root, parent);
  if (!existsSync(parentDir)) continue;
  for (const entry of readdirSync(parentDir)) {
    const dir = join(parentDir, entry);
    if (statSync(dir).isDirectory() && existsSync(join(dir, "package.json"))) {
      pkgDirs.push(dir);
    }
  }
}
if (pkgDirs.length === 0) {
  console.error("boundary check: found zero workspace packages — refusing to pass on an empty surface");
  process.exit(1);
}

const manifests = new Map(); // name -> {dir, json}
for (const dir of pkgDirs) {
  let json;
  try {
    json = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
  } catch (e) {
    fail(`${relative(root, dir)}/package.json is malformed: ${e.message}`);
    continue;
  }
  if (!json.name) { fail(`${relative(root, dir)}/package.json has no name`); continue; }
  manifests.set(json.name, { dir, json });
}

// --- coverage both ways: disk <-> matrix ---
for (const [name, { dir }] of manifests) {
  const entry = allowOf[name];
  if (!entry) { fail(`${name} exists on disk but is not listed in the dependency matrix`); continue; }
  if (resolve(root, entry.dir) !== dir) {
    fail(`${name}: matrix dir '${entry.dir}' does not match actual '${relative(root, dir)}'`);
  }
}
for (const name of Object.keys(allowOf)) {
  if (!manifests.has(name)) fail(`${name} is listed in the dependency matrix but missing on disk`);
}

// --- declared dependency edges ---
const DEP_FIELDS = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"];
for (const [name, { json }] of manifests) {
  const allow = new Set(allowOf[name]?.allow ?? []);
  for (const field of DEP_FIELDS) {
    for (const dep of Object.keys(json[field] ?? {})) {
      if (!dep.startsWith("@sceneaxi/")) continue;
      if (!allowOf[dep]) fail(`${name}: internal dependency ${dep} is not a matrix-listed package`);
      if (!allow.has(dep)) fail(`${name}: dependency ${dep} is DENIED by the matrix`);
    }
  }
}

// --- source imports (import/export-from/require specifiers) ---
const staticImportSpecifiers = (file, text) => {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const specifiers = [];
  const unknownStaticValue = Symbol("unknown-static-value");
  const staticObjectValue = Symbol("static-object-value");
  const staticArrayValue = Symbol("static-array-value");
  const constBindings = new Map();
  // Every binding form that is *not* an immutable const, recorded by name and scope so a
  // parameter, `let`/`var`, import, catch variable, or declaration name that shadows an
  // unrelated outer const is never mistaken for it. Without this the checker could report
  // a module the code never imports, or resolve a genuinely dynamic specifier.
  const shadowBindings = new Map();
  const lexicalScope = (node) => {
    for (let current = node.parent; current !== undefined; current = current.parent) {
      if (
        ts.isSourceFile(current) ||
        ts.isBlock(current) ||
        ts.isModuleBlock(current) ||
        ts.isCaseBlock(current) ||
        ts.isForStatement(current) ||
        ts.isForInStatement(current) ||
        ts.isForOfStatement(current) ||
        ts.isClassStaticBlockDeclaration(current)
      ) {
        return current;
      }
    }
    return source;
  };
  const isFunctionLikeNode = (node) =>
    ts.isFunctionDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isArrowFunction(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isConstructorDeclaration(node) ||
    ts.isGetAccessorDeclaration(node) ||
    ts.isSetAccessorDeclaration(node);
  const functionScope = (node) => {
    for (let current = node.parent; current !== undefined; current = current.parent) {
      if (
        ts.isSourceFile(current) ||
        isFunctionLikeNode(current) ||
        ts.isClassStaticBlockDeclaration(current)
      ) {
        return current;
      }
    }
    return source;
  };
  const propertyNameText = (name) => {
    if (name === undefined) return null;
    if (ts.isIdentifier(name) || ts.isStringLiteralLike(name) || ts.isNumericLiteral(name)) {
      return name.text;
    }
    return null;
  };
  const recordConstBindings = ({ name, declaration, selectors, scope }) => {
    if (ts.isIdentifier(name)) {
      const bindings = constBindings.get(name.text) ?? [];
      bindings.push({ declaration, scope, selectors });
      constBindings.set(name.text, bindings);
      return;
    }
    if (ts.isObjectBindingPattern(name)) {
      for (const element of name.elements) {
        if (element.dotDotDotToken !== undefined) continue;
        const selector = propertyNameText(element.propertyName) ??
          (ts.isIdentifier(element.name) ? element.name.text : null);
        if (selector === null) continue;
        recordConstBindings({
          name: element.name,
          declaration,
          selectors: [...selectors, selector],
          scope,
        });
      }
      return;
    }
    for (const [index, element] of name.elements.entries()) {
      if (!ts.isBindingElement(element) || element.dotDotDotToken !== undefined) continue;
      recordConstBindings({
        name: element.name,
        declaration,
        selectors: [...selectors, index],
        scope,
      });
    }
  };
  const recordShadowBinding = (name, scope) => {
    if (name === undefined || name === null) return;
    if (ts.isIdentifier(name)) {
      const scopes = shadowBindings.get(name.text) ?? [];
      scopes.push(scope);
      shadowBindings.set(name.text, scopes);
      return;
    }
    if (ts.isObjectBindingPattern(name) || ts.isArrayBindingPattern(name)) {
      for (const element of name.elements) {
        if (ts.isBindingElement(element)) recordShadowBinding(element.name, scope);
      }
    }
  };
  const collectBindings = (node) => {
    if (ts.isVariableDeclaration(node) && ts.isVariableDeclarationList(node.parent)) {
      if ((node.parent.flags & ts.NodeFlags.Const) !== 0) {
        recordConstBindings({
          name: node.name,
          declaration: node,
          selectors: [],
          scope: lexicalScope(node),
        });
      } else {
        recordShadowBinding(
          node.name,
          (node.parent.flags & ts.NodeFlags.Let) !== 0 ? lexicalScope(node) : functionScope(node),
        );
      }
    } else if (ts.isParameter(node)) {
      recordShadowBinding(node.name, node.parent);
    } else if (ts.isCatchClause(node)) {
      recordShadowBinding(node.variableDeclaration?.name, node);
    } else if (ts.isFunctionExpression(node) || ts.isClassExpression(node)) {
      recordShadowBinding(node.name, node);
    } else if (
      ts.isFunctionDeclaration(node) ||
      ts.isClassDeclaration(node) ||
      ts.isEnumDeclaration(node) ||
      ts.isModuleDeclaration(node)
    ) {
      if (node.name !== undefined && ts.isIdentifier(node.name)) {
        recordShadowBinding(node.name, lexicalScope(node));
      }
    } else if (
      ts.isImportClause(node) ||
      ts.isImportSpecifier(node) ||
      ts.isNamespaceImport(node) ||
      ts.isImportEqualsDeclaration(node)
    ) {
      recordShadowBinding(node.name, source);
    }
    ts.forEachChild(node, collectBindings);
  };
  collectBindings(source);
  // The tightest enclosing binding wins, exactly as scope resolution does. A shadowing
  // binding winning means the identifier is not the const's value at all, so the
  // specifier stays unknown rather than being read off a same-named outer const.
  const constBindingFor = (identifier) => {
    const encloses = (scope) => scope.pos <= identifier.pos && scope.end >= identifier.end;
    const candidates = [
      ...(constBindings.get(identifier.text) ?? [])
        .filter((binding) => encloses(binding.scope))
        .map((binding) => ({ binding, scope: binding.scope })),
      ...(shadowBindings.get(identifier.text) ?? [])
        .filter(encloses)
        .map((scope) => ({ binding: null, scope })),
    ].sort((left, right) =>
      (left.scope.end - left.scope.pos) - (right.scope.end - right.scope.pos));
    const [winner, runnerUp] = candidates;
    if (winner === undefined || winner.binding === null) return null;
    if (runnerUp !== undefined && runnerUp.scope === winner.scope) return null;
    return winner.binding;
  };
  const projectBindingValues = (values, selectors) => {
    let projected = values;
    for (const selector of selectors) {
      const next = new Set();
      for (const value of projected) {
        if (value === unknownStaticValue) {
          next.add(unknownStaticValue);
        } else if (typeof selector === "string" && value?.kind === staticObjectValue) {
          const propertyValues = value.properties.get(selector);
          if (propertyValues === undefined) next.add(unknownStaticValue);
          else for (const propertyValue of propertyValues) next.add(propertyValue);
        } else if (value?.kind === staticArrayValue) {
          // `A[0]` and `A["0"]` name the same element, so a digit-string index resolves
          // like a numeric one rather than falling through to unknown.
          const index = typeof selector === "number"
            ? selector
            : typeof selector === "string" && /^\d+$/.test(selector)
              ? Number(selector)
              : null;
          const elementValues = index === null ? undefined : value.elements[index];
          if (elementValues === undefined) next.add(unknownStaticValue);
          else for (const elementValue of elementValues) next.add(elementValue);
        } else {
          next.add(unknownStaticValue);
        }
      }
      projected = next;
    }
    return projected;
  };
  const staticValues = (node, seenBindings = new Set()) => {
    if (node === undefined) return new Set([unknownStaticValue]);
    if (ts.isStringLiteralLike(node)) return new Set([node.text]);
    if (ts.isNumericLiteral(node)) return new Set([Number(node.text)]);
    if (node.kind === ts.SyntaxKind.TrueKeyword) return new Set([true]);
    if (node.kind === ts.SyntaxKind.FalseKeyword) return new Set([false]);
    if (node.kind === ts.SyntaxKind.NullKeyword) return new Set([null]);
    if (ts.isIdentifier(node)) {
      const binding = constBindingFor(node);
      if (
        binding === null ||
        binding.declaration.initializer === undefined ||
        seenBindings.has(binding)
      ) {
        return new Set([unknownStaticValue]);
      }
      const nextSeenBindings = new Set(seenBindings);
      nextSeenBindings.add(binding);
      return projectBindingValues(
        staticValues(binding.declaration.initializer, nextSeenBindings),
        binding.selectors,
      );
    }
    if (ts.isObjectLiteralExpression(node)) {
      const properties = new Map();
      for (const property of node.properties) {
        if (ts.isPropertyAssignment(property)) {
          const name = propertyNameText(property.name);
          if (name !== null) properties.set(name, staticValues(property.initializer, seenBindings));
        } else if (ts.isShorthandPropertyAssignment(property)) {
          properties.set(property.name.text, staticValues(property.name, seenBindings));
        }
      }
      return new Set([{ kind: staticObjectValue, properties }]);
    }
    if (ts.isArrayLiteralExpression(node)) {
      const elements = node.elements.map((element) =>
        ts.isSpreadElement(element)
          ? new Set([unknownStaticValue])
          : staticValues(element, seenBindings));
      return new Set([{ kind: staticArrayValue, elements }]);
    }
    // Member access on an immutable const object or array is the same lookup destructuring
    // performs, so `const M = { p: "..." }; import(M.p)` must resolve exactly like
    // `const { p } = { p: "..." }; import(p)`, and `A[0]` like `const [p] = [...]`.
    if (ts.isPropertyAccessExpression(node)) {
      if (!ts.isIdentifier(node.name)) return new Set([unknownStaticValue]);
      return projectBindingValues(staticValues(node.expression, seenBindings), [node.name.text]);
    }
    if (ts.isElementAccessExpression(node)) {
      const target = staticValues(node.expression, seenBindings);
      const values = new Set();
      for (const selector of staticValues(node.argumentExpression, seenBindings)) {
        if (typeof selector === "string" || typeof selector === "number") {
          for (const value of projectBindingValues(target, [selector])) values.add(value);
        } else {
          values.add(unknownStaticValue);
        }
      }
      return values;
    }
    if (
      ts.isParenthesizedExpression(node) ||
      ts.isAsExpression(node) ||
      ts.isTypeAssertionExpression(node) ||
      ts.isSatisfiesExpression(node) ||
      ts.isNonNullExpression(node)
    ) {
      return staticValues(node.expression, seenBindings);
    }
    if (ts.isPrefixUnaryExpression(node)) {
      const values = new Set();
      for (const value of staticValues(node.operand, seenBindings)) {
        if (value === unknownStaticValue) {
          values.add(value);
        } else if (node.operator === ts.SyntaxKind.ExclamationToken) {
          values.add(!value);
        } else if (node.operator === ts.SyntaxKind.PlusToken) {
          values.add(+value);
        } else if (node.operator === ts.SyntaxKind.MinusToken) {
          values.add(-value);
        } else {
          values.add(unknownStaticValue);
        }
      }
      return values;
    }
    if (ts.isConditionalExpression(node)) {
      const values = new Set();
      for (const condition of staticValues(node.condition, seenBindings)) {
        if (condition === unknownStaticValue) {
          for (const value of staticValues(node.whenTrue, seenBindings)) values.add(value);
          for (const value of staticValues(node.whenFalse, seenBindings)) values.add(value);
        } else {
          const branch = condition ? node.whenTrue : node.whenFalse;
          for (const value of staticValues(branch, seenBindings)) values.add(value);
        }
      }
      return values;
    }
    if (ts.isBinaryExpression(node)) {
      const leftValues = staticValues(node.left, seenBindings);
      const rightValues = staticValues(node.right, seenBindings);
      const values = new Set();
      for (const left of leftValues) {
        if (
          node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ||
          node.operatorToken.kind === ts.SyntaxKind.BarBarToken ||
          node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken
        ) {
          if (left === unknownStaticValue) {
            values.add(unknownStaticValue);
            for (const right of rightValues) values.add(right);
          } else {
            const useRight = node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
              ? Boolean(left)
              : node.operatorToken.kind === ts.SyntaxKind.BarBarToken
                ? !left
                : left === null || left === undefined;
            if (useRight) {
              for (const right of rightValues) values.add(right);
            } else {
              values.add(left);
            }
          }
          continue;
        }
        for (const right of rightValues) {
          if (left === unknownStaticValue || right === unknownStaticValue) {
            values.add(unknownStaticValue);
          } else if (node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
            values.add(left + right);
          } else if (node.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken) {
            values.add(left === right);
          } else if (node.operatorToken.kind === ts.SyntaxKind.ExclamationEqualsEqualsToken) {
            values.add(left !== right);
          } else {
            values.add(unknownStaticValue);
          }
        }
      }
      return values;
    }
    if (ts.isTemplateExpression(node)) {
      let values = new Set([node.head.text]);
      for (const span of node.templateSpans) {
        const nextValues = new Set();
        for (const prefix of values) {
          for (const expression of staticValues(span.expression, seenBindings)) {
            if (prefix === unknownStaticValue || expression === unknownStaticValue) {
              nextValues.add(unknownStaticValue);
            } else {
              nextValues.add(prefix + expression + span.literal.text);
            }
          }
        }
        values = nextValues;
      }
      return values;
    }
    return new Set([unknownStaticValue]);
  };
  const addStaticSpecifier = (node) => {
    for (const value of staticValues(node)) {
      if (typeof value === "string") specifiers.push(value);
    }
  };
  const visit = (node) => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      addStaticSpecifier(node.moduleSpecifier);
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference)
    ) {
      addStaticSpecifier(node.moduleReference.expression);
    } else if (ts.isCallExpression(node)) {
      const isDynamicImport = node.expression.kind === ts.SyntaxKind.ImportKeyword;
      const isRequire = ts.isIdentifier(node.expression) && node.expression.text === "require";
      if (isDynamicImport || isRequire) addStaticSpecifier(node.arguments[0]);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return specifiers;
};
// The import loop and the Kids loop below walk overlapping file sets, and a full
// TypeScript parse per file is no longer near-free, so each file is read and parsed once.
const specifierCache = new Map();
const importSpecifiersOf = (file) => {
  const cached = specifierCache.get(file);
  if (cached !== undefined) return cached;
  const specifiers = staticImportSpecifiers(file, readFileSync(file, "utf8"));
  specifierCache.set(file, specifiers);
  return specifiers;
};
const SOURCE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".mts", ".cts"];
const walk = (dir, out = []) => {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (SOURCE_EXTENSIONS.some((extension) => entry.endsWith(extension))) out.push(p);
  }
  return out;
};
// A package may declare a visibly test-only `./testing/*` subpath so that tests in
// another package reach a real fixture seam by public package name instead of a relative
// path into a foreign test directory. That surface exists for tests alone, so it must be
// unreachable from production source, and both ways in are refused below: the public
// subpath specifier, and a relative import that lands in the package's own src/testing
// tree. Only a file already inside src/testing may name a sibling there.
const TESTING_SUBPATH_SEGMENT = "testing";
const isTestingSubpath = (spec) =>
  spec.startsWith("@sceneaxi/") && spec.split("/")[2] === TESTING_SUBPATH_SEGMENT;
const resourceSpecifierPath = (spec) => spec.replace(/[?#].*$/, "");
const sourceModuleId = (path) =>
  relative(root, path)
    .split(sep)
    .join("/")
    .replace(/\.(?:[cm]?[jt]s|[jt]sx)$/, "");
const resolveSourceModule = (candidate) => {
  if (existsSync(candidate)) {
    const status = statSync(candidate);
    if (status.isFile()) return candidate;
    if (status.isDirectory()) {
      for (const extension of SOURCE_EXTENSIONS) {
        const indexPath = join(candidate, `index${extension}`);
        if (existsSync(indexPath) && statSync(indexPath).isFile()) return indexPath;
      }
    }
  }
  const importedExtension = SOURCE_EXTENSIONS.find((extension) => candidate.endsWith(extension));
  const base = importedExtension === undefined
    ? candidate
    : candidate.slice(0, -importedExtension.length);
  for (const extension of SOURCE_EXTENSIONS) {
    const sourcePath = `${base}${extension}`;
    if (existsSync(sourcePath) && statSync(sourcePath).isFile()) return sourcePath;
  }
  return candidate;
};
// A bundler-resolved bare specifier is a package-local import too, so the alias table is
// read from the package's own tsconfig rather than hardcoded: an alias added there must
// not silently become an unmodelled path around the authority rules below.
// `extends` may name a relative file (with or without the .json suffix, or a directory
// holding tsconfig.json) or an installed package. A base that cannot be resolved would
// hide whatever `paths` it declares, so it is refused rather than skipped.
const resolveExtendedConfig = (dir, extended) => {
  if (extended.startsWith(".") || isAbsolute(extended)) {
    const base = resolve(dir, extended);
    for (const candidate of [base, `${base}.json`, join(base, "tsconfig.json")]) {
      if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
    }
    return null;
  }
  const requireFrom = createRequire(join(dir, "tsconfig.json"));
  for (const candidate of [extended, `${extended}/tsconfig.json`, `${extended}.json`]) {
    try {
      return requireFrom.resolve(candidate);
    } catch {
      // try the next documented spelling before refusing
    }
  }
  return null;
};
const readTsconfigOptions = (configPath, seen = new Set()) => {
  const key = resolve(configPath);
  if (seen.has(key) || !existsSync(key) || !statSync(key).isFile()) return null;
  seen.add(key);
  const parsed = ts.parseConfigFileTextToJson(key, readFileSync(key, "utf8"));
  if (parsed.error !== undefined || typeof parsed.config !== "object" || parsed.config === null) {
    fail(`${relative(root, key)} is not readable, so its path aliases cannot be modelled`);
    return null;
  }
  const dir = dirname(key);
  const compilerOptions = parsed.config.compilerOptions ?? {};
  const own = {
    paths: compilerOptions.paths,
    pathsDir: dir,
    baseUrl: compilerOptions.baseUrl,
    baseUrlDir: dir,
  };
  if (own.paths !== undefined && own.baseUrl !== undefined) return own;
  // `extends` merges compilerOptions per key, so an inherited `paths` or `baseUrl` still
  // maps specifiers, and each resolves relative to the config that declares it.
  const extendsList = Array.isArray(parsed.config.extends)
    ? parsed.config.extends
    : typeof parsed.config.extends === "string"
      ? [parsed.config.extends]
      : [];
  for (const extended of [...extendsList].reverse()) {
    if (typeof extended !== "string") continue;
    const extendedPath = resolveExtendedConfig(dir, extended);
    if (extendedPath === null) {
      fail(
        `${relative(root, key)} extends '${extended}', which does not resolve, so its path aliases cannot be modelled`,
      );
      continue;
    }
    const inherited = readTsconfigOptions(extendedPath, seen);
    if (inherited === null) continue;
    if (own.paths === undefined && inherited.paths !== undefined) {
      own.paths = inherited.paths;
      own.pathsDir = inherited.pathsDir;
    }
    if (own.baseUrl === undefined && inherited.baseUrl !== undefined) {
      own.baseUrl = inherited.baseUrl;
      own.baseUrlDir = inherited.baseUrlDir;
    }
  }
  return own;
};
const packageResolutionCache = new Map();
const packageResolution = (dir) => {
  const cached = packageResolutionCache.get(dir);
  if (cached !== undefined) return cached;
  const aliases = [];
  let baseUrl = null;
  const options = readTsconfigOptions(join(dir, "tsconfig.json"));
  if (options !== null) {
    if (typeof options.baseUrl === "string") {
      baseUrl = resolve(options.baseUrlDir, options.baseUrl);
    }
    if (typeof options.paths === "object" && options.paths !== null) {
      const base = baseUrl ?? options.pathsDir;
      for (const [pattern, targets] of Object.entries(options.paths)) {
        if (!Array.isArray(targets)) continue;
        for (const target of targets) {
          if (typeof target === "string") aliases.push({ pattern, target, base });
        }
      }
    }
  }
  const resolution = { aliases, baseUrl };
  packageResolutionCache.set(dir, resolution);
  return resolution;
};
const matchAlias = ({ pattern, target, base }, spec) => {
  const star = pattern.indexOf("*");
  if (star === -1) return spec === pattern ? resolve(base, target) : null;
  const prefix = pattern.slice(0, star);
  const suffix = pattern.slice(star + 1);
  if (
    spec.length < prefix.length + suffix.length ||
    !spec.startsWith(prefix) ||
    !spec.endsWith(suffix)
  ) {
    return null;
  }
  const captured = spec.slice(prefix.length, spec.length - suffix.length);
  return resolve(base, target.replace("*", captured));
};
// One bare specifier can match several alias patterns, and one pattern can declare
// several targets: TypeScript and webpack take the longest matching prefix and then the
// first target that resolves, so the first declared match is not the module a bundler
// loads. Every candidate any of them could land on is returned, and each is checked, so
// a later, more specific alias cannot reach a denied module unseen.
//
// `baseUrl` is a resolution root of its own, not merely the base `paths` targets resolve
// against: a Next.js site with `"baseUrl": "."` and no `paths` entry at all still loads
// `src/lib/identity-plane` from the bare specifier `src/lib/identity-plane`. Only a
// candidate that lands on a file that exists is kept, so a real dependency (`react`,
// `next`) stays a package import rather than becoming a phantom package-local module.
const BARE_MODULE_SPECIFIER = /^[^./\\]/;
const resolvePackageLocalSpecifiers = ({ dir, file, spec }) => {
  if (spec.startsWith(".")) return [resolveSourceModule(resolve(dirname(file), spec))];
  const { aliases, baseUrl } = packageResolution(dir);
  const resolved = [];
  for (const alias of aliases) {
    const candidate = matchAlias(alias, spec);
    if (candidate === null) continue;
    const module = resolveSourceModule(candidate);
    if (!resolved.includes(module)) resolved.push(module);
  }
  if (baseUrl !== null && BARE_MODULE_SPECIFIER.test(spec) && !spec.includes(":")) {
    const module = resolveSourceModule(resolve(baseUrl, spec));
    if (existsSync(module) && statSync(module).isFile() && !resolved.includes(module)) {
      resolved.push(module);
    }
  }
  return resolved;
};
const UMBRELLA_IDENTITY_IMPORT_OWNERS = new Map([
  [
    "@sceneaxi/auth",
    new Set([
      "sites/umbrella/src/lib/identity-plane",
      "sites/umbrella/src/lib/provider-adapters",
    ]),
  ],
  [
    "@sceneaxi/billing",
    new Set([
      "sites/umbrella/src/lib/identity-plane",
      "sites/umbrella/src/lib/provider-adapters",
    ]),
  ],
]);
const UMBRELLA_AUTHORITY_IMPORTERS = new Map([
  [
    "sites/umbrella/src/lib/identity-plane",
    new Set([
      "sites/umbrella/src/index",
      "sites/umbrella/src/lib/request-authority",
    ]),
  ],
  [
    "sites/umbrella/src/lib/provider-adapters",
    new Set([
      "sites/umbrella/src/lib/credit-webhook",
      "sites/umbrella/src/index",
      "sites/umbrella/src/lib/identity-plane",
    ]),
  ],
  [
    "sites/umbrella/src/lib/credit-webhook",
    new Set([
      "sites/umbrella/src/index",
      "sites/umbrella/src/lib/identity-plane",
      "sites/umbrella/src/lib/request-authority",
    ]),
  ],
  ["sites/umbrella/src/index", new Set()],
]);
const PROJECT_GIT_SESSION_AUTHORITY = "@sceneaxi-internal/project-git-authority";
const PROJECT_GIT_SESSION_AUTHORITY_OWNER = "apps/desktop-shell/src/session";
// Path-segment containment via relative(), never raw startsWith, so a sibling directory
// whose name merely begins with "testing" is not treated as inside it.
const contains = (parent, candidate) => {
  const rel = relative(parent, candidate);
  return rel === "" || (rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
};
for (const [name, { dir }] of manifests) {
  const srcDir = join(dir, "src");
  if (!existsSync(srcDir)) continue;
  const allow = new Set(allowOf[name]?.allow ?? []);
  const testingDir = join(srcDir, TESTING_SUBPATH_SEGMENT);
  for (const file of walk(srcDir)) {
    const fromTesting = contains(testingDir, file);
    const fromModule = sourceModuleId(file);
    for (const spec of importSpecifiersOf(file)) {
      const resourcePath = resourceSpecifierPath(spec);
      if (
        resourcePath === PROJECT_GIT_SESSION_AUTHORITY &&
        (name !== "@sceneaxi/desktop-shell" || fromModule !== PROJECT_GIT_SESSION_AUTHORITY_OWNER)
      ) {
        fail(
          `${name}: ${relative(root, file)} imports the Git mutation authority outside its live DesktopSession owner`,
        );
      }
      if (resourcePath.startsWith("@sceneaxi/")) {
        const target = resourcePath.split("/").slice(0, 2).join("/");
        if (!allow.has(target)) {
          fail(`${name}: ${relative(root, file)} imports ${target}, DENIED by the matrix`);
        }
        const owners = UMBRELLA_IDENTITY_IMPORT_OWNERS.get(target);
        if (name === "@sceneaxi/site-umbrella" && owners !== undefined && !owners.has(fromModule)) {
          fail(
            `${name}: ${relative(root, file)} imports ${target} outside its exact deployment owner files`,
          );
        }
        if (isTestingSubpath(resourcePath)) {
          fail(`${name}: ${relative(root, file)} imports test-only subpath ${spec} — production source may not reach a testing/ seam`);
        }
      } else {
        for (const resolved of resolvePackageLocalSpecifiers({ dir, file, spec: resourcePath })) {
          const targetModule = sourceModuleId(resolved);
          // Path-segment containment (not raw startsWith): "packages/cli-shadow" must not match "packages/cli"
          const rel = relative(dir, resolved);
          if (
            (rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) &&
            resourcePath !== PROJECT_GIT_SESSION_AUTHORITY
          ) {
            fail(`${name}: ${relative(root, file)} escapes its package via relative import '${spec}'`);
          } else if (!fromTesting && contains(testingDir, resolved)) {
            fail(`${name}: ${relative(root, file)} imports test-only module '${spec}' — production source may not reach a testing/ seam`);
          }
          const authorityImporters = UMBRELLA_AUTHORITY_IMPORTERS.get(targetModule);
          if (
            name === "@sceneaxi/site-umbrella" &&
            authorityImporters !== undefined &&
            !authorityImporters.has(fromModule)
          ) {
            fail(
              `${name}: ${relative(root, file)} imports deployment authority module ${targetModule} outside the request-authority facade`,
            );
          }
        }
      }
    }
  }
}

// --- Kids boundary (independent of allow lists) ---
const kidsSet = new Set(kids.kidsPackages ?? []);
const kidsOk = new Set(kids.allowedDependents ?? []);
for (const [name, { json, dir }] of manifests) {
  if (kidsSet.has(name) || kidsOk.has(name)) continue;
  for (const field of DEP_FIELDS) {
    for (const dep of Object.keys(json[field] ?? {})) {
      if (kidsSet.has(dep)) fail(`${name}: depends on Kids package ${dep} — Kids boundary violation`);
    }
  }
  const srcDir = join(dir, "src");
  if (existsSync(srcDir)) {
    for (const file of walk(srcDir)) {
      for (const spec of importSpecifiersOf(file)) {
        const resourcePath = resourceSpecifierPath(spec);
        const target = resourcePath.startsWith("@sceneaxi/")
          ? resourcePath.split("/").slice(0, 2).join("/")
          : null;
        if (target && kidsSet.has(target)) {
          fail(`${name}: ${relative(root, file)} imports Kids package ${target} — Kids boundary violation`);
        }
      }
    }
  }
}

// --- release groups and profile core pins ---
for (const [name, { json }] of manifests) {
  const expected = allowOf[name]?.releaseGroup;
  if (!expected) continue; // coverage failure already recorded above
  const actual = json.sceneaxi?.releaseGroup;
  if (actual !== expected) {
    fail(`${name}: sceneaxi.releaseGroup is '${actual}', matrix says '${expected}'`);
  }
  if (!releaseGroups[expected]) fail(`${name}: release group '${expected}' has no policy in the matrix`);
  if (expected === "profile" && typeof json.sceneaxi?.corePin !== "string") {
    fail(`${name}: profile package must declare sceneaxi.corePin (core-train semver range)`);
  }
}

if (errors.length > 0) {
  console.error(`boundary check FAILED — ${errors.length} violation(s):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(`boundary check OK — ${manifests.size} packages verified against dependency-matrix.json`);
