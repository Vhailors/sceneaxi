#!/usr/bin/env node
'use strict';

/* global module, __dirname */

const fs = module.require('node:fs');

const path = module.require('node:path');

const crypto = module.require('node:crypto');

const {createRequire} = module.require('node:module');

const assert = module.require('node:assert/strict');

/** @returns {value is string} */
function isQueryText(value) {
  try {
    // Intrinsic string branding plus identity rejects boxed strings.
    return String.prototype.valueOf.call(value) === value;
  } catch {
    return false;
  }
}

/** @returns {value is object} */
function isElementContainer(value) {
  if (value === null || Object(value) !== value) return false;

  try {
    // Intrinsic function branding excludes callables without invoking them.
    Function.prototype.toString.call(value);

    return false;
  } catch {
    return true;
  }
}

const out = __dirname;

const root = path.resolve(out, '../../../../..');

const ts = module.require(path.join(root,'node_modules/typescript'));

const hash = x => crypto.createHash('sha256').update(x).digest('hex');

const fingerprints = new Map();

const read = file => { const text=fs.readFileSync(file,'utf8'); fingerprints.set(path.relative(root,file),hash(text));

 return text; };

const packages = new Map(fs.readdirSync(path.join(root,'packages')).map(name => {
  const base=path.join(root,'packages',name); const manifest=JSON.parse(read(path.join(base,'package.json')));

  return [manifest.name,{base,manifest}];
}));

function loader(overrides = new Map()) {
 const cache=new Map();

 function load(file) {
  if(cache.has(file)) return cache.get(file).exports;
  const mod={exports:{}}; cache.set(file,mod);
  const original=read(file); const source=overrides.get(file) ?? original;
  const code=ts.transpileModule(source,{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;

  function req(spec) {
   let target;

   if(spec.startsWith('@sceneaxi/')) {
    const parts=spec.split('/'); const pkg=packages.get(parts.slice(0,2).join('/'));

    if(!pkg) throw Error('Missing source package '+spec);
    const exp=pkg.manifest.exports[parts.length===2?'.':'./'+parts.slice(2).join('/')];
    target=path.resolve(pkg.base,isQueryText(exp)?exp:exp.import ?? exp.default);
   } else if(spec.startsWith('.')) {
    const base=path.resolve(path.dirname(file),spec);
    target=[base.replace(/\.js$/,'.ts'),base.replace(/\.js$/,'.tsx'),base].find(p=>fs.existsSync(p));
   }

   if(target && /\.tsx?$/.test(target)) return load(target);

   return createRequire(file)(spec);
  }

  new Function('require','module','exports','__filename','__dirname',code)(req,mod,mod.exports,file,path.dirname(file));

  return mod.exports;
 }

 return load;
}

const publicFile=path.join(root,'packages/site-kit/src/index.ts');

const catalogFile=path.join(root,'packages/site-kit/src/catalog.ts');

const searchFile=path.join(root,'packages/site-kit/src/site-search-params.ts');

const load=loader();

 const api=load(publicFile);

const rows=[];

 let assertions=0;

function verify(label,action) { try {action(); assertions++;

 return {label,pass:true};}catch(e){return {label,pass:false,error:e.message};} }

const cases=[
 ['missing',{},['lantern-prop','market-stall-kit','odd-price-charm'],['harbour-diorama']],
 ['undefined',{q:undefined,price:undefined,sort:undefined},['lantern-prop','market-stall-kit','odd-price-charm'],['harbour-diorama']],
 ['empty',{q:'',price:'',sort:'inventory'},['lantern-prop','market-stall-kit','odd-price-charm'],['harbour-diorama']],
 ['scalar-title',{q:' LANTERN '},['lantern-prop'],[]],
 ['scalar-id',{q:'market-stall-kit'},['market-stall-kit'],[]],
 ['scalar-creator',{q:'USR_CREATOR_BEN'},['odd-price-charm'],['harbour-diorama']],
 ['filter-credits',{price:'credits'},['lantern-prop'],[]],
 ['filter-money',{price:'money'},[],['harbour-diorama']],
 ['filter-dual',{price:'credits-and-money'},['market-stall-kit','odd-price-charm'],[]],
 ['combined',{price:'credits-and-money',q:'odd'},['odd-price-charm'],[]],
 ['sort-title',{sort:'title'},['lantern-prop','market-stall-kit','odd-price-charm'],['harbour-diorama']],
 ['sort-newest',{sort:'newest'},['odd-price-charm','market-stall-kit','lantern-prop'],['harbour-diorama']],
 ['empty-search',{q:'no-such-catalog-query-proof'},[],[]],
 ['boundary100',{q:'x'.repeat(100)},[],[]],
 ['oversize101',{q:'x'.repeat(101)},null,null],
 ['huge4096',{q:'x'.repeat(4096)},null,null],
 ['readonly-singleton',{q:Object.freeze(['lantern'])},null,null],
 ['readonly-duplicate',{q:Object.freeze(['lantern','market'])},null,null],
 ['readonly-price',{price:Object.freeze(['credits'])},null,null],
 ['readonly-sort',{sort:Object.freeze(['title'])},null,null],
 ['readonly-empty',{q:Object.freeze([])},null,null],
 ['unknown-key',{extra:'x'},null,null],
 ['bad-price',{price:'free'},null,null],
 ['bad-sort',{sort:'random'},null,null],
 ['blank-sort',{sort:''},null,null]
];

function walk(value,found=[]) {if(!isElementContainer(value)) return found;

 if(value.props){found.push(value);walk(value.props.children,found);} else if(Array.isArray(value)) for(const child of value) walk(child,found);

 return found;}

(async()=>{
 for(const [i,surface] of ['catalog-game','catalog-web'].entries()) {
  const pageFile=path.join(root,'sites',surface,'src/app/page.tsx'); const page=load(pageFile).default;
  const baseline=JSON.stringify(api.listSiteCatalog(surface));

  for(const [name,input,...expected] of cases) {
   const before=JSON.stringify(input); const row={surface,name,input,inputSha256:hash(before),expected:expected[i]===null?'CATALOG_BROWSE_QUERY_INVALID':expected[i],assertions:[]};
   let observed;

 try {const result=api.browseSiteCatalog(surface,input); observed={ids:result.map(x=>x.itemId),frozen:Object.isFrozen(result)};}catch(e){observed={refusal:e.message};}

   row.observed=observed;
   row.publicQueryTarget=api.sitePathWithSearchParams('/',input);
   row.assertions.push(verify('public-query-preserves-scalar-and-duplicates',()=>{const url=new globalThis.URL(row.publicQueryTarget,'https://catalog-query.invalid');

for(const [key,value] of Object.entries(input)) assert.deepEqual(url.searchParams.getAll(key),value===undefined?[]:isQueryText(value)?[value]:[...value]);}));
   row.assertions.push(verify('public-helper-exact-result',()=>expected[i]===null?assert.equal(observed.refusal,'CATALOG_BROWSE_QUERY_INVALID'):assert.deepEqual(observed.ids,expected[i])));

   if(expected[i]!==null) row.assertions.push(verify('result-frozen',()=>assert.equal(observed.frozen,true)));
   row.assertions.push(verify('input-and-inventory-not-mutated',()=>{assert.equal(JSON.stringify(input),before);assert.equal(JSON.stringify(api.listSiteCatalog(surface)),baseline);}));
   const tree=await page({searchParams:Promise.resolve(input)}); const nodes=walk(tree);
   const pageObservation={refusal:tree?.props?.reason ?? null,cardIds:nodes.filter(n=>n.props.listing && n.key!==null && !Array.isArray(n.props.children)).map(n=>n.props.listing.itemId),empty:nodes.some(n=>n.props.id==='catalog-empty'),defaults:Object.fromEntries(nodes.filter(n=>['q','price','sort'].includes(n.props.name)).map(n=>[n.props.name,n.props.defaultValue]))};
   row.pageObserved=pageObservation;
   row.assertions.push(verify('real-source-page-refusal-or-controls',()=>{
    if(expected[i]===null) assert.equal(pageObservation.refusal,'CATALOG_BROWSE_QUERY_INVALID');
    else {assert.equal(pageObservation.refusal,null);assert.equal(pageObservation.empty,expected[i].length===0);assert.equal(pageObservation.defaults.q,isQueryText(input.q)?input.q:'');assert.equal(pageObservation.defaults.price,isQueryText(input.price)?input.price:'');assert.equal(pageObservation.defaults.sort,isQueryText(input.sort)?input.sort:'inventory'); assert.deepEqual(pageObservation.cardIds.slice(-expected[i].length||pageObservation.cardIds.length),expected[i]);}
   }));
   rows.push(row);
  }
 }

 const compile=[];

 for(const surface of ['catalog-game','catalog-web']) {
  const file=path.join(root,'sites',surface,'src/app/page.tsx'); const source=read(file); const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const guard=ast.statements.find(s=>ts.isFunctionDeclaration(s)&&s.name?.text==='isSearchText').getText(ast);
  const page=ast.statements.find(s=>ts.isFunctionDeclaration(s)&&s.modifiers?.some(m=>m.kind===ts.SyntaxKind.DefaultKeyword));
  const consumer=`import type {SearchParams} from '${searchFile}';\n${guard}\nasync function consumer(${page.parameters.map(p=>p.getText(ast)).join(', ')}) {const params=await searchParams;const q: string = isSearchText(params.q)?params.q:'';const price: string=isSearchText(params.price)?params.price:'';const sort: string=isSearchText(params.sort)?params.sort:'inventory';return {q,price,sort};}\nconst readonlyParams={q:['a','b'],price:['credits'],sort:['title']} as const satisfies SearchParams;void consumer({searchParams:Promise.resolve(readonlyParams)});void consumer({searchParams:Promise.resolve({q:'a'})});void consumer({searchParams:Promise.resolve({})});\n`;
  const virtual=path.join(out,surface+'-consumer.ts');

  function diagnostics(text){const options={noEmit:true,strict:true,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler,types:[],skipLibCheck:false};const host=ts.createCompilerHost(options);const orig=host.getSourceFile.bind(host);host.getSourceFile=(f,v,...rest)=>f===virtual?ts.createSourceFile(f,text,v,true):orig(f,v,...rest);

return ts.getPreEmitDiagnostics(ts.createProgram([virtual],options,host)).map(d=>({code:d.code,message:ts.flattenDiagnosticMessageText(d.messageText,'\n')}));}

  const actual=diagnostics(consumer);const negative=diagnostics(consumer.replace('value: SearchParams[string]','value: string | string[] | undefined'));
  compile.push({surface,subject:'exact AST guard + page parameter declaration; not whole-page typecheck',consumer,consumerSha256:hash(consumer),diagnostics:actual,negativeControl:{mutation:'restore mutable array guard parameter',diagnostics:negative,pass:negative.filter(x=>x.code===2345).length===3},pass:actual.length===0});
 }

 const mutated=loader(new Map([[catalogFile,read(catalogFile).replace('params["q"].length > 100','params["q"].length > 100000')]]))(publicFile);
 const negative=verify('mutated-length-refusal-oracle',()=>assert.throws(()=>mutated.browseSiteCatalog('catalog-game',{q:'x'.repeat(101)}),/CATALOG_BROWSE_QUERY_INVALID/));
 const fixtureFile=path.join(root,'packages/schemas/src/catalog-listings.data.ts');const originalFixture=load(fixtureFile).CATALOG_LISTINGS_DATA;
 const fixture={...originalFixture,listings:originalFixture.listings.filter(x=>x.catalog==='game').map((x,i)=>({...x,listingId:['tie-c','tie-b','tie-a'][i],title:'Tie title',publishedAt:'2026-07-23T12:00:00Z'}))};
 const tieApi=loader(new Map([[fixtureFile,'export const CATALOG_LISTINGS_DATA: unknown = '+JSON.stringify(fixture)+';']]))(publicFile);
 const ties=['inventory','title','newest'].map(sort=>({sort,fixture,observed:tieApi.browseSiteCatalog('catalog-game',{sort}).map(x=>x.itemId),assertion:verify('stable '+sort,()=>assert.deepEqual(tieApi.browseSiteCatalog('catalog-game',{sort}).map(x=>x.itemId),sort==='inventory'?['tie-c','tie-b','tie-a']:['tie-a','tie-b','tie-c']))}));
 const sources=[...fingerprints].sort(([a],[b])=>a.localeCompare(b)).map(([file,sha256])=>({file,sha256}));
 const evidence={taskId:'catalog-query',status:rows.every(r=>r.assertions.every(a=>a.pass))&&compile.every(c=>c.pass&&c.negativeControl.pass)&&!negative.pass&&ties.every(t=>t.assertion.pass)?'PASS_SCOPED':'FAIL',actualSubject:'Current source transpiled in memory, public site-kit barrel and default async page exports; actual installed React JSX runtime. No dist or Next HTTP runtime.',typescript:ts.version,sourceFingerprint:hash(JSON.stringify(sources)),sources,rows,compile,negativeControl:{mutation:'in-memory catalog length bound 100 -> 100000',observed:negative,pass:!negative.pass},ties,assertions,heavyAcceptance:'NOT_RUN',resources:'No ports/processes/temporary files; virtual compile consumers only',sourceWrites:false};

 for(const s of sources) assert.equal(hash(fs.readFileSync(path.join(root,s.file))),s.sha256,'source drift '+s.file);
 fs.writeFileSync(path.join(out,'evidence.json'),JSON.stringify(evidence,null,2)+'\n');globalThis.console.log(JSON.stringify({status:evidence.status,cases:rows.length,assertions,compile:compile.map(c=>({surface:c.surface,diagnostics:c.diagnostics,negative:c.negativeControl})),negativeControl:evidence.negativeControl,sourceFingerprint:evidence.sourceFingerprint},null,2));globalThis.process.exitCode=evidence.status==='PASS_SCOPED'?0:1;
})().catch(e=>{globalThis.console.error(e);globalThis.process.exitCode=1;});
