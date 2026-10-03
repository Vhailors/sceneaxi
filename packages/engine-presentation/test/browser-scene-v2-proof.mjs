/** Serial-owner-only real browser proof. Never treat headless unit frames as pixels. */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { writeFile } from "node:fs/promises";
import { composeSceneV2 } from "@sceneaxi/authoring-core";
import { sceneCompositionArtifactFixture, sceneCompositionTransformFixture as transform } from "@sceneaxi/schemas/testing/scene-composition";
import { createHash } from "node:crypto";

const desktop = createRequire(new globalThis.URL("../../../desktop/linux/package.json", import.meta.url));

const site = createRequire(new globalThis.URL("../../../sites/umbrella/package.json", import.meta.url));

const { build } = desktop("esbuild");

const { chromium } = site("@playwright/test");

const resolveDir = new globalThis.URL("../../../desktop/linux", import.meta.url).pathname;

let browser;

try {
  // Invoke after the serialized workspace build with the shipped resolver:
  // node --loader ./scripts/workspace-dist-resolver.mjs packages/engine-presentation/test/browser-scene-v2-proof.mjs [png-output-path]
  // Real public authoring executes in Node; filesystem modules never enter WebGL.
  const artifact = sceneCompositionArtifactFixture("crate");

  function fixture(angle) {
    const result = composeSceneV2({ schemaVersion:2, kind:"sceneaxi.scene-composition-intake", sceneId:"browser-matrix", rootInstanceId:"root", placements:[
      {instanceId:"root",artifactId:"crate",parentInstanceId:null,transform:transform([1,2,3],[2,3,4],[0,0,angle])},
      {instanceId:"child",artifactId:"crate",parentInstanceId:"root",transform:transform([1,0,0],[1,2,1],[20,30,40])},
    ]},[artifact]);

    if(!result.ok) throw Error(result.message);

    return result.scene;
  }

  const fixtures = [fixture(90),fixture(0)];

  const bundle = await build({ stdin: { resolveDir, contents: `
    import * as P from "@sceneaxi/engine-presentation";
    import { openSceneKernelSessionV2, replaySceneKernelSessionV2 } from "@sceneaxi/engine-kernel";
    globalThis.matrixRuntime = { P, openSceneKernelSessionV2, replaySceneKernelSessionV2 };
  ` }, bundle: true, platform: "browser", format: "iife", write: false });

  browser = await chromium.launch({ executablePath: "/usr/bin/chromium", headless: true, args: ["--no-sandbox","--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"] });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror",error => errors.push(error.message));
  await page.setContent('<canvas width="256" height="256"></canvas>');
  await page.addScriptTag({ content: bundle.outputFiles[0].text });

  const proof = await page.evaluate(scenes => {
    const canvas = globalThis.document.querySelector("canvas");
    const gl = canvas.getContext("webgl2");

    if (!gl) throw Error("WebGL2 unavailable");
    const { P, openSceneKernelSessionV2: open, replaySceneKernelSessionV2: replay } = globalThis.matrixRuntime;
    const textures = [], buffers = [], programs = [];

    for (const [method,list] of [["createTexture",textures],["createBuffer",buffers],["createProgram",programs]]) {
      const create = gl[method].bind(gl); gl[method] = (...args) => { const value = create(...args); list.push(value);

 return value; };
    }

    const live = () => [textures.filter(v => gl.isTexture(v)).length,buffers.filter(v => gl.isBuffer(v)).length,programs.filter(v => gl.isProgram(v)).length];

    const pixels = () => { const data = new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4); gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,data);

 return data; };

    const difference = (a,b) => { let count=0;

 for(let i=0;i<a.length;i+=4) if(a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2]) count++;

 return count; };

    const backend = P.createThreeSculptPresentationBackend({ canvas, viewport:{width:256,height:256} });
    const session = open(scenes[0],{seed:42});
    const plateaus = [];
    let result;

    try {
      backend.mountSceneV2(scenes[0]); backend.presentSceneV2(session.observe()); backend.frameMountedContent();

      if(!backend.render(["root","child"]).pixelsDrawn) throw Error("no actual pixels");
      const initial = pixels();
      backend.mountSceneV2(scenes[1]); backend.render(["root","child"]); const rotationShearDelta = difference(initial,pixels());
      backend.mountSceneV2(scenes[0]); backend.presentSceneV2(session.observe()); backend.render(["root","child"]);
      const remountDelta = difference(initial,pixels());

      for(let tick=1;tick<=12;tick++) session.advance({tick,deltaMs:16});
      const save = JSON.parse(JSON.stringify(session.save()));
      const reopened = replay(save);

      if(reopened.observe().digest!==session.observe().digest) throw Error("replay drift");
      backend.presentSceneV2(session.observe()); backend.render(["root","child"]); const advanced = pixels();
      backend.presentSceneV2(reopened.observe()); backend.render(["root","child"]); const replayDelta = difference(advanced,pixels());
      const invalid = JSON.parse(JSON.stringify(session.observe())); invalid.instances[1].bounds.max[0] += 1;
      let refused = false;

 try { backend.presentSceneV2(invalid); } catch(error) { refused = error.message.includes("refused"); }

      if(!refused) throw Error("bounds corruption accepted");
      backend.render(["root","child"]); const refusalDelta = difference(advanced,pixels());

      for(let i=0;i<10;i++) { backend.mountSceneV2(scenes[0]); backend.presentSceneV2(reopened.observe()); backend.render(["root","child"]); plateaus.push(live()); }

      const png = backend.capture();

 if(!png) throw Error("no PNG");
      result = { rotationShearDelta,remountDelta,advanceDelta:difference(initial,advanced),replayDelta,refusalDelta,terminalDigest:session.observe().digest,plateaus,png:Array.from(png) };
    } finally { backend.dispose(); }

    return { ...result,terminalLive:live(),renderer:gl.getParameter(gl.RENDERER) };
  },fixtures);

  assert.equal(errors.length,0); assert.ok(proof.rotationShearDelta>0); assert.ok(proof.advanceDelta>0);
  assert.equal(proof.remountDelta,0); assert.equal(proof.replayDelta,0); assert.equal(proof.refusalDelta,0);
  assert.deepEqual(proof.plateaus.at(-1),proof.plateaus.at(-2)); assert.deepEqual(proof.terminalLive,[0,0,0]);
  const png = Uint8Array.from(proof.png);

  if (globalThis.process.argv[2]) await writeFile(globalThis.process.argv[2], png);
  const { png: omitted, ...summary } = proof;
  assert.equal(omitted.length,png.length);
  globalThis.console.log(JSON.stringify({status:"PASS_REAL_LOCAL_BROWSER_NOT_DEVICE_OR_PRODUCTION",...summary,pngBytes:png.length,pngSha256:createHash("sha256").update(png).digest("hex")},null,2));
} finally { if(browser) await browser.close(); }
