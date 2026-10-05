#!/usr/bin/env python3
"""Bounded source admission + receipt negative control; never launches native GUI."""
import argparse, copy, hashlib, importlib.util, json, pathlib, subprocess, sys
OWN = pathlib.Path(__file__).resolve().parent
ROOT = OWN.parents[5]
spec = importlib.util.spec_from_file_location('eight_mib_check', OWN / 'check.py')
check = importlib.util.module_from_spec(spec)
spec.loader.exec_module(check)
def sha(data): return hashlib.sha256(data).hexdigest()
def validate(receipt):
    assert receipt['exit'] == 0, receipt.get('stderr')
    assert receipt['mode'] == 'admission-only'
    assert receipt['resourcesCleaned'] is True
    payload = json.loads(receipt['stdout'])
    cases = {item['input']: item for item in payload['cases']}
    assert set(cases) == {'next-byte.gltf', 'alias.gltf'}
    b = check.fixture()
    assert len(b) == 8388608 and json.loads(b)['buffers'][0]['byteLength'] == 36
    for name, size, digest, reason in [
        ('next-byte.gltf', 8388609, sha(b + b' '), 'ASSET_IMPORT_OVERSIZE'),
        ('alias.gltf', 8388608, sha(b), 'ASSET_IMPORT_SOURCE_SYMLINK')]:
        case = cases[name]
        assert case['byteLength'] == size and case['sha256'] == digest, name
        assert case['ok'] is False and case['reason'] == reason, name
        assert case['documentUnchanged'] is True, name
    assert len(payload['canonicalDocumentSha256']) == 64
    hashes = payload['sourceHashes']
    for required in ['packages/importers/src/index.ts', 'packages/importers/src/contained-gltf.ts', 'desktop/linux/src/lib/project-seed.ts']:
        assert required in hashes, required
    for relative, expected in hashes.items():
        source = (check.ROOT / relative).resolve()
        assert source.is_relative_to(check.ROOT.resolve()), relative
        assert sha(source.read_bytes()) == expected, 'source drift: ' + relative
    return {'cases': payload['cases'], 'canonicalDocumentSha256': payload['canonicalDocumentSha256'], 'sourceHashes': hashes}
def main():
    parser = argparse.ArgumentParser(); parser.add_argument('--run', action='store_true'); args = parser.parse_args()
    if args.run:
        run = subprocess.run([sys.executable, str(OWN / 'check.py'), '--admission-only'], capture_output=True, text=True, timeout=90)
        if run.returncode:
            print(run.stderr or run.stdout, file=sys.stderr); return run.returncode
    receipt = json.loads((OWN / 'admission-only-receipt.json').read_text())
    observed = validate(receipt)
    changed = check.fixture(1)
    assert len(changed) == 8388608 and sha(changed) != sha(check.fixture())
    assert json.loads(changed)['accessors'][0]['min'] == [1, 0, 0]
    observed['changedSourceFixture'] = {'byteLength': len(changed), 'sha256': sha(changed), 'geometry': 'triangle translated +1 x', 'executed': 'generation only; native hot reload NOTRUN'}
    # Kill-switch negative control: a receipt falsely claiming admission must fail.
    bad = copy.deepcopy(receipt); payload = json.loads(bad['stdout'])
    payload['cases'][0]['ok'] = True; payload['cases'][0]['reason'] = None
    bad['stdout'] = json.dumps(payload)
    try: validate(bad)
    except AssertionError: negative = 'PASS: falsified refusal rejected'
    else: raise AssertionError('dead validator: falsified admission accepted')
    output = {'taskId': 'eight-mib', 'subject': 'current actual TS source public API, not GUI or dist', 'status': 'PASS_SOURCE_ADMISSION_ONLY', 'observed': observed, 'negativeControl': negative, 'native': 'NOTRUN', 'resourcesCleaned': receipt['resourcesCleaned'], 'harnessSha256': sha(pathlib.Path(__file__).read_bytes()), 'probeSha256': sha((OWN / 'check.py').read_bytes())}
    (OWN / 'acceptance-receipt.json').write_text(json.dumps(output, indent=2) + '\n')
    print(json.dumps({'status': output['status'], 'cases': observed['cases'], 'negativeControl': negative, 'native': 'NOTRUN', 'resourcesCleaned': output['resourcesCleaned']}, indent=2))
    return 0
if __name__ == '__main__': sys.exit(main())
