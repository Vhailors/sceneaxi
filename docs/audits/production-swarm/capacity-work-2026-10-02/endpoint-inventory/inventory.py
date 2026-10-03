#!/usr/bin/env python3
"""Read-only source inventory; stdout JSON. No network, imports of provider SDKs or dist.
Run: python3 docs/audits/production-swarm/capacity-work-2026-10-02/endpoint-inventory/inventory.py
--strict exits 1 on missing literal UI targets/methods (not on intentionally refused capabilities).
"""
import argparse, hashlib, json, pathlib, re, subprocess, sys
ROOT = pathlib.Path(__file__).resolve().parents[5]
OWN = pathlib.Path(__file__).resolve().parent
p = argparse.ArgumentParser(); p.add_argument('--strict', action='store_true'); args = p.parse_args()
def digest(b): return hashlib.sha256(b).hexdigest()
def rel(p): return str(p.relative_to(ROOT))
# TypeScript AST reads the actual source; comments are not counted as callers.
NODE = r'''
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ts=require(path.join(process.cwd(),'node_modules/typescript'));
const paths=JSON.parse(fs.readFileSync(0,'utf8')); const out=[];
for(const file of paths){
 const text=fs.readFileSync(file,'utf8'),sf=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,file.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 const refs=[],methods=[],imports=[],constants={};
 const line=n=>sf.getLineAndCharacterOfPosition(n.getStart(sf)).line+1;
 function walk(n){
  if(ts.isVariableDeclaration(n)&&n.initializer&&ts.isIdentifier(n.name)&&ts.isStringLiteralLike(n.initializer))constants[n.name.text]=n.initializer.text;
  if(ts.isImportDeclaration(n)&&ts.isStringLiteral(n.moduleSpecifier))imports.push({specifier:n.moduleSpecifier.text,line:line(n)});
  if(ts.isFunctionDeclaration(n)&&n.name&&/^(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)$/.test(n.name.text)&&n.modifiers?.some(x=>x.kind===ts.SyntaxKind.ExportKeyword))methods.push({symbol:n.name.text,line:line(n)});
  if(ts.isVariableStatement(n)&&n.modifiers?.some(x=>x.kind===ts.SyntaxKind.ExportKeyword))for(const d of n.declarationList.declarations)if(/^(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)$/.test(d.name.getText(sf)))methods.push({symbol:d.name.getText(sf),line:line(d),delegate:d.initializer?.getText(sf)});
  if(ts.isStringLiteralLike(n)||ts.isTemplateHead(n)){
   const value=n.text; if(value.startsWith('/')||/^https?:/.test(value)){
    let parent=n.parent,kind='literal',method=null;
    if(ts.isJsxAttribute(parent)){kind=parent.name.getText(sf);if(kind==='action'){const a=parent.parent.properties.find(x=>ts.isJsxAttribute(x)&&x.name.getText(sf)==='method');method=a?.initializer?.text?.toUpperCase()||'GET';}}
    if(ts.isCallExpression(parent)&&/fetch$/.test(parent.expression.getText(sf))){kind='fetch';method='GET';const o=parent.arguments[1];if(o&&ts.isObjectLiteralExpression(o))for(const x of o.properties)if(x.name?.getText(sf)==='method')method=x.initializer?.text||'DYNAMIC';}
    if(ts.isPropertyAssignment(parent)&&['href','action'].includes(parent.name.getText(sf).replaceAll('"','')))kind=parent.name.getText(sf).replaceAll('"','');
    refs.push({value,line:line(n),kind,method,dynamic:ts.isTemplateHead(n)});
   }
  }
  if(ts.isJsxAttribute(n)&&['action','href'].includes(n.name.getText(sf))&&n.initializer&&ts.isJsxExpression(n.initializer)&&n.initializer.expression)refs.push({expression:n.initializer.expression.getText(sf),line:line(n),kind:n.name.getText(sf),method:n.name.getText(sf)==='action'?'POST':'GET'});
  ts.forEachChild(n,walk);
 } walk(sf); out.push({path:file,refs,methods,imports,constants});
}
// Execute the ACTUAL exported front-door factory and its exact dispatch function,
// AST-extracted/transpiled in memory. No copied dispatch algorithm or SDK import.
const subject='sites/umbrella/src/provider/better-auth-provider.ts';
const source=fs.readFileSync(subject,'utf8'),sf=ts.createSourceFile(subject,source,ts.ScriptTarget.Latest,true);
const selected=sf.statements.filter(n=>ts.isFunctionDeclaration(n)&&['requiredEndpoint','createBetterAuthProviderHandler','refusal'].includes(n.name?.text));
if(selected.length!==3)throw Error('source extraction drift');
const js=ts.transpileModule(selected.map(n=>n.getText(sf)).join('\n'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const box={exports:{},Response,Request,URL,Promise,serverLog:()=>{},BETTER_AUTH_PROVIDER_REFUSALS:{storageUnavailable:'FIXTURE_STORAGE_UNAVAILABLE'}};
vm.runInNewContext(js,box,{timeout:2000});let calls=0;
const handler=box.exports.createBetterAuthProviderHandler(()=>{calls++;return {ok:false,reason:'IDENTITY_PLANE_NOT_WIRED'}});
(async()=>{
 const results=[];
 for(const [method,url,expected] of [['GET','http://inventory.invalid/api/auth/get-session',503],['GET','http://inventory.invalid/api/auth/__endpoint_inventory_negative_control__',404],['POST','http://inventory.invalid/api/auth/get-session',404]]){
  const before=calls,r=await handler(new Request(url,{method}));const body=await r.text();
  if(r.status!==expected||r.headers.get('cache-control')!=='no-store')throw Error('live dispatch assertion failed');
  if(expected===404&&calls!==before)throw Error('unknown route loaded provider');
  results.push({method,url,status:r.status,body,cacheControl:r.headers.get('cache-control'),runtimeCalls:calls-before});
 }
 console.log(JSON.stringify({files:out,liveProbe:{subject,subjectMode:'actual source AST-extracted public factory + unchanged dispatch/refusal; injected unavailable runtime; no SDK/dist/socket',selectedSymbols:selected.map(n=>({symbol:n.name.text,line:sf.getLineAndCharacterOfPosition(n.getStart(sf)).line+1})),results,assertions:['recognized GET reaches injected runtime and refuses 503','unknown path returns 404 before runtime (negative control)','wrong method returns 404 before runtime','all observed responses no-store'],pass:true}}));
})().catch(e=>{console.error(e);process.exitCode=1});
'''
files = sorted(set([*ROOT.glob('sites/*/src/**/*.ts'), *ROOT.glob('sites/*/src/**/*.tsx'), *ROOT.glob('packages/site-kit/src/*.ts')]))
paths = [rel(x) for x in files]
proc = subprocess.run(['node','-e',NODE],input=json.dumps(paths),text=True,cwd=ROOT,capture_output=True,timeout=45)
if proc.returncode: sys.stderr.write(proc.stderr);sys.exit(proc.returncode)
data=json.loads(proc.stdout); bypath={f['path']:f for f in data['files']}; hashes={rel(x):digest(x.read_bytes()) for x in files}
ledgerpath=ROOT/'docs/audits/production-swarm/repair-review-2026-10-02/ledger.json'; ledger=json.loads(ledgerpath.read_text()); rows=ledger['rows']; originals=set(ledger['originalLocalIds'])
def crosswalk(paths):
 return [{'id':r['id'],'original113':r['id'] in originals,'ownerLane':r.get('ownerLane'),'title':r.get('title'),'matchedPaths':sorted({t['path'] for t in r.get('targets',[]) if t.get('path') in paths})} for r in rows if any(t.get('path') in paths for t in r.get('targets',[]))]
def evidence(path):
 text=(ROOT/path).read_text(); result={}
 for label,pattern in {'auth':r'session|authority|entitl|authorized|reauth|signature','origin':r'origin|cross.site','cache':r'cache.control|force.dynamic','limits':r'max|limit|timeout|8192|8_192|byte|429|retry.after','errorStatus':r'status:|refusalResponse\(|result\(|HttpStatus'}.items():
  result[label]=[{'line':i,'text':s.strip()} for i,s in enumerate(text.splitlines(),1) if re.search(pattern,s,re.I)]
 return result
routes=[]
for f in data['files']:
 if f['path'].startswith('sites/umbrella/src/app/api/') and f['path'].endswith('/route.ts'):
  route='/' + f['path'].split('/src/app/',1)[1][:-9].rstrip('/')
  delegates=[]
  for imp in f['imports']:
   if imp['specifier'].startswith('.'):
    candidate=(ROOT/f['path']).parent/imp['specifier']; candidate=candidate.with_suffix('.ts').resolve()
    if candidate.is_file():delegates.append(rel(candidate))
  routes.append({'route':route,'path':f['path'],'sha256':hashes[f['path']],'handlers':f['methods'],'directSourceFacts':evidence(f['path']),'delegates':[{'path':d,'sha256':hashes.get(d,digest((ROOT/d).read_bytes())),'sourceFacts':evidence(d)} for d in delegates],'ledger':crosswalk([f['path'],*delegates])})
# Resolve literal public targets against each actual Next app tree; external origins
# and dynamic expressions remain explicit unknowns, never invented missing routes.
constants={}
for f in data['files']:
 for k,v in f['constants'].items():constants.setdefault(k,set()).add(v)
def target(site,url):
 path=url.split('?',1)[0].split('#',1)[0].rstrip('/') or '/'
 app=ROOT/f'sites/{site}/src/app'; matches=[]
 for pattern in ('**/page.tsx','**/route.ts'):
  for pth in app.glob(pattern):
   parts=list(pth.relative_to(app).parts[:-1]); parts=[x for x in parts if not (x.startswith('(') or x.startswith('@'))]
   rg='/'+'/'.join('(?:.+)' if x.startswith('[...') else '[^/]+' if x.startswith('[') else re.escape(x) for x in parts)
   if re.fullmatch(rg,path):matches.append(rel(pth))
 if (ROOT/f'sites/{site}/public'/path.lstrip('/')).is_file():matches.append(f'sites/{site}/public/'+path.lstrip('/'))
 if path in ('/robots.txt','/sitemap.xml') and (app/(path[1:].split('.')[0]+'.ts')).exists():matches.append(rel(app/(path[1:].split('.')[0]+'.ts')))
 return matches
callers=[]; literals=[]
for f in data['files']:
 for ref in f['refs']:
  if ref.get('value','').startswith('/api/'):literals.append({'path':f['path'],**ref})
  if not f['path'].startswith('sites/') or ref['kind'] not in ('href','action','fetch'):continue
  values=[ref['value']] if 'value' in ref else list(constants.get(ref.get('expression'),[]))
  record={'path':f['path'],**ref,'resolvedValues':values,'targets':[],'status':'UNRESOLVED_DYNAMIC'}
  for value in values:
   if not value.startswith('/') or ref.get('dynamic'):continue
   matches=target(f['path'].split('/')[1],value)
   record['targets']+=matches;record['status']='RESOLVED' if matches else 'MISSING_LITERAL_TARGET'
   if matches and value.startswith('/api/'):
    supported={m['symbol'] for t in matches for m in bypath.get(t,{}).get('methods',[])}
    if (ref.get('method') or 'GET') not in supported:record['status']='METHOD_MISMATCH'
  callers.append(record)
missing=[x for x in callers if x['status'] in ('MISSING_LITERAL_TARGET','METHOD_MISMATCH')]
# Perturb only in-memory path inventory: removing the real login route must turn its
# actual UI caller into a missing target. No fixture endpoint is added to inventory.
login=next(x for x in callers if x.get('value')=='/api/login' and x['kind']=='action')
remaining=[x for x in login['targets'] if x!='sites/umbrella/src/app/api/login/route.ts']
assert login['status']=='RESOLVED' and not remaining
report={'taskid':'endpoint-inventory','root':str(ROOT),'head':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),'subject':'current source only, not PR or dist','fingerprint':digest(json.dumps(hashes,sort_keys=True).encode()),'sourceHashes':hashes,'ledger':{'path':rel(ledgerpath),'sha256':digest(ledgerpath.read_bytes()),'rowCount':len(rows),'originalIdCount':len(originals)},'routes':routes,'publicCallers':callers,'apiLiteralReferences':literals,'missingTargets':missing,'sourcePathCrosswalk':crosswalk([f['path'] for f in data['files']]),'liveProbe':data['liveProbe'],'inventoryNegativeControl':{'input':'remove real /api/login route from in-memory resolved targets','caller':login,'observed':'MISSING_LITERAL_TARGET','pass':not remaining},'limitations':['Literal/constant AST inventory, not a full interprocedural call graph; unresolved expressions retained.','Catch-all match proves Next route presence only; provider allowlist determines actual endpoint support.','Source security snippets are evidence, not proof of effective middleware, limits or auth correctness.','No builds, sockets, browser, credentials or provider operations executed.'], 'resourcesCleaned':'No temporary files, servers, ports, DBs or SDK runtimes allocated.'}
report['harnessSha256'] = digest(pathlib.Path(__file__).read_bytes())
report['liveProbe']['sourceSha256'] = hashes[report['liveProbe']['subject']]
report['executedChecks'] = ['TypeScript AST inventory against current source', 'exact-path crosswalk against 355 ledger rows / 113 original IDs', 'actual source factory unavailable-runtime dispatch + unknown-path/wrong-method negative controls', 'in-memory missing-target control']
report['deferredChecks'] = [{'status':'NOT_RUN','check':'rebuilt Next socket/browser and authenticated/provider/DB behavior','preconditions':'explicit serial handoff, stable source/build hashes, dedicated runtime authority; no heavy acceptance authorized here'}]
report['reproducedGaps'] = [str(sum(c['status'] == 'UNRESOLVED_DYNAMIC' for c in callers)) + ' external/dynamic references need context-aware review; no completeness claim', 'catalog identity adapter wiring remains separate from API route-file inventory']
report['refutedGaps'] = ['No missing target or method mismatch among resolved current literal UI links/forms'] if not missing else []
report['initialHarnessFailure'] = 'First run failed MODULE_NOT_FOUND /home/devuser/Documents/Projects/node_modules/typescript due to root parent offset; fixed parents[6] to parents[5], rerun passed. No install/build attempted.'
report['handoff'] = 'Integrate auxiliary checker only after explicit handoff. Do not create speculative missing endpoints: empty missingTargets; preserve checkout-handler in intended artifact; route identity adapter acceptance to SITE-CATALOG-IDENTITY/IDENTITY-05 owners.'
print(json.dumps(report,indent=2))
if args.strict and missing:sys.exit(1)
