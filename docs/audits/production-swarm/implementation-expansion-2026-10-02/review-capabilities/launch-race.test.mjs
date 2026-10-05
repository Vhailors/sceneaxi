import { afterEach, expect, it, vi } from "vitest";
const race = vi.hoisted(() => ({ run: null }));
vi.mock("node:fs", async original => { const fs = await original(); return { ...fs, mkdtempSync(...args) { if (String(args[0]).includes("sceneaxi-local-launch-") && race.run) { const run = race.run; race.run = null; run(); } return fs.mkdtempSync(...args); } }; });
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync, realpathSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { createDocument, serializeDocument, computeDeliveryArtifactSetDigest } from "@sceneaxi/schemas";
import { buildLocalProject, launchLocalProjectBuild } from "/home/devuser/Documents/Projects/sceneaxi/packages/authoring-core/src/local-project-build.ts";
let root;
afterEach(() => { race.run = null; if (root) rmSync(root, {recursive:true,force:true}); });
it("never executes a runtime replaced by symlink after verification", async () => {
 root=mkdtempSync(join(tmpdir(),"sceneaxi-review-race-"));
 const scene=serializeDocument(createDocument({id:"race-project",data:{objects:[]}}));
 writeFileSync(join(root,"scene.json"),scene);
 const artifacts={};
 for(const [path,bytes] of Object.entries({"index.html":"<!doctype html><title>User</title>","source/scene.json":scene})) {
  mkdirSync(join(root,"exports/web/fixture",path,".."),{recursive:true});
  writeFileSync(join(root,"exports/web/fixture",path),bytes);
  artifacts[path]={role:path.endsWith("html")?"application":"metadata",contentType:path.endsWith("html")?"text/html":"application/json",digest:"sha256:"+createHash("sha256").update(bytes).digest("hex")};
 }
 writeFileSync(join(root,"exports/web/fixture/delivery-handoff.json"),JSON.stringify({schemaVersion:1,kind:"sceneaxi.delivery-handoff",product:{id:"race-project",displayName:"User",version:"0.0.0"},target:"web",artifacts,artifactSetDigest:computeDeliveryArtifactSetDigest(artifacts),provenance:{createdAt:"2026-10-02T00:00:00Z"}}));
 const built=buildLocalProject({projectRoot:root,exportPath:"exports/web/fixture",name:"fixture",profile:"game",purpose:"local-unsigned",target:"linux"});
 expect(built.ok).toBe(true); if(!built.ok) throw new Error(built.reason);
 const marker=join(root,"executed-unverified-runtime");
 const outside=join(root,"unverified.cjs");
 writeFileSync(outside,`require("node:fs").writeFileSync(${JSON.stringify(marker)},"executed");`);
 race.run=()=>{rmSync(join(built.directory,"runtime.cjs"));symlinkSync(outside,join(built.directory,"runtime.cjs"));};
 const outcome=await launchLocalProjectBuild({projectRoot:root,name:"fixture",executable:realpathSync(process.execPath),timeoutMs:1000});
 console.log(JSON.stringify({outcome,unverifiedRuntimeExecuted:existsSync(marker),runtimeIsSymlink:true}));
 expect(existsSync(marker),"unverified runtime must not execute, even if final receipt refuses").toBe(false);
});
