#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import { createOwnSessionHandler, createConfiguredOriginAdapter } from './proposal.mjs';

const own = dirname(fileURLToPath(import.meta.url));

const root = resolve(own, '../../../../../');

const req = createRequire(resolve(root, 'package.json'));

const ts = req('typescript');

const hashes = {}, loaded = new Map(), results = [];

const sha = text => createHash('sha256').update(text).digest('hex');

function source(path) { const full = resolve(root, path); const text = readFileSync(full, 'utf8'); hashes[path] = sha(text);

 return text; }

function compile(text, path, extras = {}, exports = {}) {
  const output = ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;

  const localRequire = name => {
    if (name.startsWith('.')) { let p = resolve(root, dirname(path), name).replace(/\.js$/, '.ts');

 return load(p); }

    if (name.startsWith('@sceneaxi/')) { const [pkg, entry = 'index'] = name.slice(10).split('/');

 return load(`packages/${pkg}/src/${entry}.ts`); }

    return req(name);
  };

  vm.runInThisContext(`(function(exports, require${Object.keys(extras).map(k => ', '+k).join('')}) { ${output}\n})`, { filename: path })(exports, localRequire, ...Object.values(extras));

  return exports;
}

function load(path) { path = path.replace(root + '/', '');

 if (loaded.has(path)) return loaded.get(path); const value = {}; loaded.set(path, value); compile(source(path), path, {}, value);

 return value; }

function selected(path, names, extras) {
  const text = source(path), ast = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
  const parts = ast.statements.filter(n => (n.name && names.includes(n.name.text)) || (ts.isVariableStatement(n) && n.declarationList.declarations.some(d => names.includes(d.name.getText(ast))))).map(n => n.getText(ast));
  assert.equal(parts.length, names.length, 'all selected actual declarations found');

  return compile(parts.join('\n'), path, extras);
}

const { ok, refuse } = load('packages/site-kit/src/refusals.ts');

const catalog = load('packages/site-kit/src/catalog-identity.ts');

const deep = load('packages/site-kit/src/deep-link.ts');

const session = load('packages/site-kit/src/site-session.ts');

const authReasons = load('packages/auth/src/refusals.ts').AUTH_REFUSE_REASONS;

const identity = selected('sites/umbrella/src/lib/identity-plane.ts', ['IDENTITY_NOT_WIRED_REASONS','IDENTITY_SIGNED_OUT_REASONS','siteReasonForAuthReason','toSitePrincipal','isString','parseSessionToken','verifyCarriedSession','createAuthIdentityAdapter'], { ok, refuse, AUTH_REFUSE_REASONS: authReasons });

const provider = selected('sites/umbrella/src/provider/better-auth-provider.ts', ['requiredEndpoint','createBetterAuthProviderHandler'], { serverLog: () => {}, refusal: () => { throw Error('unexpected runtime refusal'); } });

const now = Date.parse('2026-10-02T12:00:00.000Z');

const principal = { user: { userId: 'fixture-own-user', email: 'own@example.invalid', emailVerified: true, disabled: false }, role: 'user', session: { sessionId: 'fixture-session', userId: 'fixture-own-user', surface: 'site', issuedAt: '2026-10-02T11:00:00.000Z', expiresAt: '2026-10-02T13:00:00.000Z' } };

async function test(name, input, fn) { await fn(); results.push({ name, input, outcome: 'PASS' }); }

let runtimeCalls = 0;

const endpoint = provider.createBetterAuthProviderHandler(() => { runtimeCalls++;

 return { ok: true, value: { retain() {}, auth: { handler: () => Response.json({ providerFixture: true }) } } }; });

await test('current actual catch-all refuses missing own-session endpoint', { method:'GET', url:'https://umbrella.example.invalid/api/auth/catalog-session', headers:{ 'x-sceneaxi-session':'fixture-session.fixture-token' } }, async () => {
  assert.equal(existsSync(resolve(root, 'sites/umbrella/src/app/api/auth/catalog-session/route.ts')), false);
  const response = await endpoint(new Request('https://umbrella.example.invalid/api/auth/catalog-session', { headers: { 'x-sceneaxi-session': 'fixture-session.fixture-token' } }));
  const observed = { status: response.status, headers: Object.fromEntries(response.headers), body: await response.json() }; results.push({ name:'actual missing endpoint observation', observed });
  assert.equal(response.status,404); assert.deepEqual(observed.body,{code:'NOT_FOUND'}); assert.equal(response.headers.get('cache-control'),'no-store'); assert.equal(runtimeCalls,0);
});

await test('catch-all live positive control existing get-session dispatches', {url:'/api/auth/get-session'}, async () => { const response=await endpoint(new Request('https://umbrella.example.invalid/api/auth/get-session')); assert.equal(response.status,200); assert.equal(runtimeCalls,1); assert.equal(response.headers.get('cache-control'),'no-store'); });

await test('negative control inverted endpoint PASS is rejected', {incorrectExpectedStatus:200}, async () => { const response=await endpoint(new Request('https://umbrella.example.invalid/api/auth/catalog-session')); assert.throws(()=>assert.equal(response.status,200),assert.AssertionError); });

await test('current unwired catalog named refusal', {}, async()=>{ const r=await catalog.resolveCatalogViewer(catalog.createCatalogIdentityPlane()); assert.equal(r.reason,'IDENTITY_PLANE_NOT_WIRED'); });

let verified;

const currentAdapter=identity.createAuthIdentityAdapter({ port:{ async verifySession(input){ verified=input;

 return ok({...principal,role:{role:'user'}}); } } });

await test('current authoritative adapter parses carried credential and binds user', {token:'fixture-session.fixture-token'}, async()=>{ const plane=catalog.createCatalogIdentityPlane({adapter:currentAdapter,clock:()=>now}); const r=await catalog.resolveCatalogViewer(plane,'fixture-session.fixture-token'); assert.equal(r.ok,true); assert.equal(r.value.user.userId,principal.user.userId); assert.deepEqual(JSON.parse(JSON.stringify(verified)),{surface:'site',sessionId:'fixture-session',token:'fixture-token'}); });

for (const [name,value,reason] of [['mismatched user',{...principal,session:{...principal.session,userId:'forged-user'}},'IDENTITY_ADAPTER_OUTPUT_INVALID'],['expired',{...principal,session:{...principal.session,expiresAt:'2026-10-02T11:30:00.000Z'}},'IDENTITY_SESSION_EXPIRED'],['signed out',null,'IDENTITY_SESSION_ABSENT']]) await test('current catalog '+name,{reason},async()=>{ const p=catalog.createCatalogIdentityPlane({adapter:{resolvePrincipal:async()=>ok(value)},clock:()=>now}); assert.equal((await catalog.resolveCatalogViewer(p,'fixture-session.fixture-token')).reason,reason); });

const origin='https://umbrella.example.invalid';

let planeCalls=0;

 const network=[];

const handler=createOwnSessionHandler({ refuse, verifyOrigin: signals=>session.verifySiteFormOrigin({...signals,configuredOrigin:origin}), plane:token=>{planeCalls++;

return {identity:{resolvePrincipal:async input=>{assert.equal(input.sessionToken,token);

return ok(principal);}}};} });

const adapter=createConfiguredOriginAdapter({ env:{NEXT_PUBLIC_SCENEAXI_UMBRELLA_ORIGIN:origin},resolveOrigin:deep.resolveUmbrellaOriginConfiguration,refuse,fetcher:async(url,options)=>{network.push({url,...options,signal:'bounded 5000ms'});

 return handler(new Request(url,options));} });

await test('PROPOSAL positive real Request/Response through existing catalog port', {origin,token:'fixture-session.fixture-token'},async()=>{ const p=catalog.createCatalogIdentityPlane({adapter,clock:()=>now}); const r=await catalog.resolveCatalogViewer(p,'fixture-session.fixture-token'); assert.equal(r.ok,true); assert.equal(r.value.user.userId,principal.user.userId); const sent=network.at(-1); assert.equal(sent.url,origin+'/api/auth/catalog-session'); assert.deepEqual(sent.headers,{accept:'application/json',origin,'x-sceneaxi-session':'fixture-session.fixture-token'}); assert.equal(sent.credentials,'omit'); assert.equal(sent.cache,'no-store'); assert.equal(sent.redirect,'error'); });

for(const raw of [undefined,'http://hostile.invalid','https://user:pass@umbrella.example.invalid','https://umbrella.example.invalid/path','https://umbrella.example.invalid/#fragment','not-a-url']) await test('PROPOSAL hostile configured origin refusal',{raw:raw??null},async()=>{ const before=network.length; const a=createConfiguredOriginAdapter({env:{NEXT_PUBLIC_SCENEAXI_UMBRELLA_ORIGIN:raw},resolveOrigin:deep.resolveUmbrellaOriginConfiguration,refuse,fetcher:async()=>{network.push({unexpected:true});throw Error('must not fetch');}}); assert.equal((await a.resolvePrincipal({surface:'site',sessionToken:'fixture-session.fixture-token'})).ok,false); assert.equal(network.length,before); });

for(const headers of [{}, {origin:'https://hostile.invalid'}, {origin}, {origin,cookie:'sceneaxi.session=fixture-session.fixture-token'}]) await test('PROPOSAL endpoint missing/hostile origin or credential refuses before plane',{headers},async()=>{ const before=planeCalls; const r=await handler(new Request(origin+'/api/auth/catalog-session',{headers})); assert.ok([401,403].includes(r.status)); assert.equal(planeCalls,before); assert.equal(r.headers.get('cache-control'),'private, no-store'); assert.equal(r.headers.get('set-cookie'),null); assert.equal(r.headers.get('access-control-allow-origin'),null); });

await test('PROPOSAL exact successful response headers',{},async()=>{ const r=await handler(new Request(origin+'/api/auth/catalog-session',{headers:{origin,'x-sceneaxi-session':'fixture-session.fixture-token'}})); assert.deepEqual(Object.fromEntries(r.headers),{'cache-control':'private, no-store','content-type':'application/json',vary:'Origin, x-sceneaxi-session','x-content-type-options':'nosniff'}); });

await test('PROPOSAL missing configured endpoint origin refuses',{},async()=>{ const h=createOwnSessionHandler({refuse,verifyOrigin:s=>session.verifySiteFormOrigin(s),plane:()=>{throw Error('must not reach');}}); assert.equal((await h(new Request(origin+'/api/auth/catalog-session',{headers:{origin,'x-sceneaxi-session':'fixture-session.fixture-token'}}))).status,403); });

await test('PROPOSAL no credential causes no fetch',{},async()=>{const before=network.length;assert.deepEqual(await adapter.resolvePrincipal({surface:'site'}),{ok:true,value:null});assert.equal(network.length,before);});

for(const [name,body,cache] of [['cached response',{version:1,result:ok(principal)},'public, max-age=60'],['bad version',{version:99,result:ok(principal)},'private, no-store'],['huge body','x'.repeat(17000),'private, no-store']]) await test('PROPOSAL '+name+' refusal',{},async()=>{const a=createConfiguredOriginAdapter({env:{NEXT_PUBLIC_SCENEAXI_UMBRELLA_ORIGIN:origin},resolveOrigin:deep.resolveUmbrellaOriginConfiguration,refuse,fetcher:async()=>Response.json(body,{headers:{'cache-control':cache}})});assert.equal((await a.resolvePrincipal({surface:'site',sessionToken:'fixture-session.fixture-token'})).reason,'IDENTITY_ADAPTER_OUTPUT_INVALID');});

const evidence={ taskid:'own-session', subject:'current source modules and selected actual TypeScript declarations transpiled in memory; injected provider/identity collaborators; separate proposal integration is NOT product endpoint PASS', sourceHashes:hashes, proposalSha256:sha(readFileSync(resolve(own,'proposal.mjs'))), harnessSha256:sha(readFileSync(fileURLToPath(import.meta.url))), results, network, checksPassed:results.filter(r=>r.outcome==='PASS').length, deferred:['real socket endpoint acceptance after explicit serial integration and source-bound site build','owning typecheck/boundaries/provider lifecycle acceptance'], resources:'no sockets, temp fixtures, dist, DB, browser or production configuration used' };

writeFileSync(resolve(own,'evidence.json'),JSON.stringify(evidence,null,2)+'\n');

console.log(JSON.stringify({checksPassed:evidence.checksPassed,currentEndpoint:'MISSING / actual source handler 404',negativeControl:'PASS (inverted 200 assertion rejected)',proposal:'tested separately; NOT landed'},null,2));
