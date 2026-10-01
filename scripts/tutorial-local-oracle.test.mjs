import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const cli='packages/cli/bin/sceneaxi.mjs';

const exec=(args)=>{const p=spawnSync(process.execPath,args,{encoding:'utf8',timeout:30_000});assert.equal(p.status,0,p.stderr);

return p.stdout;};

const until = (child, predicate) => new Promise((resolve,reject)=>{
  let text='';const timer=setTimeout(()=>reject(new Error(`contained process readiness timeout: ${text}`)),30_000);
  child.stdout.on('data',chunk=>{text+=chunk;

if(predicate(text)){clearTimeout(timer);resolve(text);}});
  child.once('exit',code=>{clearTimeout(timer);reject(new Error(`contained process exited ${code}: ${text}`));});
});

const stop=child=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>{child.kill('SIGKILL');reject(new Error('contained process did not stop'));},5000);child.once('exit',code=>{clearTimeout(timer);assert.ok(code===0||code===null);resolve();});child.kill('SIGINT');});

await test('fresh contained documented getting-started project workflow',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'sceneaxi-finish-guide-'));

  try {
    await t.test('real built CLI help lists project/scene/asset/profile/catalog/evidence',()=>{
      const text=exec([cli,'--help']);

for(const name of ['project','scene','asset','profile','catalog','evidence']) assert.match(text,new RegExp(name+':'));
    });
    await t.test('project new then propose leaves canonical source unchanged until apply',async()=>{
      const made=exec([cli,'project','new','--cwd',directory,'--document','scene.json','--data','{"entities":[]}']);assert.match(made,/status: created/);assert.match(made,/sha256:35d7bc5cb1d947ce5b709c2d78e3e982c6395592ddb94f30cf2ed0104be26d83/);
      const before=await readFile(join(directory,'scene.json'),'utf8');
      const proposed=exec([cli,'project','propose','--cwd',directory,'--document','scene.json','--pointer','/data/entities','--value','[{"id":"lamp"}]','--out','edit.json']);assert.match(proposed,/status: proposed/);assert.equal(await readFile(join(directory,'scene.json'),'utf8'),before);
      console.log(made.trim());console.log(proposed.trim());
    });
    await t.test('project apply then one-shot dev yields exact documented canonical digest',()=>{
      const applied=exec([cli,'project','apply','--cwd',directory,'--proposal','edit.json']);assert.match(applied,/status: applied/);
      const dev=exec([cli,'project','dev','--cwd',directory,'--document','scene.json']);assert.match(dev,/mode: one-shot/);assert.match(dev,/sha256:982db1b6ae71340f57385d067a15b56e15094c6c597c299bbfd3963faae1af12/);console.log(applied.trim());console.log(dev.trim());
    });
    await t.test('actual watch emits first cycle and SIGINT completes teardown',async()=>{
      const child=spawn(process.execPath,[cli,'project','dev','--cwd',directory,'--watch','--document','scene.json'],{stdio:['ignore','pipe','pipe']});

      try { const text=await until(child,text=>/mode: watch/.test(text)&&/cycle: 1/.test(text));assert.match(text,/status: ready/);console.log(text.trim()); } finally {await stop(child);}
    });
    await t.test('actual loopback inspector serves HTML and idle state without writing project',async()=>{
      const before=await readFile(join(directory,'scene.json'),'utf8');
      const child=spawn(process.execPath,['apps/web-shell/bin/sceneaxi-web-shell.mjs','--cwd',directory,'--port','0'],{stdio:['ignore','pipe','pipe']});

      try {const text=await until(child,text=>/http:\/\/127\.0\.0\.1:\d+\//.test(text));const url=/http:\/\/127\.0\.0\.1:\d+\//.exec(text)[0];
        const html=await fetch(url);assert.equal(html.status,200);assert.match(await html.text(),/SceneAxi inspector/);
        const state=await fetch(new URL('api/state',url));assert.equal(state.status,200);const body=await state.json();assert.equal(body.ok,true);assert.equal(body.snapshot.phase,'idle');
        assert.equal(await readFile(join(directory,'scene.json'),'utf8'),before);console.log('loopback HTML200/state200/idle/project-bytes-unchanged');
      } finally {await stop(child);}
    });
    await t.test('both executable composition/open examples match documented digests',()=>{
      const scene=exec(['examples/compose-scene/run.mjs']);assert.equal(scene.trim(),'sha256:db836fe798fafca4983c40d320afaaadfcbc003d6bd941a6a4a12ab20578a2c9');
      const opened=exec(['examples/open-scene/run.mjs']);assert.equal(opened.trim(),'sha256:28d27adebd371f7ce330fc1442fb3b2cc42b59aafe644d01723759f9b02ae129');console.log(scene.trim());console.log(opened.trim());
    });
  }finally{await rm(directory,{recursive:true,force:true});}
});
