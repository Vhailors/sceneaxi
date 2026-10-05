import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBetterAuthHttpClient } from '../../sites/umbrella/src/lib/provider-adapters.ts';

import { createCheckoutHandler } from '../../sites/umbrella/src/app/api/checkout/checkout-handler.ts';
import type { SiteResult, SiteCheckoutHandoff } from '@sceneaxi/site-kit';

type CheckoutFixture = { sessionReads: number; planeReads: number; checkout: SiteResult<SiteCheckoutHandoff> };

const fixture: CheckoutFixture = {
  sessionReads: 0, planeReads: 0,
  checkout: { ok: false, reason: 'BILLING_CHECKOUT_RATE_LIMITED', message: 'Budget reached.' },
};

const checkout = createCheckoutHandler({
  environment: () => process.env,
  readRequestSignals: (request) => ({ formOrigin: { requestUrl: request.url, origin: request.headers.get('origin'), fetchSite: request.headers.get('sec-fetch-site') } }),

  readSessionToken: async () => {
    fixture.sessionReads++;

    return 'fixture-session';
  },
  plane: () => {
    fixture.planeReads++;

    return { wired: { billing: true }, identity: { resolvePrincipal: async () => ({ ok: true, value: { user: { userId: 'fixture-user' } } }) }, billing: { createCheckout: async () => fixture.checkout } };
  },
  log: () => {},
  json: (payload, options) => Response.json(payload, options),
  redirect: (url, status) => Response.redirect(url, status),
});

const invoke = (body: string, contentType = 'application/x-www-form-urlencoded', origin: string | null = 'https://fixture.test', accept = 'application/json') => {
  const headers = new Headers({ 'content-type': contentType, accept, host: 'alias.test' });

  if (origin !== null) headers.set('origin', origin);

  return checkout(new Request('https://fixture.test/api/checkout', { method: 'POST', headers, body }));
};

const valid = 'packId=starter-100&attempt=fixture_attempt_123456';

afterEach(() => { vi.unstubAllEnvs(); fixture.sessionReads = 0; fixture.planeReads = 0; });

describe('real checkout handler boundary with hermetic authority fixture', () => {
  it.each([['{}','application/json'],['bad','multipart/form-data; boundary=missing'],[`${valid}&attempt=duplicate`,'application/x-www-form-urlencoded'],['x'.repeat(8193),'application/x-www-form-urlencoded']])('malformed/ambiguous/bounded form returns named400 before authority', async (body, type) => {
    vi.stubEnv('NEXT_PUBLIC_SCENEAXI_UMBRELLA_ORIGIN','https://fixture.test');
    const response = await invoke(body, type);expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ ok: false, reason: 'BILLING_CHECKOUT_REQUEST_INVALID' });
    expect(fixture.sessionReads).toBe(0);expect(fixture.planeReads).toBe(0);
  });
  it.each([null,'https://evil.test','https://alias.test'])('hostile/missing/alias Origin %s refuses403 before body/authority', async origin => {
    vi.stubEnv('NEXT_PUBLIC_SCENEAXI_UMBRELLA_ORIGIN','https://fixture.test');
    const response = await invoke('invalid','application/json',origin);expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ reason: 'SITE_REQUEST_CROSS_ORIGIN' });
    expect(fixture.sessionReads).toBe(0);expect(fixture.planeReads).toBe(0);
  });
  it('durable budget refusal maps JSON429 with bounded retry-after', async () => {
    vi.stubEnv('NEXT_PUBLIC_SCENEAXI_UMBRELLA_ORIGIN','https://fixture.test');
    const response=await invoke(valid);expect(response.status).toBe(429);expect(response.headers.get('retry-after')).toBe('300');
    expect(await response.json()).toMatchObject({reason:'BILLING_CHECKOUT_RATE_LIMITED'});expect(fixture.planeReads).toBe(1);
  });
  it('browser refusal keeps303 same-site relative target, never requestHost', async () => {
    vi.stubEnv('NEXT_PUBLIC_SCENEAXI_UMBRELLA_ORIGIN','https://fixture.test');
    const response=await invoke(valid,'application/x-www-form-urlencoded','https://fixture.test','text/html');
    expect(response.status).toBe(303);expect(response.headers.get('location')).toBe('/pricing?reason=BILLING_CHECKOUT_RATE_LIMITED');
  });
});

it('configured-origin proof accompanies both BetterAuth mutation POSTs, no Host trust', async () => {
  const requests: { url: string; init: Readonly<RequestInit> | undefined }[] = [];

  const client=createBetterAuthHttpClient({ origin: 'https://configured.test/ignored-path', fetch: async (url, init) => {
    requests.push({url,init});

    return new Response(JSON.stringify(url.endsWith('get-session') ? null : url.endsWith('sign-out') ? {success:true} : {user:{id:'u',email:'u@fixture.test',emailVerified:true},session:{id:'s',token:'fixture-token',userId:'u',expiresAt:'2026-01-01Z'}}));
  } });

  await client.api.signInEmail({body:{email:'u@fixture.test',password:'fixture-password'}});
  await client.revokeSession('fixture-token');
  const posts=requests.filter(x=>x.init?.method==='POST');expect(posts).toHaveLength(2);

  for(const {url,init} of posts) {expect(url).toMatch(/^https:\/\/configured\.test\/api\/auth\//);expect(init).toMatchObject({headers:{origin:'https://configured.test'},redirect:'error',cache:'no-store'});}
});


describe('checkout carried-session and configured-origin positive/negative proof', () => {
  function harness(principal: SiteResult<{ user: { userId: string } }>) {
    const calls: { userId: string; successUrl: string; cancelUrl: string }[] = [];
    let sessionReads = 0;
    const handler = createCheckoutHandler({
      environment: () => ({ NEXT_PUBLIC_SCENEAXI_UMBRELLA_ORIGIN: 'https://configured.test' }),
      readRequestSignals: request => ({ formOrigin: { requestUrl: request.url, origin: request.headers.get('origin'), fetchSite: request.headers.get('sec-fetch-site') } }),
      readSessionToken: async () => { sessionReads++; return 'carried-session'; },
      plane: token => {
        expect(token).toBe('carried-session');
        return { wired: { billing: true },
          identity: { resolvePrincipal: async input => { expect(input).toEqual({ surface: 'site', sessionToken: 'carried-session' }); return principal; } },
          billing: { createCheckout: async input => { calls.push(input); return { ok: true, value: { intentId: 'fixture-intent', redirectUrl: 'https://checkout.fixture.test/session', mode: 'test' } }; } },
        };
      },
      log: () => {}, json: (payload, options) => Response.json(payload, options),
      redirect: (url, status) => Response.redirect(url, status),
    });
    const request = (origin = 'https://configured.test') => new Request('https://configured.test/api/checkout', {
      method: 'POST', headers: { origin, host: 'untrusted-alias.test', accept: 'application/json', 'content-type': 'application/x-www-form-urlencoded' }, body: valid,
    });
    return { handler, request, calls, sessionReads: () => sessionReads };
  }

  it('does not read a hostile cross-origin body getter or any session authority', async () => {
    const h = harness({ ok: true, value: { user: { userId: 'verified-user' } } });
    const request = h.request('https://attacker.test');
    let reads = 0;
    Object.defineProperty(request, 'body', { get() { reads++; throw new Error('body reached before origin'); } });
    const response = await h.handler(request);
    expect(response.status).toBe(403); expect(reads).toBe(0);
    expect(h.sessionReads()).toBe(0); expect(h.calls).toEqual([]);
  });

  it('uses only the authenticated user and configured origin, never request Host', async () => {
    const h = harness({ ok: true, value: { user: { userId: 'verified-user' } } });
    const response = await h.handler(h.request());
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('https://checkout.fixture.test/session');
    expect(h.calls).toMatchObject([{ userId: 'verified-user', successUrl: 'https://configured.test/account?checkout=success', cancelUrl: 'https://configured.test/pricing?checkout=cancelled' }]);
  });

  it('signed-out carried credential refuses before checkout creation', async () => {
    const h = harness({ ok: false, reason: 'IDENTITY_SESSION_ABSENT', message: 'Signed out.' });
    const response = await h.handler(h.request());
    expect(await response.json()).toMatchObject({ ok: false, reason: 'IDENTITY_SESSION_ABSENT' });
    expect(h.calls).toEqual([]);
  });

  it('rejects a forged userId form field rather than letting it replace the principal', async () => {
    const h = harness({ ok: true, value: { user: { userId: 'verified-user' } } });
    const request = new Request(h.request(), { body: `${valid}&userId=other-user` });
    const response = await h.handler(request);
    expect(response.status).toBe(400); expect(h.calls).toEqual([]); expect(h.sessionReads()).toBe(0);
  });
});
