# @sceneaxi/desktop-windows

The Windows packaging and update wrapper for the existing SceneAxi Engine Desktop
application. It does not fork the product: `pnpm build` first builds
`desktop/linux`, stages that exact bundled main/preload/renderer/document, and adds
only `src/electron/main.ts` for the Windows update bootstrap.

No Windows artifact is public yet. The umbrella download IA must continue to show
Windows as **coming soon** until an operator completes the release record in
[`docs/desktop-windows.md`](../../docs/desktop-windows.md).

## Install the three roots

```powershell
# Repository root: linked workspace packages used by the existing app
pnpm install --frozen-lockfile

pnpm --dir desktop/linux install --frozen-lockfile
pnpm --dir desktop/windows install --frozen-lockfile
pnpm --dir desktop/windows build
```

The source build requires no credential and publishes nothing. It proves the
Windows wrapper compiles around the existing desktop runtime; it is not a public
installer.

## Build a signed local installer

Run on Windows x64 with Node 24, pnpm, and Windows SDK `signtool.exe` on `PATH`.
The operator must inject both standard electron-builder signing variables:

- `WIN_CSC_LINK`: operator-controlled `.pfx` path, URL, or base64 certificate;
- `WIN_CSC_KEY_PASSWORD`: the certificate password.

Then run:

```powershell
pnpm --dir desktop/windows dist
```

The command refuses before building if the host, either variable, or SignTool is
absent. `forceCodeSigning: true` prevents electron-builder from silently producing
an unsigned installer, and SignTool verifies the finished installer before
`SHA256SUMS` is written. `dist` always passes `--publish never`.

The output set has a deterministic path and name:
`release/SceneAxi-Engine-Desktop-<version>-windows-x64.exe` plus
`release/SHA256SUMS`. Authenticode timestamping means signed bytes are deliberately
not claimed bit-reproducible; the checksum identifies one recorded build.

## Publish update assets to an existing draft

Publishing is a separate operator action. In addition to the signing inputs above,
it requires:

- GitHub CLI `gh.exe` on `PATH`;
- `GITHUB_RELEASE_TOKEN`: operator-supplied GitHub contents-write token;
- `SCENEAXI_WINDOWS_RELEASE_TAG`: exactly `v<package.json version>`;
- a draft release with that tag already present in `Vhailors/sceneaxi`.

```powershell
pnpm --dir desktop/windows draft:upload
```

The command refuses when any prerequisite is absent and never creates a release.
It publishes the NSIS installer and electron-builder update metadata only to the
existing draft, uploads `SHA256SUMS`, and leaves the draft unpublished for explicit
operator review. Do not add the download-IA record until that draft is published
and its downloaded bytes have been checked.

## Updates and first run

The Windows main-process wrapper uses `electron-updater` with the generated
`app-update.yml`. It checks only in a packaged, non-smoke application. Missing
configuration and update-check errors become closed named refusals; there is no
fallback URL and no unsigned install path. NSIS update signature verification
remains enabled and derives the publisher identity from the signing certificate.

First run is the existing desktop application behavior — the contained project
lifecycle, product tabs, and Kids refuse-only posture owned by
[`docs/desktop-linux.md`](../../docs/desktop-linux.md). Windows packaging changes
none of those product semantics.

## Safe smoke

`pnpm smoke` is host-independent. It verifies the NSIS/signing/update configuration,
the complete missing-authority refusal set, the non-publishing `dist` path, and the
continued Windows coming-soon state in the download IA. It never signs or publishes.
