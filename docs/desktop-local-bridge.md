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

The desktop configuration surface supports the non-Kids `OpenRouter` provider.
It is a renderer-only settings path beside the existing Assistant route control,
not a local agent tool. Selecting BYOK shows whether a key is stored and the
available Save, Replace, Remove, or named-unavailable action. The password field
is cleared after every submission; status and mutation responses contain only
provider, operation, key-presence, and runtime-availability metadata.

`ProviderKeyStore` in `desktop/linux/src/lib/provider-key-store.ts` is the typed
host seam: `status`, `read`, `save`, and `remove`. Its Electron adapter uses
`safeStorage` only after `app.ready`, stores only its ciphertext envelope under
the application's user-data directory, and atomically replaces that envelope.
There is no app-owned cipher. On Linux, Electron's `basic_text` and `unknown`
backends are explicitly unsupported rather than treated as secure storage.
Environment variables, plaintext configuration, browser storage, project files,
and CLI arguments are not fallbacks.

The configuration request uses its own
`sceneaxi:desktop-byo-configuration` IPC channel. It is not a
`createDesktopBridge().handle()` action, cannot be reached through `local-rpc.ts`,
and adds nothing to the protocol-v1 permission/tool registry. The raw value exists
in the password control only until Save/Replace submits it to the privileged main
process; it is then cleared in both success and failure paths and never returned.

When a privileged provider adapter is injected,
`createSecureDesktopByoAssistantRunner()` performs this fixed sequence for every
BYOK job:

1. deny Kids before secure-store access;
2. retrieve the selected provider key from `ProviderKeyStore` in the privileged
   process;
3. create one provider session with a revocable key accessor and inject only the
   resulting runner into `createDesktopBridge()`;
4. revoke the key reference in `finally` before closing the provider session; and
5. reduce every thrown provider detail to a named, secret-free refusal.

The checked-in packaged host does not add a live provider transport or production
credential configuration: its provider runtime reports unavailable, while the
secure storage and UI states remain real. A deployment-owned privileged adapter
can satisfy the existing session factory without changing the renderer, CLI,
Unix socket, or tool registry. Until then a BYOK assistant start refuses rather
than borrowing the local route or crossing into hosted metering.

### Named secure-storage refusals

| Reason | Meaning |
|---|---|
| `DESKTOP_PROVIDER_KEY_STORE_UNAVAILABLE` | the platform secure-storage service is absent |
| `DESKTOP_PROVIDER_KEY_STORE_LOCKED` | the user-scoped OS credential store is locked or encryption is not currently available |
| `DESKTOP_PROVIDER_KEY_STORE_UNSUPPORTED` | the OS/backend is unsupported, including Electron `basic_text` on Linux |
| `DESKTOP_PROVIDER_KEY_STORE_CORRUPT` | the encrypted envelope or decrypted key is invalid |
| `DESKTOP_PROVIDER_KEY_STORE_FAILED` | availability, encryption, persistence, or removal failed |
| `DESKTOP_PROVIDER_KEY_MISSING` | no key is stored for the selected provider |
| `DESKTOP_PROVIDER_KEY_INVALID` | the submitted value is empty or has an unsupported shape |
| `DESKTOP_BYO_PROVIDER_UNSUPPORTED` | the requested provider is outside the checked-in provider list |
| `DESKTOP_BYO_PROVIDER_SESSION_UNAVAILABLE` | secure configuration exists but no privileged provider session factory is installed |
| `DESKTOP_BYO_PROVIDER_SESSION_FAILED` | provider session creation or execution failed; upstream detail is deliberately redacted |

All of these refuse before provider dispatch. Save encrypts before writing and
uses an atomic rename, so an encryption/write failure does not replace an existing
envelope with partial bytes. Corrupt data never falls back to an empty or plaintext
value.

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
- `packages/cli/test/desktop-socket-worker-lockstep.test.ts` keeps the socket
  worker's inlined constants honest. That worker is spawned as a bare `node`
  child without the workspace resolver, so it may import node builtins only and
  copies the protocol version, discovery kind, transport, permission set, and
  descriptor shape from the registry; the test reads its source and fails on
  drift.
- `tests/e2e/desktop-cli-local-bridge-golden.test.ts` spawns the real CLI binary
  against the real desktop server, performs propose/apply, runs the free local
  assistant, and proves absent BYOK plus hosted stay fail-closed.
- `tests/desktop/desktop-byo-secure-storage.test.ts` uses clearly synthetic
  non-secret sentinels to prove encrypted save/read/replace/remove, unavailable /
  locked / unsupported / corrupt / failed refusals, Kids-before-store ordering,
  provider-session retrieval and cleanup, renderer/bridge redaction, and the
  unchanged hosted/tool-registry boundary.

This contract does not authorize production deployment, hosted-provider
activation, Stripe LIVE, Connect LIVE, legal or tax behavior, production
credential setup, or a public Windows/macOS release. Those remain separately
owned and out of scope.
