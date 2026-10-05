// AUXILIARY PROPOSAL ONLY. Not installed, approved or product source.
export function createOwnSessionHandler({ verifyOrigin, plane, refuse }) {
  const headers = { 'cache-control': 'private, no-store', 'content-type': 'application/json', 'vary': 'Origin, x-sceneaxi-session', 'x-content-type-options': 'nosniff' };
  const reply = (result, status) => new Response(JSON.stringify({ version: 1, result }), { status, headers });
  return async request => {
    if (request.method !== 'GET' || new URL(request.url).search !== '') return reply(refuse('SITE_REQUEST_MALFORMED'), 400);
    // No requestUrl fallback: absent/malformed configured origin must refuse.
    const origin = verifyOrigin({ origin: request.headers.get('origin'), fetchSite: request.headers.get('sec-fetch-site') });
    if (!origin.ok) return reply(origin, 403);
    // Explicit credential ONLY: do not consult Cookie or framework cookie stores.
    const sessionToken = request.headers.get('x-sceneaxi-session');
    if (!sessionToken) return reply(refuse('IDENTITY_SESSION_ABSENT'), 401);
    try {
      const result = await plane(sessionToken).identity.resolvePrincipal({ surface: 'site', sessionToken });
      return reply(result, result.ok ? 200 : result.reason === 'IDENTITY_SESSION_ABSENT' ? 401 : 403);
    } catch { return reply(refuse('IDENTITY_PLANE_UNAVAILABLE'), 503); }
  };
}

export function createConfiguredOriginAdapter({ env, fetcher, resolveOrigin, refuse }) {
  return { async resolvePrincipal(request) {
    const resolved = resolveOrigin(env).origin;
    if (!resolved.ok) return resolved;
    const raw = env.NEXT_PUBLIC_SCENEAXI_UMBRELLA_ORIGIN;
    let url;
    try { url = new URL(raw); } catch { return refuse('DEEP_LINK_ORIGIN_INSECURE'); }
    // The link helper is not an SSRF validator: reject paths, userinfo and fragments.
    if (url.username || url.password || url.pathname !== '/' || url.search || url.hash) return refuse('DEEP_LINK_ORIGIN_INSECURE');
    if (!request.sessionToken) return { ok: true, value: null };
    if (request.sessionToken.length > 4096 || /[\r\n]/.test(request.sessionToken)) return refuse('SITE_REQUEST_MALFORMED');
    try {
      const response = await fetcher(new URL('/api/auth/catalog-session', resolved.value).href, {
        method: 'GET', cache: 'no-store', credentials: 'omit', redirect: 'error',
        signal: AbortSignal.timeout(5000),
        headers: { accept: 'application/json', origin: resolved.value, 'x-sceneaxi-session': request.sessionToken }
      });
      if (response.headers.get('cache-control') !== 'private, no-store' || !/^application\/json(?:;|$)/i.test(response.headers.get('content-type') ?? '')) return refuse('IDENTITY_ADAPTER_OUTPUT_INVALID');
      const reader = response.body?.getReader();
      if (!reader) return refuse('IDENTITY_ADAPTER_OUTPUT_INVALID');
      let size = 0; const chunks = [];
      try { while (true) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > 16384) { await reader.cancel(); return refuse('IDENTITY_ADAPTER_OUTPUT_INVALID'); } chunks.push(value); } } finally { reader.releaseLock(); }
      const bytes = new Uint8Array(size); let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      const body = JSON.parse(new TextDecoder().decode(bytes));
      if (body.version !== 1 || !body.result || (response.status === 200) !== (body.result.ok === true)) return refuse('IDENTITY_ADAPTER_OUTPUT_INVALID');
      return body.result; // Existing createIdentityPlane validates binding, shape and refusal registry.
    } catch { return refuse('IDENTITY_PLANE_UNAVAILABLE'); }
  } };
}
