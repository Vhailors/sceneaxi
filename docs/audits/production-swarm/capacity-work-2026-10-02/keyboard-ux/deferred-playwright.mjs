#!/usr/bin/env node
// Explicitly deferred: requires authorized browser slot and existing Playwright/browser.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {writeFileSync} from 'node:fs';
import {out,root,desktopHtml,web,hashes,sha} from './source-proof.mjs';

if(!globalThis.process.argv.includes('--run'))throw new Error('NOT RUN: pass --run only after browser authorization; see report.md');

const {chromium}=createRequire(root+'/sites/umbrella/package.json')('@playwright/test');

const launchOptions = {headless:true};

if (globalThis.process.env.KEYBOARD_UX_CHROMIUM) launchOptions.executablePath = globalThis.process.env.KEYBOARD_UX_CHROMIUM;

const browser=await chromium.launch(launchOptions);

const receipt={status:'RUNNING',sourceHashes:hashes,subject:'source-rendered app, real emitted controls; no native host or dist',rows:[],errors:[]};

// Read geometry, never manufacture focus by calling element.focus().
async function sample(page){return page.evaluate(()=>{
 const el=globalThis.document.activeElement;

if(!(el instanceof globalThis.HTMLElement)||el===globalThis.document.body)return null;
 const r=el.getBoundingClientRect(),s=globalThis.getComputedStyle(el);let clipped=false;

 for(let p=el.parentElement;p;p=p.parentElement){const q=p.getBoundingClientRect(),c=globalThis.getComputedStyle(p);

if((/auto|scroll|hidden|clip/.test(c.overflowX)&&(r.left<q.left-1||r.right>q.right+1))||(/auto|scroll|hidden|clip/.test(c.overflowY)&&(r.top<q.top-1||r.bottom>q.bottom+1)))clipped=true;}

 const points=[[r.left+1,r.top+r.height/2],[r.right-1,r.top+r.height/2],[r.left+r.width/2,r.top+1],[r.left+r.width/2,r.bottom-1],[r.left+r.width/2,r.top+r.height/2]];

 return {key:[...globalThis.document.querySelectorAll('*')].indexOf(el),id:el.id,rect:{x:r.x,y:r.y,width:r.width,height:r.height},visible:el.matches(':focus-visible'),outline:s.outlineStyle,width:s.outlineWidth,inViewport:r.left>=0&&r.top>=0&&r.right<=globalThis.innerWidth&&r.bottom<=globalThis.innerHeight,clipped,occluded:points.some(([x,y])=>{const hit=globalThis.document.elementFromPoint(x,y);

return !hit||!(el===hit||el.contains(hit));}),inModal:!!el.closest('.overlay:not([hidden])'),disabled:el.getAttribute('aria-disabled'),descriptions:(el.getAttribute('aria-describedby')||'').split(/\s+/).filter(Boolean).map(id=>({id,count:[...globalThis.document.querySelectorAll('[id]')].filter(n=>n.id===id).length,text:globalThis.document.getElementById(id)?.textContent.trim()}))};
 });}

function geometry(s){assert.ok(s&&s.rect.width>0&&s.rect.height>0&&s.visible&&s.outline!=='none'&&parseFloat(s.width)>0&&s.inViewport&&!s.clipped&&!s.occluded,JSON.stringify(s));}

async function tabTo(page,selector){for(let i=0;i<600;i++){await page.keyboard.press('Tab');

if(await page.locator(selector).evaluateAll(nodes=>nodes.includes(globalThis.document.activeElement)))return;}

throw new Error('Control unreachable by Tab: '+selector);}

async function traverse(page,row,modal=false){
 for(const direction of ['Tab','Shift+Tab']){const seen=new Set();let wrapped=false;

  for(let i=0;i<600;i++){await page.keyboard.press(direction);const s=await sample(page);

if(!s)continue;

if(seen.has(s.key)){wrapped=true;break;}

seen.add(s.key);row.samples.push({...s,direction});geometry(s);

if(modal)assert.ok(s.inModal,'modal focus escaped');

   if(s.disabled==='true'){
    assert.ok(s.descriptions.length&&s.descriptions.every(d=>d.count===1&&d.text),'description unresolved');
    const before=await page.evaluate(()=>({overlay:globalThis.document.querySelector('.shell')?.getAttribute('data-overlay')??null,url:globalThis.location.href}));const requests=row.requests.length;
    await page.keyboard.press('Enter');await page.keyboard.press('Space');
    assert.deepEqual(await page.evaluate(()=>({overlay:globalThis.document.querySelector('.shell')?.getAttribute('data-overlay')??null,url:globalThis.location.href})),before);assert.equal(row.requests.length,requests);
   }
  }

assert.ok(wrapped&&seen.size,'nonempty full keyboard cycle required');
 }
}

try{
 for(const scenario of [
  {id:'desktop-minimum',width:900,height:640},
  {id:'desktop-compact',width:1280,height:900},
  {id:'desktop-refusal',width:1280,height:900,refusal:true},
  {id:'desktop-forced-refusal',width:900,height:640,refusal:true,forced:true},
  {id:'web-mobile',width:390,height:844,web:true},
  {id:'web-desktop',width:1440,height:1000,web:true},
  ...(globalThis.process.env.KEYBOARD_UX_EDITOR_URL?[{id:'real-editor-ShellButton',width:1280,height:900,editor:globalThis.process.env.KEYBOARD_UX_EDITOR_URL}]:[])
 ]){
  const context=await browser.newContext({viewport:{width:scenario.width,height:scenario.height},forcedColors:scenario.forced?'active':'none',reducedMotion:'reduce'});
  const row={...scenario,samples:[],requests:[],pageErrors:[]};receipt.rows.push(row);

  try{
   const page=await context.newPage();page.on('pageerror',e=>row.pageErrors.push(e.message));
   const html=scenario.web?web.inspectorPageHtml(root):desktopHtml(scenario.width,scenario.height,scenario.refusal?'palette':'none');row.htmlSha256=sha(html);
   const app=scenario.web?web.createInspectorApp({projectRoot:root}):null;
   await page.route('**/*',async route=>{
    const request=route.request(),url=new globalThis.URL(request.url());

    if(scenario.editor){const target=new globalThis.URL(scenario.editor);assert.ok(['127.0.0.1','localhost','[::1]'].includes(target.hostname),'editor must be local fixture');assert.equal(url.origin,target.origin,'external request blocked');row.requests.push({method:request.method(),url:url.pathname});

return route.continue();}

    assert.equal(url.origin,'http://keyboard-ux.invalid','network escape');

    if(url.pathname==='/')return route.fulfill({body:html,contentType:'text/html'});
    const input={method:request.method(),url:url.pathname,body:request.postData()??undefined};row.requests.push(input);
    assert.ok(app,'unexpected desktop network call');
    // No accept/write route is admitted, even if a regression tries one.
    assert.ok(['/api/state','/api/propose'].includes(url.pathname),'unexpected mutating route');
    const response=app.handle(input);row.responses??=[];row.responses.push(response);

    return route.fulfill({body:response.body,status:response.status,contentType:response.contentType});
   });
   await page.goto(scenario.editor??'http://keyboard-ux.invalid/');

   if(scenario.editor){assert.ok(await page.locator('[data-kind="inert"]').count(),'editor fixture lacks inert controls');row.htmlSha256=sha(await page.content());}

   if(scenario.web){
    await tabTo(page,'#documentPath');await page.keyboard.press('ControlOrMeta+A');await page.keyboard.type('../keyboard-ux-outside.json');
    await tabTo(page,'#propose');await page.keyboard.press('Enter');
    await page.waitForFunction(()=>globalThis.document.getElementById('note')?.textContent.includes('documentPath resolves outside the served project root'));
    row.diagnostic=await page.locator('#note').innerText();const r=await page.locator('#note').boundingBox();assert.ok(r&&r.width>0&&r.height>0);assert.ok(row.responses.some(r=>r.status===403));
   }else if(scenario.refusal){
    await tabTo(page,'.palette-item[data-command="project-open"]');await page.keyboard.press('Enter');
    const dialog=page.locator('.overlay[data-overlay="outcome"]');await dialog.waitFor({state:'visible'});
    row.diagnostic=await dialog.innerText();assert.match(row.diagnostic,/Project lifecycle refused/);
    row.code=await dialog.locator('[data-outcome-code]').innerText();row.message=await dialog.locator('[data-outcome-message]').innerText();assert.ok(row.code.trim()&&row.message.trim());row.dialog=await dialog.boundingBox();assert.ok(row.dialog&&row.dialog.width>0&&row.dialog.height>0);
   }

   await traverse(page,row,!!scenario.refusal);

   if(scenario.refusal){await page.keyboard.press('Escape');assert.equal(await page.locator('.shell').getAttribute('data-overlay'),'none');await page.keyboard.press('Tab');geometry(await sample(page));}

   assert.deepEqual(row.pageErrors,[]);
   // Live negative control: hide the outline of an actual keyboard-selected control.
   await page.keyboard.press('Tab');

const original=await page.evaluate(()=>{const el=globalThis.document.activeElement;const old=el.getAttribute('style');el.style.setProperty('outline','none','important');

return old;});

   let rejected=false;

try{geometry(await sample(page));}catch{rejected=true;}

assert.ok(rejected,'live geometry negative control escaped');row.negativeControl='outline removal on actual focused control rejected';
   await page.evaluate(old=>{if(old===null)globalThis.document.activeElement.removeAttribute('style');else globalThis.document.activeElement.setAttribute('style',old);},original);
   const png=await page.screenshot();writeFileSync(out+'/'+scenario.id+'.png',png);row.pngSha256=sha(png);row.status='PASS';
  }finally{await context.close();}
 }

 receipt.status='PASS';
}catch(e){receipt.status='FAIL';receipt.errors.push(String(e));globalThis.process.exitCode=1;}
finally{await browser.close();writeFileSync(out+'/browser-receipt.json',JSON.stringify(receipt,null,2)+'\n');}
