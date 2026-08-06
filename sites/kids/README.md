# SceneAxi Kids site

The dedicated Kids origin contains one simplified local activity: choose a bundled
world, add curated pieces, and play the result. It is a separate Next install root
and has no runtime dependency beyond Next, React, and React DOM.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

There are no environment variables. The site imports no SceneAxi package—not even
`@sceneaxi/profile-kids` or `@sceneaxi/site-kit`—so the dependency matrix keeps an
empty allow list and `kidsBoundary.allowedDependents` stays empty. The activity is
held in memory for the current tab only. The install-root gate refuses network APIs,
forms, links, environment access, and external URLs anywhere under this directory —
configuration as well as source — and refuses Next configuration keys that could
proxy, redirect, or inject build-time values; response headers add
`connect-src 'none'`, `form-action 'none'`, and same-origin isolation.

`pnpm dev` is the one exception, and it is scoped to Next's development phase:
`next.config.ts` is a phase function, so the development server alone receives
`connect-src 'self'` (its hot-reload socket) and `'unsafe-eval'` (its compiler).
Both are same-origin and name no host. `pnpm build` and `pnpm start` serve
`security-headers.json` byte for byte, so the deployed origin keeps
`connect-src 'none'`. See [`docs/kids-first-release.md`](../../docs/kids-first-release.md).
The standalone pnpm workspace approves one dependency build only: Next's `sharp`;
`pnpm check:sites` refuses any second approval.

`src/lib/kids-activity.ts` is intentionally byte-identical to the profile copy.
Root parity tests keep the two independent builds aligned without opening a runtime
edge. See [`docs/kids-first-release.md`](../../docs/kids-first-release.md) for the
allowed/refused matrix and extension procedure.

This implementation is not deployment authority. Domain, hosting, DNS, and public
release remain controlled by the existing site-topology and bootstrap decisions.
