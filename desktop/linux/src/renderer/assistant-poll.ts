/**
 * The renderer's assistant-job poll, separated from the DOM it reports into.
 *
 * Everything decided here is a rule rather than a rendering detail: how a bridge
 * refusal, a vanished job, a refused job (with the host's redacted detail), and a
 * job that never settles each turn into one named outcome, and — the one with a
 * side effect — that an exhausted poll abandons the job over the bridge before it
 * refuses, so the next Retry is not met with `DESKTOP_ASSISTANT_BUSY` for work the
 * renderer stopped watching. Keeping it here lets the gate execute those paths
 * against a fake port instead of reading the viewport's source for a literal.
 */
import {
  DESKTOP_BRIDGE_REFUSALS,
  type DesktopAssistantJobSnapshot,
  type DesktopBridgeResponse,
  type DesktopRarityProposalResult,
} from "../lib/bridge-contract.js";

/** 60s at 50ms. BYOK Flash often needs longer than a local sculpt. */
export const ASSISTANT_POLL_MAX_ATTEMPTS = 1_200;
export const ASSISTANT_POLL_INTERVAL_MS = 50;

/**
 * A settled job carries its result on the outcome rather than leaving the caller
 * to re-narrow an optional member. `ok: true` is only ever produced for a job
 * that has one, so a consumer with a branch for its absence would be writing a
 * branch that cannot run — and, being unreachable, could not be kept correct.
 */
export type AssistantPollOutcome =
  | Readonly<{
      ok: true;
      job: DesktopAssistantJobSnapshot;
      result: NonNullable<DesktopAssistantJobSnapshot["result"]>;
    }>
  | Readonly<{ ok: false; reason: string; message: string; retryJobId?: string }>;

export type AssistantPollInput = Readonly<{
  request: (request: unknown) => Promise<DesktopBridgeResponse>;
  jobId: string;
  /** Called for every polled snapshot so the surface can show live progress. */
  onSnapshot?: (job: DesktopAssistantJobSnapshot) => void;
  attempts?: number;
  wait?: (ms: number) => Promise<void>;
}>;

export type AssistantRaritySettlementWatchInput = Readonly<{
  request: (request: unknown) => Promise<DesktopBridgeResponse>;
  jobId: string;
  namespaceDigest: string;
  active: () => boolean;
  wait?: (ms: number) => Promise<void>;
}>;

export type AssistantRaritySettlementAcknowledgementInput = Readonly<{
  request: (request: unknown) => Promise<DesktopBridgeResponse>;
  jobId: string;
  active: () => boolean;
  wait?: (ms: number) => Promise<void>;
}>;

const refuse = (
  reason: string,
  message: string,
  retryJobId?: string,
): AssistantPollOutcome =>
  Object.freeze({
    ok: false as const,
    reason,
    message,
    ...(retryJobId === undefined ? {} : { retryJobId }),
  });

const settledJobOutcome = (
  job: DesktopAssistantJobSnapshot | null,
  onSnapshot?: (job: DesktopAssistantJobSnapshot) => void,
): AssistantPollOutcome | null => {
  if (job === null) {
    return refuse(
      DESKTOP_BRIDGE_REFUSALS.assistantJobMissing,
      "The assistant job disappeared; retry the prompt.",
    );
  }
  onSnapshot?.(job);
  if (job.status === "refused") {
    return refuse(
      job.refusal?.reason ?? DESKTOP_BRIDGE_REFUSALS.assistantRuntimeFailed,
      job.refusal === undefined
        ? "The assistant action refused."
        : `${job.refusal.message}${job.refusal.detail === undefined ? "" : ` — ${job.refusal.detail}`}`,
    );
  }
  if (job.status === "ready" && job.result !== undefined) {
    return Object.freeze({ ok: true as const, job, result: job.result });
  }
  return null;
};

export async function pollAssistantJob(
  input: AssistantPollInput,
): Promise<AssistantPollOutcome> {
  const attempts = input.attempts ?? ASSISTANT_POLL_MAX_ATTEMPTS;
  const wait = input.wait ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    let response: DesktopBridgeResponse;
    try {
      response = await input.request({ action: "assistant", payload: { op: "status" } });
    } catch {
      await wait(ASSISTANT_POLL_INTERVAL_MS);
      continue;
    }
    if (!response.ok) {
      await wait(ASSISTANT_POLL_INTERVAL_MS);
      continue;
    }
    const job = response.data as DesktopAssistantJobSnapshot | null;
    if (job?.jobId !== input.jobId) {
      return refuse(
        DESKTOP_BRIDGE_REFUSALS.assistantJobMissing,
        "The assistant job disappeared; retry the prompt.",
      );
    }
    const outcome = settledJobOutcome(job, input.onSnapshot);
    if (outcome !== null) return outcome;
    await wait(ASSISTANT_POLL_INTERVAL_MS);
  }
  let abandoned: DesktopBridgeResponse;
  try {
    abandoned = await input.request({
      action: "assistant",
      payload: { op: "abandon", jobId: input.jobId },
    });
  } catch {
    return refuse(
      DESKTOP_BRIDGE_REFUSALS.assistantRuntimeFailed,
      "The assistant job did not finish in time, and its abandonment could not be confirmed; wait before retrying.",
      input.jobId,
    );
  }
  if (!abandoned.ok) return refuse(abandoned.reason, abandoned.message, input.jobId);
  const abandonedJob = abandoned.data as DesktopAssistantJobSnapshot | null;
  if (abandonedJob?.jobId !== input.jobId) {
    return refuse(
      DESKTOP_BRIDGE_REFUSALS.assistantRuntimeFailed,
      "The assistant job did not finish in time, and its abandonment could not be confirmed; wait before retrying.",
      input.jobId,
    );
  }
  const abandonedOutcome = settledJobOutcome(abandonedJob, input.onSnapshot);
  if (abandonedOutcome?.ok) return abandonedOutcome;
  if (
    abandonedOutcome !== null &&
    abandonedOutcome.reason !== DESKTOP_BRIDGE_REFUSALS.assistantAbandoned
  ) {
    return abandonedOutcome;
  }
  if (
    abandonedJob === null ||
    abandonedJob.status !== "refused" ||
    abandonedJob.refusal?.reason !== DESKTOP_BRIDGE_REFUSALS.assistantAbandoned
  ) {
    return refuse(
      DESKTOP_BRIDGE_REFUSALS.assistantRuntimeFailed,
      "The assistant job did not finish in time, and its abandonment could not be confirmed; wait before retrying.",
      input.jobId,
    );
  }
  return refuse(
    DESKTOP_BRIDGE_REFUSALS.assistantStatusTimeout,
    "The assistant job did not finish in time; it was abandoned and Retry may start a fresh job.",
  );
}

export async function watchAssistantRaritySettlement(
  input: AssistantRaritySettlementWatchInput,
): Promise<DesktopRarityProposalResult | null> {
  const wait = input.wait ?? ((ms: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, ms)));
  while (input.active()) {
    await wait(ASSISTANT_POLL_INTERVAL_MS);
    if (!input.active()) return null;
    let response: DesktopBridgeResponse;
    try {
      response = await input.request({ action: "assistant", payload: { op: "status" } });
    } catch {
      continue;
    }
    if (!response.ok) continue;
    const job = response.data as DesktopAssistantJobSnapshot | null;
    if (job?.jobId !== input.jobId) return null;
    const result = job.result;
    if (
      result === undefined ||
      !("kind" in result) ||
      result.kind !== "rarity-proposal" ||
      result.evidence.namespaceDigest !== input.namespaceDigest
    ) return null;
    if (
      result.retirement !== undefined ||
      result.authoring?.phase === "applied" ||
      result.authoring?.phase === "rejected"
    ) return result;
  }
  return null;
}

export async function acknowledgeAssistantRaritySettlement(
  input: AssistantRaritySettlementAcknowledgementInput,
): Promise<boolean> {
  const wait = input.wait ?? ((ms: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, ms)));
  while (input.active()) {
    try {
      const response = await input.request({
        action: "assistant",
        payload: { op: "abandon", jobId: input.jobId },
      });
      if (response.ok) return true;
    } catch {
      // A transient IPC failure leaves the terminal job available for another attempt.
    }
    await wait(ASSISTANT_POLL_INTERVAL_MS);
  }
  return false;
}
