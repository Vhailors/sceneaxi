# Catalog session adapter — implemented, focused proof PASS; serial wiring pending

## Fresh gap and scope

Read AGENTS.md, docs/agents/layout.md sites section, repair-review-2026-10-02 independent-review.md and ledger SITE-CATALOG-IDENTITY row, and capacity-work-2026-10-02/own-session report/HANDOFF. Fresh reads confirmed all four exclusive files absent; first permanent test run failed with **Cannot find module ../src/catalog-server-fetch.js**, one failed suite/no tests. Existing injected/default-unwired catalog-identity.ts, earlier repaired bytes, pages, ports/index/exports/manifests remain untouched. No stale proposal was blindly applied.

## Implementation and source hashes

- `packages/site-kit/src/catalog-server-fetch.ts` — SHA-256 `d902013c74c02b02bb524f82adb49aa4f09a31586d2289e9f460d602f94274e0`
- `packages/site-kit/test/catalog-server-fetch.test.ts` — SHA-256 `6c329da70feab86dca1fa8ca80e51270ed11c95cb81a93317f9db3cb663417db`
- `sites/catalog-game/src/lib/identity-plane.ts` — SHA-256 `efde73461c78226a9640f63cef13706e00c1e23bf66dba6bea4a0344e9362cf3`
- `sites/catalog-web/src/lib/identity-plane.ts` — SHA-256 `efde73461c78226a9640f63cef13706e00c1e23bf66dba6bea4a0344e9362cf3`

`catalog-server-fetch.ts:128` exports `createCatalogServerFetchAdapter(options={}): SiteIdentityAdapter`. `:216` exports `createCatalogServerIdentityPlane(options={}): CatalogIdentityPlane`. Options: `approved?:boolean`, `configuredOrigin?:string|null`, `allowLoopbackDevelopment?:boolean`, `transport?:typeof fetch`, `timeoutMs?:number` (may lower, not raise, 2000ms), `now?:()=>string`. Both catalog modules `:8` export `createCatalogRequestIdentityPlane` over that single shared composition and re-export the existing viewer resolver. No options means **wired=false / IDENTITY_PLANE_NOT_WIRED**. Approved safe configuration installs the real adapter; availability is adapter presence, never a claim of remote/provider health.

GET only to the immutable approved raw canonical origin + `/api/auth/own-session`; no request Host/URL target or ambient Cookie/Authorization forwarding. Only Accept/Origin/explicit x-sceneaxi-session are sent; credentials omit, cache no-store, redirect error. Production origins are dotted DNS HTTPS, never IP/localhost/local/internal/single-label/trailing-dot; exact HTTP loopback requires explicit development policy. Node server-only guard refuses browser/worker networking. Credential <=4096 cookie octets with existing first-dot session binding. Descriptor-only request scan bounds depth/nodes/strings, refuses getters/deep JSON/client roles/unknown Host inputs; Kids always denies before networking. Response <=16384 bytes streamed, deadline <=2000ms spans headers/body; media/cache/status/version/exact public keys/text fields/user/session binding are validated before reuse of existing identity plane validation. Captured other-session and expired replay refuse. Refusals preserve only the matching registered identity/surface/origin contract; malformed/private/mismatched response is IDENTITY_ADAPTER_OUTPUT_INVALID, network/abort/deadline is IDENTITY_PLANE_UNAVAILABLE.

## Executed proof (not deployed acceptance)

Final permanent suite **1 file / 47 passed**, exit0. `acceptance.log` preserves output (ANSI stripped only). Tests invoke **both actual catalog compositions** and the **real own-session handler factory** over in-memory Request/Response plus verified-port fixtures; no provider calls/sockets. Positive own principal/server-derived admin, default-unwired/missing carry, unsafe-origin matrix, role/Kids/accessor/deep/Host negatives, private/version/status/text bounds, wrong-user/session/stale replay, exact max/one-byte-over streaming, lying Content-Length, zero-progress/UTF-8, redirects/media/cache, header/body timeout/aborted/late-body cleanup and cleared timers are executable.

Actual red-to-green regressions during implementation: **42 pass/3 fail** when control-character email, 321-char email and 257-char userId were accepted; matching endpoint public text bounds fixed the same three assertions. Then **46 pass/1 fail** for a valid injected year-2000 session rejected by an outer real-clock port; forwarding the clock through both validations fixed the same assertion. Earlier lint/TS command diagnostics are retained in JSON; fixed without assertion weakening/casts/check skips.

Owned ESLint, `pnpm exec tsc -p packages/site-kit/tsconfig.json --noEmit`, `pnpm -s check:boundaries` (**27 packages**, unchanged matrix), and owned-path diff check each exit0. Fullbuild/fullgate/site production builds/browser/native/actual multi-origin HTTP/provider/DB/production **NOT RUN**, delegated to serial owner. Root gate or old failed visual pass is not promoted to success.

## Exact shared dependencies / handoff

1. Manifest owner: add `@sceneaxi/site-kit` export `./catalog-server-fetch` -> `./src/catalog-server-fetch.ts`; no root barrel/port/matrix change. bg-109 reports narrow root Vitest alias before root prefix + test tsconfig mapping applied; real storefront test imports resolve it. Manifest/native package export acceptance remains serial.
2. Page owner: both `sites/catalog-{game,web}/src/app/item/[itemId]/page.tsx:23-26,86` must import the new factory/resolver from `../../../lib/identity-plane.js` and use `createCatalogRequestIdentityPlane` with explicitly approved server configuration. Keep explicit existing readSessionToken carry and all commerce holds; never imply cross-site cookies/SSO. bg-109 acknowledged after-handback integration. Child did not edit these forbidden paths.
3. Raw config owner: `packages/site-kit/src/deep-link.ts:177` is the canonical reader of NEXT_PUBLIC_SCENEAXI_UMBRELLA_ORIGIN, but its current permissive normalization strips userinfo/path/query/hash. Expose raw configuredValue additively or strictly validate raw input BEFORE normalization; adapter must receive raw canonical value, not a sanitized unsafe origin. Separate proposed server-only approval flag SCENEAXI_CATALOG_OWN_SESSION_APPROVED=true requires owning documentation/wiring; child source reads no new environment key. No Host fallback. Default remains unwired until approved.
4. Endpoint worker bg-110 agreed exact flat v1 wire, origin/carry/status bounds and first-dot binding; reports60 own tests after matching unsafe-origin policy. Child independently executed its real factory through a fixture transport, not live Next/provider certification.

Full SITE-CATALOG-IDENTITY deployed/multi-origin clause remains **pending local serial wiring/acceptance**, not an external blocker or completed ledger row. Latest status notification to bg-109 failed unknown-endpoint; parent received a progress notification and must retain these requests.

## Resource cleanup and explicit source handback

**SOURCE HANDBACK COMPLETE: all four listed source/test files stable; no further child source edits planned.** Reports contain exact final hashes. Parent schedules shared wiring and only-after-all-handbacks frozen review. Fixtures were in memory; no provider/network/service/port/browser/container/install/account/staging/commit/push/merge/deploy/spend/production DB occurred. Readers canceled/released; timers cleared; aborted signals/late-stream cancellation asserted. No outstanding child resources. Production/publication readiness is NOT_CERTIFIED.
