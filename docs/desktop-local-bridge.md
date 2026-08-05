# Desktop local bridge and agent tools

Issue [sceneaxi#202](https://github.com/Vhailors/sceneaxi/issues/202) attaches the
external `sceneaxi` CLI to the running Engine Desktop without adding a second
authoring implementation. The desktop's existing transport-free
`createDesktopBridge().handle()` remains authoritative; `local-rpc.ts` is a
same-user Unix-socket adapter over its project and assistant operations.

## Protocol v1

The machine contract is
`packages/schemas/contracts/desktop-local-bridge.schema.json`, with runtime
constants, validators, and the closed tool registry in
`packages/schemas/src/desktop-local-bridge.ts`. The wire format is one UTF-8 JSON
request followed by `\n`, then one UTF-8 JSON response followed by `\n`; the
connection closes after that exchange. Requests and responses carry
`protocolVersion: 1` and the caller's deterministic `id`.

The packaged desktop publishes a discovery descriptor at:

- `${XDG_CONFIG_HOME}/sceneaxi/desktop-bridge-v1.json` when
  `XDG_CONFIG_HOME` is absolute;
- otherwise `~/.config/sceneaxi/desktop-bridge-v1.json`.

The socket is `${XDG_RUNTIME_DIR}/sceneaxi/desktop-v1.sock` when
`XDG_RUNTIME_DIR` is absolute, otherwise
`${TMPDIR}/sceneaxi-<uid>/sceneaxi/desktop-v1.sock`. `--descriptor <path>` is an
explicit CLI override for isolated installs and tests; it changes no server
authority.

The descriptor records protocol identity, socket path, desktop PID, project
root, granted permissions, and one random 256-bit launch capability. It is not
a BYOK credential. The containing directories are mode `0700`; descriptor and
socket are mode `0600`; the CLI refuses symlinks, non-owner endpoints, and any
group/world permission bit. A capability is generated on every launch, compared
in constant time, never emitted by a CLI envelope, and removed with the
descriptor on graceful shutdown.

A descriptor that outlived its host — after a crash or `SIGKILL`, where no
`close()` ran — is reclaimed on the next launch. Liveness is proven against the
**endpoint**, never against the recorded PID alone: the host connects to the
descriptor's own `socketPath`, and only a private same-user socket that still
accepts proves another host. A recycled PID leaves no listener, so its
descriptor is stale and is removed. Only a genuinely live host refuses a second
one, and that refusal costs the CLI attachment alone: Engine Desktop logs the
reason and opens its window with the local bridge absent, rather than exiting.

The socket is Unix-only: no TCP listener, HTTP port, remote bind, CORS surface,
or renderer-only action exists. Request and response bodies are bounded to 1
MiB and one request per connection.

## Permission boundary

Every request names exactly one permission. The host checks three things before
calling the desktop bridge: the launch capability is valid, the named
permission is granted by this desktop instance, and it is the exact permission
declared by the checked-in tool definition.

| Permission | Tools |
|---|---|
| `bridge:connect` | `sceneaxi.bridge.handshake` |
| `project:read` | `sceneaxi.project.status` |
| `project:write` | `sceneaxi.project.propose`, `accept`, `reject`, `recover`, `restart`, `undo` |
| `assistant:read` | `sceneaxi.assistant.status` |
| `assistant:run` | `sceneaxi.assistant.local.start`, `sceneaxi.assistant.byo.start`, `sceneaxi.assistant.abandon` |

`sceneaxi.project.recover` is a **write**, not a read. It resolves the shared
session's pending apply through `resolveApplyTransaction()`, which rolls a
prepared transaction forward or back on disk, so it carries `project:write` and
`mutatesProject: true`. The marker an agent reads describes what a tool can
durably do, not what it usually returns; the invariant that no
`mutatesProject` tool may sit behind a read permission is asserted in
`packages/schemas/test/desktop-local-bridge.test.ts`.

The CLI requires the operator/agent to repeat the exact permission with
`--allow`; a missing, wider, narrower, or misspelled value refuses before the
socket is opened. Document paths are then checked again by the existing desktop
bridge: absolute paths, lexical escapes, and symlink escapes outside the active
project refuse. `scene`, `open-path`, and renderer `frame-report` are not local
agent tools and cannot be reached through this transport.

## CLI examples

Build once, start Engine Desktop, then use the normal versioned CLI envelope:

```bash
pnpm build
pnpm sceneaxi desktop bridge status --json
pnpm sceneaxi desktop bridge tools --json

pnpm sceneaxi desktop bridge call \
  --tool sceneaxi.project.status \
  --allow project:read \
  --input-json '{"documentPath":"scene.json"}' \
  --json

pnpm sceneaxi desktop bridge call \
  --tool sceneaxi.project.propose \
  --allow project:write \
  --input-json '{"documentPath":"scene.json","jsonPointer":"/data/entities/0/x","newValue":7}' \
  --json

pnpm sceneaxi desktop bridge call \
  --tool sceneaxi.project.accept \
  --allow project:write \
  --json
```

`desktop bridge tools --json` is the agent-facing schema source: each row has
the exact name, input JSON Schema, permission, mutation marker, provider route,
and `creditRoute`. Do not copy a parallel tool list into an agent integration.

Transport/discovery faults produce CLI `BRIDGE_UNAVAILABLE`; an incompatible or
invalid wire response produces `BRIDGE_PROTOCOL`; authenticated host refusals
produce `BRIDGE_REFUSED`. The named local code is retained at
`error.details.bridgeCode`, with a sanitized upstream refusal name at
`bridgeDetail`. All three exit `1`; tool/input/permission mistakes are
`VALIDATION` and exit `2`.

## BYOK secure-storage contract

No provider credential may appear in a CLI argument, agent-tool input, RPC
request/response, discovery descriptor, log, evidence packet, project document,
or committed file. The v1 BYOK tool accepts only `prompt` and a non-Kids
`profile`; schema validation rejects extra fields such as a key or token.

The only supported secret boundary is an embedding deployment that:

1. retrieves the provider credential from the operating system's user-scoped
   credential store while Engine Desktop starts;
2. closes over that credential inside a provider adapter and injects only the
   existing `runByoAssistant` function into `createDesktopBridge()`;
3. keeps the credential in process memory for that desktop session and clears
   its reference when the adapter/session closes; and
4. never serializes or logs the credential, including on provider errors.

The repository's packaged default injects no provider adapter and reads no BYOK
environment variable or plaintext config file, so
`sceneaxi.assistant.byo.start` deterministically refuses
`DESKTOP_ASSISTANT_BYO_UNAVAILABLE`. This is intentional: adding an OS-keychain
adapter is deployment work at the existing seam, not authority to add a secret
store or provider dependency to CLI/core.

## Cost and hosted separation

All project tools and `sceneaxi.assistant.local.start` are offline/local and
`creditRoute: "none"`; they import neither auth nor billing and cannot append a
ledger entry. BYOK also has `creditRoute: "none"`: the user pays their provider
directly through the injected adapter, never SceneAxi credits.

There is no `sceneaxi.assistant.hosted.start` local tool. Hosted AI remains
behind `runMeteredModelCall()` and the existing identity/credit seam in the web
shell. Supplying a credential, configuring an adapter, or reaching this socket
cannot opt into hosted routing or bypass metering.

## Executable proof

- `packages/schemas/test/desktop-local-bridge.test.ts` locks protocol/tool
  schema identity, pins every tool's permission and mutation marker, proves no
  `mutatesProject` tool sits behind a read permission, and proves credential
  fields cannot enter BYOK inputs.
- `desktop/linux/test/local-rpc.test.ts` proves private modes, capability
  authentication, and exact permission checks over a real Unix socket, plus
  endpoint-liveness reclamation: an unparsable or no-longer-accepting descriptor
  is stale even when its recorded pid is alive, while a live endpoint still
  refuses a second host.
- `packages/cli/test/desktop-bridge.test.ts` proves CLI validation and
  deterministic envelope mapping through the injected transport seam.
- `tests/e2e/desktop-cli-local-bridge-golden.test.ts` spawns the real CLI binary
  against the real desktop server, performs propose/apply, runs the free local
  assistant, and proves absent BYOK plus hosted stay fail-closed.
