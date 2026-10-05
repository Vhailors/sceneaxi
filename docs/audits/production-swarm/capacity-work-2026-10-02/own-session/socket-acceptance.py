#!/usr/bin/env python3
"""DEFERRED: only an explicitly approved isolated fixture deployment.
No production, provider credentials or cookie jar. No service launch.
Run: python3 socket-acceptance.py --base http://127.0.0.1:UNIQUE_PORT \
 --credential session-a.fixture --expired session-expired.fixture --user user-a
Requires proposed /api/auth/own-session and existing IdentityPort fixture wiring.
"""
import argparse
import hashlib
import json
import urllib.error
import urllib.request

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise RuntimeError('Redirect forbidden: ' + newurl)

parser = argparse.ArgumentParser()
parser.add_argument('--base', required=True)
parser.add_argument('--credential', required=True, help='synthetic fixture only')
parser.add_argument('--expired', required=True, help='synthetic expired fixture only')
parser.add_argument('--user', required=True)
args = parser.parse_args()
base = args.base.rstrip('/')
opener = urllib.request.build_opener(NoRedirect())

def probe(name, origin, credential, expected, cookie=None):
    headers = {'accept': 'application/json'}
    if origin is not None:
        headers['origin'] = origin
    if credential is not None:
        headers['x-sceneaxi-session'] = credential
    if cookie is not None:
        headers['cookie'] = 'sceneaxi.session=' + cookie
    request = urllib.request.Request(base + '/api/auth/own-session', headers=headers)
    try:
        response = opener.open(request, timeout=5)
    except urllib.error.HTTPError as error:
        response = error
    with response:
        raw = response.read(65537)
        assert len(raw) <= 65536, 'oversized response'
        body = json.loads(raw)
        observed = {'status': response.code, 'headers': dict(response.headers), 'body': body}
        print(json.dumps({'probe': name, 'input': {'url': request.full_url, 'headers': headers},
                          'observed': observed, 'sha256': hashlib.sha256(raw).hexdigest()}))
        assert response.code == expected, observed
        assert response.headers.get('cache-control') == 'no-store', observed
        assert response.headers.get('pragma') == 'no-cache', observed
        vary = {v.strip().lower() for v in response.headers.get('vary', '').split(',')}
        assert vary == {'origin', 'x-sceneaxi-session'}, observed
        if expected == 403:
            assert body['reason'] == 'SITE_REQUEST_CROSS_ORIGIN', body
        if expected == 200:
            principal = body['value']
            assert body['ok'] is True
            assert principal['user']['userId'] == args.user
            assert principal['session']['userId'] == args.user
            assert principal['session']['surface'] == 'umbrella'
        return body

probe('missing origin', None, args.credential, 403)
probe('hostile origin', 'https://hostile.example.invalid', args.credential, 403)
probe('cookie is not credential', base, None, 401, cookie=args.credential)
probe('explicit valid carried credential', base, args.credential, 200)
probe('expired credential', base, args.expired, 401)
# Live negative control: the positive binding oracle must fail with a wrong user.
original = args.user
args.user = original + '-negative-control'
detected = False
try:
    probe('negative control wrong expected user', base, args.credential, 200)
except AssertionError:
    detected = True
assert detected, 'binding oracle negative control did not fail'
print('PASS socket oracle negative control; isolated fixture acceptance only')
