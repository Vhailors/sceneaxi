import assert from "node:assert/strict";
import process from 'node:process';
import {Buffer} from 'node:buffer';
import console from 'node:console';

// Browser globals and the bundled BYO installer are resolved inside Playwright's page realm.
/* global document, HTMLElement, getComputedStyle, innerWidth, innerHeight, Byo */
import {createRequire, registerHooks} from 'node:module';
import {execFileSync} from 'node:child_process';
import {mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

// Shared by real Tab observations and the lightweight permanent hostile oracle.
export function assertKeyboardGeometry(sample, label = 'keyboard target') {
  assert.ok(sample && sample.rect && Number.isFinite(sample.rect.x) && Number.isFinite(sample.rect.y) && Number.isFinite(sample.rect.width) &&
    Number.isFinite(sample.rect.height) && sample.rect.x >= 0 && sample.rect.y >= 0 && sample.rect.width > 0 && sample.rect.height > 0 &&
    sample.inViewport === true && sample.occluded === false && sample.clipped === false && sample.visible === true &&
    ['solid','dashed','dotted','double','groove','ridge','inset','outset'].includes(sample.outline) &&
    Number.isFinite(parseFloat(sample.width)) && parseFloat(sample.width) >= 2,
    `${label}: nonzero visible unclipped unoccluded focus geometry required: ${JSON.stringify(sample)}`);
}

function diagnosticText(value) {
  try {
    const text = String.prototype.valueOf.call(value);

    return Object.is(text, value) ? text : null;
  } catch {
    return null;
  }
}

export function assertDiagnosticEvidence(text, sample) {
  assert.ok(diagnosticText(text) !== null && text.trim().length > 0, 'blank refusal diagnostic');
  assert.ok(sample && Number.isFinite(sample.width) && Number.isFinite(sample.height) &&
    sample.width>0 && sample.height>0 && sample.inViewport===true && sample.clipped===false && sample.occluded===false,
    `refusal diagnostic geometry: ${JSON.stringify(sample)}`);
}

async function assertDiagnosticGeometry(locator) {
  const text = await locator.innerText();

  const sample = await locator.evaluate(el => {
    const r = el.getBoundingClientRect();

    const points = [[r.left+1,r.top+r.height/2],[r.right-1,r.top+r.height/2],
      [r.left+r.width/2,r.top+1],[r.left+r.width/2,r.bottom-1],[r.left+r.width/2,r.top+r.height/2]];

    let clipped = false;

    for (let p=el.parentElement;p;p=p.parentElement) {
      const q=p.getBoundingClientRect(),c=getComputedStyle(p);

      if ((/auto|scroll|hidden|clip/.test(c.overflowX)&&(r.left<q.left-1||r.right>q.right+1)) ||
          (/auto|scroll|hidden|clip/.test(c.overflowY)&&(r.top<q.top-1||r.bottom>q.bottom+1))) clipped=true;
    }

    return {width:r.width,height:r.height,clipped,
      inViewport:r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight,
      occluded:points.some(([x,y])=>{const hit=document.elementFromPoint(x,y);

return !hit||!(hit===el||el.contains(hit));})};
  });

  assertDiagnosticEvidence(text, sample);
}

if (process.argv.includes('--oracle-self-test')) {
  const valid={rect:{x:1048,y:842,width:182,height:51},inViewport:true,occluded:false,clipped:false,visible:true,outline:'solid',width:'2px'};
  assertKeyboardGeometry(valid);

  const hostile=[null,{...valid,rect:{width:0,height:51}},{...valid,rect:{width:182,height:0}},
    {...valid,clipped:true},{...valid,occluded:true},{...valid,visible:false},
    {...valid,outline:'none'},{...valid,width:'0px'},{...valid,inViewport:false},
    {...valid,rect:undefined},{...valid,occluded:undefined},{...valid,rect:{...valid.rect,x:NaN}},
    {...valid,outline:undefined},{...valid,outline:''},{...valid,width:'Infinitypx'},
    {...valid,width:'NaNpx'},{...valid,width:'1px'},{...valid,rect:{...valid.rect,x:-1}}];

  for (const sample of hostile) assert.throws(()=>assertKeyboardGeometry(sample));
  const diagnostic={width:280,height:20,inViewport:true,clipped:false,occluded:false};
  assertDiagnosticEvidence('DESKTOP_PROJECT_LIFECYCLE_UNAVAILABLE',diagnostic);
  assert.throws(()=>assertDiagnosticEvidence('   ',diagnostic));
  assert.throws(()=>assertDiagnosticEvidence('Named refusal',null));
  assert.throws(()=>assertDiagnosticEvidence('Named refusal',{...diagnostic,width:0}));
  assert.throws(()=>assertDiagnosticEvidence('Named refusal',{...diagnostic,occluded:true}));
  console.log(JSON.stringify({status:'PASS',positive:1,rejected:hostile.length,diagnosticPositive:1,diagnosticRejected:4,browser:'NOT_RUN'}));
} else {
assert.ok(process.argv[2] && /^[a-z0-9-]+$/.test(process.argv[2]), 'explicit safe receipt stage required');
const root='/home/devuser/Documents/Projects/sceneaxi';
const sha=value=>createHash('sha256').update(value).digest('hex');
const runtimeFiles=new Map();
const {resolve}=await import(root+'/scripts/workspace-dist-resolver.mjs');
registerHooks({resolve(specifier,context,nextResolve){
  const result=resolve(specifier,context,nextResolve);

  if(result.url.startsWith('file://')){
    const path=fileURLToPath(result.url);

    if(path.startsWith(root+'/'))runtimeFiles.set(path.slice(root.length+1),sha(readFileSync(path)));
  }

  return result;
}});
const require=createRequire(root+'/sites/umbrella/package.json');
const {chromium}=require('@playwright/test');
const esbuild=createRequire(root+'/desktop/linux/package.json')('esbuild');
const hostBundle=await esbuild.build({stdin:{contents:`export {createDesktopBridge} from '${root}/desktop/linux/src/lib/bridge.ts'; export {seedDesktopProject} from '${root}/desktop/linux/src/lib/project-seed.ts';`,resolveDir:root},bundle:true,packages:'external',platform:'node',format:'esm',write:false});
const {createDesktopBridge,seedDesktopProject}=await import('data:text/javascript;base64,'+Buffer.from(hostBundle.outputFiles[0].text).toString('base64'));
const stage=process.argv[2];
const beforeBundle=stage==='before'?await esbuild.build({stdin:{contents:execFileSync('git',['show','346933c105305224d575bf9319256301c1eeabfa:apps/desktop-shell/src/chrome.ts'],{cwd:root,encoding:'utf8'}),resolveDir:root+'/apps/desktop-shell/src',loader:'ts'},bundle:true,packages:'external',platform:'node',format:'esm',write:false}):null;
const afterBundle=await esbuild.build({stdin:{contents:`export {renderDesktopChrome} from '${root}/apps/desktop-shell/src/chrome.ts'; export {createDesktopVisualState,desktopVisualView} from '${root}/apps/desktop-shell/src/visual-model.ts';`,resolveDir:root},bundle:true,packages:'external',platform:'node',format:'esm',write:false,metafile:true});
const afterModule=await import('data:text/javascript;base64,'+Buffer.from(afterBundle.outputFiles[0].text).toString('base64'));
const beforeModule=beforeBundle?await import('data:text/javascript;base64,'+Buffer.from(beforeBundle.outputFiles[0].text).toString('base64')):null;
const {createDesktopVisualState,desktopVisualView}=afterModule;
const sourceHashes=Object.fromEntries(Object.keys(afterBundle.metafile.inputs).filter(path=>path!=='<stdin>').map(path=>[path,sha(readFileSync(path.startsWith('/')?path:join(root,path)))]));
sourceHashes['apps/desktop-shell/test/visual-postpr-evidence/retry/capture.mjs']=sha(readFileSync(fileURLToPath(import.meta.url)));
const byoSource=stage==='before'?execFileSync('git',['show','346933c105305224d575bf9319256301c1eeabfa:desktop/linux/src/renderer/byo-configuration.ts'],{cwd:root,encoding:'utf8'}):null;
const byo=await esbuild.build({...byoSource?{stdin:{contents:byoSource,loader:'ts',resolveDir:root+'/desktop/linux/src/renderer'}}:{entryPoints:[root+'/desktop/linux/src/renderer/byo-configuration.ts']},bundle:true,platform:'browser',format:'iife',globalName:'Byo',write:false});
const directory=root+'/apps/desktop-shell/test/visual-postpr-evidence/retry';
mkdirSync(directory,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'/home/devuser/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome'});
const receipts=[];
const fixtureRoot=mkdtempSync(join(tmpdir(),'sceneaxi-visual-'));

try {
if(!seedDesktopProject(fixtureRoot).ok) throw new Error('seed failed');
const host=createDesktopBridge({cwd:fixtureRoot,commandCapabilities:['scene.compose','authoring.change-review','authoring.undo','authoring.redo']});

for(const scenario of [
{id:'empty',width:1680,height:1000},
{id:'effect-minimum',width:900,height:600,inspectorDrawer:true,effects:true},
{id:'effect-narrow',width:1100,height:800,inspectorDrawer:true,effects:true},
{id:'effect-compact',width:1280,height:900,effects:true},
{id:'effect-forced',width:1280,height:900,effects:true,forcedColors:'active'},
{id:'forced-focus',width:1280,height:900,palette:true,forcedColors:'active'},
{id:'long-evidence',width:1680,height:1000,host:true,details:true},
{id:'selected',width:1680,height:1000,host:true,details:true},
{id:'byok',width:1680,height:1000,byo:true,details:true},
{id:'narrow',width:900,height:640,host:true,drawer:true},
{id:'byok-narrow',width:900,height:640,byo:true,details:true,assistantDrawer:true},
{id:'palette',width:1280,height:900,palette:true},
{id:'refused',width:1280,height:900,palette:true,refused:true},
{id:'refused-minimum',width:900,height:600,palette:true,refused:true},
{id:'refused-forced-minimum',width:900,height:600,palette:true,refused:true,forcedColors:'active'},
{id:'menu-pressed',width:1280,height:900,pressed:true},
{id:'mobile-refusal',width:375,height:812},
{id:'busy',width:1680,height:1000,busy:true},
{id:'web',width:1680,height:1000,profile:'web'},
{id:'kids',width:900,height:640,profile:'kids'},
].filter(scenario=>!process.argv.includes('--keyboard-only')||scenario.effects||scenario.refused)) {
const receipt={scenario:scenario.id,viewport:{width:scenario.width,height:scenario.height},status:'RUNNING',sourceHashes,runtimeFiles:Object.fromEntries(runtimeFiles)};receipts.push(receipt);
const context=await browser.newContext({viewport:{width:scenario.width,height:scenario.height},reducedMotion:scenario.busy?'no-preference':'reduce',forcedColors:scenario.forcedColors??'none'});

try {
const page=await context.newPage();
const errors=[];const hostRequests=[]; page.on('pageerror',e=>errors.push(e.message));

if(scenario.host){
await page.exposeFunction('visualHostRequest',request=>{hostRequests.push(request);

return host.handle(request);});
await page.addInitScript(({fixtureRoot})=>{globalThis.sceneaxiDesktopLinux={request:request=>globalThis.visualHostRequest(request),project:async()=>({ok:true,data:{status:{active:{name:'Visual proof project',root:fixtureRoot,documentPath:'scene.json',source:'opened'},recents:[],recovery:null}}})};},{fixtureRoot});
}

const args=['apps/desktop-shell/bin/sceneaxi-desktop.mjs','chrome','--width',String(scenario.width),'--height',String(scenario.height),'--json'];

if(scenario.palette) args.push('--overlay','palette');

if(scenario.profile) args.push('--profile',scenario.profile);

// Below minimum is rendered at the admitted tier, then the browser checks the real CSS refusal.
if(scenario.width<900){args[3]='900';args[5]='640';}

const envelope=JSON.parse(execFileSync(process.execPath,args,{cwd:root,encoding:'utf8',maxBuffer:2000000}));

if(!envelope.ok) throw new Error(JSON.stringify(envelope));
envelope.result.html=(stage==='before'?beforeModule:afterModule).renderDesktopChrome(desktopVisualView(createDesktopVisualState({window:{width:Math.max(900,scenario.width),height:scenario.height},profile:scenario.profile??'game',overlay:scenario.palette?'palette':'none'})));
await page.route('http://desktop.visual.test/',route=>route.fulfill({body:envelope.result.html,contentType:'text/html'}));
receipt.htmlSha256=sha(envelope.result.html);
await page.goto('http://desktop.visual.test/');

if(scenario.host) await page.waitForSelector('.scene-entity-identity',{state:'attached'});

if(scenario.details) await page.evaluate(()=>{document.querySelector('.shell').dataset.detailsOpen='true';});

if(scenario.drawer) await page.locator('[data-action="drawer"][data-value="left"]').click();

if(scenario.inspectorDrawer) await page.locator('[data-action="drawer"][data-value="inspector"]').click();

if(scenario.assistantDrawer) await page.click('.assistant-toggle');

if(scenario.busy) await page.evaluate(()=>{document.querySelector('.shell').dataset.assistantBusy='true';document.querySelector('[data-assistant-thinking]').hidden=false;document.querySelector('[data-assistant-thinking]').lastChild.textContent='Loading-state visual fixture';document.querySelector('[data-assistant-status]').textContent='Visual loading fixture only; no provider request.';});

if(scenario.byo){
await page.addScriptTag({content:byo.outputFiles[0].text});
await page.evaluate(()=>{Byo.installDesktopByoConfigurationSurface({});document.querySelector('.desktop-byo-config').hidden=false;});
await page.locator('.desktop-byo-config').scrollIntoViewIfNeeded();
}

if(scenario.id==='long-evidence') await page.evaluate(()=>{const row=document.querySelector('.scene-entity-identity');

 for(let i=0;i<12;i++){const copy=row.cloneNode(true); copy.querySelector('span').textContent='Dense-list visual fixture '+(i+1);

 for(const code of copy.querySelectorAll('code')) code.textContent='fixture-sha256:'+('0123456789abcdef'.repeat(4)); row.parentElement.append(copy);}

 const result=document.querySelector('[data-assistant-result]');result.hidden=false;result.textContent='Long evidence visual fixture — '+('0123456789abcdef'.repeat(16));

for(const el of document.querySelectorAll('.asset-browser-card span')) el.textContent='fixture-sha256:'+('0123456789abcdef'.repeat(4));});

if(scenario.id==='selected'){await page.locator('.scene-entity-identity').first().click();await page.locator('.scene-entity-identity').first().focus();}

if(scenario.id==='palette'||scenario.id==='forced-focus') await page.keyboard.press('Tab');

if(scenario.refused) {
// Enter the renderer transition: hidden attributes alone leave data-overlay at palette and paint nothing.
// Open is a real renderer action that refuses when the packaged browser host is absent.
// Save on a clean project is deliberately a no-op and cannot provide this oracle.
for(let step=0;step<240;step++) {
  if(await page.locator('.palette-item[data-command="project-open"]').evaluate(el=>el===document.activeElement)) break;
  await page.keyboard.press('Tab');
}

assert.ok(await page.locator('.palette-item[data-command="project-open"]').evaluate(el=>el===document.activeElement), 'real refusal command unreachable by Tab');
await page.keyboard.press('Enter');
const dialog=page.locator('.overlay[data-overlay="outcome"]');
await dialog.waitFor({state:'visible'});
assert.match(await dialog.innerText(), /Project lifecycle refused/);
await assertDiagnosticGeometry(dialog.locator('[data-outcome-code]'));
await assertDiagnosticGeometry(dialog.locator('[data-outcome-message]'));
const geometry=await dialog.boundingBox();
assert.ok(geometry!==null&&geometry.width>0&&geometry.height>0);
assert.ok(await dialog.locator('button:not([aria-disabled="true"])').count()>0);
}

if(scenario.pressed){await page.locator('.menu-item').first().hover();await page.mouse.down();}

if(scenario.busy) await page.waitForTimeout(350);
const screenshot=`apps/desktop-shell/test/visual-postpr-evidence/retry/${stage}-${scenario.id}.png`;
receipt.pngSha256=sha(await page.screenshot({path:root+'/'+screenshot}));

const metrics=await page.evaluate(()=>{
const report={};

for(const selector of ['.panel-head','.scene-entity-identity','.scene-entity-identity code','.assistant-empty','.assistant-result','.assistant-prompt','.assistant-composer','.assistant-body','.assistant','.desktop-byo-config button:disabled','.palette-item:focus-visible','.window-refusal','.asset-browser-card span','.assistant-progress','.desktop-byo-config-message','.overlay-refused .overlay-body','.icon-button','.menu-item:active']){
const element=document.querySelector(selector);

if(!element) continue;const s=getComputedStyle(element);const r=element.getBoundingClientRect();report[selector]={font:s.fontSize,lineHeight:s.lineHeight,color:s.color,background:s.backgroundColor,opacity:s.opacity,outlineWidth:s.outlineWidth,outlineColor:s.outlineColor,width:r.width,height:r.height,visible:r.width>0&&r.height>0};}

report.activeAnimations=document.getAnimations().filter(animation=>animation.playState==='running').length;
report.documentOverflow=document.documentElement.scrollWidth>innerWidth;
report.controlCount=document.querySelectorAll('button,input,select,textarea').length;

return report;
});

if(scenario.pressed) await page.mouse.up();
await page.keyboard.press('Tab');
const focusSamples=[];receipt.focusSamples=focusSamples;

for(const direction of ['Tab','Shift+Tab']) {
const seen=new Set();
let wrapped=false;

for(let step=0;step<240;step++) {
await page.keyboard.press(direction);

const sample=await page.evaluate(()=>{
const el=document.activeElement;

if(!(el instanceof HTMLElement)||el===document.body)return null;
const s=getComputedStyle(el),r=el.getBoundingClientRect();
const points=[[r.left+1,r.top+r.height/2],[r.right-1,r.top+r.height/2],[r.left+r.width/2,r.top+1],[r.left+r.width/2,r.bottom-1],[r.left+r.width/2,r.top+r.height/2]];

const occluded=points.some(([x,y])=>{const hit=document.elementFromPoint(x,y);

return hit===null||!(hit===el||el.contains(hit));});

let clipped=false;

for(let parent=el.parentElement;parent;parent=parent.parentElement){
const ps=getComputedStyle(parent),pr=parent.getBoundingClientRect();

if((/hidden|clip|scroll|auto/.test(ps.overflowX)&&(r.left<pr.left-1||r.right>pr.right+1))||(/hidden|clip|scroll|auto/.test(ps.overflowY)&&(r.top<pr.top-1||r.bottom>pr.bottom+1)))clipped=true;
}

return {key:Array.from(document.querySelectorAll('*')).indexOf(el),tag:el.tagName,id:el.id,className:el.className,clipped,visible:el.matches(':focus-visible'),outline:s.outlineStyle,width:s.outlineWidth,color:s.outlineColor,
rect:{x:r.x,y:r.y,width:r.width,height:r.height},inViewport:r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight,
occluded,ariaDisabled:el.getAttribute('aria-disabled'),
describedby:(el.getAttribute('aria-describedby')||'').split(/\s+/).filter(Boolean).map(id=>({id,text:document.getElementById(id)?.textContent?.trim()||''})),
inModal:el.closest('.overlay:not([hidden])')!==null};
});

if(sample===null)continue;
const key=sample.key;

if(seen.has(key)){wrapped=true;break;}

seen.add(key);focusSamples.push({...sample,direction});

if(sample.ariaDisabled==='true'){
assert.ok(sample.describedby.length>0&&sample.describedby.every(description=>description.text.length>0),'Inert controls must explain their refusal');
const before=await page.locator('.shell').getAttribute('data-overlay');const requestsBefore=hostRequests.length;
await page.keyboard.press('Enter');await page.keyboard.press('Space');
assert.equal(await page.locator('.shell').getAttribute('data-overlay'),before,'Inert activation must not open another state');
assert.equal(hostRequests.length,requestsBefore,'Inert activation must not invoke the host');
}
}

assert.ok(wrapped||scenario.width<900,`Tab traversal did not complete: ${scenario.id} ${direction}`);
}

if(scenario.width>=900&&scenario.width<=1280){
for(const sample of focusSamples) assertKeyboardGeometry(sample, scenario.id);
assert.ok(focusSamples.length>0,`${scenario.id}: admitted viewport must have reachable controls`);
}

if(scenario.effects) for(const direction of ['Tab','Shift+Tab']) {
for(const id of ['effect-mutation','effect-stage'])
  assert.ok(focusSamples.some(sample=>sample.direction===direction&&sample.id===id), `${scenario.id}: ${id} not reached by ${direction}`);
}

const focusScreenshot=`apps/desktop-shell/test/visual-postpr-evidence/retry/${stage}-${scenario.id}-keyboard.png`;
receipt.focusPngSha256=sha(await page.screenshot({path:root+'/'+focusScreenshot}));

if(scenario.refused){
assert.ok(focusSamples.length>0&&focusSamples.every(sample=>sample.inModal));

for(const sample of focusSamples) assertKeyboardGeometry(sample, 'refusal dismissal');
await page.keyboard.press('Escape');
assert.ok(await page.locator('.overlay[data-overlay="outcome"]').isHidden());
assert.equal(await page.locator('.shell').getAttribute('data-overlay'),'none');
}

Object.assign(receipt,{screenshot,focusScreenshot,hostRequestCount:hostRequests.length,errors,metrics});
assert.deepEqual(errors,[],'Renderer page errors invalidate visual evidence');
receipt.runtimeFiles=Object.fromEntries(runtimeFiles);
receipt.status='PASS';
}finally{await context.close();}
}
}finally{
for(const receipt of receipts) if(receipt.status==='RUNNING') receipt.status='FAIL';

try{await browser.close();}finally{
rmSync(fixtureRoot,{recursive:true,force:true});
writeFileSync(root+`/apps/desktop-shell/test/visual-postpr-evidence/retry/${stage}.json`,JSON.stringify(receipts,null,2)+'\n');
}
}

console.log(JSON.stringify(receipts,null,2));

}
