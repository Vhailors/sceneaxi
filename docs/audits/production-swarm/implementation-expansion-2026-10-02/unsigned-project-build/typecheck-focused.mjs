import ts from "typescript";

const root = process.cwd();

const config = ts.readConfigFile("tsconfig.base.json", ts.sys.readFile);

const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);

const files = ["packages/schemas/src/desktop-project-build.ts", "packages/schemas/test/local-project-build.test.ts", "packages/authoring-core/src/local-project-build.ts", "packages/authoring-core/test/local-project-build.test.ts"].map(p => root + "/" + p);

const folder = "docs/audits/production-swarm/implementation-expansion-2026-10-02/unsigned-project-build/";

const program = ts.createProgram(files, { ...parsed.options, composite: false, noEmit: true, baseUrl: root, paths: { "@sceneaxi/schemas": [folder + "schema-export-bridge.ts"], "@sceneaxi/authoring-core": [folder + "authoring-export-bridge.ts"] } });

const diagnostics = ts.getPreEmitDiagnostics(program);

console.log(ts.formatDiagnosticsWithColorAndContext(diagnostics, { getCurrentDirectory: () => root, getCanonicalFileName: p => p, getNewLine: () => "\n" }));

console.log(JSON.stringify({ ownedErrors: diagnostics.filter(d => d.file && files.includes(d.file.fileName)).length, allErrors: diagnostics.length }));

process.exit(diagnostics.length ? 1 : 0);
