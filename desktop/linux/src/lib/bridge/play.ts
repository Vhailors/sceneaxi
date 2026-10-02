import { safeRarityEvidenceFromNamespace } from "@sceneaxi/authoring-core";
import { materializeProjectAssetCopies } from "@sceneaxi/importers";
import { bootstrapOpenPath, resumeOpenPath } from "@sceneaxi/engine-orchestrator";
import {
  EDITOR_COMMAND_REFUSALS,
  RARITY_REFUSE_CODES,
  digestRarityNamespace,
  resetPlaySession,
  setPlayViewportSource,
  startPlaySession,
  stopPlaySession,
  validateRarityNamespace,
  type JsonObject,
  type PhysicsWorldHost,
  type PlaySession,
} from "@sceneaxi/schemas";
import {
  DESKTOP_ACTIVE_DOCUMENT_PATH,
  DESKTOP_BRIDGE_ACTIONS,
  DESKTOP_BRIDGE_REFUSALS,
  bridgeOk,
  bridgeRefuse,
  type DesktopBridgeResponse,
  type DesktopRarityEvidence,
} from "../bridge-contract.js";
import {
  OPEN_PATH_EXERCISE_TICKS,
  type OpenPathExercise,
  type OpenPathRaritySession,
} from "../bridge-contract-play.js";
import { desktopSceneFromDocumentData } from "../desktop-scene.js";
import { field, rarityRefusalReason, SCENE_DOCUMENT_REFUSALS, type DesktopBridgeContext } from "./context.js";

export type DesktopPlayOptions = {
  /** Integer-millisecond clock for the orchestrator host. Injectable for goldens. */
  readonly nowMs?: () => number;
  /** Initialized at the tier boundary; an absent Rapier host refuses rather than using toy. */
  readonly physicsWorldHost?: PhysicsWorldHost;
};

export function createDesktopPlayBridge(
  options: DesktopPlayOptions & Readonly<{ cwd: string }>,
  context: DesktopBridgeContext,
) {
  const nowMs = options.nowMs ?? ((): number => Date.now());
  const { readActiveDocument, containedDocumentPath } = context;
  let playSession: PlaySession | null = null;

  /**
   * Exercise the accepted rarity namespace through its own product session.
   *
   * This is additional to the composed scene's open path, never a replacement
   * for it, so its digests stay in their own record.
   */
  const rarityProductExercise = (
    documentData: Readonly<Record<string, unknown>>,
    rarityValue: unknown,
  ):
    | Readonly<{
        ok: true;
        session?: OpenPathRaritySession;
        evidence?: DesktopRarityEvidence;
      }>
    | Readonly<{ ok: false; reason: string; message: string; detail?: string | null }> => {
    const rarity = validateRarityNamespace(rarityValue);
    if (!rarity.ok) {
      return { ok: false, reason: rarity.code, message: rarity.message, detail: rarity.path };
    }
    const roll = rarity.value.rolls.at(-1);
    if (roll === undefined) {
      return { ok: true };
    }
    const productId = documentData.productId;
    const seed = documentData.seed;
    if (typeof productId !== "string" || !Number.isSafeInteger(seed)) {
      return {
        ok: false,
        reason: DESKTOP_BRIDGE_REFUSALS.requestMalformed,
        message: "The active rarity project has no valid ProductManifest identity.",
      };
    }
    const bootstrapped = bootstrapOpenPath(
      {
        kind: "product",
        productManifest: {
          productId,
          seed: seed as number,
          rarity: rarity.value,
        },
      },
      { nowMs },
    );
    if (!bootstrapped.ok) {
      const reason = rarityRefusalReason(bootstrapped.detail);
      return {
        ok: false,
        reason: reason ?? bootstrapped.reason,
        message: reason === null
          ? bootstrapped.message
          : bootstrapped.detail ?? bootstrapped.message,
        detail: bootstrapped.detail,
      };
    }
    const handle = bootstrapped.value;
    const live = handle.session();
    if (!live.ok) {
      handle.close();
      const reason = rarityRefusalReason(live.detail);
      return {
        ok: false,
        reason: reason ?? live.reason,
        message: reason === null ? live.message : live.detail ?? live.message,
        detail: live.detail,
      };
    }
    let initialDigest: string;
    let save: ReturnType<typeof live.value.save>;
    const tickDigests: string[] = [];
    try {
      const initial = live.value.observe();
      initialDigest = initial.digest;
      live.value.dispatch({
        type: "rarity-roll",
        eventId: roll.eventId,
        request: roll.request,
        ...(roll.providerEvidence === undefined
          ? {}
          : { providerEvidence: roll.providerEvidence }),
      });
      for (let tick = 1; tick <= OPEN_PATH_EXERCISE_TICKS; tick += 1) {
        live.value.advance({ tick, deltaMs: 100 });
        tickDigests.push(live.value.observe().digest);
      }
      save = live.value.save();
    } catch (error) {
      const reason = field(error, "code") ?? field(error, "reason");
      return {
        ok: false,
        reason: typeof reason === "string" ? reason : RARITY_REFUSE_CODES.provenanceMismatch,
        message: "The accepted rarity session could not be replayed exactly.",
      };
    } finally {
      handle.close();
    }
    const resumed = resumeOpenPath({ kind: "product", save }, { nowMs });
    if (!resumed.ok) {
      const reason = rarityRefusalReason(resumed.detail);
      return {
        ok: false,
        reason: reason ?? resumed.reason,
        message: reason === null ? resumed.message : resumed.detail ?? resumed.message,
        detail: resumed.detail,
      };
    }
    const replay = resumed.value.session();
    if (!replay.ok) {
      resumed.value.close();
      const reason = rarityRefusalReason(replay.detail);
      return {
        ok: false,
        reason: reason ?? replay.reason,
        message: reason === null ? replay.message : replay.detail ?? replay.message,
        detail: replay.detail,
      };
    }
    let replayDigest: string;
    try {
      const snapshot = replay.value.observe();
      replayDigest = snapshot.digest;
      if (
        replayDigest !== save.terminalDigest ||
        snapshot.rarity === undefined ||
        digestRarityNamespace(snapshot.rarity) !== digestRarityNamespace(rarity.value)
      ) {
        return {
          ok: false,
          reason: RARITY_REFUSE_CODES.provenanceMismatch,
          message:
            "The resumed rarity session did not reproduce the accepted namespace and terminal digest.",
        };
      }
    } finally {
      resumed.value.close();
    }
    return {
      ok: true,
      session: Object.freeze({
        bootstrap: handle.bootstrap,
        initialDigest,
        tickDigests: Object.freeze(tickDigests),
        replayDigest,
      }),
      ...(roll.providerEvidence === undefined
        ? {}
        : { evidence: safeRarityEvidenceFromNamespace(rarity.value, roll.eventId, seed as number) }),
    };
  };

  const openPathExercise = (payload: unknown): DesktopBridgeResponse => {
    const read = readActiveDocument(payload, SCENE_DOCUMENT_REFUSALS);
    if (!read.ok) return bridgeRefuse(read.reason, read.message);
    const status = read.status;
    const scene = desktopSceneFromDocumentData(status.data);
    if (!scene.ok) return bridgeRefuse(scene.reason, scene.message);
    const recoveryDocumentPath = containedDocumentPath(field(payload, "documentPath"));
    if (recoveryDocumentPath !== null) {
      const recovered = materializeProjectAssetCopies({ projectRoot: options.cwd, documentPath: recoveryDocumentPath });
      if (!recovered.ok) return bridgeRefuse(recovered.reason, recovered.message);
    }

    let raritySession: OpenPathRaritySession | undefined;
    let rarityEvidence: DesktopRarityEvidence | undefined;
    if (status.data.rarity !== undefined) {
      const exercised = rarityProductExercise(status.data, status.data.rarity);
      if (!exercised.ok) {
        return bridgeRefuse(exercised.reason, exercised.message, exercised.detail);
      }
      raritySession = exercised.session;
      if (exercised.evidence !== undefined) rarityEvidence = exercised.evidence;
    }

    const bootstrapped = bootstrapOpenPath(
      { kind: "scene", scene: scene.composed.scene, options: { seed: 20260731 } },
      { nowMs },
    );
    if (!bootstrapped.ok) {
      return bridgeRefuse(bootstrapped.reason, bootstrapped.message, bootstrapped.detail);
    }

    const handle = bootstrapped.value;
    const live = handle.session();
    if (!live.ok) {
      handle.close();
      return bridgeRefuse(live.reason, live.message, live.detail);
    }

    let initialDigest: string;
    let instanceCount: number;
    const tickDigests: string[] = [];
    try {
      const initial = live.value.observe();
      initialDigest = initial.digest;
      instanceCount = initial.instances.length;
      for (let tick = 1; tick <= OPEN_PATH_EXERCISE_TICKS; tick += 1) {
        live.value.advance({ tick, deltaMs: 100 });
        tickDigests.push(live.value.observe().digest);
      }
    } finally {
      handle.close();
    }

    const exercise: OpenPathExercise = Object.freeze({
      bootstrap: handle.bootstrap,
      initialDigest,
      tickDigests: Object.freeze(tickDigests),
      instanceCount,
      mountable: scene.mountable,
      closed: true as const,
      ...(rarityEvidence === undefined ? {} : { rarity: rarityEvidence }),
      ...(raritySession === undefined ? {} : { raritySession }),
    });
    return bridgeOk("open-path", exercise);
  };

  const command = (commandId: string, input: JsonObject): DesktopBridgeResponse => {
    switch (commandId) {
      case "run-play": {
        const documentPath = String(input["documentPath"] ?? DESKTOP_ACTIVE_DOCUMENT_PATH);
        const read = readActiveDocument({ documentPath }, SCENE_DOCUMENT_REFUSALS);
        if (!read.ok) return bridgeRefuse(read.reason, read.message);
        const started = startPlaySession({
          sourceDocumentPath: documentPath,
          sourceContentHash: read.status.contentHash,
          document: read.status.data as never,
        });
        if (!started.ok) return bridgeRefuse(started.reason, started.message);
        const exercised = openPathExercise({ documentPath });
        if (!exercised.ok) return exercised;
        playSession = started.session;
        return bridgeOk("command", Object.freeze({
          ...(typeof exercised.data === "object" && exercised.data !== null
            ? exercised.data as object
            : {}),
          playSession: started.session,
        }));
      }
      case "run-stop": {
        const stopped = stopPlaySession(playSession);
        if (!stopped.ok) return bridgeRefuse(stopped.reason, stopped.message);
        playSession = stopped.session;
        return bridgeOk("command", stopped.session);
      }
      case "run-reset": {
        if (playSession === null) {
          return bridgeRefuse("PLAY_SESSION_MISSING", "No Play session is active.");
        }
        const read = readActiveDocument(
          { documentPath: playSession.sourceDocumentPath },
          SCENE_DOCUMENT_REFUSALS,
        );
        if (!read.ok) return bridgeRefuse(read.reason, read.message);
        if (read.status.contentHash !== playSession.sourceContentHash) {
          return bridgeRefuse(
            "PLAY_SESSION_SOURCE_HASH_MISMATCH",
            "Reset uses the recorded source version; authoring bytes changed after Play started.",
          );
        }
        const reset = resetPlaySession(playSession, read.status.data as never);
        if (!reset.ok) return bridgeRefuse(reset.reason, reset.message);
        playSession = reset.session;
        return bridgeOk("command", reset.session);
      }
      case "play-inspect":
        if (playSession === null) {
          return bridgeRefuse("PLAY_SESSION_MISSING", "No Play session is active.");
        }
        return bridgeOk("command", playSession);
      case "viewport-source-set": {
        const switched = setPlayViewportSource(playSession, String(input["source"]));
        if (!switched.ok) return bridgeRefuse(switched.reason, switched.message);
        playSession = switched.session;
        return bridgeOk("command", switched.session);
      }
      default:
        return bridgeRefuse(EDITOR_COMMAND_REFUSALS.capabilityDenied, `${commandId} has no Play host implementation.`);
    }
  };

  return Object.freeze({
    command,
    handleAction: (action: string, payload: unknown): DesktopBridgeResponse => action === "open-path"
      ? openPathExercise(payload)
      : bridgeRefuse(
          DESKTOP_BRIDGE_REFUSALS.actionUnknown,
          `Unknown bridge action ${JSON.stringify(action)}. Known: ${DESKTOP_BRIDGE_ACTIONS.join(", ")}.`,
        ),
    session: () => playSession,
  });
}
