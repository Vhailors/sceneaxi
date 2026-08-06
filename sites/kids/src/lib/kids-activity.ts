/**
 * The first-release Kids activity is deliberately tiny and local.
 *
 * This file has one byte-identical twin across the profile/site isolation seam.
 * The duplication is load-bearing: the isolated Kids site may not import the
 * profile package, while the parity test prevents the two closed action tables
 * from drifting. Keep both copies in lockstep.
 */

export const KIDS_ACTIVITY_VERSION = 1 as const;
export const KIDS_ACTIVITY_PIECE_LIMIT = 6 as const;

function freezeRows<const T extends readonly Readonly<Record<string, unknown>>[]>(
  rows: T,
): T {
  for (const row of rows) Object.freeze(row);
  return Object.freeze(rows);
}

export const KIDS_ACTIVITY_WORLDS = freezeRows([
  {
    id: "meadow",
    label: "Sunny meadow",
    prompt: "A bright place for a tiny adventure.",
    symbol: "☀️",
  },
  {
    id: "moon",
    label: "Moon camp",
    prompt: "A quiet camp under a starry sky.",
    symbol: "🌙",
  },
  {
    id: "ocean",
    label: "Coral cove",
    prompt: "A blue world beneath the waves.",
    symbol: "🌊",
  },
] as const);

export const KIDS_ACTIVITY_PIECES = freezeRows([
  { id: "friend", label: "Friend", symbol: "🐙" },
  { id: "tree", label: "Tree", symbol: "🌳" },
  { id: "star", label: "Star", symbol: "⭐" },
  { id: "rocket", label: "Rocket", symbol: "🚀" },
] as const);

export const KIDS_ACTIVITY_ACTIONS = Object.freeze([
  "world.choose",
  "piece.add",
  "piece.undo",
  "scene.reset",
  "play.start",
  "play.stop",
] as const);

export type KidsActivityWorldId = (typeof KIDS_ACTIVITY_WORLDS)[number]["id"];
export type KidsActivityPieceId = (typeof KIDS_ACTIVITY_PIECES)[number]["id"];
export type KidsActivityAction = (typeof KIDS_ACTIVITY_ACTIONS)[number];

export type KidsActivityRequest =
  | Readonly<{ action: "world.choose"; worldId: KidsActivityWorldId }>
  | Readonly<{ action: "piece.add"; pieceId: KidsActivityPieceId }>
  | Readonly<{ action: "piece.undo" }>
  | Readonly<{ action: "scene.reset" }>
  | Readonly<{ action: "play.start" }>
  | Readonly<{ action: "play.stop" }>;

export type KidsActivityState = Readonly<{
  version: typeof KIDS_ACTIVITY_VERSION;
  worldId: KidsActivityWorldId;
  pieceIds: readonly KidsActivityPieceId[];
  mode: "build" | "play";
  revision: number;
}>;

export const KIDS_ACTIVITY_REFUSE_REASONS = Object.freeze({
  stateInvalid: "KIDS_ACTIVITY_STATE_INVALID",
  requestInvalid: "KIDS_ACTIVITY_REQUEST_INVALID",
  actionUnsupported: "KIDS_ACTIVITY_ACTION_UNSUPPORTED",
  curatedChoiceRequired: "KIDS_ACTIVITY_CURATED_CHOICE_REQUIRED",
  sceneFull: "KIDS_ACTIVITY_SCENE_FULL",
  sceneEmpty: "KIDS_ACTIVITY_SCENE_EMPTY",
  buildPaused: "KIDS_ACTIVITY_BUILD_PAUSED_WHILE_PLAYING",
  alreadyPlaying: "KIDS_ACTIVITY_ALREADY_PLAYING",
  alreadyStopped: "KIDS_ACTIVITY_ALREADY_STOPPED",
} as const);

type KidsActivityRefuseReason =
  (typeof KIDS_ACTIVITY_REFUSE_REASONS)[keyof typeof KIDS_ACTIVITY_REFUSE_REASONS];

export type KidsActivityDecision =
  | Readonly<{
      ok: true;
      action: KidsActivityAction;
      state: KidsActivityState;
      message: string;
    }>
  | Readonly<{
      ok: false;
      action: string | null;
      reason: KidsActivityRefuseReason;
      message: string;
    }>;

const worldIds = new Set<string>(KIDS_ACTIVITY_WORLDS.map((world) => world.id));
const pieceIds = new Set<string>(KIDS_ACTIVITY_PIECES.map((piece) => piece.id));
const actionIds = new Set<string>(KIDS_ACTIVITY_ACTIONS);
const issuedStates = new WeakSet<object>();

function issueState(
  worldId: KidsActivityWorldId,
  pieceIdsValue: readonly KidsActivityPieceId[],
  mode: KidsActivityState["mode"],
  revision: number,
): KidsActivityState {
  const state = Object.freeze({
    version: KIDS_ACTIVITY_VERSION,
    worldId,
    pieceIds: Object.freeze([...pieceIdsValue]),
    mode,
    revision,
  });
  issuedStates.add(state);
  return state;
}

export function createKidsActivityState(): KidsActivityState {
  return issueState("meadow", [], "build", 0);
}

function ownDataValue(value: object, key: "action" | "worldId" | "pieceId") {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined) return { ok: true as const, value: undefined };
    if (!("value" in descriptor)) return { ok: false as const };
    return { ok: true as const, value: descriptor.value };
  } catch {
    return { ok: false as const };
  }
}

function inspectRequest(request: unknown) {
  try {
    if (typeof request !== "object" || request === null || Array.isArray(request)) {
      return undefined;
    }
    const action = ownDataValue(request, "action");
    if (!action.ok) return undefined;
    return { request, action: action.value };
  } catch {
    return undefined;
  }
}

function refuse(
  action: string | null,
  reason: KidsActivityRefuseReason,
  message: string,
): KidsActivityDecision {
  return Object.freeze({ ok: false, action, reason, message });
}

function accept(
  action: KidsActivityAction,
  state: KidsActivityState,
  message: string,
): KidsActivityDecision {
  return Object.freeze({ ok: true, action, state, message });
}

/**
 * Apply one action from the closed, curated first-release table.
 *
 * Unknown actions all receive the same child-facing refusal. The decision never
 * describes accounts, money, catalogs, providers, or any other non-Kids plane.
 */
export function applyKidsActivityAction(
  state: KidsActivityState,
  request: unknown,
): KidsActivityDecision {
  if (typeof state !== "object" || state === null || !issuedStates.has(state)) {
    return refuse(
      null,
      KIDS_ACTIVITY_REFUSE_REASONS.stateInvalid,
      "This world needs a fresh start.",
    );
  }

  const inspected = inspectRequest(request);
  if (inspected === undefined || typeof inspected.action !== "string") {
    return refuse(
      null,
      KIDS_ACTIVITY_REFUSE_REASONS.requestInvalid,
      "That choice did not work. Try one of the big buttons.",
    );
  }

  const action = inspected.action;
  if (!actionIds.has(action)) {
    return refuse(
      null,
      KIDS_ACTIVITY_REFUSE_REASONS.actionUnsupported,
      "That tool is not part of this play space.",
    );
  }

  if (action === "play.start") {
    if (state.mode === "play") {
      return refuse(
        action,
        KIDS_ACTIVITY_REFUSE_REASONS.alreadyPlaying,
        "Your world is already playing.",
      );
    }
    return accept(
      action,
      issueState(state.worldId, state.pieceIds, "play", state.revision + 1),
      "Your world is playing!",
    );
  }

  if (action === "play.stop") {
    if (state.mode === "build") {
      return refuse(
        action,
        KIDS_ACTIVITY_REFUSE_REASONS.alreadyStopped,
        "Your world is already still.",
      );
    }
    return accept(
      action,
      issueState(state.worldId, state.pieceIds, "build", state.revision + 1),
      "Play stopped. You can build again.",
    );
  }

  if (state.mode === "play") {
    return refuse(
      action,
      KIDS_ACTIVITY_REFUSE_REASONS.buildPaused,
      "Stop play before changing your world.",
    );
  }

  if (action === "scene.reset") {
    return accept(action, issueState("meadow", [], "build", state.revision + 1), "Fresh world ready.");
  }

  if (action === "piece.undo") {
    if (state.pieceIds.length === 0) {
      return refuse(
        action,
        KIDS_ACTIVITY_REFUSE_REASONS.sceneEmpty,
        "Your world is already clear. Add a piece first.",
      );
    }
    return accept(
      action,
      issueState(state.worldId, state.pieceIds.slice(0, -1), "build", state.revision + 1),
      "Last piece removed.",
    );
  }

  if (action === "world.choose") {
    const world = ownDataValue(inspected.request, "worldId");
    if (!world.ok || typeof world.value !== "string" || !worldIds.has(world.value)) {
      return refuse(
        action,
        KIDS_ACTIVITY_REFUSE_REASONS.curatedChoiceRequired,
        "Pick one of the worlds shown here.",
      );
    }
    return accept(
      action,
      issueState(world.value as KidsActivityWorldId, state.pieceIds, "build", state.revision + 1),
      "New world chosen.",
    );
  }

  const piece = ownDataValue(inspected.request, "pieceId");
  if (!piece.ok || typeof piece.value !== "string" || !pieceIds.has(piece.value)) {
    return refuse(
      action,
      KIDS_ACTIVITY_REFUSE_REASONS.curatedChoiceRequired,
      "Pick one of the pieces shown here.",
    );
  }
  if (state.pieceIds.length >= KIDS_ACTIVITY_PIECE_LIMIT) {
    return refuse(
      action,
      KIDS_ACTIVITY_REFUSE_REASONS.sceneFull,
      "Your world is full. Undo one thing to add another.",
    );
  }
  return accept(
    action as KidsActivityAction,
    issueState(
      state.worldId,
      [...state.pieceIds, piece.value as KidsActivityPieceId],
      "build",
      state.revision + 1,
    ),
    "Piece added.",
  );
}
