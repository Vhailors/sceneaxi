import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

const children=[];

let browser;

let count=0;

try {
  browser=await chromium.launch({executablePath:"/usr/bin/chromium",headless:true,args:["--no-sandbox"]});

  for (const [i,site] of ["umbrella","catalog-game","catalog-web"].entries()) {
    const port=46110+i;const origin=`http://127.0.0.1:${port}`;
    const child=spawn("pnpm",["exec","next","start","--hostname","127.0.0.1","--port",String(port)],{cwd:new globalThis.URL(`../../${site}/`,import.meta.url),env:{...globalThis.process.env,NEXT_TELEMETRY_DISABLED:"1",SCENEAXI_SITE_EDITOR_PREVIEW:"1",NEXT_PUBLIC_SCENEAXI_UMBRELLA_ORIGIN:origin,NEXT_PUBLIC_SCENEAXI_GAME_CATALOG_ORIGIN:origin,NEXT_PUBLIC_SCENEAXI_WEB_CATALOG_ORIGIN:origin},stdio:["ignore","pipe","pipe"]});children.push(child);
    let output="";child.stdout.on("data",b=>output+=b);child.stderr.on("data",b=>output+=b);
    let ready=false;

for(let attempt=0;attempt<150;attempt++){if(child.exitCode!==null)throw new Error(output);

try{if((await globalThis.fetch(origin)).ok){ready=true;break;}}catch { /* Loopback may not be listening until startup completes. */ }

await new Promise(r=>globalThis.setTimeout(r,100));}

assert(ready,output);
    const context=await browser.newContext();const page=await context.newPage();const errors=[];page.on("pageerror",e=>errors.push(e.message));
    const path=site==="umbrella"?"/docs":"/publish";
    const response=await page.goto(`${origin}${path}`);
    const csp=response.headers()["content-security-policy"];

    for (const directive of ["default-src 'none'","connect-src 'self'","script-src 'self' 'nonce-","script-src-attr 'none'"]) assert(csp.includes(directive),csp);
    assert(!csp.includes("'unsafe-eval'"));assert(!/script-src[^;]*unsafe-inline/.test(csp));
    const nonce=/nonce-([^']+)/.exec(csp)[1];
    assert((await page.locator("script").evaluateAll(scripts=>scripts.filter(s=>!s.src).every(s=>s.nonce.length>0))));
    assert.equal(await page.locator('link[rel="canonical"]').getAttribute("href"),`${origin}${path}`);
    await page.evaluate(()=>{const s=globalThis.document.createElement("script");s.textContent="globalThis.window.evilExecuted=true";globalThis.document.head.append(s);});
    assert.equal(await page.evaluate(()=>globalThis.window.evilExecuted),undefined);
    const next=await context.request.get(`${origin}${path}`,{headers:{"x-sceneaxi-route":"/forged","content-security-policy":"script-src 'unsafe-inline'","host":"hostile.invalid"}});
    assert((await next.text()).includes(`href="${origin}${path}"`));assert(!next.headers()["content-security-policy"].includes(nonce));
    assert.deepEqual(errors,[]);count+=3;

    if(site==="umbrella"){
      await page.goto(`${origin}/editor?profile=web&web-html=%3Cp%3Echanged%3C%2Fp%3E`);
      await page.getByText("Local project",{exact:true}).click();
      await page.getByRole("button",{name:"Save locally",exact:true}).click();
      await page.getByRole("status").filter({hasText:"Saved locally, revision 1"}).waitFor();
      const digest=await page.locator("[data-editor-project-digest]").getAttribute("data-editor-project-digest");assert.match(digest,/^[a-f0-9]{64}$/);
      const downloadPromise=page.waitForEvent("download");await page.getByRole("button",{name:"Export canonical document",exact:true}).click();const download=await downloadPromise;
      const bytes=await readFile(await download.path());assert.equal(createHash("sha256").update(bytes).digest("hex"),digest);assert.equal(JSON.parse(bytes).data.webExperience.page.html,"<p>changed</p>");
      const exported=await context.request.get(`${origin}/api/editor/export?profile=web&web-html=%3Cp%3Echanged%3C%2Fp%3E`);assert.equal(exported.status(),200);assert.equal(exported.headers()["x-sceneaxi-document-digest"],`sha256:${digest}`);
      await page.getByRole("button",{name:"Reopen local",exact:true}).click();await page.waitForURL(/profile=web/);assert.equal(await page.locator("[data-editor-project-digest]").getAttribute("data-editor-project-digest"),digest);
      count+=3;
    }

    await context.close();child.kill("SIGTERM");
  }

  globalThis.console.log(`production-sites-proof: ${count} passed (3 configured origins/routes + strict CSP/browser execution + real Web persistence/export/reopen)`);
} finally {await browser?.close();

for(const child of children)child.kill("SIGTERM");}
