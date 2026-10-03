import { conformance } from "@sceneaxi/profile-game";
import { readFileSync } from "node:fs";
import { describe, expect, expectTypeOf, it } from "vitest";
import ts from "typescript";
import * as schemas from "@sceneaxi/schemas";
import type { ConformanceCheckResult, ConformanceSuiteResult } from "@sceneaxi/schemas";
import { runProfileConformanceSuite } from "@sceneaxi/schemas/node/profile-conformance-suite";
import type { ConformanceCheckResult as NodeCheck, ConformanceSuiteResult as NodeSuite } from "@sceneaxi/schemas/node/profile-conformance-suite";

describe("LF-02 legacy conformance import policy", () => {
    it("restores both original root types as erased exports only", () => {
        expectTypeOf<ConformanceCheckResult>().toEqualTypeOf<NodeCheck>();
        expectTypeOf<ConformanceSuiteResult>().toEqualTypeOf<NodeSuite>();
        const source = readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");
        const ast = ts.createSourceFile("index.ts", source, ts.ScriptTarget.Latest, true);
        const restored = ast.statements.filter(ts.isExportDeclaration).filter(node => node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier) && node.moduleSpecifier.text === "./profile-conformance-suite.js");
        expect(restored).toHaveLength(1);
        expect(restored[0]?.isTypeOnly).toBe(true);
        expect(restored[0]?.exportClause?.getText(ast)).toContain("ConformanceCheckResult");
        expect(restored[0]?.exportClause?.getText(ast)).toContain("ConformanceSuiteResult");
        expect(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText).not.toContain("profile-conformance-suite");
        expect(schemas).toHaveProperty("runProfileConformanceSuite", runProfileConformanceSuite);
    });
    it("restores the synchronous Node root with an explicit browser boundary", () => {
        const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
        expect(manifest.exports["./node/profile-conformance-suite"]).toBe("./src/profile-conformance-suite.ts");
          expect(manifest.exports["."]).toEqual({ browser: "./src/index.ts", node: "./src/node-index.ts", default: "./src/index.ts" });
        expect(isConformanceRunner(runProfileConformanceSuite)).toBe(true);
    });
});

it("keeps the transpiled browser root graph entirely outside Node-only modules", () => {
    const visited = new Set<string>();
    const builtins: string[] = [];

    function walk(url: URL): void {
        if (visited.has(url.href))
            return;
        visited.add(url.href);
        const source = readFileSync(url, "utf8");
        const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
        const ast = ts.createSourceFile("runtime.js", output, ts.ScriptTarget.Latest, true);

        function visit(node: ts.Node): void {
            let specifier: string | undefined;

            if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier))
                specifier = node.moduleSpecifier.text;

            if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && node.arguments[0] && ts.isStringLiteral(node.arguments[0]))
                specifier = node.arguments[0].text;

            if (specifier?.startsWith("node:"))
                builtins.push(specifier);
            else if (specifier?.startsWith("."))
                walk(new URL(specifier.replace(/\.js$/, ".ts"), url));
            else if (specifier !== undefined)
                throw Error("Unreviewed browser runtime edge " + specifier);
            ts.forEachChild(node, visit);
        }

        visit(ast);
    }

    walk(new URL("../src/index.ts", import.meta.url));
    expect(visited.size).toBeGreaterThan(10);
    expect(builtins).toEqual([]);
    expect([...visited].some(path => path.endsWith("profile-conformance-suite.ts"))).toBe(false);
});

it("documents exact LF-02 conditional Node runtime recovery", () => {
    const doc = readFileSync(new URL("../../../docs/kernel-browser-open.md", import.meta.url), "utf8");
    expect(doc).toContain('@sceneaxi/schemas/node/profile-conformance-suite');
    expect(doc).toContain("root runtime");
    expect(doc).toContain("Node condition");
    expect(doc).not.toContain("@sceneaxi/schemas/testing/*");
});

it("preserves actual synchronous suite checks, shipping false and held citations", () => {
    const result: ConformanceSuiteResult = schemas.runProfileConformanceSuite(conformance);
      expect(result).toEqual(runProfileConformanceSuite(conformance));
    expect(result.ok).toBe(true);
    expect(result.checks).toEqual(expect.arrayContaining([
        expect.objectContaining({ name: "shipping-claim-false", ok: true }),
        expect.objectContaining({ name: "cites-profile-rollout-order", ok: true }),
    ]));
    expect(conformance.claim.shippingClaim).toBe(false);
    const shippingFixture = { ...conformance, claim: { ...conformance.claim } };
    Object.defineProperty(shippingFixture.claim, "shippingClaim", { value: true });
    const refused = runProfileConformanceSuite(shippingFixture);
    expect(refused.ok).toBe(false);
    expect(refused.checks).toEqual([expect.objectContaining({ name: "claim-validates", ok: false })]);
});

it("compiles the original public root consumer signatures without emitting files", () => {
    const root = new URL("../../../", import.meta.url).pathname;
    const file = root + "legacy-compat-consumer.mts";
    const fixture = "import { computeDigest } from \"@sceneaxi/engine-kernel\";\nimport type { ConformanceCheckResult, ConformanceSuiteResult } from \"@sceneaxi/schemas\";\nconst check: ConformanceCheckResult = { name: \"old\", ok: true };\nconst result: ConformanceSuiteResult = { ok: true, suiteVersion: 1, checks: [check] };\nconst digest: string = computeDigest(1, 2, [{ id: \"\u96EA\", x: -1, y: 2 }]);\nvoid result; void digest;\n// @ts-expect-error The old helper remains exactly three arguments.\ncomputeDigest(1, 2, [], undefined);\nimport { runProfileConformanceSuite } from \"@sceneaxi/schemas\";";
    const options: ts.CompilerOptions = { module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext, target: ts.ScriptTarget.ES2022, strict: true, noEmit: true, skipLibCheck: true, types: ["node"], baseUrl: root, paths: { "@sceneaxi/engine-kernel": ["packages/engine-kernel/src/index.ts"] } };
    const host = ts.createCompilerHost(options);
    const getSource = host.getSourceFile.bind(host), exists = host.fileExists.bind(host), read = host.readFile.bind(host);
    host.fileExists = path => path === file || exists(path);
    host.readFile = path => path === file ? fixture : read(path);
    host.getSourceFile = (path, language, onError, createNew) => path === file ? ts.createSourceFile(file, fixture, language, true) : getSource(path, language, onError, createNew);
    const program = ts.createProgram([file], options, host);
    const source = program.getSourceFile(file);

    if (source === undefined)
        throw Error("Consumer was not compiled");
    const diagnostics = [...program.getSyntacticDiagnostics(source), ...program.getSemanticDiagnostics(source)];
    expect(diagnostics.map(diagnostic => ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"))).toEqual([]);
    // This is a scoped consumer check, not a whole-graph/package build claim.
});

function isConformanceRunner(value: unknown): value is typeof runProfileConformanceSuite { return isBoundaryCallableValue(value); }

type BoundaryCallableValue = (...args: never[]) => void;

function isBoundaryCallableValue<Input>(value: Input): value is Input & BoundaryCallableValue & object {
  return typeof value === "function";
}
