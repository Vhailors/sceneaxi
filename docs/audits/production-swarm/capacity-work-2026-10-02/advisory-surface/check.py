#!/usr/bin/env python3
"""Read-only installed-Next/front-door + lock advisory probe. Writes only beside itself.
Run: python3 check.py [--refresh-official]. No install/build/service/exploit.
Installed dependency JS/native binaries are the runtime subject, NOT a site build.
"""
import argparse
import datetime
import hashlib
import json
import pathlib
import re
import subprocess
import urllib.request

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[4]
SITES = ('umbrella', 'catalog-game', 'catalog-web', 'kids')
URL = 'https://api.github.com/repos/lovell/sharp/security-advisories'

def digest(data):
    return hashlib.sha256(data).hexdigest()

def run(args, timeout=20):
    result = subprocess.run(args, cwd=ROOT, capture_output=True, text=True, timeout=timeout)
    return {'command': args, 'exit': result.returncode, 'stdout': result.stdout, 'stderr': result.stderr}

def matches(version, expression):
    # Deliberately fail closed on new syntax; official snapshot currently simple comparators.
    match = re.fullmatch(r'\s*(<=|>=|<|>|=)\s*(\d+)\.(\d+)\.(\d+)\s*', expression)
    if not match or not re.fullmatch(r'\d+\.\d+\.\d+', version):
        raise ValueError('UNSUPPORTED_ADVISORY_RANGE: ' + expression + ' / ' + version)
    current = tuple(map(int, version.split('.')))
    target = tuple(map(int, match.groups()[1:]))
    return {'<': current < target, '<=': current <= target, '>': current > target,
            '>=': current >= target, '=': current == target}[match[1]]

NODE = r'''
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const {createRequire} = require('node:module');
const req = createRequire(path.resolve(process.argv[1], 'package.json'));
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
const receipt = p => ({path:p, sha256:hash(fs.readFileSync(p))});
(async () => {
  const nextPath = req.resolve('next/package.json');
  const fromNext = createRequire(nextPath);
  let sharpDir = path.dirname(fromNext.resolve('sharp'));
  let sharpPath;
  for (let depth = 0; depth < 8; depth++) {
    const candidate = path.join(sharpDir, 'package.json');
    if (fs.existsSync(candidate) && JSON.parse(fs.readFileSync(candidate, 'utf8')).name === 'sharp') {
      sharpPath = candidate; break;
    }
    sharpDir = path.dirname(sharpDir);
  }
  assert(sharpPath, 'resolved sharp package manifest absent');
  const optimizerPath = req.resolve('next/dist/server/image-optimizer.js');
  const configPath = req.resolve('next/dist/shared/lib/image-config.js');
  const optimizer = req(optimizerPath);
  const sharp = optimizer.getSharp(1);
  const defaults = req(configPath).imageConfigDefault;
  const semver = req('next/dist/compiled/semver');
  const next = req(nextPath);
  const installed = req(sharpPath);
  assert(semver.satisfies(installed.version, next.optionalDependencies.sharp));
  assert(semver.satisfies(process.versions.node, installed.engines.node));
  const cases = [];
  async function refusal(name, bytes, options, expected) {
    let observed;
    try { await optimizer.optimizeImage({buffer:bytes, contentType:'image/png', quality:75,
      width:8, concurrency:1, limitInputPixels:256, timeoutInSeconds:2, ...options}); }
    catch (error) { observed = error.message; }
    assert(observed && expected.test(observed), name + ': ' + observed);
    cases.push({name, inputBase64:bytes.toString('base64'), inputSha256:hash(bytes),
      options, observed, expected:expected.source, pass:true});
  }
  const png = await sharp({create:{width:16,height:16,channels:4,
    background:{r:125,g:40,b:230,alpha:1}}}).png().toBuffer();
  const output = await optimizer.optimizeImage({buffer:png,contentType:'image/png',quality:75,
    width:8,concurrency:1,limitInputPixels:256,timeoutInSeconds:2});
  const metadata = await sharp(output).metadata();
  assert.equal(metadata.width,8); assert.equal(metadata.height,8);
  cases.push({name:'real-Next-raster-positive',inputBase64:png.toString('base64'),
    inputSha256:hash(png),outputSha256:hash(output),width:metadata.width,height:metadata.height,pass:true});
  await refusal('pixel-budget-negative',png,{limitInputPixels:1},/pixel limit/i);
  await refusal('malformed-negative',Buffer.from('not an image'),{},/unsupported image format/i);
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><rect width="1" height="1"/></svg>');
  const svgRaster = await optimizer.optimizeImage({buffer:svg,contentType:'image/png',quality:75,width:8,concurrency:1,limitInputPixels:256,timeoutInSeconds:2});
  cases.push({name:'benign-SVG-low-level-decodes-report-refutation',inputBase64:svg.toString('base64'),inputSha256:hash(svg),outputSha256:hash(svgRaster),pass:true});
  let svgError;
  try { await optimizer.imageOptimizer({buffer:svg,etag:'fixture',cacheControl:''},
    {href:'/control.svg',quality:75,width:8,mimeType:'image/png'},{images:defaults},{silent:true}); }
  catch (error) { svgError = {status:error.statusCode,message:error.message}; }
  assert.equal(svgError?.status,400);
  assert.equal(svgError?.message,'"url" parameter is valid but image type is not allowed');
  cases.push({name:'Next-front-door-SVG-refusal',inputSha256:hash(svg),observed:svgError,pass:true});
  const remoteQuery = {url:'https://example.invalid/control.png',w:'640',q:'75'};
  const remote = optimizer.ImageOptimizerCache.validateParams({headers:{}},remoteQuery,{images:defaults},false);
  assert.equal(remote.errorMessage,'"url" parameter is not allowed');
  cases.push({name:'remote-URL-negative',input:remoteQuery,observed:remote,pass:true});
  const localQuery = {url:'/control.png',w:'640',q:'75'};
  const local = optimizer.ImageOptimizerCache.validateParams({headers:{}},localQuery,{images:defaults},false);
  assert(!local.errorMessage, JSON.stringify(local));
  cases.push({name:'local-path-admission-not-HTTP',input:localQuery,observed:local,pass:true});
  console.log(JSON.stringify({next:next.version,nextSharpRange:next.optionalDependencies.sharp,
    sharp:installed.version,sharpNodeRange:installed.engines.node,node:process.version,
    versions:sharp.versions,defaults,compatible:true,cases,
    subject:[nextPath,sharpPath,optimizerPath,configPath,fromNext.resolve('sharp'),
      ...Object.keys(require.cache).filter(p=>p.endsWith('.node'))].map(receipt)}));
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
'''

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--refresh-official', action='store_true')
    args = parser.parse_args()
    official_path = HERE / 'official-advisories.json'
    if args.refresh_official:
        request = urllib.request.Request(URL, headers={'Accept':'application/vnd.github+json', 'User-Agent':'sceneaxi-readonly-advisory-proof'})
        with urllib.request.urlopen(request, timeout=15) as response:
            raw = response.read(2_000_000)
            json.loads(raw)
        official_path.write_bytes(raw)
    raw = official_path.read_bytes()
    advisories = json.loads(raw)
    assert isinstance(advisories, list) and advisories
    ranges = [{'id':a['ghsa_id'],'url':a['html_url'],'affected':v['vulnerable_version_range'],
               'fixed':v['patched_versions']} for a in advisories for v in a['vulnerabilities']
              if v['package']['name']=='sharp']
    assert ranges
    # Negative controls exercise the same advisory decision used on every real locked/installed version.
    controls = [{'input':'0.34.5','id':a['id'],'affected':matches('0.34.5',a['affected'])} for a in ranges]
    assert any(c['affected'] for c in controls), 'negative control unexpectedly admitted old sharp'
    assert all(not matches('0.35.5',a['affected']) and matches('0.35.5',a['fixed']) for a in ranges)
    inputs = {}
    sites = []
    failures = []
    for site in SITES:
        directory = ROOT / 'sites' / site
        for name in ('package.json','pnpm-lock.yaml','next.config.ts','security-headers.json'):
            p = directory / name
            inputs[str(p.relative_to(ROOT))] = digest(p.read_bytes())
        lock = (directory/'pnpm-lock.yaml').read_text()
        locked = sorted(set(re.findall(r'^  sharp@(\d+\.\d+\.\d+)(?:\(|:)',lock,re.M)))
        assert locked, 'missing sharp lock entry'
        source_uses = []
        for p in sorted((directory/'src').rglob('*')):
            if p.suffix not in ('.ts','.tsx','.js','.jsx'): continue
            text = p.read_text()
            for number,line in enumerate(text.splitlines(),1):
                if re.search(r'next/image|\bsharp\b|/_next/image',line):
                    source_uses.append({'path':str(p.relative_to(ROOT)),'line':number,'text':line.strip()})
        result = run(['node','-e',NODE,str(directory)],25)
        runtime = json.loads(result['stdout']) if result['exit']==0 else None
        if result['exit'] != 0: failures.append(site+': installed Next probe failed: '+result['stderr'])
        versions = locked + ([runtime['sharp']] if runtime else [])
        affected = [{'version':v,'id':a['id']} for v in versions for a in ranges if matches(v,a['affected'])]
        if affected: failures.append(site+': affected version remains')
        if runtime and runtime['sharp'] not in locked: failures.append(site+': installed/lock drift')
        published = run(['git','show','346933c105305224d575bf9319256301c1eeabfa:sites/'+site+'/pnpm-lock.yaml'])
        published_raw = published.pop('stdout')
        published['sha256'] = digest(published_raw.encode()) if published['exit']==0 else None
        published['sharpVersions'] = sorted(set(re.findall(r'^  sharp@(\d+\.\d+\.\d+)(?:\(|:)',published_raw,re.M)))
        sites.append({'site':site,'locked':locked,'affected':affected,'runtime':runtime,
          'probeExit':result['exit'],'probeStderr':result['stderr'],'sourceImageUses':source_uses,
          'configImageMention':bool(re.search(r'\bimages\s*:',(directory/'next.config.ts').read_text())),
          'historicalPublishedLock':published})
    fingerprint = digest(json.dumps(inputs,sort_keys=True,separators=(',',':')).encode())
    report = {'taskid':'advisory-surface','generatedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),
      'status':'PASS_BOUNDED_ONLY' if not failures else 'FAIL','failures':failures,
      'root':str(ROOT),'head':run(['git','rev-parse','HEAD'])['stdout'].strip(),
      'inputFingerprint':fingerprint,'inputHashes':inputs,'official':{'url':URL,'sha256':digest(raw),
      'freshFetchThisRun':args.refresh_official,'ranges':ranges},'negativeControls':controls,'sites':sites,
      'executed':['official range comparison','locked/installed version compatibility','installed Next optimizer raster/refusal/URL validation','historical exact-SHA lock inspection'],
      'deferred':[{'check':'production HTTP /_next/image and tracing of rebuilt exact candidate','status':'NOTRUN','reason':'heavy jobs forbidden; no existing server assumed source-matched'},
        {'check':'full gate/build/browser/production exploitability','status':'NOTRUN'}],
      'subject':'Installed dependency JS/native artifacts (hashed); no site dist used; product source only statically inspected.',
      'cleanup':'No files outside exclusive auxiliary directory, no services/ports/temp fixtures allocated.',
      'owner':'serial integration after explicit handoff; manifests/locks security-delivery; site config sites owner',
      'fullReviewClaim':False}
    (HERE/'report.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({'status':report['status'],'fingerprint':fingerprint,'sites':[{ 'site':s['site'],'locked':s['locked'],'sharp':s['runtime']['sharp'] if s['runtime'] else None,'assertedCases':len(s['runtime']['cases']) if s['runtime'] else 0} for s in sites],'failures':failures},indent=2))
    return bool(failures)

if __name__ == '__main__':
    raise SystemExit(main())
