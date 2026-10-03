#!/usr/bin/env python3
"""Deferred Playwright front-door acceptance; default prints preconditions, never launches."""
import argparse, json, pathlib, subprocess
HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[4]
JS = r'''
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const [root,here,configPath] = process.argv.slice(1);
const config = JSON.parse(readFileSync(configPath));
const spec = JSON.parse(readFileSync(here+'/intended-spec.json'));
const digest = b=>createHash('sha256').update(b).digest('hex');
assert(config.candidateSha && config.buildHashes && config.sourceHashes,'ARTIFACT_BINDING_REQUIRED');
for(const [p,h] of Object.entries(config.sourceHashes)) assert.equal(digest(readFileSync(root+'/'+p)),h,'SOURCE_DRIFT:'+p);
for(const [p,h] of Object.entries(config.buildHashes)) assert.equal(digest(readFileSync(root+'/'+p)),h,'BUILD_DRIFT:'+p);
assert(Object.keys(config.buildHashes).length>=5,'ALL_FIVE_SURFACE_BUILD_IDENTITIES_REQUIRED');
assert.deepEqual([...new Set(config.cases.map(c=>c.id))].sort(),[...spec.requiredCases].sort(),'ALL_REAL_EDGE_CASES_REQUIRED');
for(const c of config.cases) { const u=new URL(c.url); assert(['127.0.0.1','localhost','[::1]'].includes(u.hostname),'LOOPBACK_ONLY'); assert(['http:','https:'].includes(u.protocol)); assert(c.selector && c.expectedText && c.actions,'REAL_TRANSITION_ORACLE_REQUIRED'); }
const {chromium} = createRequire(root+'/sites/umbrella/package.json')('@playwright/test');
const browser = await chromium.launch({headless:true,executablePath:config.chromiumPath??'/usr/bin/chromium'});
const receipts=[];
try {
 for(const c of config.cases) for(const width of c.id.startsWith('desktop-')?[1024,1280]:[390,1440]) for(const colorScheme of ['light','dark']) for(const forcedColors of ['none','active']) {
  const context=await browser.newContext({viewport:{width,height:width===390?844:900},colorScheme,forcedColors});
  // Never use real credentials: operator must provide an approved loopback fixture service.
  const page=await context.newPage(),errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=> { const u=new URL(route.request().url()); if(['http:','https:'].includes(u.protocol)&&!['127.0.0.1','localhost','[::1]'].includes(u.hostname)) { errors.push('EXTERNAL_REQUEST:'+u.origin); return route.abort(); } return route.continue(); });
  const response=await page.goto(c.url,{waitUntil:'networkidle',timeout:15000});
  assert(response && response.status()===c.httpStatus,'RAW_HTTP_STATUS');
  for(const a of c.actions) { const el=page.locator(a.selector); if(a.kind==='fill') await el.fill(a.value); else if(a.kind==='click') await el.click(); else if(a.kind==='press') await el.press(a.key); else throw Error('UNSUPPORTED_ACTION'); }
  const target=page.locator(c.selector); await target.waitFor({state:'visible'});
  assert((await target.innerText()).includes(c.expectedText),'ACTUAL_DIAGNOSTIC_REQUIRED');
  const geometry=await target.evaluate(el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return {width:r.width,height:r.height,clientWidth:el.clientWidth,scrollWidth:el.scrollWidth,whiteSpace:s.whiteSpace,overflowWrap:s.overflowWrap,text:el.textContent,fg:s.color,bg:s.backgroundColor};});
  assert(geometry.width>0&&geometry.height>0,'NONZERO_DIAGNOSTIC'); assert(geometry.scrollWidth<=geometry.clientWidth+1,'ELEMENT_OVERFLOW');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'DOCUMENT_OVERFLOW');
  const focus=[];
  for(let i=0;i<20;i++){await page.keyboard.press('Tab');focus.push(await page.evaluate(()=>{const e=document.activeElement,r=e.getBoundingClientRect(),s=getComputedStyle(e),top=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {tag:e.tagName,visible:r.width>0&&r.height>0,inside:r.x>=0&&r.y>=0&&r.right<=innerWidth&&r.bottom<=innerHeight,occluded:!top||!e.contains(top),outline:s.outline,missing:(e.getAttribute('aria-describedby')??'').split(/\s+/).filter(Boolean).filter(id=>!document.getElementById(id))};}));}
  assert(focus.some(f=>f.tag!=='BODY'),'NONVACUOUS_TAB'); for(const f of focus.filter(f=>f.tag!=='BODY'))assert(f.visible&&f.inside&&!f.occluded&&!f.missing.length,'FOCUS_GEOMETRY_OR_DESCRIPTION');
  assert.deepEqual(errors,[],'PAGE_ERRORS');
  const filename=`${c.id}-${width}-${colorScheme}-${forcedColors}.png`; const bytes=await page.screenshot({path:here+'/'+filename,fullPage:true});
  receipts.push({case:c.id,url:c.url,input:c.actions,expected:c.expectedText,observed:geometry,status:response.status(),errors,focus,width,colorScheme,forcedColors,png:filename,sha256:digest(bytes)});
  await context.close();
 }
 for(const [p,h] of Object.entries(config.sourceHashes))assert.equal(digest(readFileSync(root+'/'+p)),h,'SOURCE_DRIFT_AFTER');
} finally {await browser.close();writeFileSync(here+'/browser-receipts.json',JSON.stringify({candidateSha:config.candidateSha,buildHashes:config.buildHashes,sourceHashes:config.sourceHashes,receipts},null,2));}
'''
def main():
    p=argparse.ArgumentParser(); p.add_argument('--execute',metavar='APPROVED_LOOPBACK_CONFIG'); a=p.parse_args()
    if not a.execute:
        print(json.dumps({'status':'NOT_RUN','command':'python3 '+str(HERE/'browser_edges.py')+' --execute '+str(HERE/'approved-loopback.json'),'preconditions':['Explicit browser/heavy-token handoff','Five already-running approved loopback surfaces; no server launch by this driver','Stable source and build hashes; candidate SHA','Config cases matching intended-spec.json, each with real selector/actions/expectedText/httpStatus','Authenticated own-user/history, long hash/diff and errors must come from approved source-backed fixtures; no DOM text injection','No live provider/credentials; external HTTP blocked'],'limits':'Geometry subset, not full contrast/ancestor clipping/modal/assistive-tech certification'})); return
    subprocess.run(['node','--input-type=module','-',str(ROOT),str(HERE),str(pathlib.Path(a.execute).resolve())],input=JS,text=True,check=True,timeout=900)
if __name__=='__main__':main()
