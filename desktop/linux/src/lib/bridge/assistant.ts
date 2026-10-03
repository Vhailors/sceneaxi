import {
  ASSISTANT_SCULPT_REFUSALS,
  runAssistantSculptAction,
  stageRarityProviderProposal,
  type AssistantSculptProgress,
  type AssistantSculptResult,
  type RarityProviderContributionResult,
} from "@sceneaxi/authoring-core";
import type { DesktopSnapshot } from "@sceneaxi/desktop-shell";
import {
  ASSISTANT_ASK_REFUSALS,
  EDITOR_COMMAND_REFUSALS,
  RARITY_PROVIDER_REQUEST_MAX_CHARS,
  editorCommandTerminalResult,
  isFixtureProviderDescriptor,
  type EditorCommandId,
  type JsonObject,
  type SceneAssistantBuildEntry,
  type SculptArtifact,
} from "@sceneaxi/schemas";
import {
  DESKTOP_ACTIVE_DOCUMENT_PATH,
  DESKTOP_BRIDGE_ACTIONS,
  DESKTOP_BRIDGE_REFUSALS,
  DESKTOP_RARITY_EVENT_ID,
  bridgeOk,
  bridgeRefuse,
  type DesktopBridgeResponse,
} from "../bridge-contract.js";
import {
  DESKTOP_BRIDGE_ASSISTANT_OPS,
  DESKTOP_ASSISTANT_START_MODE_REFUSAL_MESSAGE,
  desktopAssistantStartMode,
  type DesktopBridgeAssistantOp,
  type DesktopAssistantJobSnapshot,
  type DesktopRarityEvidence,
  type DesktopRarityRetirementReason,
} from "../bridge-contract-assistant.js";
import {
  desktopAssistantScene,
  answerDesktopAssistantAsk,
  stageDesktopAssistantBuild,
} from "../desktop-scene.js";
import { DesktopByoRunnerRefusal } from "../byo-configuration.js";
import { field, SCENE_DOCUMENT_REFUSALS, type DesktopBridgeContext, type createRarityResolver } from "./context.js";

export type DesktopAssistantOptions = {
  /** Private privileged local executor; defaults to the deterministic compiler. */
  readonly runLocalAssistant?: (request: DesktopAssistantRunRequest) => Promise<AssistantSculptResult>;
  /** Optional privileged BYOK runner. Credentials never enter this bridge. */
  readonly runByoAssistant?: (request: DesktopAssistantRunRequest) => Promise<AssistantSculptResult>;
  /** Privileged fixture provider. It returns validated input/evidence, never raw output. */
  readonly runRarityProvider?: (
    request: DesktopRarityProviderRunRequest,
  ) => Promise<RarityProviderContributionResult>;
};

export type DesktopAssistantProfile =
  | "@sceneaxi/profile-game"
  | "@sceneaxi/profile-web"
  | "@sceneaxi/profile-kids";

export type DesktopAssistantRunRequest = Readonly<{
  prompt: string;
  profile: DesktopAssistantProfile;
  onProgress: (snapshot: AssistantSculptProgress) => void;
}>;

export type DesktopRarityProviderRunRequest = Readonly<{
  profile: DesktopAssistantProfile;
  /**
   * The operator's own request text reaches the provider only: nothing on this
   * path lets prompt text choose a tier, a candidate, a weight, or an outcome.
   * The checked-in fixture answers the same bytes whatever it says.
   */
  prompt: string;
}>;

function isAssistantOp(value: unknown): value is DesktopBridgeAssistantOp {
  // SAFETY: The owner-defined operation tuple contains only strings; widening it for a string membership test preserves every value.
  return (
    isBoundaryTextValue(value) &&
    (DESKTOP_BRIDGE_ASSISTANT_OPS as readonly string[]).includes(value)
  );
}

function isAssistantProfile(value: unknown): value is DesktopAssistantProfile {
  return (
    value === "@sceneaxi/profile-game" ||
    value === "@sceneaxi/profile-web" ||
    value === "@sceneaxi/profile-kids"
  );
}

export function createDesktopAssistantBridge(
  options: DesktopAssistantOptions,
  context: DesktopBridgeContext & {
    rarityProposalEvidence: DesktopRarityEvidence | null;
    readonly playActive: () => boolean;
    readonly resolveRarityWithKernel: ReturnType<typeof createRarityResolver>;
  },
) {
  const { authoringSession, readActiveDocument, commandTransaction, reconcilePendingAssetImport, resolveRarityWithKernel } = context;
  let assistantSequence = 0;

  let assistantJob: {
    jobId: string;
    commandId: DesktopAssistantJobSnapshot["commandId"];
    route: "local" | "byo";
    status: "running" | "ready" | "refused";
    latestProgress: AssistantSculptProgress | null;
    progressCount: number;
    result?: NonNullable<DesktopAssistantJobSnapshot["result"]>;
    refusal?: NonNullable<DesktopAssistantJobSnapshot["refusal"]>;
  } | null = null;

  let lastReadyBuild: SceneAssistantBuildEntry | null = null;
  let lastReadyArtifact: SculptArtifact | null = null;

  const currentRarityAssistantResult = () => {
    const result = assistantJob?.result;

    return result !== undefined && "kind" in result && result.kind === "rarity-proposal"
      ? result
      : null;
  };

  const updateRarityAssistantAuthoring = (
    snapshot: DesktopSnapshot,
    evidence: DesktopRarityEvidence,
  ) => {
    const result = currentRarityAssistantResult();

    if (
      assistantJob === null ||
      result === null ||
      result.evidence.namespaceDigest !== evidence.namespaceDigest
    ) return;
    assistantJob = {
      ...assistantJob,
      result: Object.freeze({
        ...result,
        authoring: Object.freeze({ ...snapshot, rarityEvidence: evidence }),
      }),
    };
  };

  const retireRarityAssistantResult = (
    evidence: DesktopRarityEvidence,
    reason: DesktopRarityRetirementReason,
  ) => {
    const result = currentRarityAssistantResult();

    if (
      assistantJob === null ||
      result === null ||
      result.evidence.namespaceDigest !== evidence.namespaceDigest
    ) return;
    assistantJob = {
      ...assistantJob,
      result: Object.freeze({
        ...result,
        retirement: Object.freeze({ reason }),
      }),
    };
  };

  /** Newest progress entry and count only; never the accumulated streaming log. */
  const assistantSnapshot = (): DesktopAssistantJobSnapshot | null => {
    if (assistantJob === null) return null;

    const terminalRefusal: AssistantOptionalFields<Pick<Parameters<typeof editorCommandTerminalResult>[0], "refusal">> = {};

    if (assistantJob.refusal !== undefined) terminalRefusal.refusal = assistantJob.refusal.reason;

    const terminal = assistantJob.status === "running"
      ? null
      : editorCommandTerminalResult({
          commandId: assistantJob.commandId,
          jobId: assistantJob.jobId,
          status: assistantJob.status === "ready"
            ? "completed"
            : assistantJob.refusal?.reason === DESKTOP_BRIDGE_REFUSALS.assistantAbandoned
              ? "cancelled"
              : "refused",
          phase: assistantJob.status === "ready"
            ? "ready"
            : assistantJob.refusal?.reason === DESKTOP_BRIDGE_REFUSALS.assistantAbandoned
              ? "cancelled"
              : "refused",
          message: assistantJob.status === "ready"
            ? (assistantJob.latestProgress?.message ?? "The registered assistant command completed.")
            : (assistantJob.refusal?.message ?? "The registered assistant command refused."),
          ...terminalRefusal,
        });

    const optionalSnapshot: AssistantOptionalFields<Pick<DesktopAssistantJobSnapshot, "result" | "refusal">> = {};

    if (assistantJob.result !== undefined) optionalSnapshot.result = assistantJob.result;

    if (assistantJob.refusal !== undefined) optionalSnapshot.refusal = assistantJob.refusal;

    return Object.freeze({
      jobId: assistantJob.jobId,
      commandId: assistantJob.commandId,
      route: assistantJob.route,
      status: assistantJob.status,
      latestProgress: assistantJob.latestProgress,
      progressCount: assistantJob.progressCount,
      terminal,
      ...optionalSnapshot,
    });
  };

  const assistant = (payload: Parameters<typeof field>[0]): DesktopBridgeResponse => {
    const op = field(payload, "op");

    if (!isAssistantOp(op)) {
      return bridgeRefuse(
        DESKTOP_BRIDGE_REFUSALS.assistantOpUnknown,
        `Unknown assistant operation ${JSON.stringify(op)}. Known: ${DESKTOP_BRIDGE_ASSISTANT_OPS.join(", ")}.`,
      );
    }

    if (op === "status") {
      return bridgeOk("assistant", assistantSnapshot());
    }

    if (op === "abandon") {
      const acknowledgedJobId = field(payload, "jobId");

      if (!isProtocolText(acknowledgedJobId) || acknowledgedJobId.length === 0) {
        return bridgeRefuse(
          DESKTOP_BRIDGE_REFUSALS.requestMalformed,
          "assistant abandon requires the exact non-empty jobId returned by start.",
        );
      }

      if (assistantJob?.jobId !== acknowledgedJobId) {
        return bridgeRefuse(
          EDITOR_COMMAND_REFUSALS.activeJobMismatch,
          "Cancel refused because the supplied jobId does not identify the exact active assistant command.",
        );
      }

      const result = currentRarityAssistantResult();

      if (
        result !== null &&
        (result.retirement !== undefined ||
          result.authoring?.phase === "applied" ||
          result.authoring?.phase === "rejected")
      ) {
        const acknowledged = assistantSnapshot();
        assistantJob = null;

        return bridgeOk("assistant", acknowledged);
      }

      if (assistantJob.status === "running") {
        assistantJob.status = "refused";
        assistantJob.refusal = Object.freeze({
          ok: false as const,
          reason: DESKTOP_BRIDGE_REFUSALS.assistantAbandoned,
          message: "The unresolved assistant job was abandoned; Retry may start a fresh job.",
          recoverable: true,
        });
      }

      return bridgeOk("assistant", assistantSnapshot());
    }

    const prompt = field(payload, "prompt");
    const profile = field(payload, "profile");
    const route = field(payload, "route");
    const mode = field(payload, "mode");
    const startMode = mode === undefined ? "build" : desktopAssistantStartMode(mode);

    if (startMode === null) {
      return bridgeRefuse(
        DESKTOP_BRIDGE_REFUSALS.assistantBuildModeRequired,
        DESKTOP_ASSISTANT_START_MODE_REFUSAL_MESSAGE,
      );
    }

    if (
      !isProtocolText(prompt) ||
      prompt.trim().length === 0 ||
      !isAssistantProfile(profile) ||
      (route !== "local" && route !== "byo" && route !== "hosted")
    ) {
      return bridgeRefuse(
        DESKTOP_BRIDGE_REFUSALS.requestMalformed,
        "assistant start requires a non-empty prompt, a SceneAxi profile, and route local, byo, or hosted.",
      );
    }

    if (profile === "@sceneaxi/profile-kids") {
      return bridgeRefuse(
        ASSISTANT_SCULPT_REFUSALS.kidsDenied,
        "The desktop assistant is denied for Kids before local generation, BYOK dispatch, or hosted routing.",
      );
    }

    if (route === "hosted" && startMode !== "ask") {
      return bridgeRefuse(
        DESKTOP_BRIDGE_REFUSALS.assistantHostedMeteringUnavailable,
        "Hosted AI is metered through the web-shell assistant panel; the desktop has no identity or credit plane and cannot bypass that gate.",
      );
    }

    const rarityMode = startMode === "agent";
    const askMode = startMode === "ask";

    if (rarityMode && (route !== "local" || options.runRarityProvider === undefined)) {
      return bridgeRefuse(
        DESKTOP_BRIDGE_REFUSALS.rarityProviderUnavailable,
        "The checked-in rarity fixture provider is available only through the local privileged host path.",
      );
    }

    if (!rarityMode && !askMode && route === "byo" && options.runByoAssistant === undefined) {
      return bridgeRefuse(
        DESKTOP_BRIDGE_REFUSALS.assistantByoUnavailable,
        "No BYOK Model Provider Port is configured for this desktop session. Local remains free and available.",
      );
    }

    const currentRarityResult = currentRarityAssistantResult();

    const raritySettlementPending = currentRarityResult !== null &&
      (currentRarityResult.retirement !== undefined ||
        currentRarityResult.authoring?.phase === "applied" ||
        currentRarityResult.authoring?.phase === "rejected");

    if (
      assistantJob?.status === "running" ||
      context.rarityProposalEvidence !== null ||
      raritySettlementPending
    ) {
      return bridgeRefuse(
        DESKTOP_BRIDGE_REFUSALS.assistantBusy,
        context.rarityProposalEvidence !== null
          ? "A rarity proposal is still waiting for Accept or Reject; settle it before starting another assistant job."
          : raritySettlementPending
            ? "The settled rarity job has not been acknowledged; read and acknowledge it before starting another assistant job."
            : "An assistant job is already running; poll its status before retrying.",
      );
    }

    let rarityDocument:
      | Readonly<{ documentPath: string; contentHash: string; data: NonNullable<Extract<ReturnType<typeof readActiveDocument>, { ok: true }>["status"]>["data"] }>
      | undefined;

    if (rarityMode) {
      const read = readActiveDocument(payload, {
        missingMessage: "A rarity assistant action requires a documentPath inside the project directory.",
        unreadableReason: DESKTOP_BRIDGE_REFUSALS.requestMalformed,
      });

      if (!read.ok) return bridgeRefuse(read.reason, read.message);
      rarityDocument = Object.freeze({
        documentPath: read.status.documentPath,
        contentHash: read.status.contentHash,
        data: read.status.data,
      });
    }

    // Install before dispatch so synchronous progress belongs to this job;
    // retain the previous job for a runner that never dispatches.
    const previousJob = assistantJob;
    assistantSequence += 1;

    const commandId = askMode
      ? "assistant-ask"
      : rarityMode
        ? "assistant-local-agent"
        : route === "byo"
          ? "assistant-byo-build"
          : "assistant-local-build";

    assistantJob = {
      jobId: `desktop-assistant-${String(assistantSequence)}`,
      commandId,
      route: route === "byo" && !askMode ? "byo" : "local",
      status: "running",
      latestProgress: null,
      progressCount: 0,
    };
    const activeJob = assistantJob;

    const onProgress = (snapshot: AssistantSculptProgress): void => {
      if (assistantJob !== activeJob || activeJob.status !== "running") return;
      activeJob.latestProgress = snapshot;
      activeJob.progressCount += 1;
    };

    const trimmedPrompt = prompt.trim();

    const request: DesktopAssistantRunRequest = {
      prompt: rarityMode
        ? trimmedPrompt.slice(0, RARITY_PROVIDER_REQUEST_MAX_CHARS)
        : trimmedPrompt,
      profile,
      onProgress,
    };

    // Provider detail may carry credentials, including Agent under route local.
    const detailIsOurs = route === "local" && !rarityMode && !askMode;

    const settleRefusal = (refusal: Readonly<{
      reason: string;
      message: string;
      recoverable: boolean;
      detail?: string;
    }>): void => {
      if (assistantJob !== activeJob || activeJob.status !== "running") return;
      activeJob.status = "refused";
      const optionalDetail: AssistantOptionalFields<Pick<typeof refusal, "detail">> = {};

      if (detailIsOurs && refusal.detail !== undefined) optionalDetail.detail = refusal.detail;
      activeJob.refusal = Object.freeze({
        ok: false as const,
        reason: refusal.reason,
        message: refusal.message,
        recoverable: refusal.recoverable,
        ...optionalDetail,
      });
    };

    const settleRuntimeFailure = (error: Parameters<NonNullable<Parameters<Promise<never>["catch"]>[0]>>[0]): void => {
      const byoRefusal = route === "byo" && error instanceof DesktopByoRunnerRefusal
        ? error
        : null;

      settleRefusal({
        reason: byoRefusal?.reason ?? DESKTOP_BRIDGE_REFUSALS.assistantRuntimeFailed,
        message: byoRefusal?.message ?? "The configured assistant runner failed.",
        recoverable: true,
        detail: error instanceof Error ? error.message : String(error),
      });
    };

    if (askMode) {
      const read = readActiveDocument(
        { documentPath: field(payload, "documentPath") ?? DESKTOP_ACTIVE_DOCUMENT_PATH },
        {
          missingMessage: "Ask requires a documentPath inside the project directory.",
          unreadableReason: ASSISTANT_ASK_REFUSALS.staleVersion,
        },
      );

      if (!read.ok) {
        settleRefusal({ reason: read.reason, message: read.message, recoverable: true });

        return bridgeOk("assistant", assistantSnapshot());
      }

      const asked = answerDesktopAssistantAsk({
        documentData: read.status.data,
        sourceContentHash: read.status.contentHash,
        profile,
        prompt: trimmedPrompt,
        scope: field(payload, "scope") ?? "document",
        playActive: context.playActive(),
      });

      if (!asked.ok) {
        settleRefusal({ reason: asked.reason, message: asked.message, recoverable: true });

        return bridgeOk("assistant", assistantSnapshot());
      }

      onProgress(Object.freeze({
        phase: "ready",
        percent: 100,
        message: "Ask answered from the explicit project inspection scope.",
      }));
      activeJob.status = "ready";
      activeJob.result = Object.freeze({ ok: true as const, ...asked.answer });

      return bridgeOk("assistant", assistantSnapshot());
    }

    if (rarityMode && rarityDocument !== undefined && options.runRarityProvider !== undefined) {
      onProgress(Object.freeze({
        phase: "waiting-provider",
        percent: 20,
        message:
          "Requesting bounded rarity policy and candidate input from the fixture provider. Your request is carried to the provider, but the checked-in fixture answers the same bounded input whatever it says.",
      }));

      const stageRarity = (contribution: RarityProviderContributionResult): void => {
        if (assistantJob !== activeJob || activeJob.status !== "running") return;

        if (!contribution.ok) {
          settleRefusal({ reason: contribution.reason, message: contribution.message, recoverable: true });

          return;
        }

        onProgress(Object.freeze({
          phase: "validating-artifact",
          percent: 70,
          message: "Validating canonical rarity bytes and authoritative kernel resolution.",
        }));
        const current = authoringSession().status(rarityDocument.documentPath);

        if (!current.ok || current.contentHash !== rarityDocument.contentHash) {
          settleRefusal({
            reason: "content-hash-conflict",
            message: "The Scene Document changed while rarity input was being prepared; reopen and retry.",
            recoverable: true,
          });

          return;
        }

        const staged = stageRarityProviderProposal({
          documentData: current.data,
          documentPath: rarityDocument.documentPath,
          expectedContentHash: rarityDocument.contentHash,
          profile,
          eventId: DESKTOP_RARITY_EVENT_ID,
          contribution: contribution.value,
          resolve: resolveRarityWithKernel,
        });

        if (!staged.ok) {
          settleRefusal({ reason: staged.reason, message: staged.message, recoverable: true });

          return;
        }

        if (staged.replayed) {
          onProgress(Object.freeze({
            phase: "ready",
            percent: 100,
            message: "The identical rarity event replayed without changing project bytes.",
          }));
          activeJob.status = "ready";
          activeJob.result = Object.freeze({
            ok: true as const,
            kind: "rarity-proposal" as const,
            replayed: true as const,
            providerClass: "fixture" as const,
            evidence: staged.evidence,
          });

          return;
        }

        const snapshot = authoringSession().proposeEdit(staged.edit);

        if (snapshot.phase !== "reviewing" || (snapshot.diagnostics?.length ?? 0) > 0) {
          const diagnostic = snapshot.diagnostics?.[0];
          settleRefusal({
            reason: diagnostic?.code ?? "RARITY_PROPOSAL_NOT_REVIEWING",
            message: diagnostic?.message ?? "The rarity proposal did not reach Change Review.",
            recoverable: true,
          });

          return;
        }

        context.rarityProposalEvidence = staged.evidence;
        onProgress(Object.freeze({
          phase: "ready",
          percent: 100,
          message: "The canonical rarity proposal is waiting in Change Review.",
        }));
        activeJob.status = "ready";
        activeJob.result = Object.freeze({
          ok: true as const,
          kind: "rarity-proposal" as const,
          replayed: false as const,
          providerClass: "fixture" as const,
          evidence: staged.evidence,
          authoring: Object.freeze({ ...snapshot, rarityEvidence: staged.evidence }),
        });
      };

      try {
        void options.runRarityProvider({ profile, prompt: request.prompt })
          .then(stageRarity)
          .catch(settleRuntimeFailure);
      } catch (error) {
        settleRuntimeFailure(error);
      }

      return bridgeOk("assistant", assistantSnapshot());
    }

    let running: Promise<AssistantSculptResult> | undefined;

    try {
      running = route === "local"
        ? options.runLocalAssistant !== undefined
          ? options.runLocalAssistant(request)
          : runAssistantSculptAction({
              route: "local",
              prompt: request.prompt,
              profile: request.profile,
              onProgress,
            })
        : options.runByoAssistant?.(request);
    } catch (error) {
      settleRuntimeFailure(error);

      return bridgeOk("assistant", assistantSnapshot());
    }

    if (running === undefined) {
      assistantJob = previousJob;

      return bridgeRefuse(
        DESKTOP_BRIDGE_REFUSALS.assistantByoUnavailable,
        "No BYOK Model Provider Port dispatched this desktop assistant job, so no work started. Local remains free and available.",
      );
    }

    void running.then(
      (result) => {
        if (assistantJob !== activeJob || activeJob.status !== "running") return;

        if (result.ok) {
          if (isFixtureProviderDescriptor(result.providerEvidence?.model ?? {})) {
            settleRefusal({
              reason: ASSISTANT_ASK_REFUSALS.fixtureNotCloud,
              message: "The checked-in rarity fixture cannot stand in for a configured cloud provider.",
              recoverable: false,
            });

            return;
          }

          const providerModel = result.providerEvidence?.model;
          lastReadyBuild = Object.freeze({
            buildId: activeJob.jobId,
            artifactDigest: result.artifactDigest,
            providerClass: result.route === "byo" ? "configured" as const : "none" as const,
            model: providerModel?.model ?? "sceneaxi-local-compiler",
            provider: providerModel?.provider ?? "sceneaxi-local",
            version: providerModel?.version ?? "local",
            fallbackPolicy: "none" as const,
          });
          lastReadyArtifact = result.artifact;
          activeJob.status = "ready";
          const optionalProvider: AssistantOptionalFields<Pick<typeof result, "providerEvidence">> = {};

          if (result.providerEvidence !== undefined) optionalProvider.providerEvidence = result.providerEvidence;
          activeJob.result = Object.freeze({
            ok: true as const,
            route: result.route,
            artifactBytes: result.artifactBytes,
            artifactDigest: result.artifactDigest,
            inspection: result.inspection,
            mountable: desktopAssistantScene(result.artifact),
            providerClass: lastReadyBuild.providerClass === "configured" ? "configured" as const : "none" as const,
            fallbackPolicy: "none" as const,
            ...optionalProvider,
          });
        } else {
          settleRefusal(result);
        }
      },
      settleRuntimeFailure,
    );

    return bridgeOk("assistant", assistantSnapshot());
  };

  const command = (commandId: EditorCommandId, input: JsonObject): DesktopBridgeResponse => {
    switch (commandId) {
      case "assistant-ask": {
        const documentPath = String(input["documentPath"]);

        const read = readActiveDocument({ documentPath }, {
          missingMessage: "Ask requires a documentPath inside the project directory.",
          unreadableReason: ASSISTANT_ASK_REFUSALS.staleVersion,
        });

        if (!read.ok) return bridgeRefuse(read.reason, read.message);

        if (read.status.contentHash !== String(input["expectedContentHash"])) {
          return bridgeRefuse(
            ASSISTANT_ASK_REFUSALS.staleVersion,
            "Ask names the exact project version being inspected.",
          );
        }

        const asked = answerDesktopAssistantAsk({
          documentData: read.status.data,
          sourceContentHash: read.status.contentHash,
          profile: input["profile"],
          prompt: String(input["prompt"]),
          scope: input["scope"],
          playActive: context.playActive(),
        });

        if (!asked.ok) return commandTransaction(commandId, bridgeRefuse(asked.reason, asked.message));

        return bridgeOk("command", asked.answer);
      }

      case "assistant-apply-build": {
        const documentPath = String(input["documentPath"]);
        const read = readActiveDocument({ documentPath }, SCENE_DOCUMENT_REFUSALS);

        if (!read.ok) return bridgeRefuse(read.reason, read.message);

        if (lastReadyBuild === null) {
          return commandTransaction(commandId, bridgeRefuse(
            DESKTOP_BRIDGE_REFUSALS.assistantJobMissing,
            "Apply Build requires a validated assistant Build artifact from this session.",
          ));
        }

        if (isFixtureProviderDescriptor(lastReadyBuild)) {
          return commandTransaction(commandId, bridgeRefuse(
            ASSISTANT_ASK_REFUSALS.fixtureNotCloud,
            "The checked-in rarity fixture cannot stand in for a configured cloud provider or a Build artifact.",
          ));
        }

        const buildInput: AssistantBuildInput = {
          documentData: read.status.data,
          contentHash: String(input["expectedContentHash"]),
          documentPath,
          entry: lastReadyBuild,
          };

        if (lastReadyArtifact !== null) buildInput.artifact = lastReadyArtifact;
        const staged = stageDesktopAssistantBuild(buildInput);

        if (!staged.ok) {
          return commandTransaction(commandId, bridgeRefuse(staged.reason, staged.message));
        }

        const proposed = reconcilePendingAssetImport(authoringSession().proposeEdit({
          documentPath,
          jsonPointer: "/data",
          expectedContentHash: String(input["expectedContentHash"]),
          newValue: staged.documentData,
        }));

        return commandTransaction(commandId, bridgeOk("command", {
          catalog: staged.catalog,
          authoringSnapshot: proposed,
        }));
      }

      case "assistant-local-build":
        return assistant({ op: "start", route: "local", mode: "build", ...input });
      case "assistant-byo-build":
        return assistant({ op: "start", route: "byo", mode: "build", ...input });
      case "assistant-local-agent":
        return assistant({ op: "start", route: "local", mode: "agent", ...input });
      case "assistant-status":
        return assistant({ op: "status" });
      case "assistant-cancel":
        return assistant({ op: "abandon", jobId: input["jobId"] });
      default:
        return bridgeRefuse(EDITOR_COMMAND_REFUSALS.capabilityDenied, `${commandId} has no assistant host implementation.`);
    }
  };

  return Object.freeze({
    command,
    handleAction: (action: string, payload: Parameters<typeof field>[0]): DesktopBridgeResponse => action === "assistant"
      ? assistant(payload)
      : bridgeRefuse(
          DESKTOP_BRIDGE_REFUSALS.actionUnknown,
          `Unknown bridge action ${JSON.stringify(action)}. Known: ${DESKTOP_BRIDGE_ACTIONS.join(", ")}.`,
        ),
    currentRarityAssistantResult,
    updateRarityAssistantAuthoring,
    retireRarityAssistantResult,
  });
}

function isProtocolText<Value>(value: Value): value is Value & (string) {
  return typeof value === "string";
}

type AssistantOptionalFields<Owner> = { -readonly [Key in keyof Owner]?: Exclude<Owner[Key], undefined> };

type AssistantBuildInput = { -readonly [Key in keyof Parameters<typeof stageDesktopAssistantBuild>[0]]: Parameters<typeof stageDesktopAssistantBuild>[0][Key] };

function isBoundaryTextValue<Input>(value: Input): value is Input & string {
  return typeof value === "string";
}
