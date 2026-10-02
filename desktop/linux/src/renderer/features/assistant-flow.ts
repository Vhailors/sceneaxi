import type { SculptMountApi, ThreeSculptPresentationBackend } from "@sceneaxi/engine-presentation";
import { formatSafeRarityEvidence } from "@sceneaxi/authoring-core/rarity-evidence";
import { createEditorCommandInvocation } from "@sceneaxi/schemas";
import { createDesktopAssistantViewportController } from "../../lib/assistant-viewport.js";
import type { DesktopAssistantProfile } from "../../lib/bridge.js";
import {
  DESKTOP_ACTIVE_DOCUMENT_PATH,
  DESKTOP_BRIDGE_REFUSALS,
  DESKTOP_RARITY_PROPOSAL_EVENT,
  type DesktopAssistantJobSnapshot,
  type DesktopBridgeResponse,
} from "../../lib/bridge-contract.js";
import { desktopAssistantRuntimeSignal } from "../assistant-runtime.js";
import { decideAssistantStart, withAssistantStrengthInstruction } from "../assistant-start.js";
import {
  assistantRaritySettlement,
  assistantRarityInvalidation,
  assistantRarityResultDigest,
  assistantRarityResultEvent,
  assistantRarityResultSettlement,
  assistantInspectionText,
  isAskAnswerResult,
  isRarityProposalResult,
} from "../assistant-inspection.js";
import {
  acknowledgeAssistantRaritySettlement,
  pollAssistantJob,
  watchAssistantRaritySettlement,
} from "../assistant-poll.js";
import { refusalText } from "./overlay-report.js";
import { refreshViewportScene } from "./scene-sync.js";
import type { BridgeGlobal, ViewportServices } from "./services.js";

export function signalAssistantRuntime(
  signal: Readonly<{ runtime: "none" | "local"; message?: string }>,
): void {
  const shell = document.querySelector<HTMLElement>(".shell");
  const eventName = shell?.dataset.assistantRuntimeEvent;
  if (eventName === undefined) return;
  document.dispatchEvent(
    new CustomEvent(eventName, {
      detail: signal,
    }),
  );
}

export function signalAssistantRuntimeUnavailable(message: string): void {
  signalAssistantRuntime(desktopAssistantRuntimeSignal({ status: "refused", message }));
}

function assistantProfile(shell: HTMLElement): DesktopAssistantProfile {
  const id = shell.dataset.profile;
  if (id === "web") return "@sceneaxi/profile-web";
  if (id === "kids") return "@sceneaxi/profile-kids";
  return "@sceneaxi/profile-game";
}

export function installAssistantProductFlow(
  stage: Element,
  port: BridgeGlobal,
  mounts: SculptMountApi,
  backend: ThreeSculptPresentationBackend,
  pollJob: typeof pollAssistantJob = pollAssistantJob,
  persistReadyBuild?: () => Promise<string>,
): boolean {
  const shell = document.querySelector<HTMLElement>(".shell");
  const prompt = document.querySelector<HTMLTextAreaElement>("#assistant-prompt");
  const send = document.querySelector<HTMLElement>("#assistant-send");
  const status = document.querySelector<HTMLElement>("[data-assistant-status]");
  const resultView = document.querySelector<HTMLElement>("[data-assistant-result]");
  const retry = document.querySelector<HTMLButtonElement>("#assistant-retry");
  const sculptStart = document.querySelector<HTMLButtonElement>("#sculpt-start");
  const sculptCancel = document.querySelector<HTMLButtonElement>("#sculpt-cancel");
  const sculptProgress = document.querySelector<HTMLElement>("[data-sculpt-progress]");
  const sculptProgressBar = sculptProgress?.querySelector<HTMLElement>("[role='progressbar']") ?? null;
  const sculptProgressFill = sculptProgress?.querySelector<HTMLElement>(".sculpt-fill") ?? null;
  const sculptProgressLabel = sculptProgress?.querySelector<HTMLElement>(".sculpt-label") ?? null;
  const sculptProgressDetail = sculptProgress?.querySelector<HTMLElement>(".sculpt-detail") ?? null;
  const manipulatorBar = stage.querySelector<HTMLElement>("[data-assistant-manipulators]");
  const sendControls = Array.from(
    document.querySelectorAll<HTMLElement>("[data-action='assistant-send']"),
  );
  const manipulatorControls = Array.from(
    manipulatorBar?.querySelectorAll<HTMLButtonElement>(
      "[data-action='assistant-manipulator']",
    ) ?? [],
  );
  if (
    shell === null ||
    prompt === null ||
    send === null ||
    status === null ||
    resultView === null ||
    retry === null ||
    manipulatorBar === null ||
    sendControls.length === 0 ||
    !sendControls.includes(send) ||
    !sendControls.includes(retry) ||
    manipulatorControls.length === 0
  ) {
    return false;
  }
  let running = false;
  let assistantRunVersion = 0;
  let recoveryJobId: string | null = null;
  let activeJobId: string | null = null;
  let activeRarityProposalDigest: string | null = null;
  let displayedRarityResultDigest: string | null = null;
  const assistantViewport = createDesktopAssistantViewportController(mounts);
  const setSculptCancelActive = (active: boolean): void => {
    if (sculptCancel === null) return;
    if (active) {
      sculptProgress?.removeAttribute("hidden");
      sculptCancel.dataset.kind = "live";
      sculptCancel.removeAttribute("aria-disabled");
      sculptCancel.removeAttribute("aria-describedby");
      sculptCancel.removeAttribute("data-refusal");
      sculptCancel.classList.remove("is-inert");
      return;
    }
    sculptProgress?.setAttribute("hidden", "");
    sculptCancel.dataset.kind = "inert";
    sculptCancel.setAttribute("aria-disabled", "true");
    sculptCancel.dataset.refusal = DESKTOP_BRIDGE_REFUSALS.assistantJobMismatch;
    sculptCancel.setAttribute(
      "aria-describedby",
      `refusal-${DESKTOP_BRIDGE_REFUSALS.assistantJobMismatch}`,
    );
    sculptCancel.classList.add("is-inert");
  };

  document.addEventListener(DESKTOP_RARITY_PROPOSAL_EVENT, (event: Event) => {
    const invalidation = assistantRarityInvalidation(
      displayedRarityResultDigest,
      (event as CustomEvent).detail,
    );
    if (invalidation !== null) {
      activeRarityProposalDigest = null;
      displayedRarityResultDigest = null;
      resultView.textContent = invalidation.evidenceText;
      resultView.setAttribute("hidden", "");
      retry.removeAttribute("hidden");
      status.textContent = invalidation.status;
      running = false;
      return;
    }
    const settlement = assistantRaritySettlement(
      activeRarityProposalDigest,
      (event as CustomEvent).detail,
    );
    if (settlement === null) return;
    activeRarityProposalDigest = settlement.activeNamespaceDigest;
    const detail = (event as CustomEvent<{
      evidence?: { namespaceDigest?: unknown };
    }>).detail;
    const settledDigest = detail?.evidence?.namespaceDigest;
    displayedRarityResultDigest = settlement.evidenceVisible && typeof settledDigest === "string"
      ? settledDigest
      : null;
    resultView.textContent = settlement.evidenceText;
    if (settlement.evidenceVisible) resultView.removeAttribute("hidden");
    else resultView.setAttribute("hidden", "");
    retry.removeAttribute("hidden");
    status.textContent = settlement.status;
    running = false;
  });

  manipulatorControls.forEach((control) => {
    control.addEventListener("click", () => {
      if (control.getAttribute("aria-disabled") === "true") return;
      assistantViewport.manipulate(control.dataset.value);
    });
  });

  const setBusy = (busy: boolean): void => {
    shell.dataset.assistantBusy = busy ? "true" : "false";
    const thinking = document.querySelector<HTMLElement>("[data-assistant-thinking]");
    if (thinking !== null) {
      if (busy) thinking.removeAttribute("hidden");
      else thinking.setAttribute("hidden", "");
    }
  };

  const refused = (reason: string, message: string): void => {
    running = false;
    setBusy(false);
    const human = reason.includes("KEY_MISSING") || reason.includes("KEY_INVALID")
      ? "Paste your OpenCode key under the prompt, save it, then Send again."
      : reason.includes("KIDS") || message.toLowerCase().includes("kids")
        ? "Flash stays off on Kids. Switch to Game or Website, then Send."
        : reason.includes("OUTPUT_INVALID") || message.toLowerCase().includes("sculpt intake")
          ? "Flash answered, but not with a usable object. Making one locally if you Send again."
          : reason.includes("STATUS_TIMEOUT") || message.toLowerCase().includes("did not finish in time")
            ? "That took too long, so it was stopped. Send again."
            : message;
    status.textContent = human.includes(reason) ? human : `${human} · ${reason}`;
    retry?.removeAttribute("hidden");
  };

  const registeredRequest = (request: unknown): Promise<DesktopBridgeResponse> => {
    const payload = typeof request === "object" && request !== null && "payload" in request
      ? (request as { payload?: { op?: unknown; jobId?: unknown } }).payload
      : undefined;
    if (payload?.op === "status") {
      return port.request({
        action: "command",
        payload: createEditorCommandInvocation("assistant-status", "desktop-control", {}),
      });
    }
    if (payload?.op === "abandon" && typeof payload.jobId === "string") {
      return port.request({
        action: "command",
        payload: createEditorCommandInvocation(
          "assistant-cancel",
          "desktop-control",
          { jobId: payload.jobId },
        ),
      });
    }
    return port.request(request);
  };

  const poll = async (jobId: string): Promise<boolean> => {
    const outcome = await pollJob({
      request: registeredRequest,
      jobId,
      onSnapshot: (job) => {
        const latest = job.latestProgress;
        if (latest !== null) {
          status.textContent = `${latest.percent}% · ${latest.message}`;
          if (job.commandId !== "assistant-local-agent") {
            sculptProgress?.removeAttribute("hidden");
            sculptProgressBar?.setAttribute("aria-valuenow", String(latest.percent));
            if (sculptProgressFill !== null) sculptProgressFill.style.width = `${latest.percent}%`;
            if (sculptProgressLabel !== null) sculptProgressLabel.textContent = latest.message;
            if (sculptProgressDetail !== null) sculptProgressDetail.textContent = latest.phase;
          }
        }
      },
    });
    if (!outcome.ok) {
      recoveryJobId = outcome.retryJobId ?? null;
      refused(outcome.reason, outcome.message);
      activeJobId = null;
      setSculptCancelActive(false);
      return false;
    }
    recoveryJobId = null;
    activeJobId = null;
    setSculptCancelActive(false);
    const job = outcome.job;
    const result = outcome.result;
    activeRarityProposalDigest = assistantRarityResultDigest(result);
    if (isAskAnswerResult(result)) {
      resultView.textContent = assistantInspectionText(job);
      resultView.removeAttribute("hidden");
      retry.removeAttribute("hidden");
      status.textContent = "Ask answered from typed project state · no provider and no saved bytes.";
      running = false;
      setBusy(false);
      return true;
    }
    if (isRarityProposalResult(result)) {
      displayedRarityResultDigest = result.evidence.namespaceDigest;
      const settlement = assistantRarityResultSettlement(result);
      const lifecycleEvent = assistantRarityResultEvent(result);
      if (settlement !== null) {
        if (lifecycleEvent !== null) {
          document.dispatchEvent(
            new CustomEvent(DESKTOP_RARITY_PROPOSAL_EVENT, { detail: lifecycleEvent }),
          );
          const acknowledgementVersion = assistantRunVersion;
          void acknowledgeAssistantRaritySettlement({
            request: (request) => port.request(request),
            jobId: job.jobId,
            active: () => assistantRunVersion === acknowledgementVersion,
          });
        }
        if (!settlement.evidenceVisible) displayedRarityResultDigest = null;
        resultView.textContent = settlement.evidenceText;
        if (settlement.evidenceVisible) resultView.removeAttribute("hidden");
        else resultView.setAttribute("hidden", "");
        retry.removeAttribute("hidden");
        status.textContent = settlement.status;
        running = false;
        setBusy(false);
        return true;
      }
      const replayed = result.replayed;
      resultView.textContent = formatSafeRarityEvidence(result.evidence) ?? "";
      resultView.removeAttribute("hidden");
      retry?.setAttribute("hidden", "");
      document.dispatchEvent(
        new CustomEvent(DESKTOP_RARITY_PROPOSAL_EVENT, {
          detail: lifecycleEvent,
        }),
      );
      status.textContent = replayed
        ? "Identical rarity event replayed · project bytes unchanged, so nothing was staged for review."
        : "Rarity proposal staged · review the canonical diff before Accept or Reject.";
      running = false;
      setBusy(false);
      if (!replayed) {
        const watchedVersion = assistantRunVersion;
        void watchAssistantRaritySettlement({
          request: (request) => port.request(request),
          jobId: job.jobId,
          namespaceDigest: result.evidence.namespaceDigest,
          active: () => assistantRunVersion === watchedVersion,
        }).then((settled) => {
          if (settled === null || assistantRunVersion !== watchedVersion) return;
          const detail = assistantRarityResultEvent(settled);
          if (detail === null) return;
          document.dispatchEvent(
            new CustomEvent(DESKTOP_RARITY_PROPOSAL_EVENT, { detail }),
          );
          void acknowledgeAssistantRaritySettlement({
            request: (request) => port.request(request),
            jobId: job.jobId,
            active: () => assistantRunVersion === watchedVersion,
          });
        });
      }
      return true;
    }
    assistantViewport.replace(result.mountable);
    displayedRarityResultDigest = null;
    backend.frameMountedContent();
    manipulatorBar?.removeAttribute("hidden");
    resultView.textContent = assistantInspectionText(job);
    resultView.removeAttribute("hidden");
    retry?.setAttribute("hidden", "");
    status.textContent =
      "Mounted in the live center viewport · translate/rotate/scale manipulators active · drag to orbit, wheel to zoom.";
    if (persistReadyBuild !== undefined) {
      try {
        status.textContent = await persistReadyBuild();
      } catch (error: unknown) {
        status.textContent = `Mounted · apply failed: ${refusalText(error)}`;
      }
    }
    running = false;
    setBusy(false);
    activeJobId = null;
    setSculptCancelActive(false);
    return true;
  };

  const recoverCurrentJob = async (): Promise<boolean> => {
    let response: Awaited<ReturnType<BridgeGlobal["request"]>>;
    try {
      response = await registeredRequest({ action: "assistant", payload: { op: "status" } });
    } catch {
      return false;
    }
    if (!response.ok) return false;
    const current = response.data;
    if (
      current === null ||
      typeof current !== "object" ||
      !("jobId" in current) ||
      typeof current.jobId !== "string" ||
      current.jobId.length === 0
    ) {
      return false;
    }
    assistantRunVersion += 1;
    recoveryJobId = current.jobId;
    activeJobId = current.jobId;
    setSculptCancelActive(
      "commandId" in current && current.commandId !== "assistant-local-agent",
    );
    activeRarityProposalDigest = null;
    displayedRarityResultDigest = null;
    running = true;
    retry.setAttribute("hidden", "");
    status.textContent = "Recovering retained assistant action…";
    await poll(current.jobId);
    return true;
  };

  const start = async (forceLocalBuild = false): Promise<void> => {
    if (running) return;
    if (recoveryJobId !== null) {
      const jobId = recoveryJobId;
      running = true;
      retry.setAttribute("hidden", "");
      status.textContent = "Recovering assistant action…";
      await poll(jobId);
      return;
    }
    const decision = decideAssistantStart({
      mode: forceLocalBuild ? "build" : shell.dataset.assistantMode,
      route: forceLocalBuild ? "local" : shell.dataset.assistantRoute,
      profile: assistantProfile(shell),
      prompt: forceLocalBuild && prompt.value.trim().length === 0
        ? "Sculpt object"
        : prompt.value,
    });
    if (!decision.ok) {
      refused(decision.reason, decision.message);
      return;
    }
    running = true;
    setBusy(true);
    retry?.setAttribute("hidden", "");
    resultView.setAttribute("hidden", "");
    status.textContent = "Starting assistant action…";
    const commandId = decision.payload.route === "byo"
      ? "assistant-byo-build"
      : decision.payload.mode === "ask"
        ? "assistant-ask"
        : decision.payload.mode === "agent"
          ? "assistant-local-agent"
          : "assistant-local-build";
    const response = commandId === "assistant-ask"
      ? await port.request({
          action: "assistant",
          payload: decision.payload,
        })
      : await port.request({
          action: "command",
          payload: createEditorCommandInvocation(
            commandId,
            "desktop-control",
            commandId === "assistant-local-agent"
              ? {
                  prompt: decision.payload.prompt,
                  profile: decision.payload.profile,
                  documentPath: decision.payload.documentPath ?? DESKTOP_ACTIVE_DOCUMENT_PATH,
                }
              : {
                  prompt: commandId === "assistant-byo-build"
                    ? withAssistantStrengthInstruction(
                        decision.payload.mode,
                        decision.payload.prompt,
                      )
                    : decision.payload.prompt,
                  profile: decision.payload.profile,
                },
          ),
        });
    if (!response.ok) {
      if (
        response.reason === DESKTOP_BRIDGE_REFUSALS.assistantBusy &&
        await recoverCurrentJob()
      ) {
        return;
      }
      refused(response.reason, response.message);
      return;
    }
    const startedJob = response.data as DesktopAssistantJobSnapshot | null;
    if (
      startedJob === null ||
      typeof startedJob !== "object" ||
      typeof startedJob.jobId !== "string" ||
      startedJob.jobId.length === 0
    ) {
      refused(
        DESKTOP_BRIDGE_REFUSALS.assistantJobMissing,
        "The assistant job disappeared; retry the prompt.",
      );
      return;
    }
    assistantRunVersion += 1;
    activeJobId = startedJob.jobId;
    setSculptCancelActive(commandId !== "assistant-local-agent");
    activeRarityProposalDigest = assistantRarityResultDigest(null);
    displayedRarityResultDigest = null;
    const finished = await poll(startedJob.jobId);
    if (!finished && commandId === "assistant-byo-build" && !forceLocalBuild) {
      status.textContent = "Flash did not return a usable object. Making one locally…";
      await start(true);
    }
  };

  sendControls.forEach((control) => {
    control.addEventListener("click", () => {
      if (control.getAttribute("aria-disabled") === "true") return;
      void start().catch((error: unknown) =>
        refused(DESKTOP_BRIDGE_REFUSALS.assistantRuntimeFailed, refusalText(error)),
      );
    });
  });
  sculptStart?.addEventListener("click", () => {
    if (sculptStart.getAttribute("aria-disabled") === "true") return;
    void start(true).catch((error: unknown) =>
      refused(DESKTOP_BRIDGE_REFUSALS.assistantRuntimeFailed, refusalText(error)),
    );
  });
  sculptCancel?.addEventListener("click", () => {
    if (activeJobId === null) {
      refused(
        DESKTOP_BRIDGE_REFUSALS.assistantJobMismatch,
        "Cancel refused because no exact active Sculpt command is retained.",
      );
      return;
    }
    const jobId = activeJobId;
    void registeredRequest({
      action: "assistant",
      payload: { op: "abandon", jobId },
    }).then((response) => {
      if (!response.ok) {
        refused(response.reason, response.message);
        return;
      }
      const snapshot = response.data as DesktopAssistantJobSnapshot;
      if (snapshot.jobId !== jobId || snapshot.terminal === null) {
        refused(
          DESKTOP_BRIDGE_REFUSALS.assistantRuntimeFailed,
          "Cancel returned no terminal result for the exact active Sculpt command.",
        );
        return;
      }
      activeJobId = null;
      setSculptCancelActive(false);
      running = false;
      status.textContent = `${snapshot.terminal.progress.percent}% · ${snapshot.terminal.progress.message}`;
    }).catch((error: unknown) =>
      refused(DESKTOP_BRIDGE_REFUSALS.assistantRuntimeFailed, refusalText(error)),
    );
  });
  running = true;
  void recoverCurrentJob()
    .then((recovered) => {
      if (!recovered) running = false;
    })
    .catch((error: unknown) =>
      refused(DESKTOP_BRIDGE_REFUSALS.assistantRuntimeFailed, refusalText(error)),
    );
  return true;
}

export function installAssistantFlow(services: ViewportServices): void {
  const persistReadyBuild = async (): Promise<string> => {
    const status = await services.request({
      action: "authoring",
      payload: { op: "status", documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH },
    });
    if (!status.ok) return `Mounted · apply skipped: ${status.reason}`;
    const contentHash = (status.data as { contentHash?: unknown }).contentHash;
    if (typeof contentHash !== "string") return "Mounted · apply skipped: no content hash.";
    const apply = await services.request({
      action: "command",
      payload: createEditorCommandInvocation(
        "assistant-apply-build",
        "desktop-control",
        {
          documentPath: DESKTOP_ACTIVE_DOCUMENT_PATH,
          expectedContentHash: contentHash,
        },
        "game",
      ),
    });
    if (!apply.ok) return `Mounted · apply refused: ${apply.reason}`;
    const snapshot = (apply.data as { authoringSnapshot?: unknown }).authoringSnapshot;
    document.dispatchEvent(new CustomEvent(DESKTOP_RARITY_PROPOSAL_EVENT, {
      detail: { snapshot },
    }));
    const accept = await services.request({
      action: "command",
      payload: createEditorCommandInvocation(
        "change-review-accept",
        "desktop-control",
        {},
        "game",
      ),
    });
    if (!accept.ok) return `Mounted and staged · Accept refused: ${accept.reason}`;
    await refreshViewportScene(services);
    return "Mounted and saved into the current scene. The assistant artifact is now part of the game.";
  };
  const assistantBound = installAssistantProductFlow(
    services.stage,
    { request: services.request },
    services.mounts,
    services.backend,
    pollAssistantJob,
    persistReadyBuild,
  );
  signalAssistantRuntime(
    desktopAssistantRuntimeSignal({ status: "mounted", controlsBound: assistantBound }),
  );
}
