# macOS desktop packaging

`desktop/macos` is the first-release macOS packaging path for the existing SceneAxi
Engine Desktop application. It stages the exact runtime built by `desktop/linux`
under a macOS-only bootstrap; it does not copy or replace the desktop-shell chrome,
bridge, renderer, project behavior, or engine behavior. The bootstrap adds only a
fail-closed update check.

## Current release status

**No macOS artifact has been published.** This repository contains no signed build,
notarization ticket, checksum, public download URL, or GitHub Release for macOS.
The umbrella download IA must continue to show macOS as unavailable until an
operator completes the release procedure below and deliberately records the output.

The packaging contract uses the stable names
`SceneAxi-Engine-Desktop-<version>-macos-universal.dmg` and
`SceneAxi-Engine-Desktop-<version>-macos-universal.zip`, where `<version>` is the
`version` field of `desktop/macos/package.json` — currently `0.0.0`. That manifest is
the only place the release version is stated: `electron-builder.yml` templates the
artifact names from it and `scripts/dist.mjs` reads it for the expected names,
`latest-mac.yml`, and the build record. Apple bundle metadata uses the independent
`buildVersion` in `electron-builder.yml` — currently `1` — because the shared package
version remains `0.0.0`; increment that positive Apple build number for every signed
candidate. Preflight refuses a missing or nonconforming value as
`MACOS_BUILD_VERSION_INVALID`. The same input runtime is staged byte-for-byte and
release metadata is written in stable sorted order, but Electron packaging, Apple
signing, and notarization are **not bit-reproducible**. A checksum identifies one
completed release build, never all builds of the same source.

## Local configuration smoke

Install the hermetic repository and both separate desktop install roots:

```bash
pnpm install --frozen-lockfile
pnpm --dir desktop/linux install --frozen-lockfile
pnpm --dir desktop/macos install --frozen-lockfile
pnpm --dir desktop/macos typecheck
pnpm --dir desktop/macos build
pnpm --dir desktop/macos smoke
```

`build` stages the exact four runtime files produced by `desktop/linux` and writes a
disabled update policy when no release location is supplied. It produces no `.dmg`
or `.zip` and makes no signing claim. `smoke` deliberately removes all release inputs
and succeeds only when `dist` refuses each one by name.

## Operator-supplied release prerequisites

Run the release only on macOS with Xcode Command Line Tools providing these
executables on `PATH`: `codesign`, `hdiutil`, `security`, `spctl`, and `xcrun`.
The `notarytool` and `stapler` subtools must also be installed:
`xcrun --find notarytool` and `xcrun --find stapler` must both succeed. `git` must also
be on `PATH`, because the release verifies the commit it records rather than trusting it.

The operator must supply all six environment variables below. The repository does
not provide values, examples, fallbacks, or secret files:

| Name | Operator-owned meaning |
|---|---|
| `CSC_LINK` | Developer ID Application certificate input accepted by electron-builder (file path, URL, or base64 data) |
| `CSC_KEY_PASSWORD` | Password for the certificate supplied through `CSC_LINK` |
| `APPLE_ID` | Apple Developer account used for notarization |
| `APPLE_APP_SPECIFIC_PASSWORD` | App-specific password for that Apple account |
| `APPLE_TEAM_ID` | Apple Developer team identifier that owns the certificate |
| `SCENEAXI_MACOS_RELEASE_BASE_URL` | Final HTTPS directory that will serve the `.dmg`, `.zip`, and `latest-mac.yml` together |

Every build record carries a verified source commit. A local signed build must export
only `GITHUB_SHA`; the value must equal the clean checkout's `git rev-parse HEAD`.
It writes `desktop-macos-local-build.json` with `iaLinkable: false` and no repository,
workflow-run, download, update-metadata, or artifact URL claim.

Only the repository's actual GitHub Actions `workflow_dispatch` release path may write
the IA-linkable `desktop-macos-release.json`. Actions supplies the three values below;
the script additionally requires `GITHUB_ACTIONS=true`, the dispatch event,
`https://github.com`, and this repository's `desktop-macos.yml` workflow reference.
An absent value refuses `MACOS_PROVENANCE_REQUIRED:<name>`, and a value of the wrong
shape refuses `MACOS_PROVENANCE_INVALID:<name>`:

| Name | Meaning |
|---|---|
| `GITHUB_REPOSITORY` | `owner/name` of the repository the release was built from |
| `GITHUB_SHA` | Full 40-character commit the release was built from |
| `GITHUB_RUN_ID` | Workflow run whose artifact holds the verified files |

`GITHUB_SHA` is **verified, not trusted**, on both paths: `git` must be on `PATH`
(`MACOS_PROVENANCE_UNVERIFIABLE:git`), the release must run inside a readable checkout
(`MACOS_PROVENANCE_UNVERIFIABLE:checkout`), the supplied commit must equal
`git rev-parse HEAD` (`MACOS_PROVENANCE_COMMIT_MISMATCH`), and `git status --porcelain`
must be empty (`MACOS_PROVENANCE_WORKTREE_DIRTY`) — build output is git-ignored, so a
completed packaging run does not dirty the tree, but an uncommitted or untracked source
change does. A local build carries commit evidence but never claims an Actions run;
export `GITHUB_SHA="$(git rev-parse HEAD)"` from the clean checkout being packaged.

The required certificate is a **Developer ID Application** certificate for direct
distribution, backed by an active Apple Developer Program membership. These inputs
belong in the operator's secret store or CI secrets; never commit them. The release
command reports only missing variable/tool names and never prints supplied values.

## Build, verify, and release handoff

With the prerequisites present:

```bash
pnpm --dir desktop/macos dist
pnpm --dir desktop/macos smoke --packaged
```

`dist` refuses before packaging if the host, a tool, a secret name, or the HTTPS
release location is absent. The `release/` output must be absent or empty; a path that
is invalid, unreadable, or contains any prior output refuses as
`MACOS_RELEASE_OUTPUT_INVALID`, `MACOS_RELEASE_OUTPUT_UNREADABLE`, or
`MACOS_RELEASE_OUTPUT_NOT_EMPTY` before building or signing. It runs electron-builder
with `--publish never`, signs the universal application, submits it for notarization,
requires stapled tickets, and verifies the app with `codesign`, `spctl`, and `stapler`.
It then writes:

- the universal `.dmg` installer and `.zip` updater payload;
- `SHA256SUMS`, sorted by artifact file name;
- `latest-mac.yml`, bound to that exact zip by SHA-512 and byte count; and
- on the dispatched Actions path, `desktop-macos-release.json`, with
  `iaLinkable: true`, exact download URLs, sizes, SHA-256 values, source application
  path, signed/notarized claims, and the verified Actions provenance the download IA
  needs; or
- on a local path, `desktop-macos-local-build.json`, with `iaLinkable: false`, the
  verified source commit and artifact evidence, and none of the IA link fields.

`smoke --packaged` rechecks checksums, signing, Gatekeeper assessment, stapling, and
exactly one valid provenance shape. An Actions record must be fully IA-linkable; a
local record must explicitly exclude every link field. It then launches the packaged
executable with `--smoke` and requires the existing desktop runtime to prove its
kernel, authoring, and real-pixel viewport path. The launch passes
`--use-angle=swiftshader --enable-unsafe-swiftshader`, exactly as the Linux smoke
does, so the pixel proof holds on a GPU-less CI runner: SwiftShader is a real
software rasterizer, not a stub, and it is the only reason a hosted macOS VM can
satisfy that assertion. Nothing else about the packaged application changes, and
`open`-ing the installed app still uses the real GPU.

The manually dispatched `.github/workflows/desktop-macos.yml` release path uploads
those verified files only as the Actions artifact `sceneaxi-desktop-macos`. It does
not create a GitHub Release, publish to an update server, or change the umbrella.
After an operator separately creates a durable release and uploads the files
together, download IA work can consume `desktop-macos-release.json` as its exact
record. Until that release exists, there is nothing honest to link.

## Install and first launch

After downloading a completed release bundle on macOS, verify it before opening:

```bash
shasum -a 256 -c SHA256SUMS
hdiutil attach SceneAxi-Engine-Desktop-0.0.0-macos-universal.dmg
```

Drag **SceneAxi Engine Desktop** from the mounted image into **Applications**, eject
the image, and start the installed copy:

```bash
open "/Applications/SceneAxi Engine Desktop.app"
```

On first launch the unchanged desktop application creates its project directory in
Electron's macOS user-data location and seeds `scene.json` only when it is absent.
Later launches preserve those bytes. The product tabs and Kids refuse-only posture
are exactly the same as the existing desktop application documented in
[`desktop-linux.md`](desktop-linux.md).

## Update behavior

An ordinary `pnpm build` writes `MACOS_UPDATE_RELEASE_NOT_CONFIGURED` and the macOS
bootstrap never calls the updater. A release build can enable checks only after the
same preflight has required signing, notarization, tools, and an HTTPS
`SCENEAXI_MACOS_RELEASE_BASE_URL`. Smoke mode never checks the network.

For a configured release, `electron-updater` reads the packaged `app-update.yml` and
checks the directory that must serve `latest-mac.yml` and its exact signed zip. A
missing, malformed, unreachable, checksum-mismatched, or improperly signed update is
ignored without replacing the installed app. The repository performs no upload and
has no fallback channel. Publishing a future update therefore remains an operator
action: build and verify one higher package version and build number, then upload its
`.dmg`, `.zip`, and metadata atomically to the configured HTTPS location.
