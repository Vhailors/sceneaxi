# @sceneaxi/profile-web

Web Experience policy stub. It compiles the locked
`web-experience-profile-scope` decision into a small public allow/refuse seam:

- allowed: interactive experiences and general interactive site shells/chrome;
- refused: CMS, form/app builder, and conventional Next/tRPC SaaS scopes;
- unknown scopes refuse until the compiled policy is explicitly extended.

`evaluateWebExperienceScope` returns a frozen structured decision. This package
does not implement a CMS, application builder, or Webapp Factory pipeline.

The MVP conformance case runs the same deterministic project fixture used by
the Game/CLI golden path through Web policy. `mvpGoldenPath` exposes only the
public authoring, kernel, and null-presentation seams used by that case and
retains `shippingClaim: false`: this proves library behavior under the Web
profile, not a shipped website product.

## Open-path demo policy

`openPathPolicy` and `evaluateOpenPath()` *read* this profile's row in the shared
open-path demo policy — the same table the CLI and both shells report
([`docs/open-path-policy.md`](../../docs/open-path-policy.md)). The profile does
not author its own level: a missing row throws at module load rather than
falling back. The row's level, session kind, evidence, and `shippingClaim` live
in that table — schema-backed and kept in lockstep by `pnpm check:contracts` — so
they are read from it here rather than copied into this page.

Note that this is independent of Profile Conformance, which still lists Web as
`not-yet-claimed` — the two grade different things.
