import { registerHooks } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

/** @returns {value is string} */
function isSourceExportPath(value) {
  try {
    // Intrinsic string branding plus identity rejects boxed strings.
    return String.prototype.valueOf.call(value) === value;
  } catch {
    return false;
  }
}

const root = globalThis.process.cwd();

registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === '@sceneaxi/site-kit') return {url:pathToFileURL(resolve(root,'docs/audits/production-swarm/implementation-expansion-2026-10-02/review-endpoints/site-kit-probe-exports.mjs')).href,shortCircuit:true};

  if (specifier.startsWith('@sceneaxi/')) {
    const [name, ...sub] = specifier.slice('@sceneaxi/'.length).split('/');
    const dir = resolve(root, 'packages', name);
    const pkg = JSON.parse(readFileSync(resolve(dir, 'package.json'), 'utf8'));
    const target = pkg.exports[sub.length ? './' + sub.join('/') : '.'];

    if (isSourceExportPath(target)) return {url:pathToFileURL(resolve(dir,target)).href, shortCircuit:true};
  }

  if (specifier.startsWith('.') && specifier.endsWith('.js') && context.parentURL?.startsWith('file:')) {
    const target = resolve(dirname(fileURLToPath(context.parentURL)), specifier.slice(0,-3)+'.ts');

    if (existsSync(target)) return {url:pathToFileURL(target).href,shortCircuit:true};
  }

  return nextResolve(specifier,context);
}});

const load = p => import(pathToFileURL(resolve(root,p)).href);

const { verifyLoginRequestOrigin } = await load('sites/umbrella/src/lib/login-flow.ts');

const { createOwnSessionHandler } = await load('sites/umbrella/src/provider/own-session.ts');

const { createCatalogServerIdentityPlane } = await load('packages/site-kit/src/catalog-server-fetch.ts');

const origin = 'https://umbrella.example.invalid';

const principal = {user:{userId:'user',email:'user@example.invalid',emailVerified:true,disabled:false},role:'user',session:{sessionId:'session',userId:'user',surface:'site',issuedAt:'2026-01-01T00:00:00.000Z',expiresAt:'2099-01-01T00:00:00.000Z'}};

const results = [];

for (const raw of [origin+'/path',origin+'?query=x',origin+'#fragment','https://user:pass@umbrella.example.invalid',' '+origin+' ']) {
 let calls=0;

 const handler=createOwnSessionHandler({verifyFormOrigin:signals=>verifyLoginRequestOrigin({NEXT_PUBLIC_SCENEAXI_UMBRELLA_ORIGIN:raw},signals),plane:()=>({identity:{resolvePrincipal:async()=>{calls++;

 return {ok:true,value:principal};}}})});

 const response=await handler(new globalThis.Request(origin+'/api/auth/own-session',{headers:{origin,'x-sceneaxi-session':'session.secret'}}));
 results.push({predicate:'raw configured origin refuses before principal read',raw,status:response.status,principalReads:calls,expectedStatus:403,pass:response.status===403&&calls===0});
}

let getters=0,net=0;

const plane=createCatalogServerIdentityPlane({approved:true,configuredOrigin:origin,transport:async()=>{net++;

return new globalThis.Response('{}');}});

let result;

try { result=await plane.identity.resolvePrincipal({surface:'site',get sessionToken(){getters++;

 return 'session.secret';}}); } catch(e) { result={thrown:e.name}; }

results.push({predicate:'actual catalog composition refuses accessor without evaluating getter',getters,networkCalls:net,result,pass:getters===0});

globalThis.console.log(JSON.stringify({results},null,2));

globalThis.process.exitCode=results.every(r=>r.pass)?0:1;
