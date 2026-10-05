#!/usr/bin/env python3
"""Bounded source-backed public consumer proof; never builds or writes product files."""
import argparse
import json
import pathlib
import subprocess
import sys

HERE = pathlib.Path(__file__).resolve().parent
ROOT = next(p for p in HERE.parents if (p / 'packages/schemas/src/desktop-scene-physics.ts').is_file())
NODE = r'''
const fs = require('fs'), path = require('path'), crypto = require('crypto'), ts = require('typescript'), Module = require('module');
const root = process.cwd(), own = process.argv[1];
const evidence = {taskId:'capacity-work-2026-10-02/physics-v1',subject:'TypeScript product source transpiled in memory; no dist, no WASM initialization', fingerprints:{}, checks:[], deferred:['Real Rapier WASM/native/GUI integration NOT RUN'], resourcesCleaned:'No fixtures, services, ports, or product outputs created'};
function hash(p) { return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'); }
const files = ['packages/schemas/src/desktop-scene-physics.ts','packages/schemas/src/physics-world-host.ts','packages/schemas/src/index.ts','packages/engine-kernel/src/scene-session.ts','packages/physics-rapier/src/index.ts','packages/physics-rapier/src/world.ts'];
for(const f of files) evidence.fingerprints[f]=hash(f);
function check(name, fn) { try { const detail=fn(); evidence.checks.push({name,status:'PASS',detail}); } catch(e) { evidence.checks.push({name,status:'FAIL',error:String(e.stack || e)}); } }
function assert(v,m) { if(!v) throw Error(m); }
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function(id,parent,...rest) {
  if(id==='@sceneaxi/schemas') return path.join(root,'packages/schemas/src/index.ts');
  try { return originalResolve.call(this,id,parent,...rest); } catch(e) {
    if(id.endsWith('.js') && parent) { const candidate=path.resolve(path.dirname(parent.filename),id.slice(0,-3)+'.ts'); if(fs.existsSync(candidate)) return candidate; }
    throw e;
  }
};
require.extensions['.ts'] = function(module,filename) {
  const source=fs.readFileSync(filename,'utf8');
  module._compile(ts.transpileModule(source,{fileName:filename,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText,filename);
};
function load(f) {return require(path.join(root,f));}
const fixture = path.join(own,'legacy-consumer.virtual.ts');
const schemaPath=path.join(root,'packages/schemas/src/index.ts').replaceAll('\\','/');
const hostPath=path.join(root,'packages/schemas/src/physics-world-host.ts').replaceAll('\\','/');
const enginePath=path.join(root,'packages/engine-kernel/src/scene-session.ts').replaceAll('\\','/');
const rapierPath=path.join(root,'packages/physics-rapier/src/index.ts').replaceAll('\\','/');
const consumer = `import { ScenePhysicsCatalog, ScenePhysicsShape, SCENE_PHYSICS_SHAPE_KINDS, emptyScenePhysicsCatalog, requireScenePhysicsCatalog, applyScenePhysicsMutation, inspectScenePhysics } from '${schemaPath}';
import {createToyPhysicsWorldHost, PhysicsWorldHost} from '${hostPath}';
import {openSceneKernelSession} from '${enginePath}';
import {createRapierPhysicsWorldHost, RapierPhysicsWorldHost} from '${rapierPath}';
const shape: ScenePhysicsShape = {shapeId:'shape-1',bodyId:'body-1',kind:SCENE_PHYSICS_SHAPE_KINDS[0],size:1};
const legacy: ScenePhysicsCatalog = {schemaVersion:1,kind:'sceneaxi.scene-physics-catalog',world:{gravityY:-9.81,stepMs:16,seed:1},bodies:[{bodyId:'body-1',instanceId:'instance-1',kind:'dynamic',mass:1}],shapes:[shape],materials:[],constraints:[]};
const legacyShapeIds = legacy.shapes.map(shape => shape.shapeId);
const mutation = applyScenePhysicsMutation({catalog:legacy,mutation:{kind:'shape-upsert',shapeId:'shape-2',bodyId:'body-1',shapeKind:shape.kind,size:2},instanceIds:['instance-1']});
const host:PhysicsWorldHost=createToyPhysicsWorldHost();
const inspected=inspectScenePhysics(legacy);
const parsed=requireScenePhysicsCatalog(legacy);
const factory: typeof createRapierPhysicsWorldHost=createRapierPhysicsWorldHost;
const opener: typeof openSceneKernelSession=openSceneKernelSession;
`;
evidence.consumerInput=consumer;
function compile(text) {
  const options={noEmit:true,strict:true,skipLibCheck:true,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.NodeNext,moduleResolution:ts.ModuleResolutionKind.NodeNext,allowImportingTsExtensions:true,esModuleInterop:true};
  const host=ts.createCompilerHost(options), read=host.readFile.bind(host), exists=host.fileExists.bind(host);
  host.readFile=p=>path.resolve(p)===fixture?text:read(p);
  host.fileExists=p=>path.resolve(p)===fixture||exists(p);
  host.getSourceFile=(p,l)=>{const s=host.readFile(p);return s===undefined?undefined:ts.createSourceFile(p,s,l,true);};
  const program=ts.createProgram([fixture],options,host);
  return ts.getPreEmitDiagnostics(program).map(d=>({file:d.file?.fileName,line:d.file&&d.start!==undefined?d.file.getLineAndCharacterOfPosition(d.start).line+1:undefined,code:d.code,message:ts.flattenDiagnosticMessageText(d.messageText,'\n')}));
}
check('legacy public consumer compiles',()=>{const diagnostics=compile(consumer);evidence.compileDiagnostics=diagnostics;const ownErrors=diagnostics.filter(d=>d.file===fixture);assert(diagnostics.length===0,JSON.stringify(diagnostics));return {consumerErrors:0,dependencyDiagnostics:diagnostics.length};});
check('compile negative control rejects incompatible legacy size',()=>{const diagnostics=compile(consumer.replace('size:1','size:"invalid"'));const found=diagnostics.filter(d=>d.file===fixture && d.line===5 && d.code===2322);assert(found.length>0,'compiler failed to detect incompatible size');return found;});
let schemas, hosts, session, rapier;
check('public modules load from source',()=>{schemas=load('packages/schemas/src/index.ts');hosts=load('packages/schemas/src/physics-world-host.ts');session=load('packages/engine-kernel/src/scene-session.ts');rapier=load('packages/physics-rapier/src/index.ts');return {schemaExports:Object.keys(schemas).filter(k=>/Physics|PHYSICS/.test(k)),sessionExports:Object.keys(session),rapierExports:Object.keys(rapier)};});
const bodies=[{bodyId:'body-1',instanceId:'instance-1',kind:'dynamic',mass:1}];
let legacy, normalized;
check('legacy shapes normalize to colliders',()=>{
  legacy={...schemas.emptyScenePhysicsCatalog(),bodies,shapes:[{shapeId:'shape-1',bodyId:'body-1',kind:schemas.SCENE_PHYSICS_SHAPE_KINDS[0],size:1}]};
  delete legacy.colliders; delete legacy.world.engine;
  const before=JSON.stringify(legacy), result=schemas.requireScenePhysicsCatalog(legacy); evidence.legacyInput=JSON.parse(before); evidence.normalizationResult=result;
  assert(result.kind==='sceneaxi.scene-physics-catalog','legacy normalization returned wrong kind');
  normalized=result;
  assert(normalized?.colliders?.[0]?.colliderId==='shape-1','legacy shapeId not normalized to colliderId');
  assert(JSON.stringify(legacy)===before,'normalization mutated input');return result;
});
check('modern colliders accepted without mutating input',()=>{const value={...schemas.emptyScenePhysicsCatalog(),bodies,colliders:[{colliderId:'collider-1',bodyId:'body-1',kind:schemas.SCENE_PHYSICS_COLLIDER_KINDS[0],size:1}]};const before=JSON.stringify(value),result=schemas.requireScenePhysicsCatalog(value);assert(result.colliders[0].colliderId==='collider-1',JSON.stringify(result));assert(JSON.stringify(value)===before,'mutated collider input');return result;});
check('legacy shape-upsert public mutation',()=>{const result=schemas.applyScenePhysicsMutation({catalog:legacy,mutation:{kind:'shape-upsert',shapeId:'shape-2',bodyId:'body-1',shapeKind:schemas.SCENE_PHYSICS_SHAPE_KINDS[0],size:2},instanceIds:['instance-1']});assert(result.ok===true,JSON.stringify(result));return result;});
function refusal(call, input) {
  let result, error;
  try { result=call(input); } catch(e) { error=String(e); }
  assert(error==='Error: PHYSICS_CATALOG_INVALID' || result?.ok===false,'invalid world accepted or leaked unexpected exception: '+JSON.stringify({result,error}));
  return {result,error};
}
for(const kind of ['null','proxy','accessor']) check(kind+' world refusal without caller mutation',()=>{
  let reads=0,writes=0;let world;
  if(kind==='null')world=null;
  if(kind==='proxy')world=new Proxy({}, {get(){reads++;throw Error('POISON_WORLD_GET');},set(){writes++;throw Error('POISON_WORLD_SET');},getOwnPropertyDescriptor(){reads++;throw Error('POISON_WORLD_DESCRIPTOR');}});
  if(kind==='accessor')world=Object.defineProperty({},'gravityY',{enumerable:true,get(){reads++;throw Error('POISON_WORLD_ACCESSOR');}});
  const catalog={...schemas.emptyScenePhysicsCatalog(),world}; const before=Object.getOwnPropertyDescriptors(catalog);
  const outcomes={
      require:refusal(x=>schemas.requireScenePhysicsCatalog(x),catalog),
      parse:(()=>{const result=schemas.parseScenePhysicsCatalog(catalog);assert(result===null,'invalid world parse must return null');return {result};})(),
    toy:refusal(x=>hosts.createToyPhysicsWorldHost().create(x),catalog),
    evaluate:refusal(x=>schemas.evaluateScenePhysics({catalog:x,sourceContentHash:'source-proof',steps:1}),catalog),
    mutation:refusal(x=>schemas.applyScenePhysicsMutation({catalog:x,mutation:{kind:'body-remove',bodyId:'absent'},instanceIds:[]}),catalog)
  };
  assert(writes===0,'world mutated');assert(catalog.world===before.world.value,'world replaced');assert(reads===0,'unsafe world read executed');
  return {input:{...schemas.emptyScenePhysicsCatalog(),world:kind==='null'?null:{poisonKind:kind}},outcomes,reads,writes};
});
check('runtime negative control trips same public refusal checker',()=>{let detected=false;try{refusal(()=>({ok:true}),{...schemas.emptyScenePhysicsCatalog(),world:null});}catch(e){detected=/invalid world accepted/.test(e.message);}assert(detected,'refusal assertion was not live');return {injectedResult:{ok:true},detected};});
check('toy public host rejects null world before stepping',()=>{const host=hosts.createToyPhysicsWorldHost();let error;try{host.create({...schemas.emptyScenePhysicsCatalog(),world:null});}catch(e){error=String(e);}assert(error,'toy host accepted invalid world');return {error};});
check('scene-session public entry refuses null scene',()=>{let error;try{session.openSceneKernelSession(null,{seed:1});}catch(e){error=String(e);}assert(error,'session accepted null scene');return {error};});
check('legacy toy host produces runtime snapshot without caller mutation',()=>{const before=JSON.stringify(legacy),world=hosts.createToyPhysicsWorldHost().create(legacy);try{world.step(0.016);const snapshot=world.snapshot();assert(snapshot.length===1 && snapshot[0].bodyId==='body-1','toy body missing');assert(JSON.stringify(legacy)===before,'toy host mutated legacy input');return {snapshot,serialized:world.serialize()};}finally{world.dispose();}});
evidence.sourceLocations=[];
for(const f of files){const s=ts.createSourceFile(f,fs.readFileSync(f,'utf8'),ts.ScriptTarget.Latest,true);for(const n of s.statements){if(n.name && /ScenePhysics|PhysicsWorld|SceneKernel|Rapier/.test(n.name.text))evidence.sourceLocations.push({path:f,symbol:n.name.text,line:s.getLineAndCharacterOfPosition(n.getStart(s)).line+1});}}
check('subject fingerprints stable throughout probe',()=>{evidence.finalFingerprints={};for(const f of files){evidence.finalFingerprints[f]=hash(f);assert(evidence.finalFingerprints[f]===evidence.fingerprints[f],'subject changed during probe: '+f);}return evidence.finalFingerprints;});
evidence.status=evidence.checks.some(c=>c.status==='FAIL')?'GAPS_REPRODUCED':'PASS_BOUNDED_SOURCE_PROBE';
console.log(JSON.stringify(evidence,null,2));
'''

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--record', action='store_true', help='write evidence.json in owned directory')
    args = parser.parse_args()
    try:
        result = subprocess.run(['node', '-e', NODE, str(HERE)], cwd=ROOT, text=True, capture_output=True, timeout=85)
    except subprocess.TimeoutExpired:
        print('Probe exceeded 85 seconds; NOT PASS', file=sys.stderr)
        return 2
    if result.returncode:
        print(result.stderr, file=sys.stderr)
        print(result.stdout)
        return result.returncode
    evidence = json.loads(result.stdout)
    evidence['harnessSha256'] = __import__('hashlib').sha256(pathlib.Path(__file__).read_bytes()).hexdigest()
    if args.record:
        (HERE / 'evidence.json').write_text(json.dumps(evidence, indent=2) + '\n')
    print(json.dumps(evidence, indent=2))
    return 1 if evidence['status'] == 'GAPS_REPRODUCED' else 0

if __name__ == '__main__':
    sys.exit(main())
