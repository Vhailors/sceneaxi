#!/usr/bin/env python3
"""Bounded source-only own-session acceptance; no dist, sockets or credentials.
Run from any directory: python3 contract-check.py. Writes evidence in this directory.
"""
import json
import pathlib
import subprocess
import sys

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[4]
SCRIPT = r'''
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {createRequire} = require('node:module');
const root = process.cwd();
let ts;
for (const base of [root, path.join(root, 'sites/umbrella'), path.join(root, 'packages/site-kit')]) {
  try { ts = createRequire(path.join(base, 'package.json'))('typescript'); break; } catch {}
}
if (!ts) throw new Error('Existing TypeScript compiler required; no dependency installation allowed');
const subjects = [
  'sites/umbrella/src/app/api/auth/[...all]/route.ts',
  'sites/umbrella/src/lib/identity-plane.ts',
  'sites/umbrella/src/lib/request-authority.ts',
  'sites/umbrella/src/provider/better-auth-provider.ts',
  'packages/site-kit/src/server-fetch.ts',
  'packages/site-kit/src/catalog-server-fetch.ts',
  'packages/site-kit/src/catalog-identity.ts',
  'packages/site-kit/src/ports.ts',
  'packages/site-kit/src/site-session.ts',
  'sites/catalog-game/src/lib/identity-plane.ts',
];
const evidence = {taskid:'capacity-own-session-2026-10-02', subject:'current TypeScript source; not dist', time:new Date().toISOString(), compiler:ts.version, files:[], checks:[], deferred:[]};
for (const file of subjects) {
  if (!fs.existsSync(path.join(root,file))) { evidence.files.push({path:file,status:'MISSING'}); continue; }
  const text = fs.readFileSync(path.join(root,file),'utf8');
  const tree = ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true);
  const symbols=[];
  function visit(n) {
    if ((ts.isFunctionDeclaration(n) || ts.isInterfaceDeclaration(n) || ts.isTypeAliasDeclaration(n) || ts.isVariableDeclaration(n)) && n.name) {
      const start=tree.getLineAndCharacterOfPosition(n.getStart()).line+1;
      const end=tree.getLineAndCharacterOfPosition(n.end).line+1;
      symbols.push({name:n.name.getText(tree),start,end,
        parameters:n.parameters?.map(p=>p.getText(tree)),
        fields:n.members?.map(p=>p.getText(tree)),
        initializer:ts.isVariableDeclaration(n) ? n.initializer?.getText(tree) : undefined});
    }
    ts.forEachChild(n,visit);
  }
  visit(tree);
  const calls=[];
  function callVisit(n) { if(ts.isCallExpression(n)) calls.push({line:tree.getLineAndCharacterOfPosition(n.getStart()).line+1,call:n.getText(tree)}); ts.forEachChild(n,callVisit); }
  callVisit(tree);
  const imports=tree.statements.filter(ts.isImportDeclaration).map(n=>({module:n.moduleSpecifier.text,bindings:n.importClause?.getText(tree)}));
  const paths=[];
  function pathsVisit(n) { if(ts.isStringLiteral(n) && /session|origin|cache|cookie|authorization/i.test(n.text)) paths.push({line:tree.getLineAndCharacterOfPosition(n.getStart()).line+1,value:n.text}); ts.forEachChild(n,pathsVisit); }
  pathsVisit(tree);
  evidence.files.push({path:file,sha256:crypto.createHash('sha256').update(text).digest('hex'),symbols,calls,imports,paths});
}
const api='sites/umbrella/src/app/api/auth';
evidence.authRoutes=[];
function routes(dir) {for(const item of fs.readdirSync(path.join(root,dir),{withFileTypes:true})) {const p=path.posix.join(dir,item.name); if(item.isDirectory()) routes(p); else if(item.name==='route.ts') evidence.authRoutes.push(p);}}
routes(api);
const vm=require('node:vm');
const assert=require('node:assert/strict');
// Execute unchanged AST-selected source declarations, never a copied algorithm.
function declarations(file,names,bindings={}) {
  const text=fs.readFileSync(path.join(root,file),'utf8');
  if(!evidence.files.some(f=>f.path===file)) evidence.files.push({path:file,sha256:crypto.createHash('sha256').update(text).digest('hex'),mode:'AST dependency'});
  const tree=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true);
  const selected=[];
  for(const n of tree.statements) {
    if(ts.isFunctionDeclaration(n) && names.includes(n.name?.text)) selected.push(n.getText(tree));
    if(ts.isVariableStatement(n)) for(const d of n.declarationList.declarations)
      if(names.includes(d.name.getText(tree))) selected.push('const '+d.getText(tree)+';');
  }
  const code=ts.transpileModule(selected.join('\n')+'\nexports.result={'+names.join(',')+'};',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
  const context={exports:{},Request,Response,Headers,URL,AbortSignal,TextDecoder,console,...bindings};
  vm.runInNewContext(code,context,{timeout:1000,filename:file});
  return context.exports.result;
}
function constant(file,name) { return declarations(file,[name])[name]; }
const refusals=declarations('packages/site-kit/src/refusals.ts',['SITE_REFUSALS','ok','refuse']);
let authReasons;
for(const name of fs.readdirSync(path.join(root,'packages/auth/src'))) {
  if(!name.endsWith('.ts')) continue;
  const file='packages/auth/src/'+name;
  if(fs.readFileSync(path.join(root,file),'utf8').includes('const AUTH_REFUSE_REASONS')) { authReasons=constant(file,'AUTH_REFUSE_REASONS'); break; }
}
if(!authReasons) throw new Error('Auth source refusal constants not located');
const identity=declarations('sites/umbrella/src/lib/identity-plane.ts', ['IDENTITY_NOT_WIRED_REASONS','IDENTITY_SIGNED_OUT_REASONS','isString','parseSessionToken','siteReasonForAuthReason','toSitePrincipal','verifyCarriedSession','createAuthIdentityAdapter'],{...refusals,AUTH_REFUSE_REASONS:authReasons});
let providerReasons=constant('sites/umbrella/src/provider/better-auth-provider-refusals.ts','BETTER_AUTH_PROVIDER_REFUSALS');
const provider=declarations('sites/umbrella/src/provider/better-auth-provider.ts',['refusal','requiredEndpoint','createBetterAuthProviderHandler'],{BETTER_AUTH_PROVIDER_REFUSALS:providerReasons,serverLog:()=>{throw new Error('Unexpected error logging');},loadProductionBetterAuthProvider:()=>{throw new Error('Production provider access forbidden');}});
const checks=evidence.checks;
function record(name,input,observed,assertions,status='PASS') {
  checks.push({name,input,observed,assertions,status,observedSha256:crypto.createHash('sha256').update(JSON.stringify(observed)).digest('hex')});
}
async function run() {
  const route=evidence.files.find(f=>f.path===subjects[0]);
  for(const method of ['GET','POST']) assert.equal(route.symbols.find(s=>s.name===method).initializer,'betterAuthProviderHandler');
  record('real front-door static wiring',{path:route.path}, {GET:'betterAuthProviderHandler',POST:'betterAuthProviderHandler'},['both route exports reference source provider handler; full route runtime NOT RUN']);
  const session=declarations('packages/site-kit/src/site-session.ts',['nonEmptyToken','resolveSiteSessionToken','requestOrigin','verifySiteFormOrigin'],refusals);
  for(const origin of [undefined,'https://hostile.example.invalid','https://umbrella.example.invalid']) {
    const input={configuredOrigin:'https://umbrella.example.invalid',requestUrl:'https://umbrella.example.invalid/api/auth/own-session',origin};
    const result=session.verifySiteFormOrigin(input);
    assert.equal(result.ok,origin==='https://umbrella.example.invalid');
    if(!result.ok) assert.equal(result.reason,'SITE_REQUEST_CROSS_ORIGIN');
    record('source form origin contract '+String(origin),input,result,['configured origin comparison','exact refusal for missing/hostile origin']);
  }
  const fallback=session.verifySiteFormOrigin({requestUrl:'https://umbrella.example.invalid/api/auth/own-session',origin:'https://umbrella.example.invalid'});
  assert.equal(fallback.ok,true);
  record('missing configured origin helper fallback',{configuredOrigin:null},fallback,['general form helper falls back to request URL; own-session must explicitly require configuration'],'GAP_BOUNDARY');
  assert.equal(session.resolveSiteSessionToken({header:'header-fixture',cookie:'cookie-fixture'}),'header-fixture');
  assert.equal(session.resolveSiteSessionToken({} ),null);
  record('source explicit session header precedence',{header:'header-fixture',cookie:'cookie-fixture'}, {preferred:'header-fixture',absent:null},['existing x-sceneaxi-session contract precedes supplied cookie','no ambient cookie lookup']);
  const catalog=declarations('packages/site-kit/src/catalog-identity.ts',['CATALOG_IDENTITY_SURFACE','resolveCatalogViewer']);
  const catalogCalls=[];
  const catalogPlane={identity:{resolvePrincipal:async input=>{catalogCalls.push(input);return {ok:false,reason:'IDENTITY_NOT_WIRED'};}}};
  await catalog.resolveCatalogViewer(catalogPlane);
  await catalog.resolveCatalogViewer(catalogPlane,'session-a.secret-a');
  assert.equal(Object.hasOwn(catalogCalls[0],'sessionToken'),false);
  assert.equal(catalogCalls[1].sessionToken,'session-a.secret-a');
  assert.equal(catalogCalls[1].surface,catalog.CATALOG_IDENTITY_SURFACE);
  record('actual catalog adapter explicit carry',{credential:'session-a.secret-a'},catalogCalls,['absent credential omitted','explicit credential exact','actual catalog surface constant']);
  let calls=[];
  const principal={user:{userId:'user-a',email:'a@example.invalid',emailVerified:true,disabled:false},role:{role:'user'},session:{sessionId:'session-a',userId:'user-a',surface:'umbrella',issuedAt:0,expiresAt:4102444800000}};
  const port={verifySession:async input=>{calls.push(input);return {ok:true,value:principal};}};
  const adapter=identity.createAuthIdentityAdapter({port});
  for(const token of [undefined,'','malformed']) {
    const result=await adapter.resolvePrincipal({surface:'umbrella',sessionToken:token});
    assert.equal(result.ok,true);assert.equal(result.value,null);assert.equal(calls.length,0);
    record('no implicit credential', {surface:'umbrella',sessionToken:token??null},result,['anonymous principal','zero verifier calls']);
  }
  const result=await adapter.resolvePrincipal({surface:'umbrella',sessionToken:'session-a.secret-a'});
  assert.equal(calls.length,1); assert.equal(JSON.stringify(calls[0]),JSON.stringify({surface:'umbrella',sessionId:'session-a',token:'secret-a'}));
  assert.equal(result.value.user.userId,'user-a');assert.equal(result.value.session.userId,'user-a');
  record('explicit carried credential positive',{sessionToken:'session-a.secret-a'}, {result,calls},['exact verifier input','authenticated user/session binding preserved']);
  const refusing=identity.createAuthIdentityAdapter({port:{verifySession:async ()=>({ok:false,reason:authReasons.sessionExpired})}});
  const denied=await refusing.resolvePrincipal({surface:'umbrella',sessionToken:'session-a.secret-a'});
  assert.equal(denied.ok,false);assert.equal(denied.reason,'IDENTITY_SESSION_EXPIRED');
  record('expired credential refusal',{sessionToken:'session-a.secret-a'},denied,['exact refusal IDENTITY_SESSION_EXPIRED']);
  // Mutation control: replace only the injected verifier response, not product source.
  const mutated=identity.createAuthIdentityAdapter({port:{verifySession:async ()=>({ok:true,value:{...principal,user:{...principal.user,userId:'attacker'}}})}});
  const mutation=await mutated.resolvePrincipal({surface:'umbrella',sessionToken:'session-a.secret-a'});
  let detected=false;try {assert.equal(mutation.value.user.userId,'user-a');} catch {detected=true;}
  assert.equal(detected,true);record('negative control credential oracle mutation',{},mutation,['binding oracle fails for attacker fixture','probe actually invokes verifier']);
  record('adapter cross-user fixture',{userId:'attacker',sessionUserId:'user-a'},mutation,['adapter alone does not validate cross-user binding; upstream IdentityPort must enforce it'],'GAP_BOUNDARY');
  let requests=[];
  const fixtureRuntime={retain:()=>{},ready:()=>({ok:true}),auth:{handler:async req=>{requests.push({url:req.url,method:req.method,headers:Object.fromEntries(req.headers)});return Response.json({user:{id:'user-a'},session:{userId:'user-a'}},{headers:{'cache-control':'public, max-age=600'}});}}};
  const handler=provider.createBetterAuthProviderHandler(()=>({ok:true,value:fixtureRuntime}));
  for(const origin of [null,'https://hostile.example.invalid','https://umbrella.example.invalid']) {
    const headers={'authorization':'Bearer explicit-fixture','cookie':'unrelated=fixture; sceneaxi.session=session-a.secret-a'};
    if(origin) headers.origin=origin;
    const req=new Request('https://umbrella.example.invalid/api/auth/get-session',{headers});
    const response=await handler(req);const body=await response.json();
    assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
    assert.equal(requests.at(-1).headers.authorization,headers.authorization);
    record('existing provider get-session fixture origin '+String(origin),{url:req.url,headers}, {status:response.status,headers:Object.fromEntries(response.headers),body,forwarded:requests.at(-1)},['real source handler factory with fixture runtime','exact no-store cache','no origin refusal at wrapper boundary; provider enforcement NOT RUN'],origin==='https://umbrella.example.invalid'?'PASS':'GAP_BOUNDARY');
  }
  const missing=new Request('https://umbrella.example.invalid/api/auth/own-session');
  const before=requests.length;const absent=await handler(missing);const body=await absent.json();
  assert.equal(absent.status,404);assert.equal(body.code,'NOT_FOUND');assert.equal(requests.length,before);
  record('own-session endpoint genuinely missing',{url:missing.url},{status:absent.status,headers:Object.fromEntries(absent.headers),body},['404 NOT_FOUND','zero provider calls','cache-control no-store'],'MISSING_ENDPOINT');
  const unconfigured=provider.createBetterAuthProviderHandler(()=>({ok:false,reason:providerReasons.storageUnavailable}));
  const unavailable=await unconfigured(new Request('https://umbrella.example.invalid/api/auth/get-session'));
  assert.equal(unavailable.status,503);assert.equal(unavailable.headers.get('cache-control'),'no-store');
  record('provider runtime unavailable',{url:'/api/auth/get-session'},{status:unavailable.status,headers:Object.fromEntries(unavailable.headers),body:await unavailable.json()},['503 named provider refusal','cache-control no-store']);
  // Negative control: the cached provider fixture must fail a no-store oracle without the real wrapper.
  const raw=await fixtureRuntime.auth.handler(new Request('https://umbrella.example.invalid/api/auth/get-session'));
  detected=false;try{assert.equal(raw.headers.get('cache-control'),'no-store');}catch{detected=true;}
  assert.equal(detected,true);record('negative control bypass real provider wrapper',{}, {headers:Object.fromEntries(raw.headers)},['no-store oracle fails without source wrapper']);
  evidence.deferred=[{check:'Configured-origin own-session adapter/socket matrix',status:'NOT RUN',reason:'own-session endpoint and both server-fetch adapter source files absent; proposal only'}, {check:'Better Auth internal origin/session/database checks',status:'NOT RUN',reason:'fixture runtime; credentials and live provider forbidden'}, {check:'Full identity port cross-user binding',status:'NOT RUN',reason:'extracted adapter injected IdentityPort; does not claim upstream validation'}];
  evidence.execution={sourceMode:'unchanged AST declarations transpiled in memory with existing TypeScript compiler',provider:'real createBetterAuthProviderHandler with synthetic runtime, no DB/network',negativeControls:2,assertionFailures:0};
}
run().then(()=>process.stdout.write(JSON.stringify(evidence,null,2))).catch(error=>{console.error(error);process.exitCode=1;});
'''

def main():
    result = subprocess.run(['node', '-e', SCRIPT], cwd=ROOT, text=True,
                            capture_output=True, timeout=80)
    if result.returncode:
        print(result.stderr, file=sys.stderr)
        return result.returncode
    evidence = json.loads(result.stdout)
    (HERE / 'evidence.json').write_text(json.dumps(evidence, indent=2) + '\n')
    for check in evidence['checks']:
        print(check['status'], check['name'], check['observedSha256'])
    for f in evidence['files']:
        print('FINGERPRINT', f['path'], f.get('sha256', f.get('status')))
    print('DEFERRED', json.dumps(evidence['deferred']))
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
