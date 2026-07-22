# Public web-consumer contract

Web products consume SceneAxi as versioned packages from a package registry. A
product owns only thin glue around SceneAxi public APIs; it does not consume this
repository as source.

> **Publication status:** the packages below are currently private `0.0.0`
> bootstrap packages. There is no supported external install until matching
> versions are published. This contract does not authorize publication. Until
> then, consumers must wait rather than substitute a Git, path, or workspace
> dependency.

## Supported package surface

| Package | Web-consumer role | Pin rule |
|---|---|---|
| `@sceneaxi/profile-web` | Primary Web Experience profile and its compiled policy. Import only capabilities exported by its package root. | Pin an exact published profile version. That release supports only the core range exposed as `seam.corePin`. |
| `@sceneaxi/schemas` | Small shared semantic language: types, validators, version constants, and versioned JSON contracts. Add it directly when product glue imports these APIs. | Pin an exact published contracts version accepted by the selected profile release. |
| `@sceneaxi/authoring-core` | Optional text-canonical document and propose/apply API for products that need authoring. It is not required merely to render a Web Experience. | Pin an exact published core version within the profile's `seam.corePin`. |

Engine packages are profile implementation dependencies by default, not
consumer entry points. Import one directly only when the selected published
profile release documents that public use, and pin it to the same core train as
every other direct core dependency. Apps such as `@sceneaxi/web-shell` are
private applications, not reusable consumer packages.

## Version support and refusal

- Declare every direct `@sceneaxi/*` dependency as an exact semver; keep the
  lockfile. Do not use `latest`, Git refs, branches, or floating ranges.
- A profile release supports exactly the core semver range in its published
  `sceneaxi.corePin`, also exposed by `@sceneaxi/profile-web` as `seam.corePin`.
  A directly installed core package outside that range is unsupported and the
  integration must refuse to start.
- Each versioned artifact is accepted only by a validator for its schema major.
  Missing, invalid, or different-major data is a refusal, never an implicit
  conversion. Upgrade the package set or run an explicit, reviewed migration.
- A new SceneAxi major is an opt-in product change. Update pins together, run
  the product's integration tests, and commit the resulting lockfile change.

Release notes for a published profile version provide the concrete compatible
package versions. If those versions or the profile's core pin cannot be
resolved together, there is no supported combination.

## Minimal product-local glue

Replace the placeholders with a compatible pair from one published release,
then install exact versions:

```sh
pnpm add -E @sceneaxi/profile-web@<profile-version> @sceneaxi/schemas@<schemas-version>
```

Keep the adapter in the product repository and import package-root APIs only:

```ts
import { seam as webProfile } from "@sceneaxi/profile-web";
import { validateDocument } from "@sceneaxi/schemas";

export function loadExperienceDocument(input: unknown) {
  const result = validateDocument(input);
  if (!result.ok) {
    throw new Error(`SceneAxi refused ${result.code}: ${result.message}`);
  }

  return { profile: webProfile.name, document: result.document };
}
```

This glue may translate product data into SceneAxi contracts or adapt a public
result to local UI state. It must not reach into package internals or reproduce
engine behavior.

## Existing contracts

The shared contracts live in `@sceneaxi/schemas`; their in-repository sources
are:

- [`packages/schemas/contracts/document.schema.json`](../packages/schemas/contracts/document.schema.json)
  and [`proposal.schema.json`](../packages/schemas/contracts/proposal.schema.json)
  for text-canonical authoring and propose/apply.
- [`packages/schemas/contracts/kernel-session.schema.json`](../packages/schemas/contracts/kernel-session.schema.json)
  for saved kernel sessions.
- [`packages/schemas/contracts/profile-conformance.schema.json`](../packages/schemas/contracts/profile-conformance.schema.json)
  for profile/core claims. A conformance claim is not a publication or shipping
  claim.
- [`docs/authoring-contracts.md`](authoring-contracts.md) for authoring behavior,
  and [`docs/DEPENDENCY-MATRIX.md`](DEPENDENCY-MATRIX.md) for release groups and
  core/profile pinning.

These contracts are the cross-repository language. They do not require a shared
integration framework.

## Scope and non-goals

The Web Experience profile covers interactive web experiences and their
shells/chrome. It is not a CMS, form or application builder, or a Next.js/tRPC
SaaS platform; those remain product or Webapp Factory concerns.

This contract explicitly excludes:

- path, `file:`, `link:`, or `workspace:` dependencies across repositories;
- vendored SceneAxi engine source or imports from unexported package paths;
- coupling to `main`, another branch, or an unpublished tarball;
- a SceneAxi dependency on Webapp Factory, or mandatory bidirectional factory
  integration; and
- a shared cross-factory kit or framework. Optional adapters stay thin,
  product-local, and independently replaceable.
