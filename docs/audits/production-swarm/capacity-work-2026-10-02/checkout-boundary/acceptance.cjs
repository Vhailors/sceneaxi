#!/usr/bin/env node
'use strict';
// Source-only loader: no dist, generated files, providers, sockets, env reads or product writes.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '../../../../..');
const req = createRequire(path.join(root, 'package.json'));
const ts = req('typescript');
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const target = 'sites/umbrella/src/app/api/checkout/checkout-handler.ts';
const modules = new Map(), fingerprints = {};
const proposal = process.argv.includes('--proposal');
const negative = process.argv.includes('--negative-control');
function load(file) {
  file = path.resolve(file);
  if (modules.has(file)) return modules.get(file).exports;
  let source = fs.readFileSync(file, 'utf8');
  fingerprints[path.relative(root, file)] = sha(source);
  if (proposal && file === path.join(root, target)) {
    const old = fs.readFileSync(path.join(__dirname, 'reader-before.txt'), 'utf8').trimEnd();
    const next = fs.readFileSync(path.join(__dirname, 'reader-proposal.txt'), 'utf8').trimEnd();
    assert.equal(source.split(old).length, 2, 'proposal must match exactly once');
    source = source.replace(old, next);
    fingerprints['AUXILIARY_IN_MEMORY_PROPOSAL'] = sha(source);
  }
  if (negative && file === path.join(root, target)) { assert.equal(source.split('if (!requestOrigin.ok)').length,2); source=source.replace('if (!requestOrigin.ok)', 'if (false)'); fingerprints.NEGATIVE_CONTROL_MUTANT=sha(source); }
  const mod = { exports: {} }; modules.set(file, mod);
  const localRequire = spec => {
    let resolved;
    if (spec.startsWith('@sceneaxi/')) {
      const [name, ...sub] = spec.slice('@sceneaxi/'.length).split('/');
      const dir = path.join(root, 'packages', name);
      const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
      let exp = manifest.exports[sub.length ? './' + sub.join('/') : '.'];
      if (typeof exp !== 'string') exp = exp.import || exp.default || exp.types;
      resolved = path.resolve(dir, exp);
    } else if (spec.startsWith('.')) {
      resolved = path.resolve(path.dirname(file), spec);
      if (!fs.existsSync(resolved)) resolved = resolved.replace(/\.js$/, '.ts');
    } else return createRequire(file)(spec);
    return /\.tsx?$/.test(resolved) ? load(resolved) : createRequire(file)(resolved);
  };
  const code = ts.transpileModule(source, { fileName: file, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInThisContext('(function(require,module,exports){' + code + '\n})', { filename: file })(localRequire, mod, mod.exports);
  return mod.exports;
}
const { createCheckoutHandler } = load(path.join(root, target));
const route = fs.readFileSync(path.join(root, 'sites/umbrella/src/app/api/checkout/route.ts'), 'utf8');
fingerprints['sites/umbrella/src/app/api/checkout/route.ts'] = sha(route);
assert.match(route, /return checkout\(request\)/);
assert.match(route, /createCheckoutHandler\(/);
const valid = 'packId=starter-100&attempt=fixture_attempt_123456';
const rows = [];
const delay = ms => new Promise(r => setTimeout(r, ms));
function fixture(result = { ok: true, value: { intentId: 'fixture-intent', redirectUrl: 'https://checkout.fixture.test/session', mode: 'test' } }, principal = { ok: true, value: { user: { userId: 'verified-user' } } }, env = { NEXT_PUBLIC_SCENEAXI_UMBRELLA_ORIGIN: 'https://fixture.test' }) {
  const calls = { session: 0, plane: 0, principal: 0, checkout: [], tokens: [] };
  const handler = createCheckoutHandler({
    environment: () => env,
    readRequestSignals: r => ({ formOrigin: { requestUrl: r.url, origin: r.headers.get('origin'), fetchSite: r.headers.get('sec-fetch-site') } }),
    readSessionToken: async () => { calls.session++; return 'fixture-session'; },
    plane: token => { calls.plane++; calls.tokens.push(token); return { wired: { billing: true }, identity: { resolvePrincipal: async input => { calls.principal++; assert.deepEqual(input, {surface:'site',sessionToken:'fixture-session'}); return principal; } }, billing: { createCheckout: async input => { calls.checkout.push(input); return result; } } }; },
    log: () => {}, json: (data, init) => Response.json(data, init), redirect: (url, status) => Response.redirect(url, status),
  });
  return { handler, calls };
}
function request(body = valid, overrides = {}) {
  const headers = new Headers({origin:'https://fixture.test',host:'alias.test',accept:'application/json','content-type':'application/x-www-form-urlencoded'});
  for (const [k,v] of Object.entries(overrides.headers || {})) v === null ? headers.delete(k) : headers.set(k,v);
  return new Request(overrides.url || 'https://fixture.test/api/checkout', {method:'POST',body,headers,duplex:'half', ...(overrides.signal ? {signal:overrides.signal} : {})});
}
async function responseData(r) {return {status:r.status,headers:Object.fromEntries(r.headers),body:r.headers.get('content-type')?.includes('application/json') ? await r.json() : null};}
async function probe(id, input, fn) {
  try { const observed = await fn(); rows.push({id,input,status:'PASS',observed}); }
  catch (e) { rows.push({id,input,status:'FAIL',error:e.message}); }
}
async function expectRefusal(h,r,status,reason) {
  const out = await responseData(await h.handler(r));
  assert.equal(out.status,status); assert.equal(out.body.reason,reason);
  assert.equal(h.calls.session,0); assert.equal(h.calls.plane,0);
  return {...out,calls:h.calls};
}
(async () => {
  for (const origin of [null,'https://evil.test','https://alias.test','null']) await probe('origin-before-body:'+origin,{origin,body:'GETTER_TRAP'}, async () => {
    const h=fixture(),r=request(valid,{headers:{origin}});let reads=0;
    Object.defineProperty(r,'body',{get(){reads++;throw Error('body trap');}});
    const out=await expectRefusal(h,r,403,'SITE_REQUEST_CROSS_ORIGIN');assert.equal(reads,0);return {...out,bodyGetterReads:reads};
  });
  await probe('malformed-config-before-body',{configuredOrigin:'not-a-url'},async()=>expectRefusal(fixture(undefined,undefined,{NEXT_PUBLIC_SCENEAXI_UMBRELLA_ORIGIN:'not-a-url'}),request(),403,'SITE_REQUEST_CROSS_ORIGIN'));
  for (const [name,body,type] of [
    ['json','{}','application/json'],['malformed-json','{"','application/json'],
    ['multipart-truncated','bad','multipart/form-data; boundary=missing'],
    ['multipart-no-boundary','bad','multipart/form-data'],
    ['duplicate-attempt',valid+'&attempt=duplicate','application/x-www-form-urlencoded'],
    ['duplicate-pack',valid+'&packId=starter-100','application/x-www-form-urlencoded'],
    ['forged-user',valid+'&userId=other-user','application/x-www-form-urlencoded'],
    ['missing-attempt','packId=starter-100','application/x-www-form-urlencoded'],
    ['oversize',valid+' '.repeat(8193-Buffer.byteLength(valid)),'application/x-www-form-urlencoded']
  ]) await probe(name,{body,bodyBytes:Buffer.byteLength(body),contentType:type},async()=>expectRefusal(fixture(),request(body,{headers:{'content-type':type}}),400,'BILLING_CHECKOUT_REQUEST_INVALID'));
  for(const [name,body] of [['valid',valid],['exact-8192',valid+' '.repeat(8192-Buffer.byteLength(valid))]]) await probe(name,{body,bodyBytes:Buffer.byteLength(body)},async()=>{
    const h=fixture(),out=await responseData(await h.handler(request(body)));assert.equal(out.status,303);assert.equal(out.headers.location,'https://checkout.fixture.test/session');
    assert.deepEqual(h.calls.tokens,['fixture-session']);assert.equal(h.calls.checkout[0].userId,'verified-user');assert.equal(h.calls.checkout[0].successUrl,'https://fixture.test/account?checkout=success');assert.equal(h.calls.checkout[0].cancelUrl,'https://fixture.test/pricing?checkout=cancelled');return {...out,calls:h.calls};
  });
  await probe('multipart-valid',{packId:'starter-100',attempt:'fixture_attempt_123456'},async()=>{
    const form=new FormData();form.set('packId','starter-100');form.set('attempt','fixture_attempt_123456');const r=request(form);r.headers.delete('content-type');
    // Request auto-header is generated only when no overriding content-type is supplied.
    const actual=new Request(r.url,{method:'POST',headers:{origin:'https://fixture.test',accept:'application/json'},body:form});
    const h=fixture(),out=await responseData(await h.handler(actual));assert.equal(out.status,303);return {...out,calls:h.calls};
  });
  await probe('alias-request-url',{url:'https://alias.test/api/checkout',origin:'https://fixture.test',host:'alias.test'},async()=>{const h=fixture(),out=await responseData(await h.handler(request(valid,{url:'https://alias.test/api/checkout'})));assert.equal(out.status,402);assert.equal(out.body.reason,'BILLING_CHECKOUT_ORIGIN_UNTRUSTED');assert.equal(h.calls.checkout.length,0);assert.equal(h.calls.principal,0);return {...out,calls:h.calls};});
  for(const accept of ['application/json','text/html']) await probe('rate-limit:'+accept,{body:valid,accept,billingReason:'BILLING_CHECKOUT_RATE_LIMITED'},async()=>{
    const h=fixture({ok:false,reason:'BILLING_CHECKOUT_RATE_LIMITED',message:'Budget reached.'}),out=await responseData(await h.handler(request(valid,{headers:{accept}})));
    if(accept==='application/json'){assert.equal(out.status,429);assert.equal(out.headers['retry-after'],'300');assert.equal(out.body.reason,'BILLING_CHECKOUT_RATE_LIMITED');}
    else {assert.equal(out.status,303);assert.equal(out.headers.location,'/pricing?reason=BILLING_CHECKOUT_RATE_LIMITED');}
    return {...out,calls:h.calls};
  });
  await probe('negative-control-same-origin-trap',{origin:'https://fixture.test',body:'GETTER_TRAP'},async()=>{
    const h=fixture(),r=request();let reads=0;Object.defineProperty(r,'body',{get(){reads++;throw Error('live trap');}});const out=await expectRefusal(h,r,400,'BILLING_CHECKOUT_REQUEST_INVALID');assert.equal(reads,1);return {...out,bodyGetterReads:reads};
  });
  await probe('oversize-cancels',{bytes:8193},async()=>{
    let cancels=0;const stream=new ReadableStream({start(c){c.enqueue(new Uint8Array(8193));},cancel(){cancels++;}});
    const out=await expectRefusal(fixture(),request(stream),400,'BILLING_CHECKOUT_REQUEST_INVALID');assert.equal(cancels,1);assert.equal(stream.locked,false);return {...out,cancels,locked:stream.locked};
  });
  await probe('request-abort-cancels-stalled-reader',{abortAfterMs:10,observeAfterMs:100},async()=>{
    let controller,cancels=0;const abort=new AbortController();const stream=new ReadableStream({start(c){controller=c;},cancel(){cancels++;}});const h=fixture();let settled=false;
    const pending=h.handler(request(stream,{signal:abort.signal})).then(async r=>{settled=true;return responseData(r);});await delay(10);abort.abort();await delay(100);
    const observed={settledAfterAbort:settled,cancels,locked:stream.locked};if(!settled)controller.error(Error('auxiliary cleanup'));const out=await pending;
    rows.push({id:'request-abort-observation',input:{abort:true},status:'OBSERVED',observed:{...observed,...out}});
    assert.equal(observed.settledAfterAbort,true,'request abort did not terminate reader within 100ms');assert.equal(cancels,1);return observed;
  });
  await probe('body-deadline',{stalledStream:true,observeMs:proposal?5200:100},async()=>{
    let controller,cancels=0;const stream=new ReadableStream({start(c){controller=c;},cancel(){cancels++;}});const h=fixture();let settled=false;
    const pending=h.handler(request(stream)).then(async r=>{settled=true;return responseData(r);});await delay(proposal?5200:100);const observed={settled,cancels,locked:stream.locked};if(!settled)controller.error(Error('auxiliary cleanup'));const out=await pending;
    rows.push({id:'body-deadline-observation',input:{stalledStream:true},status:'OBSERVED',observed:{...observed,...out}});
    assert.equal(observed.settled,true,'no bounded reader deadline observed; source contains no timer');return {...observed,...out};
  });
  await probe('nonsettling-cancel-does-not-hold-refusal',{bytes:8193,cancel:'deferred-promise',observeMs:100},async()=>{
    let release;const stream=new ReadableStream({start(c){c.enqueue(new Uint8Array(8193));},cancel(){return new Promise(r=>{release=r;});}});const h=fixture();let settled=false;
    const pending=h.handler(request(stream)).then(async r=>{settled=true;return responseData(r);});await delay(100);const observed={settled,locked:stream.locked};release();const out=await pending;
    rows.push({id:'cancel-observation',input:{bytes:8193,cancel:'deferred-promise'},status:'OBSERVED',observed:{...observed,...out}});assert.equal(observed.settled,true,'await reader.cancel holds oversize refusal');return {...observed,...out};
  });
  for(const [file,hash] of Object.entries(fingerprints)) if(file!=='AUXILIARY_IN_MEMORY_PROPOSAL' && file!=='NEGATIVE_CONTROL_MUTANT') assert.equal(sha(fs.readFileSync(path.join(root,file),'utf8')),hash,'subject changed during run: '+file);
  for(const row of rows) row.inputSha256=sha(JSON.stringify(row.input));
  const result={taskid:'checkout-boundary',subject:proposal?'source with auxiliary in-memory reader proposal NOT LANDED':'exact current source',node:process.version,typescript:ts.version,fingerprints,loadedModules:modules.size,rows,totals:{pass:rows.filter(r=>r.status==='PASS').length,fail:rows.filter(r=>r.status==='FAIL').length},cleanup:'all deferred readers errored/cancelled and cancel promises released; no files outside owned directory, no ports/providers'};
  fs.writeFileSync(path.join(__dirname,negative?'negative-control-evidence.json':proposal?'proposal-evidence.json':'evidence.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({subject:result.subject,totals:result.totals,failures:rows.filter(r=>r.status==='FAIL')},null,2));process.exitCode=result.totals.fail?1:0;
})().catch(e=>{console.error(e);process.exitCode=2;});
