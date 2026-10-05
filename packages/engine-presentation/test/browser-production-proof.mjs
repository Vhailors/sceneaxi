/** Explicit local browser proof; SwiftShader is not physical device evidence. */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { performance } from "node:perf_hooks";

const desktop = createRequire(new globalThis.URL("../../../desktop/linux/package.json", import.meta.url));

const site = createRequire(new globalThis.URL("../../../sites/umbrella/package.json", import.meta.url));

const { build } = desktop("esbuild");

const { chromium } = site("@playwright/test");

const bundle = await build({ stdin: { contents: 'import * as P from "@sceneaxi/engine-presentation"; globalThis.P = P;', resolveDir: new globalThis.URL("../../../desktop/linux", import.meta.url).pathname }, bundle: true, platform: "browser", format: "iife", write: false });

const start = performance.now();

const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", headless: true, args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });

try {
  const page = await browser.newPage();
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.setContent('<canvas width="128" height="128"></canvas><button id="audio">Unlock and play contained WAV</button>');
  await page.addScriptTag({ content: bundle.outputFiles[0].text });

  const rendering = await page.evaluate(async () => {
    const canvas = globalThis.document.querySelector("canvas"), gl = canvas.getContext("webgl2"), P = globalThis.P;

    if (!gl) throw Error("WebGL2 unavailable");
    const renderer = gl.getParameter(gl.RENDERER);
    const textures = [], counts = [];
    const createTexture = gl.createTexture.bind(gl);
    gl.createTexture = () => { const texture = createTexture(); textures.push(texture);

 return texture; };

    for (let i = 0; i < 100; i++) {
      const c = P.createThreePresentationCore({ canvas, viewport: { width: 128, height: 128 } });

      if (!c.draw().pixelsDrawn) throw Error("No actual drawing buffer frame");
      c.dispose(); counts.push(textures.filter(texture => gl.isTexture(texture)).length);
    }

    const b = P.createThreeSculptPresentationBackend({ canvas, viewport: { width: 128, height: 128 } });
    const matrix = [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];
    const mesh = { meshId: "square", nodeIndex: 0, positions: [-2,0.1,-2, 2,0.1,-2, 2,0.1,2, -2,0.1,2], indices: [0,2,1,0,3,2], matrix, baseColor: "#ffffff", metallic: 0, roughness: 1, uvs: [0,0,1,0,1,1,0,1], baseColorTexture: { width: 2, height: 2, rgba: [255,0,0,255, 0,0,255,255, 0,0,255,255, 255,0,0,255] } };
    const input = { instanceId: "square", transform: { translation: [0,0,0], rotationEulerDegrees: [0,0,0], scale: [1,1,1] }, nodes: [{ node: 0, parent: null, matrix, matrixAuthored: false, translation: [0,0,0], rotation: [0,0,0,1], scale: [1,1,1] }], meshes: [mesh] };
    const pixels = () => { const data = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4); gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, data);

 return data; };

    const changed = (left, right) => { let total = 0;

 for (let i = 0; i < left.length; i += 4) if (left[i] !== right[i] || left[i+1] !== right[i+1] || left[i+2] !== right[i+2]) total++;

 return total; };

    b.mountTriangleAsset(input); b.frameMountedContent(); b.render(["square"]);
    const checker = pixels(), pngBytes = b.capture().length;
    b.mountTriangleAsset({ ...input, meshes: [{ ...mesh, baseColorTexture: undefined }] }); b.render(["square"]);
    const base = pixels(), checkerDelta = changed(checker, base);
    const clip = { name: "move", duration: 1, channels: [{ node: 0, path: "translation", interpolation: "LINEAR", times: [0,1], values: [0,0,0, 2,0,0] }] };
    b.playTriangleAnimation("square", clip, 1); b.render(["square"]);
    const animationDelta = changed(base, pixels());
    b.playTriangleAnimation("square", { ...clip, channels: [{ ...clip.channels[0], interpolation: "STEP" }] }, 0.5); b.render(["square"]);
    const stepEarlyDelta = changed(base, pixels());
    b.playTriangleAnimation("square", { ...clip, channels: [{ ...clip.channels[0], interpolation: "STEP" }] }, 1); b.render(["square"]);
    const stepLateDelta = changed(base, pixels());
    b.resetTriangleAnimation("square"); b.render(["square"]);
    const resetDelta = changed(base, pixels());
    const featureProof = {};
    const image = new globalThis.OffscreenCanvas(16,16), ctx = image.getContext("2d");
    ctx.fillStyle = "#ff0000"; ctx.fillRect(0,0,16,16); ctx.fillStyle = "#0000ff"; ctx.fillRect(8,0,8,8); ctx.fillRect(0,8,8,8);

    for (const format of ["png", "jpeg", "webp"]) {
      const blob = await image.convertToBlob({ type: "image/" + format, quality: 0.95 });

      if (blob.type !== "image/" + format) throw Error("Browser did not encode " + format);
      const decoded = await P.decodeContainedImage({ assetId: "format-" + format, bytes: new Uint8Array(await blob.arrayBuffer()) });
      b.mountTriangleAsset({ ...input, meshes: [{ ...mesh, baseColorTexture: decoded }] }); b.render(["square"]);
      featureProof[format + "Delta"] = changed(base,pixels());
    }

    b.mountTriangleAsset({ ...input, meshes: [{ ...mesh, baseColorTexture: undefined }] }); b.render(["square"]);
    const catalogTexture = { assetId: "catalog-checker", ...mesh.baseColorTexture };
    b.setMaterialOverrides([{ instanceId: "square", baseColorMapAssetId: "catalog-checker", normalMapAssetId: null, roughnessMapAssetId: null, emissiveColor: "#000000", emissiveIntensity: 1, opacity: 1 }], [catalogTexture]); b.render(["square"]);
    featureProof.catalogDelta = changed(base,pixels()); const catalogPixels = pixels();

    try { b.setMaterialOverrides([{ instanceId: "square", baseColorMapAssetId: "absent", normalMapAssetId: null, roughnessMapAssetId: null, emissiveColor: "#000000", emissiveIntensity: 1, opacity: 1 }], [catalogTexture]); throw Error("Missing catalog slot accepted"); }
    catch (error) { if (!error.message.includes("unresolved")) throw error; }

    b.render(["square"]); featureProof.catalogRefusalDelta = changed(catalogPixels,pixels());
    b.setMaterialOverrides([]); b.render(["square"]); featureProof.catalogResetDelta = changed(base,pixels());
    const dataOverride = { instanceId: "square", baseColorMapAssetId: null, normalMapAssetId: null, roughnessMapAssetId: null, emissiveColor: "#000000", emissiveIntensity: 1, opacity: 1 };
    b.setMaterialOverrides([{ ...dataOverride, normalMapAssetId: "normal" }], [{ assetId: "normal", width: 1, height: 1, rgba: [255,128,128,255] }]); b.render(["square"]); featureProof.normalDelta = changed(base,pixels());
    b.setMaterialOverrides([{ ...dataOverride, roughnessMapAssetId: "roughness" }], [{ assetId: "roughness", width: 1, height: 1, rgba: [0,0,0,255] }]); b.render(["square"]); featureProof.roughnessDelta = changed(base,pixels());
    b.setMaterialOverrides([]); b.render(["square"]); featureProof.dataResetDelta = changed(base,pixels());
    const cubic = { ...clip, channels: [{ ...clip.channels[0], interpolation: "CUBICSPLINE", values: [0,0,0, 0,0,0, 2,0,0, 0,0,0, 2,0,0, 0,0,0] }] };
    b.playTriangleAnimation("square",cubic,0.5); b.render(["square"]); featureProof.cubicDelta = changed(base,pixels());
    b.resetTriangleAnimation("square");
    b.playTriangleAnimation("square", { ...clip, channels: [{ ...clip.channels[0], path: "rotation", values: [0,0,0,1, 0,Math.sin(Math.PI/8),0,Math.cos(Math.PI/8)] }] }, 1); b.render(["square"]); featureProof.rotationDelta = changed(base,pixels());
    b.playTriangleAnimation("square", { ...clip, channels: [{ ...clip.channels[0], path: "scale", values: [1,1,1, 0.4,0.4,0.4] }] }, 1); b.render(["square"]); featureProof.scaleDelta = changed(base,pixels());
    b.resetTriangleAnimation("square"); b.render(["square"]);
    const skin = { joints: [0], inverseBindMatrices: matrix, jointIndices: Array(16).fill(0), weights: [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0] };
    b.mountTriangleAsset({ ...input, nodes: [...input.nodes,{ ...input.nodes[0], node: 1 }], meshes: [{ ...mesh, nodeIndex: 1, baseColorTexture: undefined, skin }] }); b.render(["square"]);
    featureProof.skinRestDelta = changed(base,pixels());
    b.playTriangleAnimation("square",clip,1); b.render(["square"]); featureProof.skinDelta = changed(base,pixels());
    b.resetTriangleAnimation("square"); b.render(["square"]); featureProof.skinResetDelta = changed(base,pixels());
    b.mountTriangleAsset({ ...input, meshes: [{ ...mesh, baseColorTexture: undefined }] }); b.render(["square"]);
    b.setMaterialOverrides([{ instanceId: "square", baseColorMapAssetId: null, normalMapAssetId: null, roughnessMapAssetId: null, emissiveColor: "#00ff00", emissiveIntensity: 2, opacity: 0.5 }]); b.render(["square"]);
    const material = pixels(), materialDelta = changed(base, material);
    b.setEnvironment({ effects: ["bloom"] }); b.render(["square"]); const bloom = pixels(), bloomDelta = changed(material, bloom);
    b.setEnvironment({ effects: ["vignette"] }); b.render(["square"]); const vignetteDelta = changed(material, pixels());
    b.resize(512,512,1); b.setEnvironment({ effects: [] }); b.render(["square"]); const beforeParticles = pixels();
    const catalog = { schemaVersion: 1, kind: "sceneaxi.scene-effects-catalog", seed: 1, emitters: [{ emitterId: "dust", kind: "box", rate: 200, lifetimeMs: 1000, speed: 1, spread: 2 }] };
    const particleDigest = b.sampleEffects(catalog, 1234).digest; b.render(["square"]);
    const particleDelta = changed(beforeParticles, pixels());

    if (b.sampleEffects(catalog, 1234).digest !== particleDigest) throw Error("Nondeterministic particles");
    b.resize(160,120,1); b.render(["square"]); const resized = [gl.drawingBufferWidth, gl.drawingBufferHeight];
    const event = type => new Promise((resolve, reject) => { const timer = globalThis.setTimeout(() => reject(Error(type + " timeout")), 10000); canvas.addEventListener(type, () => { globalThis.clearTimeout(timer); resolve(); }, { once: true }); });
    const ext = gl.getExtension("WEBGL_lose_context");

 if (!ext) throw Error("Context loss extension unavailable");
    const loss = event("webglcontextlost"); ext.loseContext(); await loss;
    const lostPixels = b.render(["square"]).pixelsDrawn, lostCapture = b.capture(); b.dispose();
    const lostMount = P.createThreePresentationCore({ canvas, viewport: { width: 128, height: 128 } });
    const remountLostPixels = lostMount.draw().pixelsDrawn; lostMount.dispose();
    await new Promise(resolve => globalThis.setTimeout(resolve,1000)); const restore = event("webglcontextrestored"); ext.restoreContext(); await restore;
    const r = P.createThreeSculptPresentationBackend({ canvas, viewport: { width: 128, height: 128 } });
    r.mountTriangleAsset(input); r.frameMountedContent(); const restoredPixels = r.render(["square"]).pixelsDrawn, restoredPNG = r.capture().length;
    r.dispose(); P.releaseThreeCanvas(canvas); await new Promise(resolve => globalThis.setTimeout(resolve,50));

    return { featureProof, renderer, rounds: counts.length, liveTextures: [Math.min(...counts), Math.max(...counts)], pngBytes, checkerDelta, animationDelta, stepEarlyDelta, stepLateDelta, resetDelta, materialDelta, bloomDelta, vignetteDelta, particleDelta, resized, lostPixels, lostCapture, remountLostPixels, restoredPixels, restoredPNG, terminalContextLost: gl.isContextLost(), terminalLiveTextures: textures.filter(texture => gl.isTexture(texture)).length };
  });

  await page.evaluate(() => {
    const frames = 8000, bytes = new Uint8Array(44 + frames * 2), view = new DataView(bytes.buffer);
    const tag = (offset, value) => [...value].forEach((c,i) => bytes[offset+i] = c.charCodeAt(0));
    tag(0,"RIFF"); view.setUint32(4, bytes.length-8,true); tag(8,"WAVE"); tag(12,"fmt "); view.setUint32(16,16,true); view.setUint16(20,1,true); view.setUint16(22,1,true); view.setUint32(24,8000,true); view.setUint32(28,16000,true); view.setUint16(32,2,true); view.setUint16(34,16,true); tag(36,"data"); view.setUint32(40,frames*2,true);

    for (let i = 0; i < frames; i++) view.setInt16(44+i*2,Math.round(Math.sin(i*2*Math.PI*440/8000)*1000),true);
    globalThis.audioResult = null;
    globalThis.document.querySelector("#audio").onclick = async event => {
      let ctx;
      const audio = globalThis.P.createAudioPlaybackRuntime({ profile: "game", createContext: () => (ctx = new globalThis.AudioContext()) });

      try {
        await audio.unlock(event.isTrusted); audio.play({ assetId: "contained-tone", bytes });
        const playing = audio.activeSources(), state = ctx.state;
        audio.stop(); const stopped = audio.activeSources(); await audio.dispose();
        globalThis.audioResult = { trustedGesture: event.isTrusted, state, playing, stopped, disposed: audio.activeSources(), contextState: ctx.state };
      } catch (error) { await audio.dispose(); globalThis.audioResult = { error: error.message }; }
    };
  });
  await page.locator("#audio").click();
  await page.waitForFunction(() => globalThis.audioResult !== null, { timeout: 10000 });
  const audio = await page.evaluate(() => globalThis.audioResult);
  globalThis.console.log(JSON.stringify({ platform: "Linux Chromium ANGLE SwiftShader, not physical GPU/audio", durationMs: Math.round(performance.now()-start), rendering, audio, pageErrors }));
  assert.deepEqual(rendering.liveTextures,[4,4]);

  for (const key of ["pngDelta", "jpegDelta", "webpDelta", "catalogDelta", "normalDelta", "roughnessDelta", "cubicDelta", "rotationDelta", "scaleDelta", "skinDelta"]) assert.ok(rendering.featureProof[key] > 100,key);

  for (const key of ["catalogRefusalDelta", "catalogResetDelta", "dataResetDelta", "skinRestDelta", "skinResetDelta"]) assert.equal(rendering.featureProof[key],0,key);

  for (const key of ["checkerDelta", "animationDelta", "stepLateDelta", "materialDelta", "bloomDelta", "vignetteDelta", "particleDelta"]) assert.ok(rendering[key] > 100,key);
  assert.equal(rendering.stepEarlyDelta,0); assert.equal(rendering.resetDelta,0);
  assert.deepEqual(rendering.resized,[160,120]);
  assert.equal(rendering.lostPixels,false); assert.equal(rendering.lostCapture,null); assert.equal(rendering.remountLostPixels,false);
  assert.equal(rendering.restoredPixels,true); assert.ok(rendering.restoredPNG > 1000);
  assert.equal(rendering.terminalContextLost,true); assert.equal(rendering.terminalLiveTextures,0);
  assert.deepEqual(audio,{ trustedGesture:true, state:"running", playing:1, stopped:0, disposed:0, contextState:"closed" });
  assert.deepEqual(pageErrors,[]);
} finally { await browser.close(); }
