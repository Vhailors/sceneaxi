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
