#!/usr/bin/env node
'use strict';
// Execute actual current source in this process's realm; never import dist or copy codec logic.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const {createRequire} = require('node:module');
const {spawnSync} = require('node:child_process');
const root = path.resolve(__dirname, '../../../../..');
const hostRequire = createRequire(path.join(root, 'package.json'));
const ts = hostRequire('typescript');
const negative = process.argv.includes('--negative-control');
const cache = new Map(), hashes = {};
function load(file) {
  file = path.resolve(file);
  if (cache.has(file)) return cache.get(file).exports;
  let source = fs.readFileSync(file, 'utf8');
  hashes[path.relative(root,file)] = crypto.createHash('sha256').update(source).digest('hex');
  if (negative && file.endsWith('/hosted-response.ts')) source = source.replace('const value = visit(candidate, 0);', 'if (candidate instanceof Map) return { value: {}, json: "{}" }; const value = visit(candidate, 0);');
  const module = {exports:{}}; cache.set(file,module);
  const compiled = ts.transpileModule(source, {fileName:file, compilerOptions:{module:ts.ModuleKind.CommonJS, target:ts.ScriptTarget.ES2022}}).outputText.replaceAll("import.meta.url", JSON.stringify(require("node:url").pathToFileURL(file).href));
  const localRequire = (name) => {
    if (name.startsWith('node:')) return require(name);
    if (name.startsWith('@sceneaxi/')) {
      const [pkg,...sub] = name.slice('@sceneaxi/'.length).split('/');
      const base = path.join(root,'packages',pkg);
      const manifest = JSON.parse(fs.readFileSync(path.join(base,'package.json'),'utf8'));
      const exported = manifest.exports[sub.length ? './'+sub.join('/') : '.'];
      if (typeof exported !== 'string') throw Error('unsupported source export '+name);
      return load(path.join(base,exported));
    }
    if (name.startsWith('.')) {
      let target = path.resolve(path.dirname(file),name);
      if (target.endsWith('.js')) target = target.slice(0,-3)+'.ts';
      return load(target);
    }
    throw Error('external dependency blocked: '+name);
  };
  vm.runInThisContext('(function(exports, require, module, __filename, __dirname){'+compiled+'\n})',{filename:file})(module.exports,localRequire,module,file,path.dirname(file));
  return module.exports;
}
const billing = load(path.join(root,'packages/billing/src/index.ts'));
const auth = load(path.join(root,'packages/auth/src/index.ts'));
const {issuePrincipalForTest} = load(path.join(root,'packages/auth/src/testing/principal-issuance.ts'));
const adapters = load(path.join(root,'sites/umbrella/src/lib/provider-adapters.ts'));
const now = Date.parse('2026-10-02T00:00:00Z');
const account = {schemaVersion:1,kind:'sceneaxi.credit-account',accountId:'acc_capacity_response',userId:'usr_capacity_response',createdAt:'2026-10-01T00:00:00Z'};
const resolved = auth.resolveAdminIdentity({SCENEAXI_ADMIN_EMAIL:'captain@example.invalid'});
assert.equal(resolved.ok,true);
const principal = issuePrincipalForTest({
  user:{schemaVersion:1,kind:'sceneaxi.user',userId:account.userId,email:'crew@example.invalid',emailVerified:true,disabled:false,createdAt:account.createdAt},
  role:{schemaVersion:1,kind:'sceneaxi.role-assignment',userId:account.userId,role:'user',source:'default-user',assignedAt:account.createdAt},
  session:{schemaVersion:1,kind:'sceneaxi.session',sessionId:'ses_capacity',userId:account.userId,surface:'web-shell',issuedAt:account.createdAt,expiresAt:'2026-10-03T00:00:00Z',tokenDigest:'a'.repeat(64)}
});
const operation = {accountId:account.accountId,idempotencyKey:billing.meteringIdempotencyKey(account.accountId,'answer'),amount:7,reason:'answer',model:'fixture',operation:'turn',now};
function fixture() {
  const funded = billing.appendCreditEntry(billing.createLedgerState(account),{entryId:'ent_capacity_grant',movement:'grant',delta:100,reason:'fixture',idempotencyKey:'fixture',now});
  assert.equal(funded.ok,true);
  const state = funded.value.state;
  const store = billing.createInMemoryCreditStore({accounts:[account],entries:state.entries});
  const request = {route:'hosted',capability:'hosted-ai-assistant',now,principal,admin:resolved.value,state,store,creditAmount:7,reason:'answer',idempotencyKey:'answer',model:'fixture',operation:'turn',hostedAi:{enabled:true,pricing:billing.createHostedAiPricingPolicy([{model:'fixture',operation:'turn',capability:'hosted-ai-assistant',credits:7}])}};
  return {store,request};
}
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
function diagnostic(result) {
  assert.equal(result.ok,false);
  assert.equal(typeof result.reason,'string'); assert.equal(typeof result.message,'string');
  assert.ok(result.message.length <= 512); return {reason:result.reason,message:result.message};
}
async function recover(json) {
  const {store,request} = fixture();
  assert.equal((await store.hostedCalls.reserve(operation)).status,'acquired');
  await store.hostedCalls.saveResponse(operation,JSON.parse(json));
  let provider=0;
  const resumed = await billing.runMeteredModelCall({...request,call:()=>{provider++; throw Error('provider forbidden');}});
  assert.equal(resumed.ok,true); assert.equal(provider,0); assert.equal(resumed.value.balance,93);
  const bytes = billing.snapshotHostedResponse(resumed.value.response).json;
  assert.equal(bytes,json); assert.equal(store.entryCount(account.accountId),2);
  const replay = await billing.runMeteredModelCall({...request,state:resumed.value.state,call:()=>{provider++;}});
  assert.equal(replay.ok,true); assert.equal(replay.value.replayed,true); assert.equal(provider,0);
  return {json:bytes,sha256:digest(bytes),providerCalls:provider,entries:2,balance:93,replay:true};
}
async function main() {
  if (process.argv.includes('--recover-stdin')) { process.stdout.write(JSON.stringify(await recover(fs.readFileSync(0,'utf8')))); return; }
  const cases=[];
  async function check(id,input,fn) {
    try { const observed=await fn(); cases.push({id,input,status:'PASS',observed}); }
    catch(error) { cases.push({id,input,status:'FAIL',error:String(error.message)}); }
  }
  let hooks=0;
  const unsupported = [
    ['Map',()=>new Map([['answer','paid answer']])],['Date',()=>new Date(now)],['BigInt',()=>1n],
    ['cycle',()=>{const a={}; a.self=a;return a;}],['depth65',()=>{let a=null;for(let i=0;i<65;i++)a=[a];return a;}],
    ['accessor',()=>Object.defineProperty({},'answer',{enumerable:true,get(){hooks++;throw Error('getter');}})],
    ['toJSON',()=>({answer:'original',toJSON(){hooks++;throw Error('toJSON');}})],
    ['throwingProxy',()=>new Proxy({}, {getPrototypeOf(){hooks++;throw Error('reflection');}})],
    ['undefined',()=>({answer:undefined})],['negativeZero',()=>-0],['sparseArray',()=>new Array(2)],
    ['overBytes',()=> 'a'.repeat(billing.HOSTED_RESPONSE_MAX_BYTES-1)]
  ];
  for (const [name,make] of unsupported) {
    await check('codec:'+name,name,async()=>{const out=billing.snapshotHostedResponse(make());assert.equal(out,undefined); return {refused:true};});
    await check('raw-save:'+name,name,async()=>{let sql=0;const raw=adapters.createNeonHostedCallStore({query(){sql++;throw Error('SQL reached');},transaction(){sql++;throw Error('transaction reached');}}); await assert.rejects(async()=>raw.saveResponse(operation,make()),/bounded JSON/);assert.equal(sql,0);return {sqlCalls:sql};});
    await check('raw-recovery:'+name,name,async()=>{let sql=0;const raw=adapters.createNeonHostedCallStore({async query(){sql++;return [{status:'response-ready',response:make()}];},transaction(){throw Error('unexpected transaction');}});await assert.rejects(async()=>raw.reserve(operation),/bounded JSON/);assert.equal(sql,1);return {sqlReadCalls:sql,sqlWriteCalls:0};});
    await check('shared-save:'+name,name,async()=>{const {store}=fixture();let saves=0;const shared=billing.createCreditStore({...store,hostedCalls:{...store.hostedCalls,saveResponse(){saves++;throw Error('adapter reached');}}});await shared.hostedCalls.reserve(operation);await assert.rejects(async()=>shared.hostedCalls.saveResponse(operation,make()));assert.equal(saves,0);return {adapterSaveCalls:saves};});
    await check('paid:'+name,name,async()=>{const {store,request}=fixture();let provider=0;const first=await billing.runMeteredModelCall({...request,call:()=>{provider++;return make();}});const refusal=diagnostic(first);assert.equal(first.reason,billing.BILLING_REFUSE_REASONS.storeFailed);assert.equal(store.entryCount(account.accountId),1);const retry=await billing.runMeteredModelCall({...request,call:()=>{provider++;return make();}});diagnostic(retry);assert.equal(provider,1);assert.equal((await store.hostedCalls.reserve(operation)).status,'pending');return {...refusal,providerCalls:provider,debits:0,retryProviderCalls:0,reservation:'pending'};});
  }
  const hostile = [
    ['throwingToString',()=>({toString(){hooks++;throw Error('toString');}})],
    ['Symbol.toPrimitive',()=>({[Symbol.toPrimitive](){hooks++;throw Error('primitive');}})],
    ['conversionAccessor',()=>Object.defineProperty({},Symbol.toPrimitive,{get(){hooks++;throw Error('conversion getter');}})],
    ['throwingGetProxy',()=>new Proxy({}, {get(){hooks++;throw Error('get');}})],
    ['unsupportedString',()=> 'x'.repeat(300000)],['symbol',()=>Symbol('hosted-ai-assistant')]
  ];
  for (const [name,make] of hostile) await check('capability:'+name,name,async()=>{let provider=0,storeCalls=0;const before=hooks;const result=await billing.runMeteredModelCall({route:'hosted',capability:make(),now,hostedAi:{enabled:true},call:()=>{provider++;},store:new Proxy({}, {get(){storeCalls++;throw Error('store');}})});const refusal=diagnostic(result);assert.equal(result.reason,billing.BILLING_REFUSE_REASONS.capabilityUnknown);assert.equal(provider,0);assert.equal(storeCalls,0);assert.equal(hooks,before);return {...refusal,providerCalls:provider,storeCalls,conversionCalls:0};});
  await check('inclusiveBytes',{asciiLength:262142,jsonBytes:262144},async()=>{const snapshot=billing.snapshotHostedResponse('a'.repeat(262142));assert.equal(Buffer.byteLength(snapshot.json),262144);return {bytes:262144,sha256:digest(snapshot.json)};});
  const json='{"text":"paid answer","tokens":[1,null,true],"nested":{"unicode":"é😀"},"toJSON":"ordinary data","__proto__":{"answer":"original"}}';
  await check('raw-roundtrip',json,async()=>{let sql=0,wire;const raw=adapters.createNeonHostedCallStore({async query(query,values){sql++;if(query.startsWith('UPDATE')){wire=values[6];return [{idempotency_key:operation.idempotencyKey}];}return [{status:'response-ready',response:JSON.parse(wire)}];},transaction(){throw Error('unexpected');}});await raw.saveResponse(operation,JSON.parse(json));assert.equal(wire,json);const reserved=await raw.reserve(operation);assert.equal(billing.snapshotHostedResponse(reserved.response).json,json);return {sqlCalls:sql,json:wire,bytes:Buffer.byteLength(wire),sha256:digest(wire)};});
  await check('paid-interrupted-before-debit',json,async()=>{const {store,request}=fixture();let provider=0;const interrupted=billing.createCreditStore({...store,appendOrReplayEntry(){throw Error('synthetic connection loss before debit');}});const result=await billing.runMeteredModelCall({...request,store:interrupted,call:()=>{provider++;return JSON.parse(json);}});const refusal=diagnostic(result);assert.equal(result.reason,billing.BILLING_REFUSE_REASONS.storeFailed);assert.equal(provider,1);assert.equal(store.entryCount(account.accountId),1);const reservation=await store.hostedCalls.reserve(operation);assert.equal(reservation.status,'response-ready');const wire=billing.snapshotHostedResponse(reservation.response).json;assert.equal(wire,json);const child=spawnSync(process.execPath,[__filename,'--recover-stdin'],{input:wire,encoding:'utf8',timeout:30000});assert.equal(child.status,0,child.stderr);return {...refusal,firstProviderCalls:provider,firstDebits:0,retainedSha256:digest(wire),freshRecovery:JSON.parse(child.stdout)};});
  await check('fresh-process-response-ready',json,async()=>{const child=spawnSync(process.execPath,[__filename,'--recover-stdin'],{input:json,encoding:'utf8',timeout:30000});assert.equal(child.status,0,child.stderr);const receipt=JSON.parse(child.stdout);assert.equal(receipt.json,json);return receipt;});
  await check('hook-safety','accessors/toJSON must not run; proxy reflection may throw',async()=>{assert.equal(hooks,5);return {reflectionThrows:5,serializationOrConversionHooks:0};});
  const result={taskid:'paid-response',subject:'current source transpiled in memory; source public exports + raw deployment adapter; no dist/DB/provider',negativeControl:negative,typescript:ts.version,fingerprints:hashes,cases,passed:cases.filter(c=>c.status==='PASS').length,failed:cases.filter(c=>c.status==='FAIL').length};
  process.stdout.write(JSON.stringify(result,null,2)+'\n');process.exitCode=result.failed?1:0;
}
main().catch(error=>{console.error(error.stack);process.exitCode=2;});
