#!/usr/bin/env python3
"""NOT RUN acceptance. Requires explicit serial-integration WASM approval and installed deps."""
import os
import pathlib
import runpy
import subprocess
import sys

HERE = pathlib.Path(__file__).resolve().parent
if os.environ.get('SCENEAXI_PHYSICS_WASM_HANDOFF') != 'approved':
    print('NOT RUN: requires completed source-review handoff, existing Rapier/TypeScript dependencies, and explicit WASM resource approval.', file=sys.stderr)
    sys.exit(2)
base = runpy.run_path(str(HERE / 'acceptance.py'))
script = base['NODE'].split('const fixture =')[0] + r'''
(async()=>{
 const schemas=load('packages/schemas/src/index.ts');
 const host=await load('packages/physics-rapier/src/index.ts').createRapierPhysicsWorldHost();
 const bodies=[{bodyId:'body-1',instanceId:'instance-1',kind:'dynamic',mass:1}];
 const legacy={...schemas.emptyScenePhysicsCatalog(),bodies,shapes:[{shapeId:'shape-1',bodyId:'body-1',kind:schemas.SCENE_PHYSICS_SHAPE_KINDS[0],size:1}]};
 delete legacy.colliders;delete legacy.world.engine;
 const modern=schemas.requireScenePhysicsCatalog(legacy);
 for(const [name,catalog] of [['legacy',legacy],['colliders',modern]]){
  const before=JSON.stringify(catalog),world=host.create(catalog);
  try{world.step(0.016);const snapshot=world.snapshot();assert(snapshot.length===1,'missing body');assert(JSON.stringify(catalog)===before,'host mutated input');console.log(JSON.stringify({name,status:'PASS',snapshot,serialized:world.serialize()}));}finally{world.dispose();}
 }
 for(const name of ['null','proxy','accessor']){
  let reads=0,writes=0;
  const world=name==='null'?null:name==='proxy'?new Proxy({},{get(){reads++;throw Error('POISON');},set(){writes++;throw Error('WRITE');},getOwnPropertyDescriptor(){reads++;throw Error('DESCRIPTOR');}}):Object.defineProperty({},'gravityY',{get(){reads++;throw Error('ACCESSOR');},enumerable:true});
  const catalog={...modern,world};let error;
  try{const leaked=host.create(catalog);leaked.dispose();}catch(e){error=String(e);}
  assert(error==='Error: PHYSICS_CATALOG_INVALID','unexpected refusal '+error);
  assert(reads===0 && writes===0 && catalog.world===world,'unsafe access or mutation');
  console.log(JSON.stringify({name,status:'PASS',error,reads,writes}));
 }
 console.log(JSON.stringify({fingerprints:evidence.fingerprints,subject:'source plus actual Rapier WASM; completed only after explicit handoff'}));
})().catch(e=>{console.error(e);process.exitCode=1;});
'''
try:
    result = subprocess.run(['node', '-e', script, str(HERE)], cwd=base['ROOT'], timeout=85)
except subprocess.TimeoutExpired:
    print('NOT PASS: exceeded 85-second bound', file=sys.stderr)
    sys.exit(2)
sys.exit(result.returncode)
