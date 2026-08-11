# Windows desktop packaging and release record

Cross-surface release authorization, refusal, rollback, and evidence capture are owned
by [`production-activation.md`](production-activation.md). This document remains the
authoritative Windows signing/release procedure; the runbook supplies no credential and
authorizes no build or publication.

Status: **packaging path implemented; no public Windows artifact exists.**

`desktop/windows` wraps the existing Electron desktop application built from
`desktop/linux`; it adds no editor state, bridge action, renderer, profile path, or
macOS packaging. The source, signing, release, and update boundaries are below so a
future public download can be recorded without turning a prepared build into a
shipping claim.

## Deterministic release shape

The sole first-release target is a per-user-capable NSIS x64 installer:

| Field | Contract |
|---|---|
| Installer | `SceneAxi-Engine-Desktop-<version>-windows-x64.exe` |
| Checksum manifest | `SHA256SUMS` |
| Update metadata | electron-builder `latest.yml` and generated blockmap assets |
| Repository | `Vhailors/sceneaxi` |
| Release tag | `v<package.json version>` |
| Download URL after publication | `https://github.com/Vhailors/sceneaxi/releases/download/<tag>/<installer>` |

The names and output set are deterministic. The bytes are not claimed
bit-reproducible: Authenticode timestamping and Electron packaging make each signed
build a recorded artifact, identified by its SHA-256 digest.

There is intentionally no artifact table with a tag, URL, size, or digest yet.
Those values may be added only after a real release exists and the downloaded bytes
have been verified. Until then, the umbrella download IA remains **coming soon** for
Windows; no placeholder URL is valid.

## Operator-supplied prerequisites

All release work runs on a Windows x64 host. Install Node 24, pnpm, Git, GitHub CLI
(`gh.exe`), and Windows SDK SignTool (`signtool.exe`). Do not copy tools or
credentials into the repository.

Inject these values at runtime:

| Name | Required for | Supplied by |
|---|---|---|
| `WIN_CSC_LINK` | `dist`, `draft:upload` | operator-controlled Windows code-signing `.pfx` path, URL, or base64 value |
| `WIN_CSC_KEY_PASSWORD` | `dist`, `draft:upload` | operator-controlled certificate password |
| `GITHUB_RELEASE_TOKEN` | `draft:upload` only | operator-controlled GitHub token with contents-write permission |
| `SCENEAXI_WINDOWS_RELEASE_TAG` | `draft:upload` only | exact existing draft tag, equal to `v<package.json version>` |

No value for any row belongs in source control. `forceCodeSigning: true` makes
missing/invalid signing identity fatal. The script separately requires SignTool and
verifies the final installer with `signtool.exe verify /pa /all /v`; a checksum is
written only after that succeeds.

## Build, verify, and publish sequence

```powershell
pnpm install --frozen-lockfile
pnpm --dir desktop/linux install --frozen-lockfile
pnpm --dir desktop/windows install --frozen-lockfile
pnpm --dir desktop/windows typecheck
pnpm --dir desktop/windows smoke

# Requires WIN_CSC_LINK, WIN_CSC_KEY_PASSWORD, and signtool.exe.
pnpm --dir desktop/windows dist
Set-Location desktop/windows/release
Get-FileHash -Algorithm SHA256 .\SceneAxi-Engine-Desktop-<version>-windows-x64.exe
Get-Content .\SHA256SUMS
Set-Location ../../..
```

For a public/update release, an authorized operator first creates the matching
**draft** GitHub release outside this repository workflow, then injects
`GITHUB_RELEASE_TOKEN` and `SCENEAXI_WINDOWS_RELEASE_TAG` and runs:

```powershell
pnpm --dir desktop/windows draft:upload
```

The script verifies the draft exists. It does not invent or publish a release; it
uploads the signed installer, updater metadata, and checksum to that draft. The
operator verifies the downloaded draft assets, records source commit, run, sizes,
and hashes here, then explicitly publishes the draft. Only after publication may the
download IA replace Windows's coming-soon row with the recorded URL.

## Install and first run

After a release has actually been recorded, a downloader verifies the exact digest
from that record and starts the installer:

```powershell
Get-FileHash -Algorithm SHA256 .\SceneAxi-Engine-Desktop-<version>-windows-x64.exe
Start-Process .\SceneAxi-Engine-Desktop-<version>-windows-x64.exe
```

Choose the default per-user install unless an operator has a separate machine-wide
policy. This root stages the shared desktop application, so first launch, the
contained project lifecycle, the product tabs, and the Kids refuse-only posture are
owned by [`desktop-linux.md`](desktop-linux.md). Export Web v1 is the platform
exception: the Windows runtime refuses it by the named platform rule that document
owns.

## Fail-closed update behavior

The packaged Windows wrapper calls `electron-updater` only when all of these hold:
the process is packaged, it is not a smoke run, and electron-builder's generated
`app-update.yml` exists. Otherwise it returns one of the closed refusals
`WINDOWS_UPDATE_NOT_PACKAGED`, `WINDOWS_UPDATE_SMOKE_DISABLED`, or
`WINDOWS_UPDATE_CONFIGURATION_MISSING`. A failed check returns
`WINDOWS_UPDATE_CHECK_FAILED`; it never changes feed URL or installs fallback bytes.

The NSIS updater verifies the downloaded installer's publisher signature. Update
metadata is created/uploaded only through the existing-draft release command, which
refuses without its token, tag, GitHub CLI, signing identity, and SignTool. A draft is
not visible to normal update clients, so publication remains the final explicit
operator action.

## Gate coverage

Every rule above is held on any host, with no Windows machine and no credential:
`pnpm check:desktop` covers this install root exactly like `desktop/linux`,
`pnpm --dir desktop/windows smoke` re-checks the packaging configuration and the
download IA's coming-soon state, and `tests/desktop/desktop-windows-packaging.test.ts`
owns the artifact shape, the missing-authority refusal set, the non-publishing `dist`
path, and the update refusals — extend it when touching any of them.
