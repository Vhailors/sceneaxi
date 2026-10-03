#!/usr/bin/env python3
"""Read-only repair crosswalk. Prints JSON; never executes acceptance commands.
Exit 0: structural crosswalk valid (NOT product acceptance); 1: schema/crosswalk
error; 2: --strict-proof with unresolved acceptance. No third-party dependencies.
"""
import argparse
import copy
import hashlib
import json
from pathlib import Path
import re
import sys
from collections import Counter

BASE = 'docs/audits/production-swarm'
REPAIR = BASE + '/repair-review-2026-10-02'
DEEP = BASE + '/deep-review-2026-10-02'
LOCAL = {'DR-006', 'LOCAL-070', 'ENG-012', 'ENG-013'}
HEX = re.compile(r'^[0-9a-f]{64}$')


def sha(data):
    return hashlib.sha256(data).hexdigest()


def nonblank(value):
    return isinstance(value, str) and bool(value.strip())


def strings(value):
    if isinstance(value, str):
        return [value] if value.strip() else []
    if isinstance(value, list):
        return [s for item in value for s in strings(item)]
    if isinstance(value, dict):
        if all(k in value for k in ('id', 'kind', 'description')):
            text = f"{value['id']} ({value['kind']}): {value['description']}"
            return [text + (f" [task {value['task']}]" if value.get('task') else '')]
        return [s for item in value.values() for s in strings(item)]
    return []


def check_ledger(doc, expected, review_ids):
    errors = []
    def fail(code, pointer, task=None):
        errors.append({'code': code, 'pointer': pointer, 'id': task})
    if not isinstance(doc, dict) or not isinstance(doc.get('rows'), list):
        return [{'code': 'JSON_FORMAT_ROWS_ARRAY_REQUIRED', 'pointer': '/rows'}]
    rows = doc['rows']
    if len(rows) != 355:
        fail('ROW_COUNT_EXPECTED_355', '/rows')
    ids = [r.get('id') for r in rows if isinstance(r, dict)]
    for task, count in Counter(ids).items():
        if count != 1:
            fail('DUPLICATE_ID', '/rows', task)
    originals = doc.get('originalLocalIds')
    if not isinstance(originals, list) or len(originals) != 113 or set(originals) != expected:
        fail('ORIGINAL_ID_SET_MISMATCH', '/originalLocalIds')
    for task in sorted(expected | review_ids):
        if task not in ids:
            fail('MISSING_ID', '/rows', task)
    for i, row in enumerate(rows):
        p = '/rows/' + str(i)
        if not isinstance(row, dict):
            fail('JSON_FORMAT_ROW_OBJECT_REQUIRED', p)
            continue
        task = row.get('id')
        if not nonblank(task):
            fail('BLANK_ID', p + '/id')
        if not nonblank(row.get('ownerLane')):
            fail('BLANK_OWNER', p + '/ownerLane', task)
        a = row.get('acceptance')
        if not isinstance(a, dict):
            fail('JSON_FORMAT_ACCEPTANCE_OBJECT_REQUIRED', p + '/acceptance', task)
            a = {}
        for field in ('command', 'cwd'):
            if not nonblank(a.get(field)):
                fail('BLANK_' + field.upper(), p + '/acceptance/' + field, task)
        if not strings(a.get('assertions')):
            fail('BLANK_PREDICATE', p + '/acceptance/assertions', task)
        targets = row.get('targets')
        if not isinstance(targets, list):
            fail('JSON_FORMAT_TARGETS_ARRAY_REQUIRED', p + '/targets', task)
        else:
            for j, t in enumerate(targets):
                if not isinstance(t, dict) or (t.get('exists') and not HEX.fullmatch(str(t.get('sha256', '')))):
                    fail('MISSING_EVIDENCE_HASH', p + '/targets/' + str(j), task)
        if task in LOCAL and ('EXTERNAL' in str(row.get('status')) or 'EXTERNAL' in str(row.get('localStatus'))):
            fail('FALSE_EXTERNAL_LOCAL_CAPABILITY', p + '/status', task)
    return errors


def report_rows(doc):
    """Only explicit top-level task containers, never recursive historical copies."""
    if not isinstance(doc, dict):
        return None, [], 'non-task JSON array/scalar'
    for key in ('rows', 'tasks', 'taskOutcomes'):
        if key in doc:
            value = doc[key]
            if isinstance(value, int) and key == 'rows' and isinstance(doc.get('statusCounts'), dict):
                return key, [], 'summary row count, not task records; do not iterate integer'
            if not isinstance(value, list):
                return key, [], 'FORMAT_ERROR: expected array'
            records = []
            for i, row in enumerate(value):
                if isinstance(row, dict) and nonblank(row.get('id')):
                    records.append((f'/{key}/{i}', row))
                elif isinstance(row, str):
                    records.append((f'/{key}/{i}', {'id': row, 'status': doc.get('status', doc.get('localStatus')), 'rowFormat': 'id-string; no row proof'}))
                else:
                    return key, records, 'FORMAT_ERROR: row without explicit id'
            return key, records, None
    if isinstance(doc.get('taskIds'), list):
        return 'taskIds', [(f'/taskIds/{i}', {'id': v, 'status': doc.get('status', doc.get('localStatus')), 'rowFormat': 'id-only; no per-row outcome'}) for i, v in enumerate(doc['taskIds'])], None
    return None, [], 'not a task-outcome report'


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[5])
    ap.add_argument('--strict-proof', action='store_true')
    ap.add_argument('--negative-control', choices=['missing-id'])
    args = ap.parse_args()
    root = args.root.resolve()
    fingerprints = {}
    cache = {}
    def load(rel):
        raw = (root / rel).read_bytes()
        fingerprints[rel] = {'sha256': sha(raw), 'bytes': len(raw)}
        value = json.loads(raw)
        cache[rel] = value
        return value
    ledger = load(REPAIR + '/ledger.json')
    mc = load(REPAIR + '/fix-missing-capabilities.json')
    old = load(DEEP + '/07-goal-accounting.json')
    load(DEEP + '/08-FINAL.json')
    expected = {r['id'] for r in old['missingAcceptanceMap']}
    review_ids = set()
    for name in ('01-pr-integrity', '02-build-tests', '03-visual-sites', '04-visual-desktop', '05-auth-billing', '06-runtime-containment', '07-goal-accounting'):
        review_ids.update(r['id'] for r in load(DEEP + '/' + name + '.json')['findings'])
    if args.negative_control:
        ledger = copy.deepcopy(ledger)
        ledger['rows'] = ledger['rows'][1:]
    errors = check_ledger(ledger, expected, review_ids)
    if len(review_ids) != 35:
        errors.append({'code': 'DEEP_REVIEW_EXPECTED_35', 'observed': len(review_ids)})
    if {r['id'] for r in mc['taskOutcomes']} != {r['id'] for r in ledger['rows']}:
        errors.append({'code': 'MISSING_CAPABILITIES_CROSSWALK_MISMATCH'})
    canonical = {r['id']: r['canonicalAssertions'] for r in mc['originalAcceptanceMap']}
    for row in ledger['rows']:
        if row['id'] in canonical and strings(row['acceptance']['assertions']) != strings(canonical[row['id']]):
            errors.append({'code': 'CANONICAL_PREDICATE_MISMATCH', 'id': row['id']})
    # Negative controls use the actual loaded structure; no disk mutation.
    controls = []
    mutations = [('missing-id', 'MISSING_ID', lambda d: d['rows'].pop(0)),
                 ('blank-command', 'BLANK_COMMAND', lambda d: d['rows'][0]['acceptance'].update(command=' ')),
                 ('blank-predicate', 'BLANK_PREDICATE', lambda d: d['rows'][0]['acceptance'].update(assertions=[])),
                 ('blank-owner', 'BLANK_OWNER', lambda d: d['rows'][0].update(ownerLane='')),
                 ('missing-hash', 'MISSING_EVIDENCE_HASH', lambda d: d['rows'][0]['targets'][0].update(sha256='')),
                 ('wrong-json-format', 'JSON_FORMAT_ROWS_ARRAY_REQUIRED', lambda d: d.update(rows={})),
                 ('local-native-as-external', 'FALSE_EXTERNAL_LOCAL_CAPABILITY', lambda d: next(r for r in d['rows'] if r['id'] == 'DR-006').update(status='EXTERNAL_BLOCKER'))]
    for task in ('LOCAL-070', 'ENG-012', 'ENG-013'):
        mutations.append((task + '-as-external', 'FALSE_EXTERNAL_LOCAL_CAPABILITY', lambda d, task=task: next(r for r in d['rows'] if r['id'] == task).update(status='EXTERNAL_BLOCKER')))
    for name, code, mutate in mutations:
        altered = copy.deepcopy(ledger)
        mutate(altered)
        found = check_ledger(altered, expected, review_ids)
        controls.append({'name': name, 'expected': code, 'observed': sorted({e['code'] for e in found}), 'pass': any(e['code'] == code for e in found)})
    dialects, claims, finishes, classifications = [], [], set(), []
    paths = sorted((root / BASE).glob('finish-*.json')) + sorted((root / REPAIR).glob('fix-*.json'))
    for p in paths:
        rel = p.relative_to(root).as_posix()
        doc = cache.get(rel) if rel in cache else load(rel)
        key, rows, note = report_rows(doc)
        dialects.append({'path': rel, 'container': key, 'rowCount': len(rows), 'note': note})
        if note and note.startswith('FORMAT_ERROR'):
            errors.append({'code': 'REPORT_FORMAT_MISMATCH', 'path': rel, 'detail': note})
        for pointer, row in rows:
            task = row['id']
            status = str(row.get('status', row.get('localStatus', '')))
            if p.name in ('finish-authoring.json', 'finish-engine.json', 'finish-assets-kids.json', 'finish-cli-desktop.json'):
                finishes.add(task)
            if task in LOCAL and 'EXTERNAL' in status:
                classifications.append({'id': task, 'path': rel, 'pointer': pointer, 'status': status, 'reason': 'mixed local capability cannot close as external-only; retain separate hardware/signing gate'})
            if status.startswith('DONE') or status in ('PASS', 'VERIFIED'):
                claims.append({'id': task, 'path': rel, 'pointer': pointer, 'reportedStatus': status, 'scope': 'historical' if p.parent == root / BASE else 'repair', 'reason': 'Requires serial reconciliation against ledger NEEDS_LOCAL_FIX; not a finding that reported tests are absent or false', 'namedEvidencePresent': bool(row.get('matchingExecutedOracles') or row.get('executedAssertions') or row.get('proof')), 'reportCommandCount': len(doc.get('commands', doc.get('latestVerification', []))), 'reportedRow': row})
    missing_finish = sorted(expected - finishes)
    if missing_finish != sorted(ledger['missing53Ids']):
        errors.append({'code': 'MISSING_FINISH_SET_DRIFT', 'observed': missing_finish})
    gaps, packets, current_hashes = [], [], {}
    for i, row in enumerate(ledger['rows']):
        targets = []
        for t in row.get('targets', []):
            name = t['path']
            p = (root / name).resolve()
            if not p.is_relative_to(root):
                observed = None
            else:
                if name not in current_hashes:
                    current_hashes[name] = sha(p.read_bytes()) if p.is_file() else None
                observed = current_hashes[name]
            targets.append({'path': name, 'line': t.get('line'), 'symbol': t.get('symbol'), 'recordedSha256': t.get('sha256'), 'currentSha256': observed})
            if observed != t.get('sha256') or observed is None:
                gaps.append({'id': row['id'], 'path': name, 'recordedSha256': t.get('sha256'), 'currentSha256': observed, 'reason': 'missing target' if observed is None else 'artifact hash drift; not itself product regression'})
        packets.append({'id': row['id'], 'ledgerPointer': '/rows/' + str(i), 'owner': row.get('ownerLane'), 'status': 'NOT_RUN', 'command': row['acceptance'].get('command'), 'cwd': row['acceptance'].get('cwd'), 'timeoutSeconds': row['acceptance'].get('timeoutSeconds'), 'predicates': row['acceptance'].get('assertions'), 'subject': targets, 'preconditions': ['Explicit serial-integration handoff; stable reviewed source/artifact', 'Per-command resource/authority review: commands may exceed this lane heavy-job budget', 'Map each predicate to named real-front-door oracle, do not infer coverage from suite exit'], 'requiredReceipt': {'executed': True, 'exit': 0, 'command': 'exact command', 'cwd': 'exact cwd', 'subjectHashes': 'path -> actual source/artifact SHA256', 'predicateResults': 'each predicate -> named assertion + observed input/output + log path/SHA256', 'cleanup': 'owned resources removed'}, 'productAcceptance': 'NOT_VERIFIED'})
    hash_input = json.dumps(sorted(current_hashes.items()), separators=(',', ':')).encode()
    result = {'taskid': 'task-proof', 'schemaVersion': 1, 'subject': 'actual report/ledger bytes and current declared target bytes; no dist or product execution', 'fingerprints': fingerprints, 'currentTargetInventorySha256': sha(hash_input), 'counts': {'ledgerRows': len(ledger['rows']), 'originalIds': len(expected), 'overlappingReviewFindings': len(review_ids), 'judgeAliases': 5, 'supplements': sum(r['category'] == 'supplemental-new' for r in ledger['rows']), 'missingOriginalFinishIds': len(missing_finish), 'unexplainedClosureRecords': len(claims), 'targetHashGapRecords': len(gaps)}, 'structuralErrors': errors, 'negativeControls': controls, 'jsonDialects': dialects, 'missingOriginalFinishIds': missing_finish, 'unexplainedClosures': claims, 'falseExternalClassifications': classifications, 'currentEvidenceGaps': gaps, 'acceptancePackets': packets, 'executed': ['read-only JSON crosswalk', 'SHA256 declared source/evidence targets', 'seven in-memory negative controls'], 'deferred': ['All product commands in acceptancePackets are NOT_RUN; no full review/production acceptance claimed'], 'resourcesCleaned': 'No temporary fixtures, processes, ports, containers or dependencies created', 'authority': 'Auxiliary only; authoritative ledger unchanged', 'verdict': 'STRUCTURAL_FAIL' if errors else 'STRUCTURAL_PASS_ACCEPTANCE_OPEN'}
    result['executed'][-1] = f'{len(controls)} in-memory negative controls'
    result['closureQueuePolicy'] = 'unexplainedClosures is an unresolved cross-report reconciliation queue, not a verdict against bounded lane evidence. Preserve reportedRow and namedEvidencePresent; never infer false tests from missing normalized receipts.'
    result['counts']['historicalClosureRecords'] = sum(c['scope'] == 'historical' for c in claims)
    result['counts']['repairClosureRecords'] = sum(c['scope'] == 'repair' for c in claims)
    result['counts']['uniqueTargetHashGapPaths'] = len({g['path'] for g in gaps})
    result['counts']['closureUniqueIds'] = len({c['id'] for c in claims})
    result['unexplainedClosureIds'] = sorted({c['id'] for c in claims})
    print(json.dumps(result, indent=2, sort_keys=True))
    return 1 if errors or not all(c['pass'] for c in controls) else (2 if args.strict_proof else 0)


if __name__ == '__main__':
    try:
        sys.exit(main())
    except (ValueError, KeyError, TypeError, OSError) as error:
        print(json.dumps({'verdict': 'INPUT_REFUSED', 'errorType': type(error).__name__, 'detail': str(error)}))
        sys.exit(1)
