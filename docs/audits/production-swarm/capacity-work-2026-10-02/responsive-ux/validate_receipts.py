#!/usr/bin/env python3
"""Read-only, bounded PNG/DOM receipt verifier; never launches product processes."""
import copy, hashlib, json, pathlib, struct, subprocess, zlib
ROOT = pathlib.Path(__file__).resolve().parents[5]
HERE = pathlib.Path(__file__).resolve().parent
BASE = 'sites/catalog-game/test/visual-evidence/postpr/'
sha = lambda b: hashlib.sha256(b).hexdigest()
def load(p):
    return json.loads((ROOT / p).read_text())
def png(row, data=None):
    p = (ROOT / row['file']).resolve()
    assert p.is_relative_to(ROOT / BASE), 'RECEIPT_PATH_OUTSIDE_APPROVED_DIRECTORY'
    b = p.read_bytes() if data is None else data
    assert sha(b) == row['sha256'], 'PNG_HASH_MISMATCH'
    assert len(b) == row['bytes'], 'PNG_BYTES_MISMATCH'
    assert b[:8] == b'\x89PNG\r\n\x1a\n', 'PNG_SIGNATURE'
    pos, chunks, dimensions = 8, [], None
    while pos < len(b):
        size = struct.unpack('>I', b[pos:pos+4])[0]
        kind, content = b[pos+4:pos+8], b[pos+8:pos+8+size]
        crc = struct.unpack('>I', b[pos+8+size:pos+12+size])[0]
        assert zlib.crc32(kind + content) & 0xffffffff == crc, 'PNG_CRC'
        chunks.append(kind.decode('ascii'))
        if kind == b'IHDR':
            dimensions = struct.unpack('>IIBBBBB', content)
        pos += 12 + size
        if kind == b'IEND': break
    assert pos == len(b) and chunks[0] == 'IHDR' and chunks[-1] == 'IEND' and 'IDAT' in chunks, 'PNG_STRUCTURE'
    assert dimensions[0] == (390 if row['viewport'] == 'mobile' else 1440), 'PNG_VIEWPORT_WIDTH'
    m = row.get('metrics', {})
    assert m.get('scrollWidth', 0) <= m.get('width', 0), 'RECORDED_DOCUMENT_OVERFLOW'
    return dict(path=row['file'], sha256=sha(b), bytes=len(b), width=dimensions[0], height=dimensions[1], bitDepth=dimensions[2], colorType=dimensions[3], metrics=m)
def contrast(fg, bg):
    def lum(h):
        channels = [int(h[i:i+2],16)/255 for i in (1,3,5)]
        return sum((v/12.92 if v <= .04045 else ((v+.055)/1.055)**2.4)*w for v,w in zip(channels,[.2126,.7152,.0722]))
    a,b = sorted([lum(fg),lum(bg)])
    return (b+.05)/(a+.05)
def main():
    report = load('docs/audits/production-swarm/finish-visual-postpr-sites.json')
    receipts, ledgers, controls = [], [], []
    pairs = {('umbrella','editor'), ('umbrella','account'), ('catalog-game','detail'), ('catalog-web','empty'), ('kids','empty')}
    for phase in ('before','after'):
        reference = report['screenshots']['all'+phase.title()+'Receipts']
        raw = (ROOT/reference['file']).read_bytes()
        assert sha(raw) == reference['sha256'], 'LEDGER_HASH_MISMATCH'
        ledger = json.loads(raw)
        ledgers.append(dict(path=reference['file'],sha256=sha(raw),fields=sorted(ledger)))
        selected = [r for r in ledger['receipts'] if (r['site'],r['name']) in pairs]
        assert len(selected) == 10, 'MISSING_MOBILE_DESKTOP_RECEIPTS'
        for r in selected:
            receipts.append(png(r))
        first = selected[0]
        corrupt = copy.deepcopy(first); corrupt['sha256'] = '0'*64
        try: png(corrupt)
        except AssertionError as e: controls.append(dict(input='expected sha256='+'0'*64, observed=str(e), passed=str(e)=='PNG_HASH_MISMATCH'))
        else: raise AssertionError('NEGATIVE_CONTROL_NOT_LIVE')
    before = load(BASE+'before.json'); after = load(BASE+'after.json')
    colors = []
    for phase,ledger in [('before',before),('after',after)]:
        r = next(r for r in ledger['receipts'] if r['site']=='umbrella' and r['name']=='editor' and r['viewport']=='desktop')
        colors.append(dict(phase=phase, observed=r['metrics']['stale'], background='#0D0F12', foreground='#7A6448' if phase=='before' else '#8A929C', ratio=contrast('#7A6448' if phase=='before' else '#8A929C','#0D0F12')))
    assert colors[0]['ratio'] < 4.5 <= colors[1]['ratio'], 'CONTRAST_BEFORE_AFTER_ORACLE'
    sources = {p:sha((ROOT/p).read_bytes()) for p in report['sourceSha256After']}
    for p in ['packages/site-kit/src/design-tokens.ts','apps/web-shell/src/inspector-app.ts','apps/desktop-shell/src/chrome.ts']:
        sources[p] = sha((ROOT/p).read_bytes())
    result = dict(taskId='responsive-ux', status='PASS_HISTORICAL_RECEIPT_INTEGRITY_ONLY', head=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True,timeout=10).strip(), subject='Historical local PNG and recorded DOM metrics; no fresh rendering, no PR certification', sourceHashes=sources, sourceFingerprint=sha(json.dumps(sources,sort_keys=True).encode()), historicalCssMatches={p:sources[p]==h for p,h in report['sourceSha256After'].items()}, ledgers=ledgers, receipts=receipts, negativeControls=controls, contrast=colors, limitations=['PNG structural validation is not decoded pixel/aesthetic review','Historical ledgers omit raw HTTP status/page errors and complete source/build identity','Account screenshots do not prove authenticated purchase history','Desktop compact delegated to keyboard-ux; no fresh native browser run'])
    print(json.dumps(result,indent=2))
if __name__ == '__main__': main()
