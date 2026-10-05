// Serial-owner-only actual runtime fixture. NOT RUN by builder.
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { buildLocalProject, contentHash, launchLocalProjectBuild } from "@sceneaxi/authoring-core";
import { parseDocumentText, serializeDocument } from "@sceneaxi/schemas";
import { seedDesktopProject } from "/home/devuser/Documents/Projects/sceneaxi/desktop/linux/src/lib/project-seed.ts";
import { exportDesktopWebProject } from "/home/devuser/Documents/Projects/sceneaxi/desktop/linux/src/lib/web-export.ts";
function argument(name: string): string { const i = process.argv.indexOf(name); const value = process.argv[i + 1]; if (i < 0 || !value) throw new Error(`Required ${name}`); return value; }
const renderer = argument("--renderer"), publisher = argument("--publisher"), electron = argument("--electron");
const evidence = "/home/devuser/Documents/Projects/sceneaxi/docs/audits/production-swarm/implementation-expansion-2026-10-02/unsigned-project-build";
const project = mkdtempSync(join(tmpdir(), "sceneaxi-user-local-runtime-"));
try {
 assert.equal(seedDesktopProject(project).ok, true);
 const parsed = parseDocumentText(readFileSync(join(project, "scene.json"), "utf8"));
 if (!parsed.ok) throw new Error(parsed.message);
 const source = serializeDocument({ ...parsed.document, title: "Unsigned USER project — contained local runtime" });
 writeFileSync(join(project, "scene.json"), source);
 const exported = exportDesktopWebProject({ projectRoot: project, documentPath: "scene.json", expectedContentHash: contentHash(source), expectedContentByteLength: Buffer.byteLength(source), runtimeJavaScript: readFileSync(renderer), publisherExecutable: publisher });
 if (!exported.ok) throw new Error(exported.reason);
 const built = buildLocalProject({ projectRoot: project, exportPath: relative(project, exported.outputDirectory), name: "native-smoke", profile: "game", purpose: "local-unsigned", target: "linux" });
 if (!built.ok) throw new Error(built.reason);
 const launched = await launchLocalProjectBuild({ projectRoot: project, name: "native-smoke", executable: electron });
 if (!launched.ok) throw new Error(launched.reason);
 assert.equal(launched.exitCode, 0); assert.equal(launched.pixelsDrawn, true); assert.equal(launched.documentHash, contentHash(source));
 assert.equal(readFileSync(join(project, "scene.json"), "utf8"), source);
 writeFileSync(join(evidence, "native-runtime.png"), launched.png);
 writeFileSync(join(evidence, "native-source-scene.json"), source);
 writeFileSync(join(evidence, "native-build-manifest.json"), JSON.stringify(built.receipt, null, 2) + "\n");
 const { png, ...proof } = launched;
 writeFileSync(join(evidence, "native-smoke-receipt.json"), JSON.stringify({ status: "PASS", fixture: "actual saved user SceneDocument -> existing Web export -> local unsigned build -> standalone Electron", proof, sourceUnchanged: true, publication: false, signing: false }, null, 2) + "\n");
 console.log(JSON.stringify({ status: "PASS", ...proof, capture: join(evidence, "native-runtime.png") }));
} finally { rmSync(project, { recursive: true, force: true }); }
