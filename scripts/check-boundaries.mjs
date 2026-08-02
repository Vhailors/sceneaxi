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
  const collectConstBindings = (node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isVariableDeclarationList(node.parent) &&
      (node.parent.flags & ts.NodeFlags.Const) !== 0
    ) {
      recordConstBindings({
        name: node.name,
        declaration: node,
        selectors: [],
        scope: lexicalScope(node),
      });
    }
    ts.forEachChild(node, collectConstBindings);
  };
  collectConstBindings(source);
  const constBindingFor = (identifier) => {
    const bindings = (constBindings.get(identifier.text) ?? [])
      .filter(({ scope }) => scope.pos <= identifier.pos && scope.end >= identifier.end)
      .sort((left, right) =>
        (left.scope.end - left.scope.pos) - (right.scope.end - right.scope.pos));
    if (bindings.length === 0 || bindings[0].scope === bindings[1]?.scope) return null;
    return bindings[0];
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
        } else if (typeof selector === "number" && value?.kind === staticArrayValue) {
          const elementValues = value.elements[selector];
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
const resolvePackageLocalSpecifier = ({ name, srcDir, file, spec }) => {
  if (spec.startsWith(".")) return resolveSourceModule(resolve(dirname(file), spec));
  if (name === "@sceneaxi/site-umbrella" && spec.startsWith("@/")) {
    return resolveSourceModule(resolve(srcDir, spec.slice(2)));
  }
  return null;
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
    const text = readFileSync(file, "utf8");
    for (const spec of staticImportSpecifiers(file, text)) {
      const resourcePath = resourceSpecifierPath(spec);
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
        const resolved = resolvePackageLocalSpecifier({ name, srcDir, file, spec: resourcePath });
        if (resolved === null) continue;
        const targetModule = sourceModuleId(resolved);
        // Path-segment containment (not raw startsWith): "packages/cli-shadow" must not match "packages/cli"
        const rel = relative(dir, resolved);
        if (rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
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
      for (const spec of staticImportSpecifiers(file, readFileSync(file, "utf8"))) {
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
