#!/usr/bin/env node
// DEFERRED: run only after serial integration, owned configured loopback fixture service,
// fresh source-bound site build, and authenticated fixture session (no real credential).
import assert from 'node:assert/strict';

const [base,token]=process.argv.slice(2);

const url=new URL(base);

 assert.ok(['127.0.0.1','localhost','[::1]'].includes(url.hostname));

assert.equal(url.protocol,'http:');

 assert.ok(token && token.startsWith('fixture-'),'fixture credentials only');

const endpoint=new URL('/api/auth/catalog-session',base);

for(const [name,headers,status] of [
 ['missing-origin',{'x-sceneaxi-session':token},403],
 ['hostile-origin',{origin:'https://hostile.invalid','x-sceneaxi-session':token},403],
 ['no-implicit-cookie',{origin:url.origin,cookie:'sceneaxi.session='+token},401],
 ['authenticated-own-user',{origin:url.origin,'x-sceneaxi-session':token},200]
]) {
 const response=await fetch(endpoint,{headers,redirect:'error',credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(5000)});
 const body=await response.json();
 console.log(JSON.stringify({name,input:{url:endpoint.href,headers},status:response.status,headers:Object.fromEntries(response.headers),body}));
 assert.equal(response.status,status,name); assert.equal(response.headers.get('cache-control'),'private, no-store');
 assert.equal(response.headers.get('set-cookie'),null); assert.equal(response.headers.get('access-control-allow-origin'),null);
 assert.equal(body.version,1);

 if(status===200) {assert.equal(body.result.ok,true);assert.equal(body.result.value.user.userId,'fixture-own-user');assert.equal(body.result.value.session.userId,'fixture-own-user');}
}
