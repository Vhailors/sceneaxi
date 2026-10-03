#!/usr/bin/env python3
"""Persist a bounded serial checkpoint, not a frozen candidate or publication PASS."""
import collections
import datetime
import hashlib
import json
import os
from pathlib import Path
import stat
import subprocess

ROOT = Path('/home/devuser/Documents/Projects/sceneaxi')
OUT = ROOT / 'docs/audits/production-swarm/repair-review-2026-10-02'
NOW = datetime.datetime.now(datetime.timezone.utc).isoformat()

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT)

def load(name):
    return json.loads((OUT / name).read_text())

def write(name, value):
    (OUT / name).write_text(json.dumps(value, indent=2, ensure_ascii=False) + '\n')

ledger = load('ledger.json')
rows = ledger['rows']
assert len(rows) == len({row['id'] for row in rows}) == 355
assert len(ledger['originalLocalIds']) == 113
assert all(row['acceptance']['command'].strip() and row['acceptance']['assertions'] for row in rows)
by_id = {row['id']: row for row in rows}
assert by_id['DEEP-08-ADDITIONAL-1']['canonicalRepairKey'] == 'VISUAL-REFUSAL-COVERAGE'
assert by_id['DEEP-08-ADDITIONAL-2']['canonicalRepairKey'] == 'HOSTED-SERIALIZER-REFUSALS'
assert by_id['DEEP-08-ADDITIONAL-3']['canonicalRepairKey'] == 'UNSIGNED-LOCAL-PROJECT-BUILD'

checks = []
def check(command, exit_code, log, assertions, limitation='', counts=None):
    path = OUT / log
    assert path.is_file(), log
    record = {'command': command, 'cwd': str(ROOT), 'exit': exit_code, 'log': str(path.relative_to(ROOT)), 'logSha256': digest(path), 'assertions': assertions, 'limitation': limitation, 'artifact': 'PRE_EXPANSION_LOCAL_CHECKPOINT_NOT_CURRENT_CHILD_SOURCE'}
    if counts:
        record['counts'] = counts
    checks.append(record)

check('pnpm build', 0, 'integration-pass-3-build.log', ['Strict referenced source and root tests compile.'])
check('pnpm gate', 1, 'integration-pass-3-gate.log', ['Unchanged mandatory gate executed; failure retained.'], 'Stopped at test stage; lint was executed separately, not inferred.', {'filesPassed':296, 'filesFailed':6, 'testsPassed':4623, 'testsFailed':44})
for site in ['umbrella', 'catalog-game', 'catalog-web', 'kids']:
    for action in ['typecheck', 'build']:
        check(f'NEXT_TELEMETRY_DISABLED=1 pnpm --dir sites/{site} {action}', 0, f'integration-pass-3-{site}-{action}.log', [f'Isolated {site} {action} executes unchanged owning script.'], 'Fresh successful build predates active source expansion; no green transfers to changed children.')
check('pnpm build:sdk', 0, 'integration-pass-3-build:sdk.log', ['163-entry source-backed SDK generated; zip SHA256 906539c5138a52433f51150e18ae0861e403c09ea72fb07d7e8882dab9ba4e51.'])
check('pnpm docs:api', 4, 'integration-pass-3-docs:api.log', ['TypeDoc warnings remain fatal; no skipErrorChecking or validation weakening.'], 'AudioConnectionTarget referenced by AudioContextPort.destination is not included; previous docs remain transactional.')
check('pnpm test:golden', 1, 'integration-pass-3-test:golden.log', ['Unchanged golden script executed; VM-global failure reproduced.'], 'The owning bridge suite was subsequently repaired; complete golden script not rerun while children write.', {'filesPassed':56, 'filesFailed':1, 'testsPassed':522, 'testsFailed':22})
check('pnpm lint', 1, 'integration-pass-3-lint.log', ['Complete ESLint command executed; every diagnostic retained.'], '224 errors including capture scripts and retained probe files; no ignores or blanket globals added.', {'errors':224})
check('pnpm lint:anti-slop', 1, 'integration-pass-3-lint:anti-slop.log', ['Existing oxlint policy executed unchanged; source-policy debt remains local.'], 'No rules disabled or allow-lists widened.', {'errors':17930, 'warnings':28, 'files':802})
check('pnpm exec vitest run packages/billing/test/hosted-response.test.ts tests/sites/provider-adapters.test.ts tests/sites/billing-final-acceptance.test.ts --reporter=verbose --maxWorkers=1', 0, 'integration-pass-3-codec-provider.log', ['Current owned JSON codec/refusal/restart/provider/checkout named assertions pass.'], 'Not real paid-provider or production DB acceptance.', {'testsPassed':87, 'filesPassed':3})
check('node sites/catalog-game/test/repair-accessibility-proof.mjs', None, 'integration-pass-3-browser.log', ['Actual production browser attempted; bounded command timed out at 300 seconds; no exit-zero asserted.'], 'Partial receipt records 299 failures, not successful rendered acceptance.')
check('pnpm --dir desktop/linux typecheck', 0, 'integration-pass-3-linux-typecheck.log', ['Strict desktop install-root typecheck.'])
check('pnpm --dir desktop/linux build', 0, 'integration-pass-3-linux-build.log', ['Fresh runtime and no-replace publisher built.'])
check('CSC_IDENTITY_AUTO_DISCOVERY=false pnpm --dir desktop/linux exec electron-builder --dir --linux --publish never --config.directories.output=dist-build/repair-pass3', 0, 'integration-pass-3-linux-package.log', ['Fresh local unpacked Linux artifact staged without signing or publication.'], 'Builder selected Electron43.2.0 despite source manifest ^43.5.0; dependency/install reconciliation required.')
check('SCENEAXI_SMOKE_PACKAGED_ROOT=dist-build/repair-pass3/linux-unpacked pnpm --dir desktop/linux smoke --packaged', 1, 'integration-pass-3-linux-smoke-1.log', ['Fresh packaged front door actually launched; absent proof line remains failure.'], 'Second/third consecutive smoke runs not executed after first failure; no capacity/teardown PASS inferred.')
check('pnpm exec vitest run packages/cli/test/capabilities.test.ts packages/cli/test/desktop-bridge.test.ts tests/e2e/desktop-cli-local-bridge-golden.test.ts --reporter=verbose --maxWorkers=1', 0, 'integration-pass-3-cli-socket.log', ['Real rebuilt CLI command enumeration and Unix-socket authoring/permissions tests.'], 'Refutes permanent CLI capability failure; full-gate60s timeout remains in original evidence.', {'testsPassed':19, 'filesPassed':3})
check('pnpm --dir sites/umbrella exec vitest run --config vitest.config.ts test/better-auth-provider.test.ts test/account-lifecycle.test.ts --reporter=verbose --maxWorkers=1', 0, 'integration-pass-3-identity-lifecycle.log', ['Fresh owning auth/lifecycle suite with disposable PostgreSQL, loopback HTTP/HTTPS and Chromium cookies.'], 'Fixture-local mail/target; not production or real mail delivery.', {'testsPassed':35, 'filesPassed':2})
check('pnpm exec vitest run tests/e2e/desktop-linux-bridge-golden.test.ts --reporter=dot --maxWorkers=1', 0, 'integration-pass-3-vm-final.log', ['Unchanged existing bridge/rarity/authoring assertions pass with functional VM DOM observer.', 'New observer filter/dataset/attribute/disconnect oracle passes.'], 'Focused owning green; full candidate gates must rerun after child handbacks.', {'testsPassed':70, 'filesPassed':1})

native_base = {}
base = 'dd77cc9cb91d24091082e0c5bc20a130f0f51ffc'
for line in git('ls-tree', '-rz', base).split(b'\0'):
    if line:
        metadata, path = line.split(b'\t', 1)
        mode, kind, blob = metadata.decode().split()
        native_base[os.fsdecode(path)] = {'mode':mode, 'kind':kind, 'blob':blob}
paths = set(os.fsdecode(p) for p in git('ls-files', '--cached', '--others', '--exclude-standard', '-z').split(b'\0') if p)
files = []
missing = []
for relative in sorted(paths):
    path = ROOT / relative
    try:
        info = path.lstat()
    except FileNotFoundError:
        missing.append(relative)
        continue
    if stat.S_ISLNK(info.st_mode):
        raw = os.fsencode(os.readlink(path))
        mode = '120000'
    elif stat.S_ISREG(info.st_mode):
        raw = path.read_bytes()
        mode = '100755' if info.st_mode & 0o111 else '100644'
    else:
        continue
    blob = hashlib.sha1(b'blob ' + str(len(raw)).encode() + b'\0' + raw).hexdigest()
    files.append({'path':relative, 'mode':mode, 'blob':blob, 'sha256':hashlib.sha256(raw).hexdigest(), 'bytes':len(raw)})
source = [item for item in files if not item['path'].startswith('docs/audits/production-swarm/')]
source_fingerprint = hashlib.sha256(json.dumps(source, sort_keys=True, separators=(',',':')).encode()).hexdigest()
present = {item['path']:item for item in files}
base_missing = sorted(set(native_base) - set(present))
mode_changes = [{'path':p, 'base':entry['mode'], 'current':present[p]['mode']} for p,entry in native_base.items() if p in present and entry['mode'] != present[p]['mode']]
write('integration-pass-3-current-inventory.json', {'capturedAt':NOW, 'method':'Complete native Git base inventory plus cached/untracked nonignored local paths; raw Git blob hash, SHA256 and symlink-aware mode. No index/object/worktree mutation.', 'status':'MUTABLE_CHECKPOINT_NOT_FROZEN_CANDIDATE', 'head':git('rev-parse','HEAD').decode().strip(), 'base':base, 'sourceFingerprint':source_fingerprint, 'basePathCount':len(native_base), 'baseMissing':base_missing, 'modeChanges':mode_changes, 'missingLocalPaths':missing, 'files':files, 'candidateTree':None, 'untrackedApproval':'Not granted merely by inventory; serial successor must approve explicit source/test/evidence paths and exclude private/secret/generated artifacts before a private index freeze.'})

browser_path = ROOT / 'sites/catalog-game/test/visual-evidence/repair/receipt.json'
browser = json.loads(browser_path.read_text())
browser_summary = {key:browser.get(key) for key in ['capturedAt','finishedAt','sourceFingerprint','providerBrowserBranch','cleanup']}
browser_summary.update({key:len(browser.get(key,[])) for key in ['builds','routes','focus','contrasts','screenshots','checkpoints','liveOpen','failures']})
browser_summary['failureKinds'] = dict(collections.Counter(item['message'] for item in browser['failures']))
browser_summary['receipt'] = str(browser_path.relative_to(ROOT))
browser_summary['receiptSha256'] = digest(browser_path)

lanes = []
for name in ['authoring-assets','billing','desktop-cli','engine-physics','identity-provider','missing-capabilities','security-delivery','sites-accessibility']:
    report = load(f'fix-{name}.json')
    outcomes = report.get('tasks', report.get('rows', report.get('taskOutcomes', report.get('taskIds', []))))
    lanes.append({'node':name, 'status':'NEEDS_LOCAL_FIX', 'report':f'fix-{name}.json', 'reportSha256':digest(OUT / f'fix-{name}.json'), 'ownerReportedOutcomes':outcomes, 'independentLanePass':False, 'note':'Retain all owner rows; stale in-progress companions and missing per-clause proof are local assurance failures, not inferred implementation absence.'})

pending = [
    ('bg-110','own-session endpoint'), ('bg-111','catalog own-session server adapter'),
    ('bg-112','checkout abort/deadline/bounded cancellation'), ('bg-113','desktop keyboard geometry'),
    ('bg-114','web inspector keyboard/modal UX'), ('bg-115','versioned compatible scene transforms'),
    ('bg-116','unsigned contained user-project build'), ('bg-117','importer preparation/capacity'),
    ('bg-118','catalog-game visible UI'), ('bg-119','catalog-web visible UI')]
open_local = [
    {'id':'INTEGRATION-GATE','status':'NEEDS_LOCAL_FIX','acceptance':'Rerun unchanged pnpm gate after ALL expansion handbacks; all required assertions must pass. Retain before44 failures.'},
    {'id':'INTEGRATION-RESTORED-GUI','status':'NEEDS_LOCAL_FIX','acceptance':'Restored asset-order/real-bridge/form tests pass without removing assertions; actual emitted typed forms/control submit drive the real bridge.'},
    {'id':'INTEGRATION-NO-SECRETS','status':'NEEDS_LOCAL_FIX','acceptance':'Keep unchanged whole-tracked-tree secret scan; eliminate credential-shaped local fixture/evidence literals in db/local-postgres-oracle.mjs and docs/audits/production-swarm/fix-billing-data.json safely without broad exemptions or revealing values.'},
    {'id':'INTEGRATION-DOCS-AUDIO','status':'NEEDS_LOCAL_FIX','acceptance':'Export/document AudioConnectionTarget through real public API; docs:api exits0 with warnings fatal and old docs preserved on failure, no intentionallyNotExported suppression.'},
    {'id':'INTEGRATION-LINT','status':'NEEDS_LOCAL_FIX','acceptance':'Source-risk ESLint/oxlint and unchanged full ESLint pass; explicit policy-debt disposition retained, no ignores/rule weakening.'},
    {'id':'INTEGRATION-BROWSER','status':'NEEDS_LOCAL_FIX','acceptance':'Current four rebuilt sites complete visible keyboard/contrast/persistence/open/Kids isolation tests; distinguish occlusion-oracle bugs from actual source defects without weakening effective geometry.'},
    {'id':'INTEGRATION-NATIVE','status':'NEEDS_LOCAL_FIX','acceptance':'Reconciled installed/locked Electron version then fresh packaged native proof succeeds three consecutive runs with8MiB latency/RSS/event-loop/resource/context-loss assertions.'},
    {'id':'INTEGRATION-FROZEN-TREE','status':'NEEDS_LOCAL_FIX','acceptance':'After source handbacks and exact-candidate checks, freeze complete localHEAD+explicit approved paths in private isolated index; preserve every untouched base path/blob/mode and permit only explicitly approved deletions.'}]
remote = load('integration-pass-3-remote-pr.json')
required = load('integration-pass-3-required-ci.json')
final = {'schemaVersion':1, 'updatedAt':NOW, 'root':str(ROOT), 'verdict':'PARTIAL', 'localStatus':'NEEDS_LOCAL_FIX', 'publicationReadyLocal':False, 'publishedStatus':'FAIL', 'fullProductionStatus':'BLOCKED', 'integrationPassCount':3, 'maximumIntegrationPasses':3, 'independentAstraVerdict':'FAIL_PASS_2; PASS_3_NOT_RECEIVED', 'artifact':{'localHead':git('rev-parse','HEAD').decode().strip(), 'sourceFingerprint':source_fingerprint, 'sourceMutable':True, 'candidateTree':None, 'inventoryReceipt':'integration-pass-3-current-inventory.json', 'baseMissing':base_missing, 'modeChanges':mode_changes, 'publishedSha':remote['headRefOid'], 'pr':remote['url'], 'prState':remote['state'], 'mergeStateStatus':remote['mergeStateStatus'], 'requiredCI':required, 'fullCheckConclusions':dict(collections.Counter(item.get('conclusion',item.get('state','UNKNOWN')) for item in remote['statusCheckRollup']))}, 'checks':checks, 'browser':browser_summary, 'perNode':lanes, 'perTask':rows, 'additionalIntegrationFindings':open_local, 'originalIds':ledger['originalLocalIds'], 'originalCount':113, 'provenanceRecordCount':355, 'overlapNote':'355 provenance records are not355 unique defects or a completion denominator; no suite totals inherit DONE for unmatched predicates.', 'pendingExpansion':[{'node':node,'task':task,'status':'NEEDS_LOCAL_FIX','acceptance':'Await exact source handback and independent named oracles; then fresh serial candidate checks. New authorization does not change historical failed evidence.'} for node,task in pending], 'independentExpansionReviewers':['bg-120','bg-121','bg-122','bg-123'], 'externalRequirements':[row for row in rows if row['status']=='EXTERNAL_BLOCKER'], 'intentionalFullProductionGaps':[row for row in rows if row['status']=='INTENTIONAL_FULL_PRODUCTION_GAP'], 'temporaryResources':{'packagedStaging':'desktop/linux/dist-build/repair-pass3', 'disposition':'Owned ignored Linux staging removed after failed native proof; never a released artifact. Fixture tests clean owned DB/browser/socket/temp resources; process scan found no next/browser/native/heavy process after commands.', 'privateIndexCreated':False}, 'actions':{'stage':False,'commit':False,'push':False,'publicPost':False,'merge':False,'deploy':False,'sign':False,'spend':False,'productionDB':False}, 'harnessFailures':['Initial ledger validator KeyError tasks; recovered actual rows and validated355/113.', 'Initial POSIX shell bad substitution; no checks ran in that attempt; unchanged script commands reran with valid log paths.', 'Browser command300s hard timeout; partial failure receipt preserved; no exit0 fabricated.'], 'nextGate':'Parent collects ten exclusive Sol source handbacks and four Astra reviews, then starts explicitly reauthorized fresh bounded serial integration. This old three-pass checkpoint remains PARTIAL; no freeze/publication while child sources mutate.'}
write('FINAL.json', final)
integration = load('integration.json')
integration['status'] = 'NEEDS_LOCAL_FIX'
integration['stage'] = 'SERIAL_PASS_3_PARTIAL_CHECKPOINT_EXPANSION_PENDING'
integration['pass3'] = {'updatedAt':NOW,'status':'PARTIAL','checks':checks,'browser':browser_summary,'pendingExpansion':final['pendingExpansion'],'sourceMutable':True,'candidateTree':None,'noHistoricalGreenTransferred':True}
write('integration.json', integration)
assert final['originalCount'] == 113 and len(final['perTask']) == 355
assert len(final['externalRequirements']) == 22 and len(final['intentionalFullProductionGaps']) == 13
assert final['integrationPassCount'] == final['maximumIntegrationPasses'] == 3
print('Checkpoint final JSON PASS:113 originals/355 provenance rows,8 lane reports,10 pending sourcechildren; PARTIAL/NOT publication-ready; no candidate tree or stage/commit/push.')
