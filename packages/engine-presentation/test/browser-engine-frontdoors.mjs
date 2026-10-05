/** Public source browser front doors; controller samples are injected, never physical-device proof. */
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const desktop = createRequire(new globalThis.URL("../../../desktop/linux/package.json", import.meta.url));

const site = createRequire(new globalThis.URL("../../../sites/umbrella/package.json", import.meta.url));

const { build } = desktop("esbuild"), { chromium } = site("@playwright/test");

const bundle = await build({ stdin: { contents: 'import * as P from "@sceneaxi/engine-presentation"; import * as K from "@sceneaxi/engine-kernel"; import * as R from "@sceneaxi/physics-rapier"; globalThis.P=P; globalThis.K=K; globalThis.R=R;', resolveDir: new globalThis.URL("../../../desktop/linux", import.meta.url).pathname }, bundle: true, platform: "browser", format: "iife", write: false });

const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", headless: true, args: ["--no-sandbox","--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"] });

try {
  const page = await browser.newPage(), errors = []; page.on("pageerror",error=>errors.push(error.message));
  await page.setContent('<canvas width="256" height="256"></canvas>'); await page.addScriptTag({ content: bundle.outputFiles[0].text });

  const proof = await page.evaluate(async () => {
    const { P,K,R } = globalThis;
    const sampler = K.createGamepadActionSampler();
    const session = K.open({ productId: "gamepad", seed: 1, gameplay: { profile: "game", initialState: { score: 0 }, actions: [{ id: "play.primary", effects: [{ kind: "add-state", key: "score", value: 1 }] }], timers: [] } }, { nowMs: () => 1 });
    let value = 0.2;
    const descriptor = Object.getOwnPropertyDescriptor(globalThis.navigator,"getGamepads");
    Object.defineProperty(globalThis.navigator,"getGamepads",{ configurable:true, value: () => [{ index:0,connected:true,mapping:"standard",axes:[],buttons:[{value,pressed:value>0.5}] }] });
    let deadzone, repeat, scoreBefore, scoreAfter, inputReplay;

    try {
      const sample = () => sampler.sample(globalThis.navigator.getGamepads(),{profile:"game",active:true});
      deadzone = sample().length; value=1;

      for (const command of sample()) session.dispatch(command);
      repeat=sample().length; scoreBefore=session.observe().gameplay.state.score;
      session.advance({tick:1,deltaMs:16}); scoreAfter=session.observe().gameplay.state.score;
      inputReplay=K.replay(JSON.parse(JSON.stringify(session.save())),{nowMs:()=>1}).observe().digest===session.observe().digest;
    } finally { if (descriptor) Object.defineProperty(globalThis.navigator,"getGamepads",descriptor); else delete globalThis.navigator.getGamepads; }

    const canvas = globalThis.document.querySelector("canvas"), gl=canvas.getContext("webgl2");

 if (!gl) throw Error("WebGL2 unavailable");
    const b=P.createThreeSculptPresentationBackend({canvas,viewport:{width:256,height:256}});
    const matrix=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
    const positions=[-.5,-.5,-.5,.5,-.5,-.5,.5,.5,-.5,-.5,.5,-.5,-.5,-.5,.5,.5,-.5,.5,.5,.5,.5,-.5,.5,.5];
    const indices=[0,2,1,0,3,2,4,5,6,4,6,7,0,1,5,0,5,4,3,7,6,3,6,2,0,4,7,0,7,3,1,2,6,1,6,5];
    const mount=(id,y,scale,color)=>b.mountTriangleAsset({instanceId:id,transform:{translation:[0,y,0],rotationEulerDegrees:[0,0,0],scale:[scale,scale,scale]},meshes:[{meshId:id,positions,indices,matrix,baseColor:color,metallic:0,roughness:1}]});
    mount("floor",0,2,"#707070");mount("ball",3,.5,"#ffcc00");b.frameMountedContent();
    const host=await R.createRapierPhysicsWorldHost();
    const catalog={schemaVersion:1,kind:"sceneaxi.scene-physics-catalog",world:{gravityY:-9.81,stepMs:16,seed:1,engine:"rapier"},bodies:[{bodyId:"floor",instanceId:"floor",kind:"static",mass:1},{bodyId:"ball",instanceId:"ball",kind:"dynamic",mass:1}],shapes:[{shapeId:"floor",bodyId:"floor",kind:"box",size:2},{shapeId:"ball",bodyId:"ball",kind:"box",size:.5}],materials:[],constraints:[]};
    const a=host.create(catalog,{poses:[{bodyId:"floor",translation:[0,0,0],rotation:[0,0,0,1]},{bodyId:"ball",translation:[0,3,0],rotation:[0,0,0,1]}]});
    const pixels=()=>{const data=new Uint8Array(256*256*4);gl.readPixels(0,0,256,256,gl.RGBA,gl.UNSIGNED_BYTE,data);

return data;};

    const changed=(left,right)=>{let count=0;

for(let i=0;i<left.length;i+=4)if(left[i]!==right[i]||left[i+1]!==right[i+1]||left[i+2]!==right[i+2])count++;

return count;};

    const present=world=>{b.setInstancePoses(world.poses().map(p=>({instanceId:p.bodyId,translation:p.translation,rotation:p.rotation})));b.render(["floor","ball"]);};

    try {
      present(a);const before=pixels();

for(let i=0;i<40;i++)a.step(.016);present(a);const moved=pixels(),poseDelta=changed(before,moved);
      const resumed=host.replay(JSON.parse(JSON.stringify(a.save())));

      try {
        present(resumed);const resumeDelta=changed(moved,pixels());

for(let i=0;i<20;i++){a.step(.016);resumed.step(.016);}

present(a);const future=pixels();present(resumed);const futureDelta=changed(future,pixels());
        const replayState=a.serialize()===resumed.serialize(),pngBytes=b.capture().length;

        return {input:{source:"injected navigator samples, not physical hardware",deadzone,repeat,scoreBefore,scoreAfter,inputReplay},physics:{poseDelta,resumeDelta,futureDelta,replayState,pngBytes}};
      } finally {resumed.dispose();}
    } finally {a.dispose();b.dispose();P.releaseThreeCanvas(canvas);}
  });

  assert.deepEqual(proof.input,{source:"injected navigator samples, not physical hardware",deadzone:0,repeat:0,scoreBefore:0,scoreAfter:1,inputReplay:true});
  assert.ok(proof.physics.poseDelta>100,"actual solver pose pixel motion");assert.equal(proof.physics.resumeDelta,0);assert.equal(proof.physics.futureDelta,0);assert.equal(proof.physics.replayState,true);assert.ok(proof.physics.pngBytes>1000);assert.deepEqual(errors,[]);
  globalThis.console.log(JSON.stringify({platform:"Chromium/SwiftShader; real Rapier WASM; no physical controller/GPU claim",proof,pageErrors:errors}));
} finally {await browser.close();}
