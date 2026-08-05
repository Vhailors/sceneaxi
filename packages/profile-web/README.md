# @sceneaxi/profile-web

Web Experience profile. It compiles the locked
`web-experience-profile-scope` decision into a small public allow/refuse seam:

- allowed: interactive experiences and general interactive site shells/chrome;
- refused: CMS, form/app builder, and conventional Next/tRPC SaaS scopes;
- unknown scopes refuse until the compiled policy is explicitly extended.

`evaluateWebExperienceScope` returns a frozen structured decision. This package
does not implement a CMS, application builder, or Webapp Factory pipeline.

## First-release authoring subset

`webExperienceAuthoring` exposes the schema-owned #197 contract: page/HTML,
site-canvas configuration, known asset injection, and a safe Three embed. The
closed desktop-only set refuses by name, unknown operations fail closed, and the
sandbox policy grants authored HTML no script, network, navigation, or parent-DOM
authority. The deployable umbrella consumes the same contract through site-kit
rather than importing this profile, preserving ADR 0018's site dependency edge.

The full access, sandbox, and proof map is
[`docs/web-experience-editor.md`](../../docs/web-experience-editor.md).

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
