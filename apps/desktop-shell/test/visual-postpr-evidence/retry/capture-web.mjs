import {createRequire,registerHooks} from 'node:module';
import {execFileSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
const root='/home/devuser/Documents/Projects/sceneaxi';
const {resolve}=await import(root+'/scripts/workspace-dist-resolver.mjs');registerHooks({resolve});
const {chromium}=createRequire(root+'/sites/umbrella/package.json')('@playwright/test');
const esbuild=createRequire(root+'/desktop/linux/package.json')('esbuild');
const stage=process.argv[2];
const source=stage==='before'?execFileSync('git',['show','346933c105305224d575bf9319256301c1eeabfa:apps/web-shell/src/inspector-app.ts'],{cwd:root,encoding:'utf8'}):null;
const bundle=await esbuild.build({...source?{stdin:{contents:source,resolveDir:root+'/apps/web-shell/src',loader:'ts'}}:{entryPoints:[root+'/apps/web-shell/src/inspector-app.ts']},bundle:true,packages:'external',platform:'node',format:'esm',write:false});
const {inspectorPageHtml,createInspectorApp}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
// Only rendering and readonly idle-state requests; neither writes nor provider calls.
const app=createInspectorApp({projectRoot:root});
const browser=await chromium.launch({headless:true,executablePath:'/home/devuser/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome'});
const rows=[];
try {
for(const scheme of ['light','dark']) for(const scenario of [{id:'idle',width:1440,height:1000},{id:'long-diff',width:390,height:844,stress:true},{id:'refusal',width:390,height:844,error:true}]){
const context=await browser.newContext({viewport:{width:scenario.width,height:scenario.height},colorScheme:scheme,reducedMotion:'reduce'});
try {
const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('http://inspector.visual.test/**',route=>{const path=new URL(route.request().url()).pathname;if(path==='/'){return route.fulfill({body:inspectorPageHtml('/workspace/'+('long-project-identity-'.repeat(10))),contentType:'text/html'});} const response=app.handle({method:'GET',url:path});return route.fulfill({body:response.body,status:response.status,contentType:'application/json'});});
await page.goto('http://inspector.visual.test/');await page.waitForTimeout(100);
if(scenario.stress) await page.evaluate(()=>{document.getElementById('diff').textContent='Visual-only long diff fixture; no proposal made.\ncontentHash: '+('0123456789abcdef'.repeat(16))+'\nold: '+JSON.stringify({id:'fixture',path:'long-path/'.repeat(24)});});
if(scenario.error) await page.evaluate(()=>{const note=document.getElementById('note');note.className='refused';note.textContent='Visual-only refusal fixture: REQUEST_REFUSED — no write or retry has occurred. '+('0123456789abcdef'.repeat(8));});
const screenshot=`apps/desktop-shell/test/visual-postpr-evidence/retry/${stage}-inspector-${scenario.id}-${scheme}.png`;await page.screenshot({path:root+'/'+screenshot,fullPage:true});
const metrics=await page.evaluate(()=>{const diff=document.getElementById('diff');const note=document.getElementById('note');const disabled=document.getElementById('accept');const style=getComputedStyle(note);return {documentOverflow:document.documentElement.scrollWidth>innerWidth,diffOverflow:diff.scrollWidth>diff.clientWidth,refusalColor:style.color,canvas:getComputedStyle(document.body).backgroundColor,disabledOpacity:getComputedStyle(disabled).opacity,hiddenRecovery:document.getElementById('recover').hidden};});
const focus=[];
for(const direction of ['Tab','Shift+Tab']){
const seen=new Set();let wrapped=false;
for(let step=0;step<240;step++){
await page.keyboard.press(direction);
const sample=await page.evaluate(()=>{
const el=document.activeElement;if(!(el instanceof HTMLElement)||el===document.body)return null;
const s=getComputedStyle(el),r=el.getBoundingClientRect();
const points=[[r.left+1,r.top+r.height/2],[r.right-1,r.top+r.height/2],[r.left+r.width/2,r.top+1],[r.left+r.width/2,r.bottom-1],[r.left+r.width/2,r.top+r.height/2]];
const occluded=points.some(([x,y])=>{const hit=document.elementFromPoint(x,y);return hit===null||!(hit===el||el.contains(hit));});
let clipped=false;
for(let parent=el.parentElement;parent;parent=parent.parentElement){const ps=getComputedStyle(parent),pr=parent.getBoundingClientRect();if((/hidden|clip|scroll|auto/.test(ps.overflowX)&&(r.left<pr.left-1||r.right>pr.right+1))||(/hidden|clip|scroll|auto/.test(ps.overflowY)&&(r.top<pr.top-1||r.bottom>pr.bottom+1)))clipped=true;}
return {key:Array.from(document.querySelectorAll('*')).indexOf(el),id:el.id,focusVisible:el.matches(':focus-visible'),outline:s.outlineStyle,width:s.outlineWidth,color:s.outlineColor,rect:{x:r.x,y:r.y,width:r.width,height:r.height},inViewport:r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight,clipped,occluded};
});
if(sample===null)continue;
if(seen.has(sample.key)){wrapped=true;break;}seen.add(sample.key);focus.push({...sample,direction});
if(!sample.focusVisible||sample.outline==='none'||parseFloat(sample.width)<=0||!sample.inViewport||sample.clipped||sample.occluded)throw new Error('Keyboard focus is not visibly reachable: '+JSON.stringify(sample));
}
if(!wrapped||seen.size===0)throw new Error('Incomplete keyboard traversal: '+direction);
}
const focusScreenshot=`apps/desktop-shell/test/visual-postpr-evidence/retry/${stage}-inspector-${scenario.id}-${scheme}-focus.png`;await page.screenshot({path:root+'/'+focusScreenshot,fullPage:true});
if(errors.length>0||metrics.documentOverflow)throw new Error('Invalid inspector capture: '+JSON.stringify({errors,metrics}));
rows.push({scheme,scenario:scenario.id,screenshot,focusScreenshot,viewport:{width:scenario.width,height:scenario.height},errors,metrics,focus});
}finally{await context.close();}
}
}finally{await browser.close();}
writeFileSync(root+`/apps/desktop-shell/test/visual-postpr-evidence/retry/${stage}-inspector.json`,JSON.stringify(rows,null,2)+'\n');console.log(rows);
