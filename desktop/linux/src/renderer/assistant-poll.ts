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
} from "../lib/bridge-contract.js";

export const ASSISTANT_POLL_MAX_ATTEMPTS = 200;
export const ASSISTANT_POLL_INTERVAL_MS = 50;

export type AssistantPollOutcome =
  | Readonly<{ ok: true; job: DesktopAssistantJobSnapshot }>
  | Readonly<{ ok: false; reason: string; message: string }>;

export type AssistantPollInput = Readonly<{
  request: (request: unknown) => Promise<DesktopBridgeResponse>;
  /** Called for every polled snapshot so the surface can show live progress. */
  onSnapshot?: (job: DesktopAssistantJobSnapshot) => void;
  attempts?: number;
  wait?: (ms: number) => Promise<void>;
}>;

const refuse = (reason: string, message: string): AssistantPollOutcome =>
  Object.freeze({ ok: false as const, reason, message });

export async function pollAssistantJob(
  input: AssistantPollInput,
): Promise<AssistantPollOutcome> {
  const attempts = input.attempts ?? ASSISTANT_POLL_MAX_ATTEMPTS;
  const wait = input.wait ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const response = await input.request({ action: "assistant", payload: { op: "status" } });
    if (!response.ok) return refuse(response.reason, response.message);
    const job = response.data as DesktopAssistantJobSnapshot | null;
    if (job === null) {
      return refuse(
        DESKTOP_BRIDGE_REFUSALS.assistantJobMissing,
        "The assistant job disappeared; retry the prompt.",
      );
    }
    input.onSnapshot?.(job);
    if (job.status === "refused") {
      return refuse(
        job.refusal?.reason ?? DESKTOP_BRIDGE_REFUSALS.assistantRuntimeFailed,
        job.refusal === undefined
          ? "The assistant action refused."
          : `${job.refusal.message}${job.refusal.detail === undefined ? "" : ` — ${job.refusal.detail}`}`,
      );
    }
    if (job.status === "ready" && job.result !== undefined) {
      return Object.freeze({ ok: true as const, job });
    }
    await wait(ASSISTANT_POLL_INTERVAL_MS);
  }
  await input.request({ action: "assistant", payload: { op: "abandon" } });
  return refuse(
    DESKTOP_BRIDGE_REFUSALS.assistantStatusTimeout,
    "The assistant job did not finish in time; it was abandoned and Retry may start a fresh job.",
  );
}
