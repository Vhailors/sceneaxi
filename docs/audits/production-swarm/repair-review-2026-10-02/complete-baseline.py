#!/usr/bin/env python3
"""Complete report-only packets and verify preserved-work/ledger invariants."""
from pathlib import Path
from collections import Counter
from datetime import datetime, timezone
import hashlib, json, re, subprocess

ROOT=Path('/home/devuser/Documents/Projects/sceneaxi')
OUT=ROOT/'docs/audits/production-swarm/repair-review-2026-10-02'
def load(name): return json.loads((OUT/name).read_text())
def write(name,data): (OUT/name).write_text(json.dumps(data,indent=2,ensure_ascii=False)+'\n')
ledger=load('ledger.json'); baseline=load('baseline.json'); inventory=load('artifact-inventory.json'); ownership=load('ownership.json')['owners']
lanes=[l for l in ownership if l!='serial-integration']

# Children receive exact disjoint files. Cross-cutting IDs remain with lead, never duplicated.
def child(lane,path):
    if lane=='authoring-assets':
        if path.startswith('packages/authoring-core/'):return 'authoring-core'
        if path.startswith(('packages/importers/','packages/plugin-host/')):return 'importers-plugin'
        return 'profiles-kids'
    if lane=='engine-physics':
        if path.startswith('packages/engine-presentation/'):return 'presentation'
        if path.startswith('packages/physics-rapier/'):return 'physics'
        return 'kernel-orchestrator'
    if lane=='billing':return 'provider-checkout-db' if path.startswith(('sites/','db/')) else 'billing-core'
    if lane=='identity-provider':return 'auth-core' if path.startswith('packages/auth/') else 'provider-wiring'
    if lane=='sites-accessibility':
        if path.startswith(('sites/catalog-game/','sites/catalog-web/')):return 'catalog-pair'
        return 'umbrella'
    if lane=='desktop-cli':
        if path.startswith('packages/cli/'):return 'cli'
        if path.startswith('apps/desktop-shell/'):return 'desktop-chrome'
        if path.startswith('apps/web-shell/'):return 'web-inspector'
        if path.startswith('desktop/linux/'):return 'linux-runtime'
        return 'macos-windows-release'
    if lane=='security-delivery':return 'scripts-checkers' if path.startswith('scripts/') else 'manifests-workflows'
    return 'site-kit-capabilities'

packets=[]
for lane in lanes:
    owned=ownership[lane]
    children={}
    for path in owned:
        children.setdefault(child(lane,path),{'files':[],'taskIds':[]})['files'].append(path)
    tasks=[r for r in ledger['rows'] if r['ownerLane']==lane]
    lead_tasks=[]
    for task in tasks:
        responsible={child(lane,t['path']) for t in task['targets'] if t['writeOwner']==lane and t['path'] in owned}
        if len(responsible)==1:
            name=next(iter(responsible));children[name]['taskIds'].append(task['id'])
        else:
            lead_tasks.append(task['id'])
    packet={'lane':lane,'implementationModelRequested':'GPT-6.1 Sol standard','independentReviewerModelRequested':'GPT-6 Astra standard','maximumRepairPasses':3,'dispatch':'NOT_STARTED_BY_BASELINE_NODE; orchestration must avoid already-running builders','ownedFiles':owned,'taskIds':[r['id'] for r in tasks],'leadCoordinatorTaskIds':lead_tasks,'oneLevelChildren':children,'leadWrites':'Only own fix report and undelegated files; no delegated file writes before explicit child completion/handoff.','sharedRequests':[{'id':r['id'],'targets':[t for t in r['targets'] if t['writeOwner']!=lane]} for r in tasks if any(t['writeOwner']!=lane for t in r['targets'])],'heavyProcessPolicy':'At most ONE root/site build, browser, native smoke or packaging process at a time across entire graph; builders do focused tests only, root and production-site builds are serial-integration-owned.','passCriteria':'Every task has reproduced/refuted hypothesis, exact current file hashes, permanent positive/negative assertions with command+exit+named oracle, no weakened safety/checks and cleaned resources. Historical/local evidence never certifies published SHA. Three passes maximum; exhausted failures stay NEEDS_LOCAL_FIX, not synthetic PASS.'}
    packets.append(packet)
    lines=[f'# Assignment — {lane}', '', '**Status:** READY FOR DISPATCH, not implemented or verified by baseline.', '', '## Role and safety', '', 'Lead: GPT-6.1 Sol, standard tier requested; independent reviewer/judge: GPT-6 Astra, standard tier requested. Orchestrator must confirm actual dispatch. Repair bound: three passes. Parent is coordinator; no recursive grandchildren. Do not duplicate live builders. No writes to child-owned files until explicit completion handoff.', '', 'Read whole target files and canonical helpers before writing. Preserve all inherited dirty/untracked work. Reproduce exact failures and retain fail-before/pass-after oracles. No blanket casts, weakened checks, skipped assertions or invented external resources. No staging, commits, pushes, public posts, merge, deployment, spending, accounts, LIVE activation, production DB or held proof.', '', 'ALL manifests, locks, dependency manifests and workflows belong to security-delivery, even inside your package/site/desktop directories. Shared schemas/index, root configurations/exports, root tests and owning docs are serial-integration-only. Source files not listed below are read-only; submit exact requests to their owner.', '', 'Root/site builds and full gate belong to serial integration. No more than one heavy build/browser/native/packaging process runs graph-wide. Lightweight static/code work may fan out under available-memory monitoring.', '', '## Task acceptance', '', f'Primary tasks ({len(tasks)}): '+', '.join(packet['taskIds'])+'.', '', 'Read exact targets, symbols, SHA-256, dependency owners, commands and nonblank assertions from `../ledger.json`. A named suite exit is insufficient if the task assertion has no executed matching oracle. Baseline verification state is NOT_EXECUTED; no DONE or percentage transferred from finish reports.', '', 'Astra PASS requires every assigned assertion tied to current exact source/artifact, preserved positive/negative safety, and recorded command/exit/cleanup. Local and published and full-production are separately classified. Reports must use DONE_VERIFIED, NEEDS_LOCAL_FIX, EXTERNAL_BLOCKER with exact missing input, or INTENTIONAL_FULL_PRODUCTION_GAP; the latter never closes the full goal.', '', '## One-level parallel child packets', '']
    for name,c in children.items():
        lines.extend([f'### {name}', '', 'Task IDs: '+(', '.join(c['taskIds']) or 'Source-preservation/closure support only; lead retains cross-file task IDs')+'.', '', 'Exclusive exact files:', ''])
        lines.extend('- `'+f+'`' for f in c['files'])
        lines.append('')
    lines.extend(['## Lead-only cross-file task coordination', '', ', '.join(lead_tasks) or 'None.', '', 'All task source owners outside this lane are dependencies, not overlapping write grants. Exact requests are machine-readable in `../assignments.json`. A missing-capabilities task owner may not rewrite source belonging to another lane; it must obtain a bounded owner implementation/handoff and retain responsibility for complete acceptance.', '', '## Report ownership and handoff', '', f'Own only `../fix-{lane}.md` and `../fix-{lane}.json` for lane findings. Write them early; retain source hashes, commands, exits, assertion names, failures, resource cleanup and external inputs. Other audit/repair/finish directories are READ ONLY. After completion explicitly release these reports and child file claims to serial integration; no permanent report lock.', ''])
    if lane=='missing-capabilities':
        lines.extend(['## Uncovered original tasks — exclusive primary task responsibility', '', 'The following 53 IDs had no finish row; they are exclusively assigned here. Other lanes remain source owners when their exact paths are required. Do not hide local work under external-only labels; split genuine credentials/signing/hardware from missing local adapters.', '', ', '.join(ledger['missing53Ids'])+'.', '', 'Detailed acceptance may be expanded by this designated worker, preserving all canonical assertions and the nonblank executable command already provided. Implement unclaimed site-kit helper/test work concurrently; request exact shared schema/root-test/manifest and other-lane patches. DR-006 native user-project adapter is a local dependency, separate from external signing/native certification.', ''])
    dest=OUT/'assignments'/f'{lane}.md';dest.parent.mkdir(exist_ok=True);dest.write_text('\n'.join(lines))
write('assignments.json',{'schemaVersion':1,'root':str(ROOT),'resourceInputsFromParent':{'logicalCpus':12,'availableRamMiB':5233,'swapUsedMiB':49523,'freshlyMeasuredHere':False},'schedule':['Prepare static sources and dedicated focused fixtures in disjoint children concurrently.','Lightweight focused test processes start only under coordinator memory admission; never assume 12 CPUs permit 12 memory-heavy suites.','One heavy process total: serial root build/gate, then site builds, then browser/native proof, each on stable artifact.','Astra evaluates exact row assertions for pass 1; failed rows routed only to owner; pass 2 and pass 3 similarly bounded.','Serial integration reconciles ledger/inventory; serial publication alone makes checked descendant commit(s)/fast-forward push; judge exact published SHA and required CI.'],'packets':packets,'serialOwnedFiles':ownership['serial-integration'],'handoff':'Baseline control report ownership released to serial integration on completion; subsequent lanes own only their fix pair.'})

# Read-only remote metadata; a failed command is recorded, never promoted to CI success.
remote=[]
for name,args in [('remote-pr.json',['gh','pr','view','312','--repo','Vhailors/sceneaxi','--json','url,state,createdAt,headRefOid,baseRefOid,statusCheckRollup']),('remote-checks.json',['gh','pr','checks','312','--repo','Vhailors/sceneaxi','--json','name,state,link,bucket'])]:
    try:
        result=subprocess.run(args,cwd=ROOT,capture_output=True,timeout=45)
        receipt={'command':' '.join(args),'cwd':str(ROOT),'exit':result.returncode,'capturedAt':datetime.now(timezone.utc).isoformat(),'timeoutSeconds':45}
        try:receipt['data']=json.loads(result.stdout)
        except (ValueError,TypeError):receipt['stdout']=result.stdout.decode(errors='replace')
        receipt['stderr']=result.stderr.decode(errors='replace')
    except subprocess.TimeoutExpired:
        receipt={'command':' '.join(args),'exit':None,'status':'TIMEOUT','timeoutSeconds':45}
    write(name,receipt);remote.append({'path':name,'exit':receipt.get('exit')})

result=subprocess.run(['git','diff','--name-status',baseline['oldPublishedDiff']['freshReproductionCommand'].split()[-2],baseline['oldPublishedDiff']['freshReproductionCommand'].split()[-1]],cwd=ROOT,capture_output=True,timeout=30)
assert result.returncode==0
counts=dict(Counter(line.split(b'\t')[0].decode()[0] for line in result.stdout.splitlines() if line))
assert counts=={'D':825,'M':204,'A':180,'R':1},counts
baseline['oldPublishedDiff']['freshlyReproducedCounts']=counts
baseline['remoteEvidence']=remote
baseline['executableCounts']={k:len(v) for k,v in inventory['executables'].items()}
baseline['priorPreparationFailures']=[{'step':'machine finding normalization','exit':1,'output':"AttributeError: 'str' object has no attribute 'get' on final additionalFindings","recovery":"Accept string-form additional findings without dropping records; successful script rerun."},{'step':'shell-filtered diff counting','exit':1,'output':'IndexError: list index out of range','recovery':'Native Git diff captured directly with subprocess; exhaustive counts D825/M204/A180/R1 now asserted.'}]
write('baseline.json',baseline)

ids=[r['id'] for r in ledger['rows']]
assert len(ids)==len(set(ids))
assert len(ledger['originalLocalIds'])==113
assert len(ledger['missing53Ids'])==53
assert set(ledger['originalLocalIds']) <= set(ids)
assert all(next(r for r in ledger['rows'] if r['id']==i)['ownerLane']=='missing-capabilities' for i in ledger['missing53Ids'])
assert all(r['acceptance']['command'].strip() and r['acceptance']['assertions'] and all(str(a).strip() for a in r['acceptance']['assertions']) and r['targets'] for r in ledger['rows'])
assert all(r['artifact']['worktreeInventorySha256']==inventory['worktreeInventorySha256'] and r['maximumRepairPasses']==3 for r in ledger['rows'])
files=[f for packet in packets for f in packet['ownedFiles']]
assert len(files)==len(set(files))
child_files=[f for packet in packets for c in packet['oneLevelChildren'].values() for f in c['files']]
assert len(child_files)==len(set(child_files)) and set(child_files)==set(files)
for packet in packets:
    assert not any(Path(f).name in ('package.json','pnpm-lock.yaml','package-lock.json','yarn.lock') or f.startswith('.github/workflows/') for f in packet['ownedFiles']) or packet['lane']=='security-delivery'
assert ledger['statusCounts'].get('EXTERNAL_BLOCKER')==22
assert ledger['statusCounts'].get('INTENTIONAL_FULL_PRODUCTION_GAP')==13

changed=[]
for row in inventory['currentIntendedSourceInventory']:
    p=ROOT/row['path']
    if not row.get('present'):
        assert not p.exists() and not p.is_symlink(),row['path'];continue
    content=bytes(str(p.readlink()),'utf-8') if p.is_symlink() else p.read_bytes()
    if hashlib.sha256(content).hexdigest()!=row['sha256']:changed.append(row['path'])
assert not changed,{'concurrentSourceChanges':changed}
receipt={'status':'PASS_REPORT_INVARIANTS_AND_SNAPSHOT_PRESERVATION','exit':0,'commands':['python3 docs/audits/production-swarm/repair-review-2026-10-02/prepare-baseline.py','python3 docs/audits/production-swarm/repair-review-2026-10-02/complete-baseline.py'],'assertions':['all113 original IDs retained','all53 missing IDs exclusively assigned','all355 rows have nonblank executable command and assertions, targets, artifact identity','no duplicate task IDs or lane/child file ownership','ALL manifests/locks/workflows remain security-owned','22 true external and13 intentional full-production gaps retained','base1101/head456/D825/M204/A180/R1 freshly reproduced','all pre-existing snapshot paths/bytes preserved; four unapproved missing base paths flagged'],'statusCounts':ledger['statusCounts'],'sourceInventorySha256':inventory['worktreeInventorySha256'],'sourceTestsExecuted':False,'cleanup':'No temporary fixture/server/container created.'}
write('verification.json',receipt)
print(json.dumps({'ledgerRows':len(ids),'statusCounts':ledger['statusCounts'],'childPackets':sum(len(p['oneLevelChildren']) for p in packets),'lanePackets':len(packets),'oldNativeDiff':counts,'snapshotPreserved':not changed},indent=2))
