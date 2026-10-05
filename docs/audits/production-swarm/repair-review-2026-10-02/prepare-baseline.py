#!/usr/bin/env python3
"""Read-only Git/source accounting; write only this repair report directory."""
from pathlib import Path
from collections import Counter
from datetime import datetime, timezone
import hashlib, json, os, re, stat, subprocess, sys

ROOT = Path('/home/devuser/Documents/Projects/sceneaxi')
REPORT = ROOT / 'docs/audits/production-swarm'
OUT = REPORT / 'repair-review-2026-10-02'
BASE = 'dd77cc9cb91d24091082e0c5bc20a130f0f51ffc'
OLD = '346933c105305224d575bf9319256301c1eeabfa'
PREFIX = str(OUT.relative_to(ROOT)) + '/'
LANES = ['authoring-assets', 'engine-physics', 'billing', 'identity-provider', 'sites-accessibility', 'desktop-cli', 'security-delivery', 'missing-capabilities']
ROUTE = {'authoring': LANES[0], 'assets-plugins': LANES[0], 'profiles-kids': LANES[0], 'engine': LANES[1], 'billing-data': LANES[2], 'identity': LANES[3], 'sites-ui': LANES[4], 'cli': LANES[5], 'shells': LANES[5], 'desktop-linux': LANES[5], 'desktop-release': LANES[5], 'delivery-ops': LANES[6]}
COMMANDS = []

def run(args, timeout=30):
    result = subprocess.run(args, cwd=ROOT, capture_output=True, timeout=timeout)
    COMMANDS.append({'command': ' '.join(args), 'cwd': str(ROOT), 'exit': result.returncode, 'stdoutSha256': hashlib.sha256(result.stdout).hexdigest(), 'stderrSha256': hashlib.sha256(result.stderr).hexdigest(), 'timeoutSeconds': timeout})
    if result.returncode:
        raise RuntimeError('Command failed: ' + ' '.join(args) + '\n' + result.stderr.decode(errors='replace'))
    return result.stdout

def load(p):
    return json.loads(p.read_text())

def write(name, value):
    path = OUT / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + '\n')

def tree(sha):
    rows = []
    for raw in run(['git', 'ls-tree', '-rz', sha]).split(b'\0'):
        if not raw:
            continue
        meta, path = raw.split(b'\t', 1)
        mode, kind, blob = meta.decode().split()
        rows.append({'path': os.fsdecode(path), 'mode': mode, 'type': kind, 'blob': blob})
    return rows

now = datetime.now(timezone.utc).isoformat()
head = run(['git', 'rev-parse', 'HEAD']).decode().strip()
branch = run(['git', 'branch', '--show-current']).decode().strip()
status_raw = run(['git', 'status', '--porcelain=v1', '-z', '--untracked-files=all'])
status_rows = []
parts = iter(status_raw.split(b'\0'))
for raw in parts:
    if not raw:
        continue
    row = {'status': raw[:2].decode(), 'path': os.fsdecode(raw[3:])}
    if 'R' in row['status'] or 'C' in row['status']:
        row['originalPath'] = os.fsdecode(next(parts))
    if not row['path'].startswith(PREFIX):
        status_rows.append(row)
base_tree, old_tree, local_tree = tree(BASE), tree(OLD), tree(head)
tracked = set(os.fsdecode(p) for p in run(['git', 'ls-files', '-z']).split(b'\0') if p)
untracked = set(os.fsdecode(p) for p in run(['git', 'ls-files', '--others', '--exclude-standard', '-z']).split(b'\0') if p)
index = {}
for raw in run(['git', 'ls-files', '--stage', '-z']).split(b'\0'):
    if raw:
        meta, path = raw.split(b'\t', 1)
        mode, blob, stage = meta.decode().split()
        index[os.fsdecode(path)] = {'mode': mode, 'blob': blob, 'stage': stage}
current = []
for name in sorted(tracked | untracked):
    if name.startswith(PREFIX):
        continue
    p = ROOT / name
    row = {'path': name, 'tracked': name in tracked, 'untracked': name in untracked, 'index': index.get(name)}
    if not p.exists() and not p.is_symlink():
        row.update({'present': False, 'deletionApproved': False, 'requiredAction': 'Serial integrator must restore or obtain explicit deletion approval; no deletion authorized by this report.'})
    else:
        s = p.lstat()
        if stat.S_ISLNK(s.st_mode):
            content = os.fsencode(os.readlink(p)); mode = '120000'
        elif stat.S_ISREG(s.st_mode):
            content = p.read_bytes(); mode = '100755' if s.st_mode & 0o111 else '100644'
        else:
            row.update({'present': True, 'unsupportedFileKind': True}); current.append(row); continue
        row.update({'present': True, 'mode': mode, 'bytes': len(content), 'sha256': hashlib.sha256(content).hexdigest(), 'blob': hashlib.sha1(b'blob ' + str(len(content)).encode() + b'\0' + content).hexdigest()})
        if row['untracked']:
            row['inclusion'] = 'RETAIN_AND_REVIEW_FOR_PUBLICATION; never silently omit'
            row['approvalClass'] = 'authorized-handler-visual-test-evidence' if ('checkout-handler' in name or '/test/' in name or '/tests/' in name or '/audits/' in name) else 'legitimate-worktree-addition-needs-serial-review'
    current.append(row)
current_by_path = {r['path']: r for r in current}
missing_base = [dict(r, deletionApproved=False, currentState=current_by_path.get(r['path']), requiredAction='restore-or-explicit-approval') for r in base_tree if not current_by_path.get(r['path'], {}).get('present')]
old_deleted = [dict(r, currentState=current_by_path.get(r['path']), deletionApproved=False) for r in base_tree if r['path'] not in {x['path'] for x in old_tree}]
artifact_hash = hashlib.sha256(json.dumps(current, sort_keys=True, separators=(',', ':')).encode()).hexdigest()
inventory = {'schemaVersion': 1, 'capturedAt': now, 'root': str(ROOT), 'head': head, 'base': BASE, 'oldPublishedHead': OLD, 'worktreeInventorySha256': artifact_hash, 'method': 'git ls-tree -rz; ls-files --stage/--others -z; lstat; raw blob hash and SHA256, no object/index writes', 'excludes': [PREFIX + '** generated by this node; additive report inventory is separate', 'ignored build/cache/install outputs are not source artifacts'], 'initialStatusRows': status_rows, 'baseTree': base_tree, 'oldPublishedTree': old_tree, 'localHeadTree': local_tree, 'currentIntendedSourceInventory': current, 'everyUntrackedPath': [r for r in current if r['untracked']], 'everyBasePathMissingLocally': missing_base, 'everyBasePathMissingOnOldPublishedHead': old_deleted, 'executables': {'base': [r for r in base_tree if r['mode']=='100755'], 'oldPublished': [r for r in old_tree if r['mode']=='100755'], 'current': [r for r in current if r.get('mode')=='100755']}, 'deletionsApprovedByThisNode': [], 'publicationAllowed': False}
write('artifact-inventory.json', inventory)

mega = load(REPORT / 'MEGALIST.json')
final = load(REPORT / 'FINAL.json')
goals = load(REPORT / 'deep-review-2026-10-02/07-goal-accounting.json')
original = load(REPORT / 'remaining-local-113.json')['rows']
missing53 = set(goals['accounting']['original113MissingFinishIds'])
roots = {}
for row in mega['canonicalRoots']:
    roots.setdefault(row['id'], row)
finish = {}
inputs = []
for p in sorted(REPORT.glob('finish-*')):
    if not p.is_file():
        continue
    inputs.append({'path': str(p.relative_to(ROOT)), 'bytes': p.stat().st_size, 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()})
    if p.suffix == '.json':
        d = load(p)
        if isinstance(d, dict) and isinstance(d.get('rows'), list):
            for row in d['rows']:
                finish.setdefault(row['id'], []).append({'report': str(p.relative_to(ROOT)), 'row': row})

# Ownership is exhaustive for existing nonignored source paths; broad directories do not override manifests.
def source_owner(path):
    n = path.replace(str(ROOT)+'/', '')
    if Path(n).name in ('package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'package-lock.json', 'yarn.lock') or n.startswith('.github/workflows/') or n.endswith(('/requirements.txt', '/Cargo.toml', '/Cargo.lock')):
        return 'security-delivery'
    if n.startswith(('packages/schemas/', 'tests/')) or n in ('tsconfig.json', 'vitest.config.ts', 'eslint.config.mjs', '.oxlintrc.json', 'docs/dependency-matrix.json', 'packages/site-kit/src/index.ts'):
        return 'serial-integration'
    if n.startswith('docs/'):
        return 'serial-integration'
    if n.startswith(('packages/engine-', 'packages/physics-rapier/')):
        return 'engine-physics'
    if n.startswith(('packages/authoring-core/', 'packages/importers/', 'packages/plugin-host/', 'packages/profile-', 'sites/kids/')):
        return 'authoring-assets'
    if n.startswith(('packages/billing/', 'db/')) or n.startswith('sites/umbrella/src/lib/provider-adapters') or n.startswith(('sites/umbrella/src/app/account/', 'sites/umbrella/src/app/api/checkout/', 'sites/umbrella/src/app/api/stripe/')):
        return 'billing'
    if n.startswith('packages/auth/') or n in ('sites/umbrella/src/lib/identity-plane.ts', 'sites/umbrella/src/lib/request-authority.ts', 'sites/umbrella/src/lib/login-flow.ts') or n.startswith(('sites/umbrella/src/provider/', 'sites/umbrella/src/app/login/', 'sites/umbrella/src/app/api/auth/', 'sites/umbrella/src/app/api/login/', 'sites/umbrella/src/app/api/logout/')):
        return 'identity-provider'
    if n.startswith(('apps/desktop-shell/', 'apps/web-shell/', 'packages/cli/', 'desktop/')):
        return 'desktop-cli'
    if n.startswith('sites/'):
        if n.startswith('sites/umbrella/test/') and ('provider' in n or 'billing' in n):
            return 'billing'
        return 'sites-accessibility'
    if n.startswith('scripts/'):
        return 'security-delivery'
    if n.startswith('packages/site-kit/'):
        return 'missing-capabilities'
    return 'serial-integration'

ownership = {lane: [] for lane in LANES + ['serial-integration']}
for name in sorted(tracked | untracked):
    if name.startswith(PREFIX) or name.startswith('docs/'):
        continue
    ownership[source_owner(name)].append(name)
write('ownership.json', {'schemaVersion':1, 'root':str(ROOT), 'owners':ownership, 'precedence':'security-delivery owns ALL dependency manifests, locks and workflows; serial-integration owns schemas/root config/root tests; exact lists override broad prefixes', 'allOtherDocsReadOnly':True})

SUITES = {
 'authoring-assets': 'pnpm exec vitest run packages/authoring-core/test packages/importers/test packages/plugin-host/test packages/profile-game/test packages/profile-web/test packages/profile-kids/test --reporter=dot',
 'engine-physics': 'pnpm exec vitest run packages/engine-kernel/test packages/engine-presentation/test packages/engine-orchestrator/test packages/physics-rapier/test --reporter=dot',
 'billing': 'pnpm exec vitest run packages/billing/test tests/sites/billing-final-acceptance.test.ts tests/sites/provider-adapters.test.ts --reporter=dot',
 'identity-provider': 'pnpm exec vitest run packages/auth/test tests/sites/identity-plane-wiring.test.ts tests/e2e/runtime-provenance-refusal.test.ts --reporter=dot',
 'sites-accessibility': 'pnpm exec vitest run tests/sites/umbrella-visual.test.ts tests/sites/catalog-storefronts.test.ts tests/sites/kids-surface.test.ts --reporter=dot',
 'desktop-cli': 'pnpm exec vitest run packages/cli/test apps/desktop-shell/test apps/web-shell/test desktop/linux/test desktop/windows/test desktop/macos/test --reporter=dot',
 'security-delivery': 'pnpm -s check:boundaries && pnpm -s check:contracts && pnpm -s check:sites && pnpm -s check:desktop && pnpm -s check:publish-ready',
 'missing-capabilities': 'pnpm exec vitest run packages/site-kit/test --reporter=dot',
}
module_symbols = {}
def target(path, line=None, symbol=None):
    path = path.replace(str(ROOT)+'/', '')
    p = ROOT / path
    if not symbol and p.is_file() and p.suffix in ('.ts', '.tsx', '.mjs', '.js'):
        if path not in module_symbols:
            text = p.read_text(errors='replace')
            module_symbols[path] = re.findall(r'export\s+(?:async\s+)?(?:function|class|const|type|interface)\s+(\w+)', text)
        symbol = ', '.join(module_symbols[path][:12])
    return {'path': path, 'line': line, 'symbol': symbol or ('file inventory / mode / blob' if not p.is_file() else 'file-level contract'), 'exists':p.exists() or p.is_symlink(), 'writeOwner':source_owner(path), 'sha256':current_by_path.get(path,{}).get('sha256')}

def targets(record, lane):
    ts = []
    for t in record.get('targets', []) + (record.get('source', []) if isinstance(record.get('source'), list) else []):
        if isinstance(t, dict) and t.get('path'):
            ts.append(target(t['path'], t.get('line'), t.get('symbol')))
    text = json.dumps(record)
    for name in re.findall(r'(?:tests/)?(?:packages|apps|sites|desktop|db|scripts|docs)/[\w./@-]+\.(?:tsx?|mjs|json|md|sql|yaml|css)', text):
        ts.append(target(name))
    for name in ('package.json', 'tsconfig.json', '.oxlintrc.json'):
        if re.search(r'(?<![\w/.-])' + re.escape(name), text):
            ts.append(target(name))
    if not ts:
        defaults = {'authoring-assets':'packages/authoring-core/src/index.ts', 'engine-physics':'packages/engine-kernel/src/index.ts', 'billing':'packages/billing/src/index.ts', 'identity-provider':'sites/umbrella/src/lib/identity-plane.ts', 'sites-accessibility':'sites/umbrella/src/app/globals.css', 'desktop-cli':'packages/cli/src/dispatcher.ts', 'security-delivery':'package.json', 'missing-capabilities':'packages/site-kit/src/index.ts'}
        ts = [target(defaults[lane])]
    return list({(t['path'], t['symbol']):t for t in ts}.values())

rows = []
def add(identifier, record, category, lane, provenance, acceptance=None):
    if any(r['id']==identifier for r in rows):
        existing = next(r for r in rows if r['id']==identifier)
        existing['provenance'].append(provenance); return
    criteria = acceptance or record.get('acceptance') or record.get('fixAcceptance') or record.get('fix_acceptance') or record.get('preciseFixAcceptance') or record.get('expectation') or record.get('expected') or record.get('rootCause') or record.get('title')
    if isinstance(criteria,str):
        criteria=[criteria]
    if not isinstance(criteria,list) or not criteria:
        criteria=['Reproduce the exact source finding, repair its root cause, preserve named refusal and valid positive-path behavior, and retain fail-before/pass-after assertions.']
    ts = targets(record,lane)
    cmd = SUITES[lane]
    # Missing finish tasks stay exclusively delegated; actual source owners remain dependencies.
    origin_lane = ROUTE.get(record.get('ownerLane'),lane)
    if lane=='missing-capabilities' and origin_lane!='missing-capabilities':
        cmd=SUITES[origin_lane]
    row = {'id':identifier,'category':category,'title':record.get('rootCause') or record.get('title') or record.get('observed') or record.get('why') or identifier,'ownerLane':lane,'sourceOwners':sorted({t['writeOwner'] for t in ts}),'targets':ts,'dependencies':record.get('dependencies',[]) + sorted({t['writeOwner'] for t in ts if t['writeOwner']!=lane}),'acceptance':{'command':cmd,'cwd':str(ROOT),'timeoutSeconds':120,'assertions':criteria,'requiredEvidence':'Exact current source hash; command exit; named tests/assertions; fail-before/pass-after or explicitly refuted original hypothesis; resource cleanup. A suite exit alone cannot close unmatched assertions.','independentJudge':'GPT-6 Astra; PASS only after every row assertion is tied to an executed oracle on exact reviewed artifact; at most three repair passes.'},'status':'NEEDS_LOCAL_FIX','verificationState':'NOT_EXECUTED_BY_BASELINE_NODE','artifact':{'head':head,'worktreeInventorySha256':artifact_hash,'publishedSha':None,'historicalPublishedSha':OLD},'historicalFinish':finish.get(identifier,[]),'historicalDisposition':record.get('category') or record.get('disposition'),'missingInput':record.get('missingInput'),'provenance':[provenance],'repairPass':0,'maximumRepairPasses':3}
    if record.get('category')=='genuine-external-blocker' and record.get('missingInput'):
        row['status']='EXTERNAL_BLOCKER'
    elif record.get('category')=='intentional-nonlaunch-capability':
        row['status']='INTENTIONAL_FULL_PRODUCTION_GAP'
    row['historicalRecord'] = record
    rows.append(row)

for x in original:
    r=roots.get(x['id'],x)
    lane='missing-capabilities' if x['id'] in missing53 else ROUTE.get(r.get('ownerLane'),'missing-capabilities')
    g=next(a for a in goals['missingAcceptanceMap'] if a['id']==x['id'])
    add(x['id'],r,'original-local-113',lane,'remaining-local-113.json + MEGALIST.json + deep-review/07 missingAcceptanceMap',g.get('finalAcceptance') or r.get('acceptance'))
for identifier,r in roots.items():
    add(identifier,r,'supplemental-or-historical-mapping',ROUTE.get(r.get('ownerLane'),'missing-capabilities'),'MEGALIST.json canonicalRoots')
for r in final.get('additionalTaskOutcomes',[]):
    add(r['id'],r,'supplemental-new','authoring-assets' if r['id'].startswith('AUTHORING') else 'missing-capabilities','FINAL.json additionalTaskOutcomes')
for identifier,claims in finish.items():
    if not any(r['id']==identifier for r in rows):
        r=claims[0]['row'];lane=next((l for k,l in ROUTE.items() if k in claims[0]['report']),'missing-capabilities')
        if identifier.startswith(('AP-', 'AP', 'PK-', 'AUTHORING')):lane='authoring-assets'
        add(identifier,r,'finish-supplemental',lane,claims[0]['report'],[str(r.get('proof') or r.get('implementation') or identifier)])
review_inputs=[]
for p in sorted((REPORT/'deep-review-2026-10-02').glob('*.json')):
    d=load(p)
    review_inputs.append({'path':str(p.relative_to(ROOT)),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'parsed':True})
    fs=d.get('findings',d.get('topFiveFindings',[]))
    for i,r in enumerate(fs):
        identifier=r.get('id') or f'DEEP-{p.name[:2]}-{i+1:02}'
        idx=p.name[:2]
        lane={'01':'security-delivery','02':'security-delivery','03':'sites-accessibility','04':'desktop-cli','05':'billing','06':'engine-physics','07':'missing-capabilities','08':'security-delivery'}[idx]
        if identifier=='06-05':lane='security-delivery'
        if identifier=='06-04':lane='authoring-assets'
        add(identifier,r,'deep-review-finding',lane,str(p.relative_to(ROOT))+f'#/findings/{i}')
    if p.name=='08-FINAL.json':
        for i,r in enumerate(d.get('additionalFindings',[])):
            lane=['engine-physics','desktop-cli','billing','authoring-assets'][min(i,3)]
            if isinstance(r, str):
                r = {'title': r, 'source': r, 'acceptance': [r]}
            add('DEEP-08-ADDITIONAL-'+str(i+1),r,'deep-review-additional',lane,str(p.relative_to(ROOT))+f'#/additionalFindings/{i}')
# Override published-tree findings with exact artifact executable acceptance, serial-only.
for r in rows:
    if r['category']=='deep-review-finding' and (r['id'].startswith('PR-') or r['id'] in ('GA-001','GA-002','GA-004','08-01','08-02','08-03','08-05','05-001','05-002','06-01','VS-01','VS-03','VS-04','VD-01')):
        r['publicationDependency']='serial-publication; no lane may commit, push, stage or post'
        r['dependencies'].append('serial-publication')
        r['acceptance']['serialCommands']=['git ls-tree -rz <exact-candidate-sha>','git diff --name-status '+BASE+' <exact-candidate-sha>','pnpm gate','gh pr view 312 --repo Vhailors/sceneaxi --json headRefOid,statusCheckRollup','gh pr checks 312 --repo Vhailors/sceneaxi --required']
        r['acceptance']['assertions'].extend(['Complete path/blob/mode inventory matches reviewed intended artifact; every deletion has explicit approval; handler/tests/evidence included.','Required CI is successful on exactly the current published SHA; local or historical greens are not substitutes.'])
write('ledger.json',{'schemaVersion':1,'createdAt':now,'root':str(ROOT),'head':head,'worktreeInventorySha256':artifact_hash,'originalLocalIds':[x['id'] for x in original],'missing53Ids':sorted(missing53),'rows':rows,'counts':dict(Counter(r['category'] for r in rows)),'statusCounts':dict(Counter(r['status'] for r in rows)),'verification':'Planning ledger; no source tests, whole gate, site build, native proof or published CI rerun by this node.','inputs':inputs+review_inputs,'backlogMapping':mega.get('backlogMapping'),'requirementsMapping':mega.get('requirementsMapping'),'independentReviewRequestedModel':'GPT-6 Astra standard','implementationRequestedModel':'GPT-6.1 Sol standard','repairPassBound':3,'authorizations':'No new money/account/deploy/live/provider/production DB authority; serial owner alone may correct existing PR under prior authorization.'})

baseline={'schemaVersion':1,'status':'BASELINE_PREPARED_CANDIDATE_NOT_VERIFIED','capturedAt':now,'root':str(ROOT),'branch':branch,'localHead':head,'worktreeInventorySha256':artifact_hash,'sourceStatusCount':len(status_rows),'trackedDirtyCount':sum(x['status']!='??' for x in status_rows),'untrackedCount':len([x for x in current if x['untracked']]),'currentSourceFiles':len([x for x in current if x.get('present')]),'baseFiles':len(base_tree),'oldPublishedFiles':len(old_tree),'oldReviewedCi':{'sha':OLD,'fail':9,'skip':2,'pass':0,'fresh':False},'oldPublishedDiff':{'D':825,'M':204,'A':180,'R':1,'freshReproductionCommand':'git diff --name-status '+BASE+' '+OLD},'localBuild':{'status':'NOT_RERUN','datedDeepReviewStatus':'FAIL','reason':'Full root build/gate belong to serial integration; no historical green transferred.'},'originalLocalIds':113,'missing53DelegatedExclusively':'missing-capabilities','ledgerRows':len(rows),'laneTaskCounts':dict(Counter(r['ownerLane'] for r in rows)),'unapprovedMissingBasePaths':[r['path'] for r in missing_base],'artifactInventory':'artifact-inventory.json','ownership':'ownership.json','ledger':'ledger.json','commands':COMMANDS,'baselineTests':'No application tests executed by this report-only preparation node.','resources':'No fixture copies, servers, containers, installs, accounts or provider connections; zero temporary resources requiring cleanup.','publicationPerformed':False,'modelDispatch':'Requested model/tier recorded; no endpoint available to verify or launch model dispatch from this node.'}
write('baseline.json',baseline)
print(json.dumps({k:baseline[k] for k in ('localHead','trackedDirtyCount','untrackedCount','currentSourceFiles','baseFiles','oldPublishedFiles','ledgerRows','laneTaskCounts','unapprovedMissingBasePaths')},indent=2))
