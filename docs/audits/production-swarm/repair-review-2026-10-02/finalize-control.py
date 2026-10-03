#!/usr/bin/env python3
"""Finalize de-duplicated review routing and additive control-path inventory."""
from pathlib import Path
from datetime import datetime, timezone
from collections import Counter
import ast, hashlib, json, os, stat, subprocess
ROOT=Path('/home/devuser/Documents/Projects/sceneaxi')
OUT=ROOT/'docs/audits/production-swarm/repair-review-2026-10-02'
def read(name): return json.loads((OUT/name).read_text())
def write(name,data): (OUT/name).write_text(json.dumps(data,indent=2,ensure_ascii=False)+'\n')
l=read('ledger.json');b=read('baseline.json');v=read('verification.json');inventory=read('artifact-inventory.json')
groups={
 'ARTIFACT-TREE':['PR-001','GA-001','05-001','06-01','08-01'],
 'CHECKOUT-INCLUSION':['PR-002','05-002','08-02'],
 'EXACT-CI':['PR-003','02-001','08-03'],
 'VISUAL-INCLUSION':['PR-004','VS-01','VD-01','GA-002','08-05'],
 'UTC-RECEIPTS':['PR-005','VS-03','GA-004'],
 'TYPE-BOUNDARIES':['02-002','08-04'],
 'CATALOG-READONLY':['02-003','VS-02'],
 'VISUAL-TEST-ARTIFACT':['02-005','VS-04'],
 'FOCUS-GEOMETRY':['VD-04','VS-05'],
 'PHYSICS-V1-COMPATIBILITY':['06-02','DEEP-08-ADDITIONAL-1'],
 'VISUAL-REFUSAL-COVERAGE':['VD-03','VD-05','DEEP-08-ADDITIONAL-2'],
 'HOSTED-SERIALIZER-REFUSALS':['05-004','05-005','DEEP-08-ADDITIONAL-3'],
 'CAPACITY-SECURITY-ASSURANCE':['06-04','06-05','DEEP-08-ADDITIONAL-4'],
}
for row in l['rows']:
    row['relatedReviewIds']=[]
    row['canonicalRepairKey']=row['id']
    for key,ids in groups.items():
        if row['id'] in ids:
            row['canonicalRepairKey']=key
            row['relatedReviewIds']=[i for i in ids if i!=row['id']]
    if row['id']=='GATE-PUBLICATION':
        row['authorityClarification']='Existing PR #312 correction and subsequent visual loop are already authorized for serial publication ONLY. This external gate is broader signed/public release/update publication, not permission to repair the PR or local code.'
    if row['id']=='GATE-OBSERVABILITY':
        row['localComponentDisposition']='Read-only PR/current-check observation is locally achievable and executed in remote-pr/checks receipts; configured monitoring and genuine ops drills remain separately external. Do not park local checks under this input gate.'
    if row['id']=='DR-006':
        row['localComponentDisposition']='Implement and verify missing local user-project native packaging adapter through serial-owned schema contract; retain true native-host/signing/notarization certification separately.'
    if row['status']=='INTENTIONAL_FULL_PRODUCTION_GAP':
        row['localEngineeringPolicy']='Not a DONE disposition or permission to park achievable engineering. Route compatible local implementation/oracles to missing-capabilities; preserve held-key/Kids/LIVE and required architecture guards. Any remaining exclusion still fails the unchanged full-production goal.'
    row['acceptance']['passResult']='DONE_VERIFIED only for executed, named matching assertions on exact artifact; acceptance plans or inherited finish claims remain NEEDS_LOCAL_FIX.'
l['deduplication']={'reviewGroups':groups,'interpretation':'355 accounting records are preserved for provenance and coverage, not 355 disjoint defects or release criteria. Aliases identify overlapping review causes; no percentage denominator claimed.'}
write('ledger.json',l)

# Compare raw source bytes AND executable/symlink modes to the immutable source snapshot.
for row in inventory['currentIntendedSourceInventory']:
    p=ROOT/row['path']
    if not row.get('present'):
        assert not p.exists() and not p.is_symlink(),row['path'];continue
    s=p.lstat();content=os.fsencode(os.readlink(p)) if stat.S_ISLNK(s.st_mode) else p.read_bytes()
    mode='120000' if stat.S_ISLNK(s.st_mode) else ('100755' if s.st_mode & 0o111 else '100644')
    assert hashlib.sha256(content).hexdigest()==row['sha256'],row['path']
    assert mode==row['mode'],row['path']
for p in OUT.glob('*.py'):
    ast.parse(p.read_text(),filename=str(p))
for p in OUT.rglob('*.json'):
    json.loads(p.read_text())
for row in l['rows']:
    assert row['acceptance']['command'].strip() and row['targets'] and row['acceptance']['assertions']
    assert all(str(x).strip() for x in row['acceptance']['assertions'])
assert len({r['id'] for r in l['rows']})==355
assert len(l['originalLocalIds'])==113 and len(l['missing53Ids'])==53
assert all(next(r for r in l['rows'] if r['id']==i)['ownerLane']=='missing-capabilities' for i in l['missing53Ids'])
result=subprocess.run(['git','diff','--check','--',str(OUT.relative_to(ROOT))],cwd=ROOT,capture_output=True,timeout=30)
assert result.returncode==0,result.stdout.decode(errors='replace')
head=subprocess.run(['git','rev-parse','HEAD'],cwd=ROOT,capture_output=True,check=True).stdout.decode().strip()
assert head==b['localHead']
remote=read('remote-pr.json')
if remote.get('exit')==0:
    d=remote['data'];b['freshRemote']={'url':d['url'],'state':d['state'],'sha':d['headRefOid'],'base':d['baseRefOid'],'ciConclusions':dict(Counter(c.get('conclusion') for c in d['statusCheckRollup'])),'capturedAt':remote['capturedAt']}
b['controlStatus']='DONE_VERIFIED_REPORT_INVARIANTS_ONLY'
b['ownershipHandoff']='RELEASED_TO_SERIAL_INTEGRATION; lanes own only their fix pairs after dispatch'
b['applicationCompletion']='NOT_VERIFIED_BY_BASELINE'
b['productionStatus']='BLOCKED'
b['additiveReportInventory']='control-artifact-inventory.json'
v['priorFinalizationFailure']={'exit':1,'output':'AssertionError: six newly created parallel-expansion sidecar reports were not in original immutable snapshot','recovery':'Read-only additive late-report inventory preserves their hashes/modes without altering initial source fingerprint or sidecar contents.'}
v['finalVerification']={'at':datetime.now(timezone.utc).isoformat(),'exit':0,'command':'python3 docs/audits/production-swarm/repair-review-2026-10-02/finalize-control.py','assertions':['all355 unique records and113/53 retained after aliasing','all baseline source bytes AND modes unchanged','three report-generation scripts parse as Python','every JSON report parses','scoped git diff --check exit0','HEAD unchanged','local PR correction authority distinguished from broader held publication gate','all current untracked paths enumerated, including late read-only sidecar reports'],'applicationTestsExecuted':False}
self_path=OUT/'control-artifact-inventory.json'
control=[]
for p in sorted(OUT.rglob('*')):
    if not p.is_file() or p==self_path:continue
    data=p.read_bytes();s=p.stat()
    control.append({'path':str(p.relative_to(ROOT)),'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'mode':'100755' if s.st_mode & 0o111 else '100644'})
control.append({'path':str(self_path.relative_to(ROOT)),'mode':'100644','selfReferencePolicy':'This additive inventory enumerates itself; its own hash/bytes cannot be recursively embedded. External hash is computed by the serial candidate receipt.'})
all_untracked=subprocess.run(['git','ls-files','--others','--exclude-standard','-z'],cwd=ROOT,capture_output=True,check=True).stdout
paths={os.fsdecode(p) for p in all_untracked.split(b'\0') if p}
paths.add(str(self_path.relative_to(ROOT)))
covered={r['path'] for r in inventory['everyUntrackedPath']} | {r['path'] for r in control}
late=[]
for name in sorted(paths-covered):
    assert name.startswith('docs/audits/production-swarm/parallel-expansion-2026-10-02/'), 'New source addition requires serial re-snapshot: '+name
    p=ROOT/name;data=p.read_bytes();s=p.stat()
    late.append({'path':name,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'mode':'100755' if s.st_mode & 0o111 else '100644','writeOwner':'parallelism-sidecar','observedAfterBaseline':True,'thisNodeReadOnly':True})
assert paths <= covered | {r['path'] for r in late}
write('baseline.json',b)
write('verification.json',v)
# Refresh control report hashes after their final writes, without changing source snapshot.
for row in control:
    if row['path']==str(self_path.relative_to(ROOT)):continue
    data=(ROOT/row['path']).read_bytes();row['bytes']=len(data);row['sha256']=hashlib.sha256(data).hexdigest()
write('control-artifact-inventory.json',{'sourceInventory':'artifact-inventory.json','controlFiles':control,'readOnlyLateReportAdditions':late,'everyCurrentUntrackedPath':sorted(paths),'coverageAssertion':'All current untracked paths are present in source inventory, additive control inventory or late read-only sidecar inventory; no untracked handler, visual source, test/evidence or report silently omitted.','candidateAssemblyPolicy':'Serial normal-Git complete-tree review preserves untouched paths/modes, approves each deletion and explicitly reviews intended untracked additions. No source objects/index/commit/push written here.'})
print(json.dumps({'status':'DONE_VERIFIED_CONTROL_ONLY','rows':355,'originals':113,'missing53':53,'reportFiles':len(control),'allUntrackedEnumerated':len(paths),'sourceBytesAndModesPreserved':True,'applicationTestsExecuted':False,'HEAD':head},indent=2))
