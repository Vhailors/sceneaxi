#!/usr/bin/env python3
"""Read-only native Git path/blob/mode inventory. No index/object/ref writes.
Run from anywhere; JSON output is stdout. --candidate requires an existing local
Git commit/tree (never fetched). Auxiliary capacity-work receipts are excluded
from checkout hashing to avoid reading other agents' exclusive directories.
Exit 2 = acceptance blocked; this auxiliary tool never authorizes publication.
"""
import argparse
import datetime
import hashlib
import json
import os
from pathlib import Path
import stat
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[5]
EXCLUDED = 'docs/audits/production-swarm/capacity-work-2026-10-02/'
BASE = 'dd77cc9cb91d24091082e0c5bc20a130f0f51ffc'
PUBLISHED = '346933c105305224d575bf9319256301c1eeabfa'


def run(*args, data=None, allowed=(0,)):
    p = subprocess.run(args, cwd=ROOT, input=data, stdout=subprocess.PIPE,
                       stderr=subprocess.PIPE, timeout=60,
                       env={**os.environ, 'GIT_OPTIONAL_LOCKS': '0'})
    if p.returncode not in allowed:
        raise RuntimeError(f'{args}: exit {p.returncode}: {p.stderr.decode(errors="replace")}')
    return p


def git(*args, data=None):
    return run('git', *args, data=data).stdout


def tree(ref):
    result = {}
    for row in git('ls-tree', '-rz', '--full-tree', ref).split(b'\0'):
        if not row:
            continue
        header, path = row.split(b'\t', 1)
        mode, kind, oid = header.decode().split()
        result[os.fsdecode(path)] = {'mode': mode, 'type': kind, 'blob': oid}
    return result


def fingerprint(entries):
    return hashlib.sha256(json.dumps(entries, sort_keys=True, ensure_ascii=True,
                                     separators=(',', ':')).encode()).hexdigest()


def compare(expected, actual):
    common = expected.keys() & actual.keys()
    return {'missing': sorted(expected.keys() - actual.keys()),
            'added': sorted(actual.keys() - expected.keys()),
            'blobChanged': sorted(p for p in common if expected[p]['blob'] != actual[p]['blob']),
            'modeChanged': sorted(p for p in common if expected[p]['mode'] != actual[p]['mode']),
            'typeChanged': sorted(p for p in common if expected[p]['type'] != actual[p]['type'])}


def checkout():
    index = {}
    for row in git('ls-files', '--stage', '-z').split(b'\0'):
        if row:
            head, raw = row.split(b'\t', 1)
            mode, oid, stage = head.decode().split()
            if stage != '0':
                raise RuntimeError('unmerged index: ' + os.fsdecode(raw))
            index[os.fsdecode(raw)] = {'mode': mode, 'type': 'commit' if mode == '160000' else 'blob', 'blob': oid}
    untracked = [os.fsdecode(p) for p in git('ls-files', '--others', '--exclude-standard', '-z').split(b'\0') if p]
    paths = sorted(set(index) | set(untracked))
    entries, regular, before, errors = {}, [], {}, []
    for path in paths:
        if path.startswith(EXCLUDED):
            continue
        absolute = ROOT / path
        try:
            info = absolute.lstat()
        except FileNotFoundError:
            continue
        before[path] = (info.st_mtime_ns, info.st_size, info.st_mode)
        if stat.S_ISLNK(info.st_mode):
            oid = git('hash-object', '--stdin', data=os.fsencode(os.readlink(absolute))).decode().strip()
            entries[path] = {'mode': '120000', 'type': 'blob', 'blob': oid}
        elif stat.S_ISREG(info.st_mode):
            entries[path] = {'mode': '100755' if info.st_mode & 0o111 else '100644', 'type': 'blob', 'blob': ''}
            regular.append(path)
        elif index.get(path, {}).get('mode') == '160000':
            errors.append('gitlink needs independently pinned submodule checkout: ' + path)
            entries[path] = index[path]
        else:
            errors.append('unsupported file kind: ' + path)
    for start in range(0, len(regular), 100):
        batch = regular[start:start + 100]
        hashes = git('hash-object', '--no-filters', '--', *batch).decode().splitlines()
        assert len(hashes) == len(batch)
        for path, oid in zip(batch, hashes):
            entries[path]['blob'] = oid
    for path, previous in before.items():
        try:
            info = (ROOT / path).lstat()
            if previous != (info.st_mtime_ns, info.st_size, info.st_mode):
                errors.append('changed during snapshot: ' + path)
        except FileNotFoundError:
            errors.append('disappeared during snapshot: ' + path)
    return entries, index, untracked, errors


def gh_receipt(*args):
    command = ['gh', *args, '--repo', 'Vhailors/sceneaxi']
    try:
        p = run(*command, allowed=tuple(range(256)))
        return {'command': command, 'exit': p.returncode,
                'output': json.loads(p.stdout) if p.returncode == 0 else p.stdout.decode(errors='replace'),
                'stderr': p.stderr.decode(errors='replace')}
    except (RuntimeError, subprocess.TimeoutExpired, FileNotFoundError, ValueError) as exc:
        return {'command': command, 'error': str(exc)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base', default=BASE)
    parser.add_argument('--published', default=PUBLISHED)
    parser.add_argument('--candidate', help='existing commit/tree, explicitly selected by integrator')
    parser.add_argument('--github', action='store_true', help='read-only PR metadata requests')
    args = parser.parse_args()
    assert git('rev-parse', '--show-toplevel').decode().strip() == str(ROOT)
    snapshots = {'base': tree(args.base), 'published': tree(args.published), 'localHead': tree('HEAD')}
    local, index, untracked, errors = checkout()
    snapshots['currentCheckout'] = local
    snapshots['index'] = index
    if args.candidate:
        snapshots['sourceCandidate'] = tree(args.candidate)
    comparisons = {name: compare(snapshots['base'], value) for name, value in snapshots.items() if name != 'base'}
    comparisons['publishedToCheckout'] = compare(snapshots['published'], local)
    if args.candidate:
        # Same explicit auxiliary exclusion on both sides; all other paths exact.
        candidate = {p: v for p, v in snapshots['sourceCandidate'].items() if not p.startswith(EXCLUDED)}
        comparisons['checkoutToCandidate'] = compare(local, candidate)
    # Negative controls operate ONLY on in-memory snapshots, using real native Git input.
    chosen = 'packages/schemas/package.json'
    assert chosen in snapshots['base']
    negative = dict(snapshots['base'])
    del negative[chosen]
    refusal = compare(snapshots['base'], negative)
    assert refusal['missing'] == [chosen]
    assert not any(compare(snapshots['base'], snapshots['base']).values())
    executable = next(p for p, v in snapshots['base'].items() if v['mode'] == '100755')
    mode_control = {**snapshots['base'], executable: {**snapshots['base'][executable], 'mode': '100644'}}
    assert compare(snapshots['base'], mode_control)['modeChanged'] == [executable]
    blob_control = {**snapshots['base'], chosen: {**snapshots['base'][chosen], 'blob': '0' * 40}}
    assert compare(snapshots['base'], blob_control)['blobChanged'] == [chosen]
    gh = {}
    if args.github:
        gh['openPRs'] = gh_receipt('pr', 'list', '--state', 'open', '--limit', '100', '--json', 'number,title,headRefName,headRefOid,baseRefName,isDraft,mergeable,mergeStateStatus,url')
        gh['pr312'] = gh_receipt('pr', 'view', '312', '--json', 'number,state,headRefName,headRefOid,baseRefName,baseRefOid,mergeable,mergeStateStatus,statusCheckRollup,url')
    probes = ['sites/umbrella/src/app/api/checkout/checkout-handler.ts',
              'sites/umbrella/src/app/globals.css', 'sites/catalog-game/src/app/globals.css',
              'sites/catalog-web/src/app/globals.css', 'sites/kids/src/app/globals.css',
              'apps/desktop-shell/src/chrome.ts', 'apps/web-shell/src/inspector-app.ts',
              'docs/audits/production-swarm/finish-visual-postpr-sites.json',
              'docs/audits/production-swarm/finish-visual-postpr-desktop.json']
    blockers = ['candidate ownership/release is external authority; this script cannot approve publication']
    if not args.candidate:
        blockers.append('source candidate NOT PROVIDED: checkout/HEAD/index are not a frozen candidate')
    if comparisons['currentCheckout']['missing']:
        blockers.append('base paths missing locally without per-path approval')
    if comparisons['published']['missing']:
        blockers.append('published tree loses base paths: approval/rename mapping required')
    if errors:
        blockers.extend(errors)
    if args.candidate and any(comparisons['checkoutToCandidate'].values()):
        blockers.append('candidate differs from complete observed checkout')
    receipt = {'taskId': 'pr-ready', 'status': 'BLOCKED',
               'capturedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
               'root': str(ROOT), 'head': git('rev-parse', 'HEAD').decode().strip(),
               'inputs': vars(args), 'excludedCheckoutSubtree': EXCLUDED,
               'hashSemantics': 'Git native raw blob IDs (--no-filters), symlink target bytes, native executable bits; ignored untracked build/install outputs excluded by Git; index separate',
               'candidateOwnership': 'FROZEN for Astra; serial integrator only after explicit handoff; no grant inferred from status/ref names',
               'inventories': {name: {'count': len(value), 'inventorySha256': fingerprint(value),
                                     'executables': sorted(p for p, v in value.items() if v['mode'] == '100755'),
                                     'entries': value} for name, value in snapshots.items()},
               'sourceCheckoutFingerprint': fingerprint({p: v for p, v in local.items() if not p.startswith('docs/audits/')}),
               'comparisons': comparisons, 'snapshotErrors': errors,
               'untrackedPaths': untracked,
               'lostPublishedManifests': [p for p in comparisons['published']['missing'] if p.endswith('/package.json')],
               'probes': {p: {'untracked': p in untracked, **{name: value.get(p) for name, value in snapshots.items()}} for p in probes},
               'negativeControl': {'missingPath': chosen, 'inputSha256': fingerprint(negative), 'observed': refusal,
                                   'missingDetected': True, 'modeDetected': True, 'blobDetected': True, 'identityControlPassed': True,
                                   'actualTreeModified': False},
               'github': gh, 'blockers': blockers,
               'executed': ['native complete tree/index/checkout inventory', 'real base missing-path/mode/blob negative controls', 'identity positive control'],
               'deferred': ['candidate-ref equality and explicit deletion approvals', 'unchanged root/site/native/SDK/docs gate on released artifact', 'immutable resulting PR SHA required CI'],
               'cleanup': 'No temporary files, ports, services or object/index/ref writes; stdout only.'}
    print(json.dumps(receipt, indent=2, sort_keys=True))
    return 2


if __name__ == '__main__':
    sys.exit(main())
