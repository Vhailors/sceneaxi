/** Unsigned local lockfile inventory, NOT an installed/deployed/signed attestation. */
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parse } from 'yaml';

export const INSTALL_ROOTS = Object.freeze(['.','sites/umbrella','sites/catalog-game','sites/catalog-web','sites/kids','desktop/linux','desktop/macos','desktop/windows']);

export async function collectLocalSbom(root = '.') {
  const components = new Map(); const locks = [];

  for (const directory of INSTALL_ROOTS) {
    const bytes = await readFile(resolve(root,directory,'pnpm-lock.yaml'),'utf8');
    const lock = parse(bytes); const filename = `${directory}/pnpm-lock.yaml`;
    locks.push({ name: filename, value: createHash('sha256').update(bytes).digest('hex') });

    for (const [locator, value] of Object.entries(lock.packages ?? {})) {
      const nameVersion = locator.split('(')[0]; const split = nameVersion.lastIndexOf('@');

      if (split < 1) throw new Error('SBOM_UNSUPPORTED_LOCK_LOCATOR');
      const name = nameVersion.slice(0,split); const version = nameVersion.slice(split+1);
      const key=`${name}@${version}`;
      const component=components.get(key) ?? { type: 'library', name, version, 'bom-ref': key, properties: [] };
      component.properties.push({ name: `sceneaxi:lock-source:${directory}`, value: String(value.resolution?.integrity ?? 'lock-entry-no-integrity') });
      components.set(key,component);
    }
  }

  const git=spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'});

  if(git.status!==0) throw new Error('SBOM_SOURCE_IDENTITY_UNAVAILABLE');
  const status=spawnSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'});

  if(status.status!==0) throw new Error('SBOM_SOURCE_STATUS_UNAVAILABLE');

  return { bomFormat: 'CycloneDX', specVersion: '1.6', version: 1,
    metadata: { tools: { components: [{type:'application',name:'node',version:process.version},{type:'application',name:'pnpm-policy',version:'9.15.0'}] },
      properties: [{name:'sceneaxi:evidence-kind',value:'unsigned-local-lockfile-inventory-not-installed-or-deployed-attestation'},{name:'sceneaxi:source-head',value:git.stdout.trim()},{name:'sceneaxi:source-dirty',value:String(status.stdout.length>0)},...locks] },
    components: [...components.values()].sort((a,b)=>a['bom-ref'].localeCompare(b['bom-ref'])) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [flag,output,...rest]=process.argv.slice(2);

  if(flag!=='--out'||!output||rest.length) throw new Error('usage: node scripts/local-sbom.mjs --out <local-json>');
  await writeFile(output,JSON.stringify(await collectLocalSbom(),null,2)+'\n');
  console.log('Unsigned local lockfile SBOM written; no signature, upload or deployment claim.');
}
