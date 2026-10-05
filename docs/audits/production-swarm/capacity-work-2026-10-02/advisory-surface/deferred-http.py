#!/usr/bin/env python3
"""NOTRUN: actual existing loopback Next production HTTP acceptance.
Preconditions: serial owner rebuilt exact candidate, records build/output/native hashes,
starts isolated Next server, supplies an existing local raster path. No server is started here.
Run once per site: python3 deferred-http.py --url http://127.0.0.1:PORT --fixture /known.png --candidate SHA256
"""
import argparse
import hashlib
import json
import urllib.error
import urllib.parse
import urllib.request

p = argparse.ArgumentParser(description=__doc__)
p.add_argument('--url', required=True)
p.add_argument('--fixture', required=True)
p.add_argument('--candidate', required=True)
a = p.parse_args()
u = urllib.parse.urlsplit(a.url)
assert u.scheme == 'http' and u.hostname in ('127.0.0.1', 'localhost', '::1') and not u.username and not u.password
assert a.fixture.startswith('/') and not a.fixture.startswith('//')
assert len(a.candidate) == 64 and all(c in '0123456789abcdef' for c in a.candidate)
class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None
opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
checks = [
    ('missing-query', '', 400),
    ('remote-negative', urllib.parse.urlencode({'url':'https://example.invalid/control.png','w':640,'q':75}),400),
    ('real-raster', urllib.parse.urlencode({'url':a.fixture,'w':640,'q':75}),200),
]
rows = []
for name, query, expected in checks:
    url = a.url.rstrip('/') + '/_next/image' + ('?' + query if query else '')
    request = urllib.request.Request(url, headers={'Accept':'image/png'})
    try:
        response = opener.open(request, timeout=5)
    except urllib.error.HTTPError as error:
        response = error
    with response:
        body = response.read(2_000_001)
        assert len(body) <= 2_000_000
        row = {'name':name,'input':url,'status':response.status,'contentType':response.headers.get('Content-Type'),
               'sha256':hashlib.sha256(body).hexdigest(),'body':body.decode('utf8',errors='replace') if expected==400 else None}
        rows.append(row)
        assert response.status == expected, row
        if expected == 200: assert row['contentType'].startswith('image/'), row
print(json.dumps({'status':'PASS_HTTP_ONLY','candidateProvidedByOperator':a.candidate,'checks':rows},indent=2))
