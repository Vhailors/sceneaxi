#!/usr/bin/env node
import {createRequire,registerHooks} from 'node:module';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';

export const out=dirname(fileURLToPath(import.meta.url));

export const root=resolve(out,'../../../../..');

const ts=createRequire(root+'/package.json')('typescript');

export const hashes={};

export const sha=b=>createHash('sha256').update(b).digest('hex');

registerHooks({resolve(spec,ctx,next){try{return next(spec,ctx)}catch(e){if(spec.endsWith('.js')&&ctx.parentURL?.startsWith('file:')){const u=new URL(spec.slice(0,-3)+'.ts',ctx.parentURL);

if(existsSync(u))return {url:u.href,shortCircuit:true};}

throw e;}},load(url,ctx,next){if(url.startsWith('file:')&&url.endsWith('.ts')){const text=readFileSync(new URL(url),'utf8');hashes[fileURLToPath(url).replace(root+'/','')]=sha(text);

return {format:'module',source:ts.transpileModule(text,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText,shortCircuit:true};}

return next(url,ctx);}});

export const desktop=await import(pathToFileURL(root+'/apps/desktop-shell/src/chrome.ts'));

export const model=await import(pathToFileURL(root+'/apps/desktop-shell/src/visual-model.ts'));

export const web=await import(pathToFileURL(root+'/apps/web-shell/src/inspector-app.ts'));

export function desktopHtml(width=1280,height=900,overlay='none'){return desktop.renderDesktopChrome(model.desktopVisualView(model.createDesktopVisualState({window:{width,height},profile:'game',overlay})));}

if(process.argv[1]===fileURLToPath(import.meta.url)){
 const html=desktopHtml();const inspector=web.inspectorPageHtml(root);
 const input={method:'POST',url:'/api/propose',body:JSON.stringify({documentPath:'../keyboard-ux-outside.json',jsonPointer:'/data/x',newValue:42})};
 const response=web.createInspectorApp({projectRoot:root}).handle(input);
 assert.equal(JSON.parse(response.body).ok,false);assert.match(response.body,/document-outside-project-root/);
 let caught=false;

try{assert.equal(JSON.parse(response.body).ok,true);}catch{caught=true;}

assert.ok(caught);
 writeFileSync(out+'/desktop-source.html',html);writeFileSync(out+'/inspector-source.html',inspector);
 const receipt={subject:'current TypeScript source transpiled in memory; no dist, no browser, no typecheck',compiler:ts.version,sourceHashes:hashes,htmlHashes:{desktop:sha(html),inspector:sha(inspector)},input,response,negativeControl:'deliberately require ok:true for actual refused request: assertion rejected'};
 writeFileSync(out+'/source-receipt.json',JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify({status:'PASS',response,sourceFiles:Object.keys(hashes).length}));
}
