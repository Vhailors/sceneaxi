#!/usr/bin/env python3
"""Source-only admission probe; --native is explicit deferred heavy automation."""
import argparse, base64, hashlib, json, os, pathlib, struct, subprocess, tempfile
ROOT=pathlib.Path('/home/devuser/Documents/Projects/sceneaxi')
OWN=pathlib.Path(__file__).resolve().parent
LIMIT=8*1024*1024
BUDGETS={'importReviewMs':4000,'acceptMaterializeMs':4000,'reloadMs':4000,'mainLoopGapMs':100,'rendererLoopGapMs':100,'rssGrowthBytes':256*1024*1024,'rssPlateauGrowthBytes':32*1024*1024,'pickerCancelMs':500,'reviewRejectMs':500,'cycles':3}
def digest(b): return hashlib.sha256(b).hexdigest()
def fixture(offset=0):
 raw=struct.pack('<9f',offset,0,0,1+offset,0,0,offset,1,0)
 doc={'asset':{'version':'2.0'},'buffers':[{'byteLength':36,'uri':'data:application/octet-stream;base64,'+base64.b64encode(raw).decode()}],'bufferViews':[{'buffer':0,'byteOffset':0,'byteLength':36}],'accessors':[{'bufferView':0,'componentType':5126,'count':3,'type':'VEC3','min':[offset,0,0],'max':[1+offset,1,0]}],'meshes':[{'primitives':[{'attributes':{'POSITION':0},'mode':4}]}],'nodes':[{'mesh':0}],'scenes':[{'nodes':[0]}],'scene':0}
 b=json.dumps(doc,separators=(',',':')).encode();return b+b' '*(LIMIT-len(b))
LOADER=r'''
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),Module=require('node:module'),assert=require('node:assert/strict');
const root=process.argv[1], fixtureRoot=process.argv[2];
const original=Module._resolveFilename, ts=require(path.join(root,'node_modules/typescript')), hashes={};
Module._resolveFilename=function(id,parent,...rest){
 if(id.startsWith('@sceneaxi/')){let parts=id.slice(10).split('/');id=path.join(root,'packages',parts.shift(),'src',parts.length?parts.join('/'):'index.ts');}
 if(id.endsWith('.js')&&parent){const p=path.resolve(path.dirname(parent.filename),id.slice(0,-3)+'.ts');if(fs.existsSync(p))id=p;}
 return original.call(this,id,parent,...rest);
};
require.extensions['.ts']=(m,file)=>{const text=fs.readFileSync(file,'utf8');hashes[path.relative(root,file)]=crypto.createHash('sha256').update(text).digest('hex');m._compile(ts.transpileModule(text,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,file);};
const seed=require(path.join(root,'desktop/linux/src/lib/project-seed.ts')).seedDesktopProject(fixtureRoot);assert.equal(seed.ok,true,JSON.stringify(seed));
'''
PROBE=LOADER+r'''
const api=require(path.join(root,'packages/importers/src/index.ts')); const doc=path.join(fixtureRoot,'scene.json');
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');const before=hash(doc), cases=[];
const selected=process.env.EIGHT_MIB_ADMISSION_ONLY==='1'?['next-byte.gltf','alias.gltf']:['eight-mib.gltf','next-byte.gltf','alias.gltf'];
for(const file of selected){
 const started=performance.now();const result=api.proposeProjectAssetImport({projectRoot:fixtureRoot,documentPath:'scene.json',sourcePath:path.join(fixtureRoot,file)});
 const record={input:file,byteLength:fs.statSync(path.join(fixtureRoot,file)).size,sha256:hash(path.join(fixtureRoot,file)),elapsedMs:performance.now()-started,ok:result.ok,reason:result.reason||null,documentUnchanged:hash(doc)===before};cases.push(record);
 assert(record.documentUnchanged);if(file==='eight-mib.gltf')assert.equal(result.ok,true,JSON.stringify(result));else {assert.equal(result.ok,false);if(file==='next-byte.gltf')assert.equal(result.reason,api.CONTAINED_GLTF_REFUSALS.oversize);else assert.equal(result.reason,'ASSET_IMPORT_SOURCE_SYMLINK');}
}
console.log(JSON.stringify({subject:'actual current TS source transpiled in memory; no dist or native GUI',cases,sourceHashes:hashes,seedSubject:'seedDesktopProject -> writeNativeProjectSeed',canonicalDocumentSha256:before}));
'''
NATIVE=r'''
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const [root,fixtureRoot,exe,expected,receipt]=process.argv.slice(1);const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');assert.equal(sha(exe),expected,'native executable SHA mismatch');
const {_electron}=require(path.join(root,'node_modules/playwright')); const budgets=JSON.parse(process.env.EIGHT_MIB_BUDGETS);let app;
const watchdog=setTimeout(()=>{process.exitCode=1;if(app)app.close();},80000);
const output={subject:'real packaged native UI, not bridge.handle',executable:{path:exe,sha256:expected},budgets,phases:[],pickerCancellation:'UNVERIFIED: click plus fixed delay is not terminal acknowledgement',hotReload:'NOTRUN: document reload is not changed-source hotReload:true',inFlightCancellation:'NOTRUN: no asset planning AbortSignal/control seam established'};
(async()=>{try{
 app=await _electron.launch({executablePath:exe,args:['--user-data-dir='+path.join(fixtureRoot,'user-data')],env:{PATH:process.env.PATH,HOME:fixtureRoot,DISPLAY:process.env.DISPLAY||'',XDG_RUNTIME_DIR:process.env.XDG_RUNTIME_DIR||''},timeout:30000});
 await app.evaluate(({dialog,app},root)=>{globalThis.__capacityChoice=root;dialog.showOpenDialog=async(_w,options)=>({canceled:globalThis.__capacityChoice===null,filePaths:globalThis.__capacityChoice===null?[]:[globalThis.__capacityChoice]});globalThis.__capacity={gaps:[],rss:[],last:performance.now()};globalThis.__capacityTimer=setInterval(()=>{const p=globalThis.__capacity;const now=performance.now();p.gaps.push(now-p.last);p.last=now;p.rss.push(app.getAppMetrics().reduce((s,m)=>s+m.memory.workingSetSize*1024,0));},10);},fixtureRoot);
 let page=await app.firstWindow();page.setDefaultTimeout(4000);
 await page.locator('[data-command="project-open"]').first().click();
 await page.waitForFunction(root=>document.querySelector('.shell')?.dataset.projectRoot===root,fixtureRoot);
 const document=path.join(fixtureRoot,'scene.json');const original=sha(document);
 const monitor=async()=>page.evaluate(()=>{globalThis.__capacity={gaps:[],last:performance.now()};globalThis.__capacityTimer=setInterval(()=>{const x=globalThis.__capacity,n=performance.now();x.gaps.push(n-x.last);x.last=n;},10);});await monitor();
 const phase=async(name,budget,action)=>{const start=performance.now();await action();const ms=performance.now()-start;output.phases.push({name,ms,budget});assert(ms<=budget,name+' latency budget');};
 await page.locator('[data-action="profile"][data-value="web"]').click();
 // Dialog cancellation is a real UI front door, distinct from in-flight planning cancellation.
 await app.evaluate(()=>{globalThis.__capacityChoice=null;});
 await phase('picker-cancel',budgets.pickerCancelMs,async()=>{await page.locator('[data-action="web-inject-asset"]').click();await page.waitForTimeout(50);});assert.equal(sha(document),original);
 await app.evaluate((_e,p)=>{globalThis.__capacityChoice=p;},path.join(fixtureRoot,'eight-mib.gltf'));
 await phase('import-review',budgets.importReviewMs,async()=>{await page.locator('[data-action="web-inject-asset"]').click();await page.locator('[data-change-proposal]').waitFor({state:'visible'});});assert.equal(sha(document),original);
 await phase('review-reject',budgets.reviewRejectMs,async()=>{await page.locator('[data-action="change-reject"]').click();await page.locator('[data-change-proposal]').waitFor({state:'hidden'});});assert.equal(sha(document),original);
 await phase('import-review-accepted',budgets.importReviewMs,async()=>{await page.locator('[data-action="web-inject-asset"]').click();await page.locator('[data-change-proposal]').waitFor({state:'visible'});});
 await phase('accept-materialize',budgets.acceptMaterializeMs,async()=>{await page.locator('[data-action="change-accept"]').click();await page.locator('[data-change-proposal]').waitFor({state:'hidden'});});assert.notEqual(sha(document),original);const accepted=sha(document);const postAcceptRss=await app.evaluate(({app})=>app.getAppMetrics().reduce((s,m)=>s+m.memory.workingSetSize*1024,0));
 const copies=fs.readdirSync(path.join(fixtureRoot,'assets')).filter(p=>p.endsWith('.gltf'));assert.equal(copies.length,1);const copy=path.join(fixtureRoot,'assets',copies[0]);assert(!fs.lstatSync(copy).isSymbolicLink());assert.equal(sha(copy),sha(path.join(fixtureRoot,'eight-mib.gltf')));
 for(let i=0;i<budgets.cycles;i++)await phase('reload-'+i,budgets.reloadMs,async()=>{const revision=await page.locator('.shell').getAttribute('data-project-browser-revision');await page.locator('[data-action="document-reload"]').click();await page.waitForFunction(r=>document.querySelector('.shell')?.dataset.projectBrowserRevision!==r,revision);assert.equal(sha(document),accepted);assert.equal(sha(copy),sha(path.join(fixtureRoot,'eight-mib.gltf')));});
 const main=await app.evaluate(()=>{clearInterval(globalThis.__capacityTimer);return globalThis.__capacity;});const renderer=await page.evaluate(()=>{clearInterval(globalThis.__capacityTimer);return globalThis.__capacity;});output.main=main;output.renderer=renderer;
 assert(main.gaps.length&&renderer.gaps.length);assert(Math.max(...main.gaps)<=budgets.mainLoopGapMs);assert(Math.max(...renderer.gaps)<=budgets.rendererLoopGapMs);assert(Math.max(...main.rss)-main.rss[0]<=budgets.rssGrowthBytes);assert(main.rss.at(-1)-postAcceptRss<=budgets.rssPlateauGrowthBytes);
 output.documentSha256=accepted;output.copySha256=sha(copy);output.status='PARTIAL: import/materialization/document-reload only; picker terminal ack, changed-source hot reload and in-flight cancellation unproved';process.exitCode=2;
 }catch(e){output.status='FAIL';output.error=String(e);process.exitCode=1;}finally{clearTimeout(watchdog);if(app)await app.close();fs.writeFileSync(receipt,JSON.stringify(output,null,2));}})();
'''
def main():
 p=argparse.ArgumentParser();p.add_argument('--admission-only',action='store_true',help='run only source next-byte and symlink refusals; do not parse accepted maximum fixture');p.add_argument('--native',action='store_true');p.add_argument('--authorized-heavy',action='store_true');p.add_argument('--executable');p.add_argument('--sha256');a=p.parse_args()
 if a.native and not(a.authorized_heavy and a.executable and a.sha256): p.error('native NOTRUN without explicit heavy authorization, existing executable and independently recorded SHA256')
 with tempfile.TemporaryDirectory(prefix='fixture-',dir=OWN) as directory:
  d=pathlib.Path(directory);b=fixture();assert len(b)==LIMIT;json.loads(b);assert len(json.loads(b)['nodes'])==1
  for name,data in [('eight-mib.gltf',b),('next-byte.gltf',b+b' ')]:
   with (d/name).open('xb') as f:f.write(data)
   assert not (d/name).is_symlink();assert (d/name).resolve().is_relative_to(d.resolve())
  (d/'alias.gltf').symlink_to(d/'eight-mib.gltf')
  env={**os.environ,'EIGHT_MIB_BUDGETS':json.dumps(BUDGETS),'EIGHT_MIB_ADMISSION_ONLY':'1' if a.admission_only else '0'}
  result=subprocess.run(['node','-e',PROBE,str(ROOT),str(d)],capture_output=True,text=True,timeout=90,env=env)
  receipt={'taskId':'eight-mib','fixture':{'bytes':len(b),'sha256':digest(b),'padding':'ASCII space outside valid JSON','mesh':'single 3-vertex POSITION triangle; embedded buffer, no external URI'},'command':'./check.py','exit':result.returncode,'stdout':result.stdout,'stderr':result.stderr,'native':'NOTRUN','budgets':BUDGETS,'resourcesCleaned':True}
  receipt['mode']='admission-only' if a.admission_only else 'full-source-proposal'
  receipt['resourcesCleaned']='PENDING_TEMPORARY_DIRECTORY_EXIT'
  receipt_path=OWN/('admission-only-receipt.json' if a.admission_only else 'admission-receipt.json')
  receipt_path.write_text(json.dumps(receipt,indent=2)+'\n');print(result.stdout or result.stderr)
  if result.returncode:raise SystemExit(result.returncode)
  if a.native:
   receipt=OWN/'native-receipt.json';r=subprocess.run(['node','-e',NATIVE,str(ROOT),str(d),str(pathlib.Path(a.executable).resolve()),a.sha256,str(receipt)],env=env,timeout=90);raise SystemExit(r.returncode)
 receipt['resourcesCleaned']=not d.exists()
 receipt_path.write_text(json.dumps(receipt,indent=2)+'\n')
if __name__=='__main__':main()
