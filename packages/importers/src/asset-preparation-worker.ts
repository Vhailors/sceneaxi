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
let active = false;
let generation = 0;

/** One bounded worker in this process. Desktop retains profile, lease and E1 authority. */
export function startProjectAssetPreparation(input: unknown): ProjectAssetPreparationJob {
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
  const request: ImportInput = {
    projectRoot: input.projectRoot,
    documentPath: input.documentPath,
    sourcePath: input.sourcePath,
    ...(input.assetId === undefined ? {} : { assetId: input.assetId }),
    ...(input.hotReload === undefined ? {} : { hotReload: input.hotReload }),
  };
  let worker: Worker;

  try {
    // Stock tsc ESM uses its built sibling; packaged Electron CJS uses a fixed
      // source-bound bundle beside main.cjs. Renderer input cannot choose an entry.
      const entry = typeof __dirname === "string"
        ? pathToFileURL(join(__dirname, "asset-preparation-worker.cjs"))
        : new URL("./asset-preparation-worker.js", import.meta.url);
      worker = new Worker(entry, {
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
function validPreparationInput(input: unknown): input is ProjectAssetPreparationInput {
  if (input === null || typeof input !== "object" || types.isProxy(input) || Array.isArray(input)) return false;
  const allowed = ["profile", "projectRoot", "documentPath", "sourcePath", "assetId", "hotReload"];
  const descriptors = Object.getOwnPropertyDescriptors(input);
  if (Reflect.ownKeys(descriptors).some(key => typeof key !== "string" || !allowed.includes(key))) return false;
  if (Object.values(descriptors).some(descriptor => !("value" in descriptor))) return false;
  const value = (key: string): unknown => descriptors[key]?.value;
  const profile = value("profile");
  const root = value("projectRoot");
  const document = value("documentPath");
  const source = value("sourcePath");
  const pathText = (path: unknown): path is string => typeof path === "string" && path.length > 0 && path.length <= 4096 && !path.includes("\0");
  return (profile === "game" || profile === "web" || profile === "kids") &&
    pathText(root) && isAbsolute(root) && pathText(source) && isAbsolute(source) &&
    pathText(document) && !isAbsolute(document) && normalize(document) !== ".." && !normalize(document).startsWith(`..${sep}`) &&
    (value("assetId") === undefined || (typeof value("assetId") === "string" && /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(String(value("assetId"))))) &&
    (value("hotReload") === undefined || typeof value("hotReload") === "boolean");
}

if (!isMainThread && parentPort !== null) {
  const data: unknown = workerData;

  if (!isJsonObject(data) || !Number.isSafeInteger(data["generation"]) ||
    !isJsonObject(data["input"])) throw new Error("Invalid asset preparation envelope.");
  const raw = data["input"];

  if (typeof raw["projectRoot"] !== "string" || typeof raw["documentPath"] !== "string" ||
    typeof raw["sourcePath"] !== "string" ||
    (raw["assetId"] !== undefined && typeof raw["assetId"] !== "string") ||
    (raw["hotReload"] !== undefined && typeof raw["hotReload"] !== "boolean")) throw new Error("Invalid asset preparation input.");
  const input: ImportInput = {
    projectRoot: raw["projectRoot"], documentPath: raw["documentPath"], sourcePath: raw["sourcePath"],
    ...(raw["assetId"] === undefined ? {} : { assetId: raw["assetId"] }),
    ...(raw["hotReload"] === undefined ? {} : { hotReload: raw["hotReload"] }),
  };
  const base = projectAssetPreparationBaseHash(input);
  const prepared = base.ok ? proposeProjectAssetImport(input) : base;
  parentPort.postMessage({ generation: data["generation"], baseContentHash: base.ok ? base.hash : "", prepared });
  parentPort.close();
}
