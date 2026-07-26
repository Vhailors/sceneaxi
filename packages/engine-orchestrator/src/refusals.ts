/**
 * Named refusal registry for `@sceneaxi/engine-orchestrator`.
 *
 * Nothing in this package throws across its public seam. The kernel signals
 * invalid input by throwing `KernelSessionError`; the orchestrator's job at that
 * boundary is to turn every failure — its own and the kernel's — into one named,
 * inspectable refusal so a caller can branch on a reason instead of a message.
 *
 * `test/refuse-matrix.test.ts` asserts every key here is reachable, so a refusal
 * cannot be added without a covering case.
 */

export const ORCHESTRATOR_REFUSALS = Object.freeze({
  OPEN_PATH_REQUEST_MALFORMED:
    "The open-path request is not an object carrying a kind, so no session is bootstrapped.",
  OPEN_PATH_KIND_UNKNOWN:
    "The requested open path is not one of the kernel's landed open paths. Widening the set is an explicit edit, never an inference.",
  OPEN_PATH_HOST_INVALID:
    "The host does not satisfy the open-path host contract (a nowMs clock, and a digest that agrees with the portable kernel digest when supplied).",
  OPEN_PATH_SUBJECT_UNIDENTIFIED:
    "The request carries no subject id (productId, artifactId, or sceneId), so the bootstrap record could not identify what is being opened.",
  OPEN_PATH_KERNEL_REFUSED:
    "The kernel refused to open the subject. The orchestrator adds no fallback and opens nothing partial.",
  OPEN_PATH_RESUME_REFUSED:
    "The kernel refused to replay the save artifact — a resumed session must reproduce its terminal digest exactly.",
  OPEN_PATH_SESSION_CLOSED:
    "The open-path session has been closed. A closed handle never hands out its kernel session again.",
} as const);

export type OrchestratorRefusalReason = keyof typeof ORCHESTRATOR_REFUSALS;

/** Every refusal reason, frozen, for exhaustive matrix tests. */
export const ORCHESTRATOR_REFUSAL_REASONS: readonly OrchestratorRefusalReason[] =
  Object.freeze(Object.keys(ORCHESTRATOR_REFUSALS) as OrchestratorRefusalReason[]);

export type OrchestratorRefusal = {
  readonly ok: false;
  readonly reason: OrchestratorRefusalReason;
  readonly message: string;
  /**
   * The underlying kernel message when the kernel is the one refusing, else
   * `null`. Always present so callers never branch on property existence.
   */
  readonly detail: string | null;
};

export type OrchestratorOk<T> = { readonly ok: true; readonly value: T };

export type OrchestratorResult<T> = OrchestratorOk<T> | OrchestratorRefusal;

/** Build a frozen refusal carrying the registry message for `reason`. */
export function refuse(
  reason: OrchestratorRefusalReason,
  detail: string | null = null,
): OrchestratorRefusal {
  return Object.freeze({
    ok: false as const,
    reason,
    message: ORCHESTRATOR_REFUSALS[reason],
    detail,
  });
}

/** Build a frozen ok result. */
export function ok<T>(value: T): OrchestratorOk<T> {
  return Object.freeze({ ok: true as const, value });
}
