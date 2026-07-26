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
 * identified the same way regardless of which path opened it. `digest` stays
 * optional and is verified against the portable kernel digest before use, so an
 * injected implementation can change performance but never bytes.
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
function ownField(value: unknown, field: string): unknown {
  if (typeof value !== "object" || value === null) return undefined;
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
function ownString(value: unknown, field: string): string {
  const found = ownField(value, field);
  return typeof found === "string" ? found : "";
}

function kernelMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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
 * a finite reading, refuses here rather than producing a session whose bytes or
 * bootstrap record cannot be trusted.
 */
function resolveHost(host: OpenPathHost): OrchestratorResult<ResolvedHost> {
  if (typeof host !== "object" || host === null) {
    return refuse("OPEN_PATH_HOST_INVALID", "host is not an object");
  }

  let clock: unknown;
  try {
    clock = host.nowMs;
  } catch (error) {
    return refuse("OPEN_PATH_HOST_INVALID", kernelMessage(error));
  }
  if (typeof clock !== "function") {
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
  if (typeof openedAtMs !== "number" || !Number.isFinite(openedAtMs)) {
    return refuse(
      "OPEN_PATH_HOST_INVALID",
      "host.nowMs must return a finite number",
    );
  }

  return ok({
    digest,
    kernelHost: { nowMs: () => host.nowMs(), digest },
    openedAtMs,
  });
}

function sessionIdOf(
  kind: OpenPathKind,
  subjectId: string,
  openedAtMs: number,
  resumed: boolean,
  digest: KernelDigest,
): string {
  const mode = resumed ? "resume" : "open";
  return `sha256:${digest(
    `sceneaxi.open-path:${kind}:${subjectId}:${String(openedAtMs)}:${mode}`,
  )}`;
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

type Bootstrapped<K extends OpenPathKind, S> = OrchestratorResult<
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

  let kernelSession: S;
  try {
    kernelSession = openSession(resolved.value);
  } catch (error) {
    return refuse(
      resumed ? "OPEN_PATH_RESUME_REFUSED" : "OPEN_PATH_KERNEL_REFUSED",
      kernelMessage(error),
    );
  }

  const { openedAtMs, digest } = resolved.value;
  return ok(
    createHandle(
      Object.freeze({
        kind,
        subjectId,
        sessionId: sessionIdOf(kind, subjectId, openedAtMs, resumed, digest),
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
function refuseRequest(request: unknown): OrchestratorRefusal {
  if (typeof request !== "object" || request === null) {
    return refuse("OPEN_PATH_REQUEST_MALFORMED", "request is not an object");
  }
  const kind = ownField(request, "kind");
  if (typeof kind !== "string" || kind === "") {
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
      const productManifest = ownField(
        request,
        "productManifest",
      ) as ProductManifest;
      return bootstrapWith(
        "product",
        host,
        ownString(productManifest, "productId"),
        false,
        (resolved) => open(productManifest, resolved.kernelHost),
      );
    }
    case "sculpt": {
      const artifact = ownField(request, "artifact");
      const options = ownField(request, "options") as SculptKernelOptions;
      return bootstrapWith(
        "sculpt",
        host,
        ownString(artifact, "artifactId"),
        false,
        (resolved) =>
          openSculptKernelSession(artifact, options, {
            digest: resolved.digest,
          }),
      );
    }
    case "scene": {
      const scene = ownField(request, "scene");
      const options = ownField(request, "options") as SceneKernelOptions;
      return bootstrapWith(
        "scene",
        host,
        ownString(scene, "sceneId"),
        false,
        (resolved) =>
          openSceneKernelSession(scene, options, { digest: resolved.digest }),
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
      const save = ownField(request, "save") as KernelSessionSaveArtifact;
      return bootstrapWith(
        "product",
        host,
        ownString(ownField(save, "productManifest"), "productId"),
        true,
        (resolved) => replay(save, resolved.kernelHost),
      );
    }
    case "sculpt": {
      const save = ownField(request, "save") as SculptKernelSaveArtifact;
      return bootstrapWith(
        "sculpt",
        host,
        ownString(ownField(save, "artifact"), "artifactId"),
        true,
        (resolved) =>
          replaySculptKernelSession(save, { digest: resolved.digest }),
      );
    }
    case "scene": {
      const save = ownField(request, "save") as SceneKernelSaveArtifact;
      return bootstrapWith(
        "scene",
        host,
        ownString(ownField(save, "scene"), "sceneId"),
        true,
        (resolved) =>
          replaySceneKernelSession(save, { digest: resolved.digest }),
      );
    }
    default:
      return refuseRequest(request);
  }
}
