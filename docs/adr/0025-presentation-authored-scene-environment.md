# ADR 0025: Scene environment is presentation-authored data

- **Status:** Accepted.
- **Date recorded:** 2026-08-14
- **Lineage:** Specializes ADR 0002 and ADR 0017. Does not change kernel authority (ADR 0001).

## Context

The Engine Desktop needs authored lighting, tone mapping, fog, and a closed
post-process set without putting visual data into kernel digests or
`composeScene()`.

## Decision

Environment lives in `documentData.sceneEnvironment`. It changes the project
content hash and never a kernel digest. It rides `MountableScene` as an optional
sibling block with its own digest. Composition stays placement-only.

Post-processing v1 uses Three's own addons behind the seam. The headless
surface declares the configured effect names and never claims they drew.

## Consequences

- Both viewports consume the same sibling payload.
- WebGPU revisit is behind the presentation seam.
- Kids is refused independently on the catalog.

## Rejected alternatives

- Putting environment into `composeScene()` — would rewrite placement goldens.
- Kernel-owned lights — visual data is not game authority.
