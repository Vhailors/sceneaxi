# Get started with SceneAxi

Use this guide to install the monorepo, make a reviewed document edit, and open a scene in the local tools. SceneAxi's packages are private bootstrap packages at version `0.0.0`. Run this guide from the repository, not from an external package install. See the [web consumer guide](web-consumer.md) before integrating from another repository.

## Install and build

Clone the repository, then install both workspace roots and build the source-backed packages:

```sh
pnpm install --frozen-lockfile
(cd desktop/linux && ELECTRON_SKIP_BINARY_DOWNLOAD=1 pnpm install --frozen-lockfile)
pnpm build
```

`pnpm build` is required before running a workspace binary. The separate desktop install skips downloading Electron's binary; `pnpm gate` uses this layout too. The installs reported `Scope: all 21 workspace projects` and `Lockfile is up to date, resolution step is skipped`. The root build ran:

```text
> sceneaxi@0.0.0 build
> tsc --build && tsc -p tsconfig.tests.json
```

## Run the CLI

```sh
node packages/cli/bin/sceneaxi.mjs --help
```

A run from this checkout printed:

```text
ok: true
schemaVersion: 1
cliVersion: 0.0.0
result:
  bin: sceneaxi
  description: SceneAxi agent-native CLI — umbrella dispatcher over authoring-core
  commands:
    project: E1 authoring surface (source-first)
    scene: Deterministic multi-object scene composition (offline; no provider, no seed)
    asset: Offline asset ingestion and package inspection
    profile: Profile operations (read-only)
    catalog: Dormant catalog operations (commerce inert; never activated here)
    evidence: Evidence packet operations (read-only)
    desktop: Local Engine Desktop bridge
    demo: Held-key protocol demo (synthetic keys; fails closed)
    protocol: Protocol introspection (ungated; no product policy)
```

The CLI emits a versioned result envelope. Add `--json` when a script needs machine-readable output.

## Create and edit a project

Set `PROJECT_DIR` to a directory you own. Run the CLI commands from the repository root and pass that path with `--cwd`:

```sh
PROJECT_DIR=$(mktemp -d)
node packages/cli/bin/sceneaxi.mjs project new --cwd "$PROJECT_DIR" --document scene.json --data '{"entities":[]}'
node packages/cli/bin/sceneaxi.mjs project propose --cwd "$PROJECT_DIR" --document scene.json --pointer /data/entities --value '[{"id":"lamp"}]' --out edit.json
node packages/cli/bin/sceneaxi.mjs project apply --cwd "$PROJECT_DIR" --proposal edit.json
node packages/cli/bin/sceneaxi.mjs project dev --cwd "$PROJECT_DIR" --document scene.json
```

In a separate temporary project created in this checkout, `project new` returned:

```text
status: created
documentPath: scene.json
documentId: scene
contentHash: sha256:35d7bc5cb1d947ce5b709c2d78e3e982c6395592ddb94f30cf2ed0104be26d83
```

`project propose` printed a diff changing `/data/entities` from `[]` to `[{"id":"lamp"}]`. It wrote `edit.json`; it did not apply the edit. Its result included:

```text
status: proposed
documentPath: scene.json
jsonPointer: /data/entities
proposalPath: edit.json
```

`project apply` returned `status: applied` and listed `scene.json` under `appliedPaths`. The one-shot `project dev` command reported:

```text
status: ready
mode: one-shot
documentPath: scene.json
contentHash: sha256:982db1b6ae71340f57385d067a15b56e15094c6c597c299bbfd3963faae1af12
```

To rerun the status when the document changes, start watch mode:

```sh
node packages/cli/bin/sceneaxi.mjs project dev --cwd "$PROJECT_DIR" --watch --document scene.json
```

Watch mode printed `mode: watch` and `cycle: 1` in a live run:

```text
status: ready
mode: watch
cycle: 1
```

Stop it with Ctrl+C. It does not change the E1 propose/apply review boundary.

## Compose and open a scene

The [scene composition example](../examples/compose-scene/README.md) rebuilds two checked-in Sculpt Artifacts and composes one instance of each through the package-root API. The [headless open example](../examples/open-scene/README.md) opens the composed scene through the orchestrator and prints the kernel digest.

```sh
node examples/compose-scene/run.mjs
node examples/open-scene/run.mjs
```

The commands printed these digests in this checkout:

```text
sha256:db836fe798fafca4983c40d320afaaadfcbc003d6bd941a6a4a12ab20578a2c9
sha256:28d27adebd371f7ce330fc1442fb3b2cc42b59aafe644d01723759f9b02ae129
```

## Open the web inspector

Point the inspector at the project directory. It binds to loopback and prints the URL to open in a browser:

```sh
pnpm sceneaxi-web-shell --cwd "$PROJECT_DIR" --port 0
```

The server stays in the foreground until you press Ctrl+C. A run with `--port 0` printed:

```text
sceneaxi-web-shell: serving the inspector
  url:          http://127.0.0.1:44873/
  project root: /tmp/sceneaxi-guide.qAg6Rb
  scope:        loopback only; nothing is written until a proposal is accepted
Press Ctrl+C to stop.
```

Opening that URL returned the inspector HTML with the title `SceneAxi inspector — /tmp/sceneaxi-guide.qAg6Rb`. The inspector previews edits before acceptance and writes nothing until you accept a proposal. It is a local development tool, not a remotely hosted site.

## Run the desktop app

The Linux Electron app has its own install root. Start it from that directory:

```sh
cd desktop/linux
pnpm start
```

The build printed `desktop runtime build OK — dist/main.cjs, dist/preload.cjs, dist/renderer.js, dist/index.html`. The launch attempt in this headless environment failed because Electron could not find an X server or `$DISPLAY`. The desktop surface is documented in the [Linux desktop guide](desktop-linux.md). Use the web inspector or CLI in a headless environment.

## Open the umbrella site locally

The umbrella is a separate Next.js install root. From its directory, install dependencies and start the local server:

```sh
cd sites/umbrella
pnpm install --frozen-lockfile
pnpm dev
```

Open the loopback URL printed by Next.js. The local build completed with `✓ Generating static pages (18/18)`, and the dev server printed `Local: http://localhost:3000`. A live request returned `HTTP 200` with `98200` bytes of HTML. This is local development, not deployment or production activation. The umbrella's routes, environment, and operator checks are documented in [websites deployment](websites-deploy.md) and [production activation](production-activation.md).

## Next steps

Use the [CLI reference](../packages/cli/README.md) for command options, [runnable surfaces](runnable-surfaces.md) for evidence and current limits, and the [plugin guide](plugins.md) to implement a registered capability. The [documentation index](README.md) separates user guides from governance and architecture records.
