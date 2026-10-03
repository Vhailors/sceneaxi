#!/usr/bin/env python3
"""Read-only source/Git/CI admission verifier. No installs/builds/checkouts.
Run: ./verify.py --live (captures public existing PR/check logs in this directory).
Exit 1 means an artifact failed admission, not that evidence collection failed.
Static lexical closure is intentionally not a TypeScript compiler/YAML evaluator.
"""
import argparse, concurrent.futures, datetime, hashlib, json, os, pathlib, re, subprocess, sys
HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[4]
BASE = 'dd77cc9cb91d24091082e0c5bc20a130f0f51ffc'
PR = '346933c105305224d575bf9319256301c1eeabfa'
def run(args, timeout=25):
    p = subprocess.run(args, cwd=ROOT, capture_output=True, timeout=timeout)
    return {'command': args, 'exit': p.returncode, 'stdout': p.stdout.decode(errors='replace'), 'stderr': p.stderr.decode(errors='replace')}
def sha(b): return hashlib.sha256(b).hexdigest()
def git_tree(ref):
    p = subprocess.run(['git','ls-tree','-rz',ref],cwd=ROOT,capture_output=True,check=True)
    out={}
    for record in p.stdout.split(b'\0'):
        if record:
            meta,name=record.split(b'\t',1); mode,kind,oid=meta.decode().split()
            if kind=='blob': out[name.decode()]={'mode':mode,'oid':oid}
    return out
class Subject:
    def __init__(self, ref=None):
        self.ref=ref
        if ref: self.entries=git_tree(ref)
        else:
            names=subprocess.check_output(['git','ls-files','-co','--exclude-standard','-z'],cwd=ROOT).decode().split('\0')
            self.entries={n:{'mode':'100755' if (ROOT/n).stat().st_mode & 0o111 else '100644'} for n in set(names) if n and (ROOT/n).is_file() and not n.startswith('docs/audits/')}
        self.cache={}
    def text(self,n):
        if n not in self.entries: return ''
        if n not in self.cache:
            data=subprocess.check_output(['git','show',f'{self.ref}:{n}'],cwd=ROOT) if self.ref else (ROOT/n).read_bytes()
            self.cache[n]=data.decode(errors='replace')
        return self.cache[n]
    def exists(self,n): return n in self.entries

def leaves(obj):
    if isinstance(obj,str): yield obj
    elif isinstance(obj,dict):
        for v in obj.values(): yield from leaves(v)
    elif isinstance(obj,list):
        for v in obj: yield from leaves(v)

def inspect(s, baseline):
    errors=[]; refs=[]; exports=[]; workflows=[]
    def need(path,owner,kind):
        path=os.path.normpath(path)
        refs.append({'owner':owner,'path':path,'kind':kind})
        if not s.exists(path): errors.append({'kind':kind,'owner':owner,'missing':path})
    need('docs/dependency-matrix.json','baseline','matrix-file')
    matrix=json.loads(s.text('docs/dependency-matrix.json') or subprocess.check_output(['git','show',BASE+':docs/dependency-matrix.json'],cwd=ROOT))
    for name,entry in matrix['packages'].items():
        directory=entry['dir']; manifest=directory+'/package.json'
        need(manifest,'docs/dependency-matrix.json','matrix-manifest')
        need(directory+'/tsconfig.json','docs/dependency-matrix.json','matrix-tsconfig')
        if s.exists(manifest):
            obj=json.loads(s.text(manifest))
            for target in leaves(obj.get('exports',{})):
                if target.startswith('./') and '*' not in target:
                    exports.append({'package':name,'target':target})
                    need(directory+'/'+target,manifest,'public-export')
    for n in sorted(s.entries):
        if n.startswith('scripts/') and n.endswith(('.mjs','.mts')):
            text=s.text(n)
            for target in re.findall(r'(?:from\s+|import\s*\()\s*[\"\'](\.[^\"\']+)',text):
                need(str(pathlib.PurePosixPath(n).parent/target),n,'script-import')
        if n.startswith('.github/workflows/') and n.endswith(('.yml','.yaml')):
            text=s.text(n); uses=re.findall(r'uses:\s*([^\s#]+)',text)
            unpinned=[u for u in uses if not u.startswith('./') and not re.search(r'@[0-9a-f]{40}$',u)]
            if unpinned: errors.append({'kind':'unpinned-actions','owner':n,'values':unpinned})
            workflows.append({'path':n,'sha256':sha(text.encode()),'uses':uses,'conditionalLines':[{'line':i,'text':l.strip()} for i,l in enumerate(text.splitlines(),1) if re.search(r'\bif:|default: false',l)]})
            for step in re.split(r'(?m)^ *- (?=name:|run:|uses:)',text):
                cwd=re.search(r'working-directory:\s*([^\s#]+)',step)
                directory=cwd.group(1) if cwd else '.'
                for target in re.findall(r'\bnode\s+(scripts/[\w./-]+)',step):
                    need(directory+'/'+target,n,'workflow-node-target')
    for n,entry in baseline.items():
        if entry['mode']=='100755' and (not s.exists(n) or s.entries[n]['mode']!='100755'):
            errors.append({'kind':'baseline-executable-mode','path':n,'expected':'100755','actual':s.entries.get(n)})
    for n in ['scripts/check-publish-ready.mjs','scripts/build-engine-sdk.mjs','scripts/docs-api.mjs','scripts/workspace-dist-resolver.mjs','scripts/lib/package-exports.mjs','sites/umbrella/src/app/api/checkout/checkout-handler.ts']:
        need(n,'acceptance-front-doors','mandatory-target')
    # tsconfig references are actual compiler input, not guessed package dependencies.
    for n in sorted(s.entries):
        if n.endswith('tsconfig.json'):
            try: config=json.loads(s.text(n))
            except json.JSONDecodeError: continue
            for item in config.get('references',[]):
                target=os.path.normpath(str(pathlib.PurePosixPath(n).parent/item['path']))
                need(target if target.endswith('.json') else target+'/tsconfig.json',n,'typescript-project-reference')
    fingerprints={n:sha(s.text(n).encode()) for n in sorted(s.cache)}
    return {'subject':s.ref or 'working-tree-source-not-dist','entryCount':len(s.entries),'errors':errors,'publicExportTargets':exports,'workflowInventory':workflows,'references':refs,'sourceSha256':fingerprints,'fingerprintSha256':sha(json.dumps(fingerprints,sort_keys=True).encode())}

def main():
    parser=argparse.ArgumentParser(); parser.add_argument('--live',action='store_true'); parser.add_argument('--candidate',help='existing immutable local Git commit to admit'); args=parser.parse_args()
    base=git_tree(BASE); local=Subject(); published=Subject(PR)
    results={'taskid':'workflow-ci','capturedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'root':str(ROOT),'head':run(['git','rev-parse','HEAD'])['stdout'].strip(),'baseline':BASE,'published':PR,'scope':'static source/Git closure plus read-only current CI, not a full build or full review','local':inspect(local,base),'pr':inspect(published,base)}
    # Live negative control: remove a real required file in memory only, rerun same validator.
    del local.entries['packages/schemas/package.json']
    neg=inspect(local,base)
    assert any(e.get('missing')=='packages/schemas/package.json' and e['kind']=='matrix-manifest' for e in neg['errors'])
    results['negativeControl']={'input':'in-memory removal of packages/schemas/package.json','observed':'matrix-manifest refusal','pass':True,'diskWrites':False}
    if args.candidate:
        candidate=run(['git','rev-parse',args.candidate+'^{commit}'])
        if candidate['exit']: raise RuntimeError(candidate)
        oid=candidate['stdout'].strip(); results['candidate']=inspect(Subject(oid),base)
        results['candidate']['fastForwardFromPublished']=run(['git','merge-base','--is-ancestor',PR,oid])['exit']==0
    # Actual public checker, read-only/dependency-free. No generation or dist execution.
    results['publicChecker']=run(['node','scripts/check-publish-ready.mjs'])
    if args.live:
        receipt=run(['gh','pr','view','312','--repo','Vhailors/sceneaxi','--json','number,headRefOid,baseRefOid,url,mergeStateStatus,statusCheckRollup'])
        results['ghReceipt']=receipt
        if receipt['exit']==0:
            live=json.loads(receipt['stdout']); results['live']=live
            results['publishedShaStillMatches']=live['headRefOid']==PR
            jobs=live['statusCheckRollup']; results['ciCounts']={c:sum(j.get('conclusion')==c for j in jobs) for c in ['SUCCESS','FAILURE','SKIPPED']}
            results['ciAccepted']=bool(jobs) and all(j.get('status')=='COMPLETED' and j.get('conclusion')=='SUCCESS' for j in jobs)
            runs=sorted({re.search(r'/runs/(\d+)',j['detailsUrl']).group(1) for j in jobs if j.get('conclusion')=='FAILURE'})
            def log(runid):
                try: receipt=run(['gh','run','view',runid,'--repo','Vhailors/sceneaxi','--log-failed'],20)
                except subprocess.TimeoutExpired: return {'run':runid,'status':'TIMEOUT_NOT_PROOF'}
                raw=receipt['stdout']; dest=HERE/('ci-run-'+runid+'.log'); dest.write_text(raw)
                return {'run':runid,'exit':receipt['exit'],'path':dest.name,'sha256':sha(raw.encode()),'stderr':receipt['stderr'],'diagnostics':[l for l in raw.splitlines() if re.search(r'ENOENT|TS5083|TS6053|Cannot find module|MODULE_NOT_FOUND|##\[error\]',l)]}
            with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool: results['failureLogs']=list(pool.map(log,runs))
    results['deferred']=['pnpm docs:api','pnpm gate','pnpm build:sdk','isolated four-site typecheck/build','native packaging/signing acceptance on authorized hosts','required checks on final immutable published candidate SHA']
    results['resourcesCleaned']='No processes/services/fixtures/dependencies created; in-memory mutation discarded; only owned receipts written.'
    results['distUsed']=False
    (HERE/'report.json').write_text(json.dumps(results,indent=2)+'\n')
    print(json.dumps({'localErrors':len(results['local']['errors']),'prErrors':len(results['pr']['errors']),'negativeControl':True,'checkerExit':results['publicChecker']['exit'],'ci':results.get('ciCounts'),'fingerprint':results['local']['fingerprintSha256']},indent=2))
    return 1 if results['local']['errors'] or results['pr']['errors'] or not results.get('ciAccepted',False) else 0
if __name__=='__main__': sys.exit(main())
