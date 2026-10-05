#!/usr/bin/env python3
"""Bounded real-source Request consumer. No server, database, dist or network.
Run: python3 docs/audits/production-swarm/capacity-work-2026-10-02/privacy-lifecycle/check.py
SQL is an explicit recording fixture, NOT PostgreSQL semantics/atomicity proof.
"""
import json
import pathlib
import subprocess
import sys

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[4]
JS = r'''
const {createRequire} = await import('node:module');
const {readFileSync} = await import('node:fs');
const {resolve, dirname} = await import('node:path');
const {pathToFileURL} = await import('node:url');
const {createHash} = await import('node:crypto');
const {default: assert} = await import('node:assert/strict');
const root = process.cwd();
const req = createRequire(resolve(root,'package.json'));
const ts = req('typescript');
const providerRequire = createRequire(resolve(root,'sites/umbrella/package.json'));
const cryptoPath = providerRequire.resolve('better-auth/crypto');
const crypto = await import(pathToFileURL(cryptoPath).href);
const hashes = {};
function read(path) { const text=readFileSync(resolve(root,path),'utf8'); hashes[path]=createHash('sha256').update(text).digest('hex'); return text; }
const cache = new Map();
function load(path, mutate=false) {
  if(!mutate && cache.has(path)) return cache.get(path);
  let text=read(path);
  if(mutate) { const needle='Object.keys(fields).some((key) => key !== "password" && key !== "confirm")'; assert(text.includes(needle)); text=text.replace(needle,'false'); }
  const compiled=ts.transpileModule(text,{fileName:path,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const module={exports:{}}; if(!mutate) cache.set(path,module.exports);
  const localRequire=(id)=> {
    if(id==='better-auth/crypto') return crypto;
    if(id==='@sceneaxi/schemas') return load('packages/schemas/src/provenance.ts');
    if(id.startsWith('.')) return load(resolve(dirname(path),id).replace(root+'/','').replace(/\.js$/,'.ts'));
    return req(id);
  };
  new Function('require','module','exports',compiled)(localRequire,module,module.exports);
  return module.exports;
}
const lifecyclePath='sites/umbrella/src/provider/account-lifecycle.ts';
const {createAccountLifecycle}=load(lifecyclePath);
const origin='https://privacy-fixture.invalid';
const password='auxiliary-fixture-password';
const passwordHash=await crypto.hashPassword(password);
const records=[];
function fixture(options={}) {
  const queries=[]; let connects=0,releases=0,stock=0,disabled=false;
  const client={release(){releases++;},async query(sql,args=[]) {
    queries.push({sql:sql.replace(/\s+/g,' ').trim(),args});
    if(sql.includes('SELECT u.user_id')) return {rows: args[0]==='valid-fixture-token' && !disabled ? [{user_id:'fixture-own',email:'own@example.invalid',email_verified:true,disabled:false,created_at:'2026-10-02T00:00:00Z',provider_created_at:'2026-10-02T00:00:00Z',password:passwordHash}]:[]};
    if(sql.startsWith('SELECT CURRENT_TIMESTAMP')) return {rows:[{recent:options.recent!==false}]};
    if(sql.includes('INSERT INTO better_auth_rate_limits')) return {rows:[{count:options.count??1}]};
    if(sql.startsWith('UPDATE users')) {disabled=true;return {rows:[]};}
    if(sql.includes('FROM credit_accounts WHERE')) return {rows:[{account_id:'fixture-credit',user_id:'fixture-own',created_at:'2026-10-02T00:00:00Z'}]};
    if(sql.includes('FROM credit_ledger_entries')) return {rows:[{entry_id:'fixture-grant',account_id:'fixture-credit',sequence:1,movement:'credit',delta:'7',balance_after:'7',reason:'fixture',occurred_at:'2026-10-02T00:00:00Z'}]};
    if(sql.includes('FROM checkout_session_intents')) return {rows:[]};
    return {rows:[]};
  }};
  const pool={async connect(){connects++;return client;}};
  const factory=options.mutate?load(lifecyclePath,true).createAccountLifecycle:createAccountLifecycle;
  return {handler:factory(pool,{origin,bootstrapEmail:'admin@example.invalid'}),queries,counts:()=>({connects,releases,stock}),stock:async()=>{stock++;return Response.json({fixture:true});}};
}
async function probe(name,path,expectedStatus,expectedCode,options={}) {
  const f=options.fixture??fixture(options);
  const headers={'origin':origin,'content-type':'application/json','authorization':'Bearer valid-fixture-token',...options.headers};
  for(const key of Object.keys(headers)) if(headers[key]===null) delete headers[key];
  const fields=options.fields??{password};
  const method=options.method??'POST';
  const body=options.raw??JSON.stringify(fields);
  const request=new Request(origin+'/api/auth/'+path,{method,headers,...(method==='GET'?{}:{body})});
  if(options.bodyTrap) Object.defineProperty(request,'body',{get(){throw Error('BODY_READ_BEFORE_ORIGIN');}});
  const response=await f.handler.dispatch(request,f.stock);
  const payload=await response.json();
  assert.equal(response.status,expectedStatus,name);
  if(expectedCode) assert.equal(payload.code,expectedCode,name);
  assert.equal(response.headers.get('cache-control'),'no-store');
  assert.equal(response.headers.get('x-content-type-options'),'nosniff');
  assert.equal(f.counts().stock,0);
  assert.equal(f.counts().connects,f.counts().releases);
  if(options.noConnect) assert.equal(f.counts().connects,0);
  if(options.retry) assert.equal(response.headers.get('retry-after'),options.retry);
  for(const q of f.queries) assert(!/^(UPDATE|DELETE FROM) (credit_|checkout_)/i.test(q.sql),'financial mutation prohibited');
  records.push({name,input:{path:'/api/auth/'+path,method,headers,body:method==='GET'?null:body,bodyTrap:!!options.bodyTrap},observed:{status:response.status,headers:Object.fromEntries(response.headers),body:payload},counts:f.counts(),queries:f.queries});
  return {f,payload,response};
}
await probe('unknown action','account/unknown',404,'NOT_FOUND',{noConnect:true});
await probe('unknown member','account/export',401,'IDENTITY_SESSION_ABSENT',{headers:{authorization:'Bearer unknown-fixture-token'}});
await probe('missing credential','account/export',401,'IDENTITY_SESSION_ABSENT',{headers:{authorization:null}});
await probe('cross-user field','account/export',400,'SITE_REQUEST_MALFORMED',{fields:{password,userId:'fixture-other'}});
await probe('forged admin field','account/export',400,'SITE_REQUEST_MALFORMED',{fields:{password,role:'admin'}});
await probe('missing origin body trap','account/disable',403,'SITE_REQUEST_CROSS_ORIGIN',{headers:{origin:null},bodyTrap:true,noConnect:true});
await probe('hostile origin body trap','account/export',403,'SITE_REQUEST_CROSS_ORIGIN',{headers:{origin:'https://hostile.invalid'},bodyTrap:true,noConnect:true});
await probe('wrong method','account/export',405,'METHOD_NOT_ALLOWED',{method:'GET',noConnect:true});
await probe('unconfigured email reset request','request-password-reset',503,'ACCOUNT_RECOVERY_MAIL_TRANSPORT_UNCONFIGURED',{fields:{email:'own@example.invalid'},noConnect:true});
await probe('unconfigured reset token replay','reset-password',503,'ACCOUNT_RECOVERY_MAIL_TRANSPORT_UNCONFIGURED',{fields:{token:'replayed-fixture-token',newPassword:password},noConnect:true});
await probe('no legal erasure claim','account/delete',503,'ACCOUNT_DELETION_RETENTION_POLICY_UNCONFIGURED',{noConnect:true});
await probe('old provider session','account/reauth',401,'ACCOUNT_REAUTHENTICATION_REQUIRED',{recent:false});
await probe('wrong password','account/reauth',401,'ACCOUNT_REAUTHENTICATION_REQUIRED',{fields:{password:'incorrect-fixture'}});
await probe('password budget','account/reauth',429,'ACCOUNT_REAUTHENTICATION_RATE_LIMITED',{count:6,retry:'300'});
await probe('valid reauthentication','account/reauth',200,'ACCOUNT_REAUTHENTICATED');
await probe('duplicate form field','account/export',400,'SITE_REQUEST_MALFORMED',{headers:{'content-type':'application/x-www-form-urlencoded'},raw:'password=a&password=b'});
await probe('4097 byte body','account/export',400,'SITE_REQUEST_MALFORMED',{raw:JSON.stringify({password}).padEnd(4097,' ')});
const own=await probe('own-user export','account/export',200,null);
assert.equal(own.payload.identity.userId,'fixture-own');
assert(!JSON.stringify(own.payload).includes(passwordHash));
assert.equal(own.response.headers.get('content-disposition'),'attachment; filename="sceneaxi-account.json"');
for(const q of own.f.queries.filter(q=>/FROM (credit_accounts|credit_ledger_entries|checkout_session_intents)/.test(q.sql))) assert.deepEqual(q.args,['fixture-own',1001]);
const disabled=await probe('disable own access','account/disable',200,'ACCOUNT_ACCESS_DISABLED',{fields:{password,confirm:'disable-access'}});
assert(disabled.response.headers.get('set-cookie').includes('Max-Age=0'));
assert.deepEqual(disabled.f.queries.filter(q=>/^(UPDATE users|DELETE FROM)/.test(q.sql)).map(q=>q.args),[['fixture-own'],['fixture-own'],['fixture-own']]);
await probe('session replay after disable fixture','account/export',401,'IDENTITY_SESSION_ABSENT',{fixture:disabled.f});
const admin=load('packages/auth/src/admin.ts');
const issued=admin.resolveAdminIdentity({SCENEAXI_ADMIN_EMAIL:'admin@example.invalid'});
assert.equal(issued.ok,true);assert.equal(admin.hasAdminIdentityProvenance(issued.value),true);
assert.equal(admin.hasAdminIdentityProvenance({...issued.value}),false);
assert.equal(admin.hasAdminIdentityProvenance(new Proxy(issued.value,{})),false);
const provenance=load('packages/auth/src/principal-provenance.ts');
assert.equal(provenance.hasPrincipalProvenance({role:'admin',user:{id:'fixture-own'}}),false);
const reauth=load('packages/site-kit/src/admin-reauth.ts');
let verifyCalls=0;
assert.equal((await reauth.verifySiteAdminReauthentication({credential:'id.token',password,verify:async()=>{verifyCalls++;return true;}})).ok,true);
assert.equal((await reauth.verifySiteAdminReauthentication({credential:'id.token',password})).ok,false);
assert.equal((await reauth.verifySiteAdminReauthentication({credential:'id.token',password,verify:async()=>{throw Error('fixture');}})).ok,false);
assert.equal(verifyCalls,1);
let negativeControl=false;
try {await probe('MUTANT cross-user validation removed','account/export',400,'SITE_REQUEST_MALFORMED',{fixture:fixture({mutate:true}),fields:{password,userId:'fixture-other'}});} catch(error) {assert.equal(error.code,'ERR_ASSERTION');assert.equal(error.actual,200);assert.equal(error.expected,400);negativeControl=true;}
assert.equal(negativeControl,true);
for(const path of ['sites/umbrella/src/app/login/page.tsx','sites/umbrella/src/app/account/page.tsx','sites/umbrella/src/provider/better-auth-provider.ts','sites/umbrella/src/app/api/auth/[...all]/route.ts','packages/auth/src/index.ts','sites/umbrella/src/lib/identity-plane.ts']) read(path);
console.log(JSON.stringify({taskId:'privacy-lifecycle',status:'PASS_SCOPED_FIXTURE',subject:'current TypeScript source transpiled in memory; real Better Auth password crypto; recording SQL fixture, not database/HTTP socket',typescript:ts.version,cryptoArtifact:{path:cryptoPath,sha256:createHash('sha256').update(readFileSync(cryptoPath)).digest('hex')},hashes,requestCases:records.length,records,additionalAssertions:['issued admin accepted','spread and proxy admin refused','structural principal refused','admin verifier success/missing/throw fail closed'],negativeControl:{mutation:'in-memory unknown-field guard removed',input:{password,userId:'fixture-other'},expectedStatus:400,observedMutantStatus:200,detected:true},resources:{sockets:0,containers:0,temporaryFiles:0,productionCalls:0}},null,2));
'''

if __name__ == '__main__':
    result = subprocess.run(['node', '--input-type=module'], input=JS, text=True, cwd=ROOT, capture_output=True, timeout=90)
    if result.returncode:
        print(result.stderr, file=sys.stderr)
        sys.exit(result.returncode)
    evidence = json.loads(result.stdout)
    (HERE / 'evidence.json').write_text(json.dumps(evidence, indent=2) + '\n')
    print(json.dumps({'status': evidence['status'], 'requestCases': evidence['requestCases'], 'negativeControl': evidence['negativeControl'], 'evidence': str(HERE / 'evidence.json')}))
