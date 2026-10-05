/**
 * The real open path above the Game Kernel: bootstrap and session lifecycle.
 *
 * The kernel owns simulation authority (ADR 0001) and landed three open paths —
 * a product manifest session, a sculpt session, and a composed-scene session —
 * each with its own entry point, its own host expectations, and its own throw
 * behaviour. Every caller that wanted to *open something* had to know which of
 * the three it held, assemble the right host, and wrap the call in a try/catch.
 * That is the orchestration this module owns, and it is all it owns:
 *
 * - **One request vocabulary.** `bootstrapOpenPath()` takes a kind-tagged
 *   request and selects the kernel entry point; callers stop hand-picking one.
 * - **One host contract.** `OpenPathHost` is resolved once and passed down, so a
 *   caller never has to know that two of the three paths want no clock.
 * - **Fail-closed results, not throws.** Every failure becomes a named refusal
 *   from `./refusals.js`. Nothing here throws across the package seam.
 * - **A session lifecycle.** The kernel session has no teardown of its own, so
 *   the handle is where "this session is still mine to advance" lives. After
 *   `close()`, the handle never hands the kernel session out again.
 * - **A bootstrap record.** What was opened, under which id, at which clock
 *   reading, resumed or fresh — deterministic, so it can be asserted.
 *
 * Deliberately **not** here, and not implied by anything here: a job queue, a
 * scheduler, a durable job store, a worker pool, retries, multi-tenancy, or a
 * plugin hook. This module holds exactly one session per handle and creates no
 * work of its own (ADR 0023).
 *
 * Browser-safe by construction, like the kernel it sits on: no Node builtin
 * import, no Node-only global, and digest semantics borrowed from the kernel's
 * portable sha256 rather than a platform crypto module.
 */
import {
  BOM_VERSION,
  KernelSessionError,
  KERNEL_VERSION,
  open,
  openSceneKernelSession,
  openSculptKernelSession,
  replay,
  replaySceneKernelSession,
  replaySculptKernelSession,
  resolveKernelDigest,
  type KernelDigest,
  type KernelHost,
  type KernelSession,
  type KernelSessionSaveArtifact,
  type ProductManifest,
  type SceneKernelOptions,
  type SceneKernelSaveArtifact,
  type SceneKernelSession,
  type SculptKernelOptions,
  type SculptKernelSaveArtifact,
  type SculptKernelSession,
} from "@sceneaxi/engine-kernel";
import { validateSculptArtifact, validateComposedScene } from "@sceneaxi/schemas";
import {
  ok,
  refuse,
  type OrchestratorRefusal,
  type OrchestratorResult,
} from "./refusals.js";

/** The kernel open paths this orchestrator can bootstrap. Widening is an explicit edit. */
export const OPEN_PATH_KINDS = Object.freeze([
  "product",
  "sculpt",
  "scene",
] as const);

export type OpenPathKind = (typeof OPEN_PATH_KINDS)[number];

/**
 * Host services the open path needs, in one shape for all three kinds.
 *
 * `nowMs` is required even where the kernel does not ask for it: the bootstrap
 * record is stamped with the clock reading, so every opened session is
 * identified the same way regardless of which path opened it. It must return an
 * integer millisecond reading, which is what the kernel's product session
 * requires of every later reading too — in a browser that is `Date.now()` or
 * `Math.floor(performance.now())`, never raw fractional `performance.now()`.
 * `digest` stays optional and is verified against the portable kernel digest
 * before use, so an injected implementation can change performance but never
 * bytes.
 */
export interface OpenPathHost {
  readonly nowMs: () => number;
  readonly digest?: KernelDigest;
}

export type ProductOpenPathRequest = {
  readonly kind: "product";
  readonly productManifest: ProductManifest;
};

export type SculptOpenPathRequest = {
  readonly kind: "sculpt";
  readonly artifact: unknown;
  readonly options: SculptKernelOptions;
};

export type SceneOpenPathRequest = {
  readonly kind: "scene";
  readonly scene: unknown;
  readonly options: SceneKernelOptions;
};

export type OpenPathRequest =
  | ProductOpenPathRequest
  | SculptOpenPathRequest
  | SceneOpenPathRequest;

export type ProductResumeRequest = {
  readonly kind: "product";
  readonly save: KernelSessionSaveArtifact;
};

export type SculptResumeRequest = {
  readonly kind: "sculpt";
  readonly save: SculptKernelSaveArtifact;
};

export type SceneResumeRequest = {
  readonly kind: "scene";
  readonly save: SceneKernelSaveArtifact;
};

export type ResumeOpenPathRequest =
  | ProductResumeRequest
  | SculptResumeRequest
  | SceneResumeRequest;

export type OpenPathStatus = "open" | "closed";

/**
 * What was opened. Frozen, fully determined by the request and the host clock,
 * and therefore safe to assert in a golden fixture.
 */
export type OpenPathBootstrap<K extends OpenPathKind = OpenPathKind> = {
  readonly kind: K;
  /** `productId`, `artifactId`, or `sceneId` of the thing that was opened. */
  readonly subjectId: string;
  /** `sha256:<hex>` over kind, subject, clock reading, and mode. */
  readonly sessionId: string;
  readonly openedAtMs: number;
  /** True when the session came from a save artifact rather than a fresh open. */
  readonly resumed: boolean;
  readonly kernelVersion: string;
  readonly bomVersion: string;
};

/**
 * One opened session and the lifecycle around it.
 *
 * `session()` returns the kernel session itself rather than re-exporting
 * `dispatch`/`advance`/`observe`/`save`. Wrapping them would be a second
 * implementation of kernel behaviour that can drift from the first; the
 * lifecycle guard belongs here, the simulation contract stays the kernel's.
 */
export type OpenPathHandle<K extends OpenPathKind, S> = {
  readonly kind: K;
  readonly bootstrap: OpenPathBootstrap<K>;
  status(): OpenPathStatus;
  session(): OrchestratorResult<S>;
  /** Release the session. Idempotent; every later `session()` refuses. */
  close(): void;
};

export type ProductOpenPathHandle = OpenPathHandle<"product", KernelSession>;

export type SculptOpenPathHandle = OpenPathHandle<"sculpt", SculptKernelSession>;

export type SceneOpenPathHandle = OpenPathHandle<"scene", SceneKernelSession>;

export type AnyOpenPathHandle =
  | ProductOpenPathHandle
  | SculptOpenPathHandle
  | SceneOpenPathHandle;

/** Read one own data property without invoking an accessor the value may define. */
type OwnDataField<Value, Field extends string> = Value extends object ? Field extends keyof Value ? Value[Field] : undefined : undefined;

function ownField<Value, Field extends string>(value: Value, field: Field): OwnDataField<Value, Field> | undefined {
  if (!isObjectValue(value) || value === null) return undefined;

  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, field);

    return descriptor !== undefined && "value" in descriptor
      ? descriptor.value
      : undefined;
  } catch {
    return undefined;
  }
}

/** Read one own string data property, or `""` when it is absent or not a string. */
function ownString<Value, Field extends string>(value: Value, field: Field): string {
  const found = ownField(value, field);

  return isStringValue(found) ? found : "";
}

function kernelMessage(cause: unknown): string {
  // Never invoke toString, Error.message getters or proxy traps for diagnostics.
  const message = ownErrorMessage(cause);

  return isStringValue(message) ? message.slice(0, 512) : "operation failed";
}

type ResolvedHost = {
  readonly digest: KernelDigest;
  readonly kernelHost: KernelHost;
  readonly openedAtMs: number;
};

/**
 * Prove the host before anything is opened.
 *
 * A digest that disagrees with the portable one, or a clock that does not return
 * an integer reading, refuses here rather than producing a session whose bytes or
 * bootstrap record cannot be trusted. The integer requirement is the kernel's
 * (`dispatch` throws on a fractional reading), so proving it here is what keeps a
 * bootstrapped product session from failing at its first command instead.
 */
function resolveHost(host: OpenPathHost): OrchestratorResult<ResolvedHost> {
  if (!isObjectValue(host) || host === null) {
    return refuse("OPEN_PATH_HOST_INVALID", "host is not an object");
  }

  let clock: unknown;

  try {
    clock = host.nowMs;
  } catch (error) {
    return refuse("OPEN_PATH_HOST_INVALID", kernelMessage(error));
  }

  if (!isClockSource(clock)) {
    return refuse("OPEN_PATH_HOST_INVALID", "host.nowMs is required");
  }

  let digest: KernelDigest;

  try {
    digest = resolveKernelDigest(host.digest);
  } catch (error) {
    return refuse("OPEN_PATH_HOST_INVALID", kernelMessage(error));
  }

  let openedAtMs: unknown;

  try {
    openedAtMs = host.nowMs();
  } catch (error) {
    return refuse("OPEN_PATH_HOST_INVALID", kernelMessage(error));
  }

  if (!isNumberValue(openedAtMs) || !Number.isSafeInteger(openedAtMs)) {
    return refuse(
      "OPEN_PATH_HOST_INVALID",
      "host.nowMs must return an integer number of milliseconds",
    );
  }

  return ok({
    digest,
    kernelHost: { nowMs: () => host.nowMs(), digest },
    openedAtMs,
  });
}

const SESSION_ID_DIGEST_RE = /^[0-9a-f]{64}$/;

/**
 * Derive the bootstrap session id, proving the digest on the one input that
 * matters here.
 *
 * The kernel proves an injected digest against a fixed set of probes, which
 * cannot speak for an input it never saw: a digest that answers the probes and
 * then throws — or returns a non-hex string — on the session-id input would
 * otherwise escape as a raw throw or stamp a malformed id into a frozen record.
 * Both are host failures, so both refuse by name.
 */
function sessionIdOf(
  kind: OpenPathKind,
  subjectId: string,
  openedAtMs: number,
  resumed: boolean,
  digest: KernelDigest,
): OrchestratorResult<string> {
  const mode = resumed ? "resume" : "open";
  let hex: unknown;

  try {
    hex = digest(
      `sceneaxi.open-path:${kind}:${subjectId}:${String(openedAtMs)}:${mode}`,
    );
  } catch (error) {
    return refuse("OPEN_PATH_HOST_INVALID", kernelMessage(error));
  }

  if (!isStringValue(hex) || !SESSION_ID_DIGEST_RE.test(hex)) {
    return refuse(
      "OPEN_PATH_HOST_INVALID",
      "host digest must return 64 lowercase hex characters",
    );
  }

  return ok(`sha256:${hex}`);
}

function createHandle<K extends OpenPathKind, S>(
  bootstrap: OpenPathBootstrap<K>,
  kernelSession: S,
): OpenPathHandle<K, S> {
  let live = true;

  return Object.freeze({
    kind: bootstrap.kind,
    bootstrap,
    status: (): OpenPathStatus => (live ? "open" : "closed"),
    session: () =>
      live ? ok(kernelSession) : refuse("OPEN_PATH_SESSION_CLOSED"),
    close: () => {
      live = false;
    },
  });
}

export type Bootstrapped<K extends OpenPathKind, S> = OrchestratorResult<
  OpenPathHandle<K, S>
>;

/**
 * Everything shared by every open and every resume: prove the host, identify the
 * subject, call the kernel exactly once, and wrap the result in a lifecycle.
 */
function bootstrapWith<K extends OpenPathKind, S>(
  kind: K,
  host: OpenPathHost,
  subjectId: string,
  resumed: boolean,
  openSession: (resolved: ResolvedHost) => S,
): Bootstrapped<K, S> {
  const resolved = resolveHost(host);

  if (!resolved.ok) return resolved;

  if (subjectId === "") {
    return refuse("OPEN_PATH_SUBJECT_UNIDENTIFIED", `${kind} request`);
  }

  const { openedAtMs, digest } = resolved.value;
  const sessionId = sessionIdOf(kind, subjectId, openedAtMs, resumed, digest);

  if (!sessionId.ok) return sessionId;

  let kernelSession: S;

  try {
    kernelSession = openSession(resolved.value);
  } catch (error) {
    return refuse(
      resumed ? "OPEN_PATH_RESUME_REFUSED" : "OPEN_PATH_KERNEL_REFUSED",
      kernelMessage(error),
    );
  }

  return ok(
    createHandle(
      Object.freeze({
        kind,
        subjectId,
        sessionId: sessionId.value,
        openedAtMs,
        resumed,
        kernelVersion: KERNEL_VERSION,
        bomVersion: BOM_VERSION,
      }),
      kernelSession,
    ),
  );
}

/** Refuse a request whose shape says nothing usable about which path it wants. */
function refuseRequest(request: OpenPathRequest | ResumeOpenPathRequest): OrchestratorRefusal {
  if (!isObjectValue(request) || request === null) {
    return refuse("OPEN_PATH_REQUEST_MALFORMED", "request is not an object");
  }

  const kind = ownField(request, "kind");

  if (!isRequestKindText(kind)) {
    return refuse("OPEN_PATH_REQUEST_MALFORMED", "request.kind is required");
  }

  return refuse("OPEN_PATH_KIND_UNKNOWN", kind);
}

/**
 * Open one kernel session through the orchestrator.
 *
 * The kernel still validates the subject and still owns every simulation rule;
 * this adds the host contract, the named refusals, the bootstrap record, and the
 * lifecycle around the session it returns.
 */
export function bootstrapOpenPath(
  request: ProductOpenPathRequest,
  host: OpenPathHost,
): Bootstrapped<"product", KernelSession>;
export function bootstrapOpenPath(
  request: SculptOpenPathRequest,
  host: OpenPathHost,
): Bootstrapped<"sculpt", SculptKernelSession>;
export function bootstrapOpenPath(
  request: SceneOpenPathRequest,
  host: OpenPathHost,
): Bootstrapped<"scene", SceneKernelSession>;
export function bootstrapOpenPath(
  request: OpenPathRequest,
  host: OpenPathHost,
): OrchestratorResult<AnyOpenPathHandle>;
export function bootstrapOpenPath(
  request: OpenPathRequest,
  host: OpenPathHost,
): OrchestratorResult<AnyOpenPathHandle> {
  switch (ownField(request, "kind")) {
    case "product": {
      const productManifest = ownField(request, "productManifest");

      return bootstrapWith(
        "product",
        host,
        ownString(productManifest, "productId"),
        false,
        (resolved) => {
          if (productManifest === undefined) throw new KernelSessionError("productManifest.productId is required");

          return open(productManifest, resolved.kernelHost);
        },
      );
    }

    case "sculpt": {
      const artifact = ownField(request, "artifact");
      const options = ownField(request, "options");

      return bootstrapWith(
        "sculpt",
        host,
        ownString(artifact, "artifactId"),
        false,
        (resolved) => {
          const parsed = validateSculptArtifact(artifact);

          if (!parsed.ok) throw new KernelSessionError(parsed.diagnostics[0]?.message ?? "invalid Sculpt Artifact");

          if (options === undefined) throw new KernelSessionError("sculpt options.seed must be an integer");

          return openSculptKernelSession(parsed.value, options, { digest: resolved.digest });
        },
      );
    }

    case "scene": {
      const scene = ownField(request, "scene");
      const options = ownField(request, "options");

      return bootstrapWith(
        "scene",
        host,
        ownString(scene, "sceneId"),
        false,
        (resolved) => {
          const parsed = validateComposedScene(scene);

          if (!parsed.ok) throw new KernelSessionError(parsed.diagnostics[0]?.message ?? "invalid ComposedScene");

          if (options === undefined) throw new KernelSessionError("sculpt options.seed must be an integer");

          return openSceneKernelSession(parsed.value, options, { digest: resolved.digest });
        },
      );
    }

    default:
      return refuseRequest(request);
  }
}

/**
 * Resume a session from a kernel save artifact.
 *
 * Resume is not a second open path: the kernel replays the recorded events and
 * refuses on terminal-digest drift, so a handle only exists when the resumed
 * session reproduces its save exactly.
 */
export function resumeOpenPath(
  request: ProductResumeRequest,
  host: OpenPathHost,
): Bootstrapped<"product", KernelSession>;
export function resumeOpenPath(
  request: SculptResumeRequest,
  host: OpenPathHost,
): Bootstrapped<"sculpt", SculptKernelSession>;
export function resumeOpenPath(
  request: SceneResumeRequest,
  host: OpenPathHost,
): Bootstrapped<"scene", SceneKernelSession>;
export function resumeOpenPath(
  request: ResumeOpenPathRequest,
  host: OpenPathHost,
): OrchestratorResult<AnyOpenPathHandle>;
export function resumeOpenPath(
  request: ResumeOpenPathRequest,
  host: OpenPathHost,
): OrchestratorResult<AnyOpenPathHandle> {
  switch (ownField(request, "kind")) {
    case "product": {
      const save = ownField(request, "save");

      return bootstrapWith(
        "product",
        host,
        ownString(ownField(save, "productManifest"), "productId"),
        true,
        (resolved) => {
          if (!isProductSave(save)) throw new KernelSessionError("invalid save artifact");

          return replay(save, resolved.kernelHost);
        },
      );
    }

    case "sculpt": {
      const save = ownField(request, "save");

      return bootstrapWith(
        "sculpt",
        host,
        ownString(ownField(save, "artifact"), "artifactId"),
        true,
        (resolved) => {
          if (!isSculptSave(save)) throw new KernelSessionError("invalid sculpt save artifact");

          return replaySculptKernelSession(save, { digest: resolved.digest });
        },
      );
    }

    case "scene": {
      const save = ownField(request, "save");

      return bootstrapWith(
        "scene",
        host,
        ownString(ownField(save, "scene"), "sceneId"),
        true,
        (resolved) => {
          if (!isSceneSave(save)) throw new KernelSessionError("invalid scene save artifact");

          return replaySceneKernelSession(save, { digest: resolved.digest });
        },
      );
    }

    default:
      return refuseRequest(request);
  }
}

function ownErrorMessage(cause: unknown): string | undefined {
  if (cause === null || !isObjectValue(cause)) return undefined;

  try {
    const descriptor = Object.getOwnPropertyDescriptor(cause, "message");
    const message: unknown = descriptor !== undefined && "value" in descriptor ? descriptor.value : undefined;

    return isStringValue(message) ? message : undefined;
  } catch {
    return undefined;
  }
}

function isObjectValue<Value>(value: Value): value is Value & object { return value !== null && typeof value === "object"; }

function isStringValue<Value>(value: Value): value is Value & string { return typeof value === "string"; }

function isClockSource<Value>(value: Value): value is Value & OpenPathHost["nowMs"] { return typeof value === "function"; }

function isNumberValue<Value>(value: Value): value is Value & number { return typeof value === "number"; }

type SavedSession = KernelSessionSaveArtifact | SculptKernelSaveArtifact | SceneKernelSaveArtifact;

// These own fields distinguish the typed save variants; each kernel replay still validates the full untrusted payload.
function isProductSave(value: SavedSession | undefined): value is KernelSessionSaveArtifact {
  return value !== undefined && isObjectValue(value) && Object.hasOwn(value, "productManifest");
}

function isSculptSave(value: SavedSession | undefined): value is SculptKernelSaveArtifact {
  return value !== undefined && isObjectValue(value) && Object.hasOwn(value, "artifact");
}

function isSceneSave(value: SavedSession | undefined): value is SceneKernelSaveArtifact {
  return value !== undefined && isObjectValue(value) && Object.hasOwn(value, "scene");
}

function isRequestKindText<Value>(value: Value): value is Value & string {
  return typeof value === "string" && value !== "";
}
