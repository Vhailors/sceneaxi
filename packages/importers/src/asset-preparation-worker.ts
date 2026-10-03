/** Node-only preparation adapter. No writes, apply authority, or canonical compaction. */
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import { isAbsolute, join, normalize, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { types } from "node:util";
import { isJsonObject } from "@sceneaxi/schemas";
import {
  projectAssetPreparationBaseHash,
  proposeProjectAssetImport,
  verifyPreparedProjectAssetImport,
  type ProjectAssetProposalResult,
  type ContainedGltfRefusal,
} from "./contained-gltf.js";

export const ASSET_PREPARATION_DEADLINE_MS = 4000;

export const ASSET_PREPARATION_REFUSALS = Object.freeze({
  cancelled: "ASSET_PREPARATION_CANCELLED",
  deadline: "ASSET_PREPARATION_DEADLINE",
  unavailable: "ASSET_PREPARATION_UNAVAILABLE",
  busy: "ASSET_PREPARATION_BUSY",
  kidsDenied: "ASSET_PREPARATION_KIDS_DENIED",
  inputInvalid: "ASSET_PREPARATION_INPUT_INVALID",
} as const);

type PreparationBoundaryInput = Parameters<typeof isJsonObject>[0];

type ImportInput = Parameters<typeof proposeProjectAssetImport>[0];

export type ProjectAssetPreparationInput = ImportInput & Readonly<{ profile: "game" | "web" | "kids" }>;

export type ProjectAssetPreparationOutcome = Readonly<{
  generation: number;
  prepared: Extract<ProjectAssetProposalResult, { ok: true }>;
  ok: true;
}> | Readonly<{
  generation: number;
  ok: false;
  reason: typeof ASSET_PREPARATION_REFUSALS[keyof typeof ASSET_PREPARATION_REFUSALS] | ContainedGltfRefusal;
}>;

export type ProjectAssetPreparationJob = Readonly<{
  generation: number;
  result: Promise<ProjectAssetPreparationOutcome>;
  /** Resolves only after worker exit; the identical result remains terminal. */
  cancel(): Promise<ProjectAssetPreparationOutcome>;
}>;

type WorkerMessage = Readonly<{
  generation: number;
  prepared: ProjectAssetProposalResult;
  baseContentHash: string;
}>;

type ProjectAssetPreparationHost = Readonly<{ createWorker: (entry: URL, options: ConstructorParameters<typeof Worker>[1]) => Worker }>;

const projectAssetPreparationHost: ProjectAssetPreparationHost = Object.freeze({ createWorker: (entry, options) => new Worker(entry, options) });

let active = false;

let generation = 0;

/** One bounded worker in this process. Desktop retains profile, lease and E1 authority. */
export function startProjectAssetPreparation(input: PreparationBoundaryInput, host: ProjectAssetPreparationHost = projectAssetPreparationHost): ProjectAssetPreparationJob {
  const id = ++generation;

  const refusal = (reason: typeof ASSET_PREPARATION_REFUSALS[keyof typeof ASSET_PREPARATION_REFUSALS]): ProjectAssetPreparationOutcome =>
    Object.freeze({ ok: false, generation: id, reason });

  const immediate = (outcome: ProjectAssetPreparationOutcome): ProjectAssetPreparationJob => {
    const result = Promise.resolve(outcome);

    return Object.freeze({ generation: id, result, cancel: () => result });
  };

  if (!validPreparationInput(input)) return immediate(refusal(ASSET_PREPARATION_REFUSALS.inputInvalid));

  if (input.profile !== "game" && input.profile !== "web") return immediate(refusal(ASSET_PREPARATION_REFUSALS.kidsDenied));

  if (active) return immediate(refusal(ASSET_PREPARATION_REFUSALS.busy));

  // Copy scalars only: no user-supplied executable, callbacks or worker options.
  const request: ImportRequestBuilder = {
    projectRoot: input.projectRoot,
    documentPath: input.documentPath,
    sourcePath: input.sourcePath,
  };

  if (input.assetId !== undefined) request.assetId = input.assetId;

  if (input.hotReload !== undefined) request.hotReload = input.hotReload;

  let worker: Worker;

  try {
    // Stock tsc ESM uses its built sibling; packaged Electron CJS uses a fixed
      // source-bound bundle beside main.cjs. Renderer input cannot choose an entry.
      const entry = (typeof __dirname !== "undefined" && isBoundaryString(__dirname))
        ? pathToFileURL(join(__dirname, "asset-preparation-worker.cjs"))
        : new URL("./asset-preparation-worker.js", import.meta.url);

      worker = host.createWorker(entry, {
      workerData: { generation: id, input: request },
      resourceLimits: { maxOldGenerationSizeMb: 512, stackSizeMb: 4 },
    });
  } catch {
    return immediate(refusal(ASSET_PREPARATION_REFUSALS.unavailable));
  }

  active = true;
  let terminal = false;
  let received = false;
  const publication = new AbortController();
  let verification: Promise<void> = Promise.resolve();
  let finish: (outcome: ProjectAssetPreparationOutcome) => void = () => undefined;
  const result = new Promise<ProjectAssetPreparationOutcome>(resolve => { finish = resolve; });

  const settle = (outcome: ProjectAssetPreparationOutcome) => {
    if (terminal) return;

    // Fence synchronously BEFORE awaiting termination or allowing a late message.
    terminal = true;
    publication.abort();
    clearTimeout(timer);
    void Promise.all([worker.terminate(), verification]).then(() => {
      active = false;
      finish(outcome);
    }, () => {
      active = false;
      finish(refusal(ASSET_PREPARATION_REFUSALS.unavailable));
    });
  };

  const timer = setTimeout(() => settle(refusal(ASSET_PREPARATION_REFUSALS.deadline)), ASSET_PREPARATION_DEADLINE_MS);
  worker.once("error", () => settle(refusal(ASSET_PREPARATION_REFUSALS.unavailable)));
  worker.once("exit", () => {
    if (!terminal && !received) settle(refusal(ASSET_PREPARATION_REFUSALS.unavailable));
  });
  worker.once("message", (message: WorkerMessage) => {
    if (terminal) return;

    if (message.generation !== id) {
      settle(refusal(ASSET_PREPARATION_REFUSALS.unavailable));

      return;
    }

    received = true;
    verification = (async () => {
    const checked = await verifyPreparedProjectAssetImport(request, message.prepared, message.baseContentHash, publication.signal);

    if (terminal) return;
    const prepared = checked.ok ? message.prepared : checked;

    if (!prepared.ok) {
      settle(Object.freeze({ ok: false, generation: id, reason: prepared.reason }));

      return;
    }

    settle(Object.freeze({ ok: true, generation: id, prepared }));
    })().catch(() => settle(refusal(ASSET_PREPARATION_REFUSALS.unavailable)));
  });

  return Object.freeze({ generation: id, result, cancel() {
    settle(refusal(ASSET_PREPARATION_REFUSALS.cancelled));

    return result;
  } });
}

/** Descriptor-only route admission: reject accessors/proxies before any property read or Worker allocation. */
function validPreparationInput(input: PreparationBoundaryInput): input is ProjectAssetPreparationInput {
  if (input === null || !isBoundaryObjectOrNull(input) || types.isProxy(input) || Array.isArray(input)) return false;
  const allowed = ["profile", "projectRoot", "documentPath", "sourcePath", "assetId", "hotReload"];
  const descriptors = Object.getOwnPropertyDescriptors(input);

  if (Reflect.ownKeys(descriptors).some(key => !isBoundaryString(key) || !allowed.includes(key))) return false;

  if (Object.values(descriptors).some(descriptor => !("value" in descriptor))) return false;
  const value = (key: string): PreparationBoundaryInput => descriptors[key]?.value;
  const profile = value("profile");
  const root = value("projectRoot");
  const document = value("documentPath");
  const source = value("sourcePath");
  const pathText = (path: PreparationBoundaryInput): path is string => isBoundaryString(path) && path.length > 0 && path.length <= 4096 && !path.includes("\0");

  return (profile === "game" || profile === "web" || profile === "kids") &&
    pathText(root) && isAbsolute(root) && pathText(source) && isAbsolute(source) &&
    pathText(document) && !isAbsolute(document) && normalize(document) !== ".." && !normalize(document).startsWith(`..${sep}`) &&
    (value("assetId") === undefined || (isBoundaryString(value("assetId")) && /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(String(value("assetId"))))) &&
    (value("hotReload") === undefined || isBoundaryBoolean(value("hotReload")));
}

if (!isMainThread && parentPort !== null) {
  const data: unknown = workerData;

  if (!isJsonObject(data) || !Number.isSafeInteger(data["generation"]) ||
    !isJsonObject(data["input"])) throw new Error("Invalid asset preparation envelope.");
  const raw = data["input"];

  if (!isBoundaryString(raw["projectRoot"]) || !isBoundaryString(raw["documentPath"]) ||
    !isBoundaryString(raw["sourcePath"]) ||
    (raw["assetId"] !== undefined && !isBoundaryString(raw["assetId"])) ||
    (raw["hotReload"] !== undefined && !isBoundaryBoolean(raw["hotReload"]))) throw new Error("Invalid asset preparation input.");

  const input: ImportRequestBuilder = {
    projectRoot: raw["projectRoot"], documentPath: raw["documentPath"], sourcePath: raw["sourcePath"],
  };

  if (raw["assetId"] !== undefined) input.assetId = raw["assetId"];

  if (raw["hotReload"] !== undefined) input.hotReload = raw["hotReload"];

  const base = projectAssetPreparationBaseHash(input);
  const prepared = base.ok ? proposeProjectAssetImport(input) : base;
  parentPort.postMessage({ generation: data["generation"], baseContentHash: base.ok ? base.hash : "", prepared });
  parentPort.close();
}

function isBoundaryString(value: PreparationBoundaryInput): value is string {
  return typeof value === "string";
}

function isBoundaryBoolean(value: PreparationBoundaryInput): value is boolean {
  return typeof value === "boolean";
}

function isBoundaryObjectOrNull(value: PreparationBoundaryInput): value is object | null {
  return isBoundaryObjectValue(value);
}

type ImportRequestBuilder = { -readonly [Key in keyof ImportInput]: ImportInput[Key] };

type BoundaryObjectValue = object | null;

function isBoundaryObjectValue<Input>(value: Input): value is Input & Readonly<BoundaryObjectValue> {
  return typeof value === "object";
}
