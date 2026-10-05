/** Contained offline HTML-canvas PWA. No provider, network asset, or dependency. */
import { createHash } from "node:crypto";
import { serializeDocument } from "@sceneaxi/schemas";
import { buildWebExperienceEditorView, readWebExperienceEditorState, type WebExperienceEditorState } from "./web-experience-editor.js";

export type OfflineWebExport = Readonly<{ documentDigest: string; files: Readonly<Record<string, string>>; archive: Uint8Array }>;

const encoder = new TextEncoder();

/** Stored ZIP records with fixed UTF-8 names, CRC32 and an exact central directory. */
function zip(files: Readonly<Record<string, string>>): Uint8Array {
  const local: Uint8Array[] = []; const central: Uint8Array[] = []; let offset = 0;

  const crc32 = (bytes: Uint8Array) => {
    let crc = 0xffffffff;

    for (const byte of bytes) { crc ^= byte;

 for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0); }

    return (crc ^ 0xffffffff) >>> 0;
  };

  for (const [name, text] of Object.entries(files)) {
    const path = encoder.encode(name); const bytes = encoder.encode(text); const crc = crc32(bytes);
    const header = new Uint8Array(30 + path.length); const h = new DataView(header.buffer);
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x800, true);
    h.setUint32(14, crc, true); h.setUint32(18, bytes.length, true); h.setUint32(22, bytes.length, true); h.setUint16(26, path.length, true); header.set(path, 30);
    local.push(header, bytes);
    const record = new Uint8Array(46 + path.length); const c = new DataView(record.buffer);
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x800, true);
    c.setUint32(16, crc, true); c.setUint32(20, bytes.length, true); c.setUint32(24, bytes.length, true); c.setUint16(28, path.length, true); c.setUint32(42, offset, true); record.set(path, 46);
    central.push(record); offset += header.length + bytes.length;
  }

  const size = central.reduce((total, part) => total + part.length, 0);
  const end = new Uint8Array(22); const e = new DataView(end.buffer);
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, central.length, true); e.setUint16(10, central.length, true); e.setUint32(12, size, true); e.setUint32(16, offset, true);
  const output = new Uint8Array(offset + size + 22); let cursor = 0;

  for (const part of [...local, ...central, end]) { output.set(part, cursor); cursor += part.length; }

  return output;
}

export function buildOfflineWebExport(state: WebExperienceEditorState): OfflineWebExport {
  // Unsupported renderer/asset bundles must not silently ship a broken export.
  if (state.embedThree || state.injectStarterAsset) throw new Error("WEB_EXPORT_EXTERNAL_ASSET_UNSUPPORTED");
  const checked = readWebExperienceEditorState({ profile: "web", "web-title": state.title, "web-html": state.html, "web-layout": state.layout });

  if (!checked.ok) throw new Error(checked.reason);
  const view = buildWebExperienceEditorView({ state: checked.value, starterArtifactId: "offline-no-asset" });
  const document = serializeDocument(view.document);
  const digest = createHash("sha256").update(document).digest("hex");

  const files = Object.freeze({
    "index.html": `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; style-src 'self'; frame-src 'self'; worker-src 'self'; manifest-src 'self'; connect-src 'self'; base-uri 'none'; object-src 'none'"><title>Offline Web Experience</title><link rel="manifest" href="./manifest.webmanifest"><link rel="stylesheet" href="./app.css"><script src="./app.js" defer></script></head><body><h1 id="title"></h1><iframe id="canvas" title="Authored page" sandbox=""></iframe><p>Contained HTML canvas; no hosted identity or external assets.</p></body></html>`,
    "app.css": "body{font-family:system-ui;margin:1rem}iframe{width:100%;height:70vh;border:1px solid}",
    "app.js": `"use strict";document.getElementById("title").textContent=${JSON.stringify(view.page.title)};document.getElementById("canvas").srcdoc=${JSON.stringify(view.canvas.srcDoc)};if("serviceWorker" in navigator)navigator.serviceWorker.register("./sw.js",{scope:"./"});`,
    "manifest.webmanifest": JSON.stringify({ name: view.page.title, short_name: "SceneAxi", start_url: "./index.html", scope: "./", display: "standalone" }),
    "document.json": document,
    "sw.js": `"use strict";const CACHE="sceneaxi-html-${digest}";const FILES=["index.html","app.css","app.js","manifest.webmanifest","document.json","sw.js"].map(p=>new URL(p,self.registration.scope).href);self.addEventListener("install",e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting())));self.addEventListener("activate",e=>e.waitUntil(self.clients.claim()));self.addEventListener("fetch",e=>{if(e.request.method==="GET"&&FILES.includes(e.request.url))e.respondWith(caches.open(CACHE).then(c=>c.match(e.request)).then(r=>r||Response.error()));});`,
    "README.txt": `Serve these six runtime files together under their own HTTP localhost or HTTPS directory. Visit index.html online once, await service-worker activation, then revisit offline. Scope and start URL are relative to this directory. Authored HTML is opaque-sandboxed (scripts and networking denied). Three/asset bundles are explicitly unsupported. Canonical document SHA-256: ${digest}. No accounts, credentials, checkout, or hosted APIs are exported.`,
  });

  return Object.freeze({ documentDigest: `sha256:${digest}`, files, archive: zip(files) });
}
