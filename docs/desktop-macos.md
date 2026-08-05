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
`latest-mac.yml`, and `desktop-macos-release.json`. The same input runtime is staged
byte-for-byte and release metadata is written in stable sorted order, but Electron
packaging, Apple signing, and notarization are **not bit-reproducible**. A checksum
identifies one completed release build, never all builds of the same source.

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
`xcrun --find notarytool` and `xcrun --find stapler` must both succeed.

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
release location is absent. It runs electron-builder with `--publish never`, signs
the universal application, submits it for notarization, requires stapled tickets,
and verifies the app with `codesign`, `spctl`, and `stapler`. It then writes:

- the universal `.dmg` installer and `.zip` updater payload;
- `SHA256SUMS`, sorted by artifact file name;
- `latest-mac.yml`, bound to that exact zip by SHA-512 and byte count; and
- `desktop-macos-release.json`, containing the exact download URLs, sizes, SHA-256
  values, source application path, and signed/notarized claims.

`smoke --packaged` rechecks checksums, signing, Gatekeeper assessment, and stapling,
then launches the packaged executable with `--smoke`. It requires the existing
desktop runtime to prove its kernel, authoring, and real-pixel viewport path.

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
action: build and verify one higher version, then upload its `.dmg`, `.zip`, and
metadata atomically to the configured HTTPS location.
