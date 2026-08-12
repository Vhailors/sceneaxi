/** Durable project/workspace input-action settings behind the command registry. */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  atomicWriteFile,
  contentHash,
} from "@sceneaxi/authoring-core";
import {
  INPUT_ACTION_REFUSALS,
  INPUT_ACTION_REGISTRY,
  composeInputActionMap,
  emptyInputActionOverrides,
  inputActionMapDigest,
  inputActionOverridesDigest,
  parseInputActionOverrides,
  reviewInputActionRebind,
  serializeInputActionOverrides,
  type InputActionBinding,
  type InputActionId,
  type InputActionMap,
  type InputActionOverrides,
  type InputActionRefusal,
  type InputActionScope,
} from "@sceneaxi/schemas";

export const PROJECT_INPUT_ACTIONS_PATH = ".sceneaxi/input-actions.v1.json" as const;
export const WORKSPACE_INPUT_ACTIONS_FILE = "input-actions.v1.json" as const;
export const DESKTOP_INPUT_ACTIONS_CHANNEL = "sceneaxi:desktop-input-actions" as const;

export type InputActionInspection = Readonly<{
  schemaVersion: 1;
  kind: "sceneaxi.input-action-inspection";
  effectiveBaseVersion: string;
  baseVersions: Readonly<Record<InputActionScope, string>>;
  map: InputActionMap;
  overrides: Readonly<Record<InputActionScope, InputActionOverrides>>;
  documentUndoAffected: false;
  layoutStateAffected: false;
}>;

export type InputActionReview = Readonly<{
  schemaVersion: 1;
  kind: "sceneaxi.input-action-review";
  operation: "rebind" | "reset";
  scope: InputActionScope;
  status: "review" | "committed";
  baseVersion: string;
  resultBaseVersion: string;
  reviewDigest: string;
  before: InputActionMap;
  after: InputActionMap;
  documentUndoAffected: false;
  layoutStateAffected: false;
}>;

export type InputActionHostResult<T = InputActionInspection | InputActionReview> =
  | Readonly<{ ok: true; data: T }>
  | Readonly<{ ok: false; reason: InputActionRefusal; message: string; detail: string | null }>;

export type DesktopInputActionHost = Readonly<{
  inspect(): InputActionHostResult<InputActionInspection>;
  rebind(input: Readonly<{
    scope: InputActionScope;
    expectedBaseVersion: string;
    actionId: unknown;
    binding: unknown;
    approved: boolean;
    reviewDigest: string | null;
  }>): InputActionHostResult<InputActionReview>;
  reset(input: Readonly<{
    scope: InputActionScope;
    expectedBaseVersion: string;
    approved: boolean;
    reviewDigest: string | null;
  }>): InputActionHostResult<InputActionReview>;
}>;

type LoadedScope = Readonly<{
  overrides: InputActionOverrides;
  path: string;
  bytes: string | null;
}>;

const refusal = (
  reason: InputActionRefusal,
  message: string,
  detail: string | null = null,
): InputActionHostResult<never> => Object.freeze({ ok: false as const, reason, message, detail });

function replaceOverride(
  current: InputActionOverrides,
  actionId: InputActionId,
  binding: InputActionBinding,
): InputActionOverrides {
  const byAction = new Map(current.bindings.map((row) => [row.actionId, row.binding]));
  byAction.set(actionId, binding);
  return Object.freeze({
    schemaVersion: 1 as const,
    kind: "sceneaxi.input-action-overrides" as const,
    scope: current.scope,
    bindings: Object.freeze(INPUT_ACTION_REGISTRY.flatMap((definition) => {
      const selected = byAction.get(definition.id);
      return selected === undefined
        ? []
        : [Object.freeze({ actionId: definition.id, binding: selected })];
    })),
  });
}

export function createDesktopInputActionHost(options: Readonly<{
  projectRoot: string;
  workspaceDirectory: string;
}>): DesktopInputActionHost {
  const paths: Readonly<Record<InputActionScope, string>> = Object.freeze({
    project: join(options.projectRoot, PROJECT_INPUT_ACTIONS_PATH),
    workspace: join(options.workspaceDirectory, WORKSPACE_INPUT_ACTIONS_FILE),
  });

  const load = (scope: InputActionScope): LoadedScope | InputActionHostResult<never> => {
    const path = paths[scope];
    if (!existsSync(path)) {
      return Object.freeze({ overrides: emptyInputActionOverrides(scope), path, bytes: null });
    }
    let bytes: string;
    try {
      bytes = readFileSync(path, "utf8");
    } catch (error) {
      return refusal(
        INPUT_ACTION_REFUSALS.persistedStateInvalid,
        `The ${scope} input-action state could not be read.`,
        error instanceof Error ? error.message : String(error),
      );
    }
    const overrides = parseInputActionOverrides(bytes, scope);
    if (overrides === null) {
      return refusal(
        INPUT_ACTION_REFUSALS.persistedStateInvalid,
        `The ${scope} input-action state is invalid; defaults were not substituted.`,
        path,
      );
    }
    return Object.freeze({ overrides, path, bytes });
  };

  const loaded = (): InputActionHostResult<Readonly<Record<InputActionScope, LoadedScope>>> => {
    const workspace = load("workspace");
    if ("ok" in workspace) return workspace;
    const project = load("project");
    if ("ok" in project) return project;
    return Object.freeze({ ok: true as const, data: Object.freeze({ workspace, project }) });
  };

  const inspection = (): InputActionHostResult<InputActionInspection> => {
    const scopes = loaded();
    if (!scopes.ok) return scopes;
    const map = composeInputActionMap(
      scopes.data.workspace.overrides,
      scopes.data.project.overrides,
    );
    return Object.freeze({
      ok: true as const,
      data: Object.freeze({
        schemaVersion: 1 as const,
        kind: "sceneaxi.input-action-inspection" as const,
        effectiveBaseVersion: inputActionMapDigest(map),
        baseVersions: Object.freeze({
          workspace: inputActionOverridesDigest(scopes.data.workspace.overrides),
          project: inputActionOverridesDigest(scopes.data.project.overrides),
        }),
        map,
        overrides: Object.freeze({
          workspace: scopes.data.workspace.overrides,
          project: scopes.data.project.overrides,
        }),
        documentUndoAffected: false as const,
        layoutStateAffected: false as const,
      }),
    });
  };

  const write = (
    loadedScope: LoadedScope,
    next: InputActionOverrides,
  ): InputActionHostResult<InputActionOverrides> => {
    const bytes = serializeInputActionOverrides(next);
    try {
      atomicWriteFile(loadedScope.path, bytes, loadedScope.bytes === null
        ? { mustBeAbsent: true }
        : { expectedContentHash: contentHash(loadedScope.bytes) });
    } catch (error) {
      return refusal(
        INPUT_ACTION_REFUSALS.writeFailed,
        `The ${next.scope} input-action state was not committed atomically.`,
        error instanceof Error ? error.message : String(error),
      );
    }
    return Object.freeze({ ok: true as const, data: next });
  };

  const review = (
    operation: InputActionReview["operation"],
    scope: InputActionScope,
    expectedBaseVersion: string,
    approved: boolean,
    reviewDigest: string | null,
    nextFor: (current: InputActionMap, scopes: Readonly<Record<InputActionScope, LoadedScope>>) =>
      InputActionHostResult<InputActionOverrides>,
  ): InputActionHostResult<InputActionReview> => {
    const scopes = loaded();
    if (!scopes.ok) return scopes;
    const before = composeInputActionMap(
      scopes.data.workspace.overrides,
      scopes.data.project.overrides,
    );
    const currentBase = inputActionOverridesDigest(scopes.data[scope].overrides);
    if (currentBase !== expectedBaseVersion) {
      return refusal(
        INPUT_ACTION_REFUSALS.staleBase,
        `The ${scope} input-action base is stale; inspect and review the current map before retrying.`,
      );
    }
    const next = nextFor(before, scopes.data);
    if (!next.ok) return next;
    const effective = composeInputActionMap(
      scope === "workspace" ? next.data : scopes.data.workspace.overrides,
      scope === "project" ? next.data : scopes.data.project.overrides,
    );
    const resultBaseVersion = inputActionOverridesDigest(next.data);
    if ((!approved && reviewDigest !== null) ||
      (approved && reviewDigest !== resultBaseVersion)) {
      return refusal(
        INPUT_ACTION_REFUSALS.reviewMismatch,
        `The ${scope} input-action approval does not match the exact reviewed settings bytes.`,
      );
    }
    if (approved) {
      const committed = write(scopes.data[scope], next.data);
      if (!committed.ok) return committed;
    }
    return Object.freeze({
      ok: true as const,
      data: Object.freeze({
        schemaVersion: 1 as const,
        kind: "sceneaxi.input-action-review" as const,
        operation,
        scope,
        status: approved ? "committed" as const : "review" as const,
        baseVersion: currentBase,
        resultBaseVersion,
        reviewDigest: resultBaseVersion,
        before,
        after: effective,
        documentUndoAffected: false as const,
        layoutStateAffected: false as const,
      }),
    });
  };

  return Object.freeze({
    inspect: inspection,
    rebind(input) {
      return review("rebind", input.scope, input.expectedBaseVersion, input.approved, input.reviewDigest,
        (current, scopes) => {
          const proposed = reviewInputActionRebind(current, input.actionId, input.binding);
          if (!proposed.ok) {
            return refusal(proposed.reason, proposed.message);
          }
          if (!("map" in proposed)) {
            return refusal(INPUT_ACTION_REFUSALS.registryInvalid, "The rebind review returned no map.");
          }
          return Object.freeze({
            ok: true as const,
            data: replaceOverride(
              scopes[input.scope].overrides,
              proposed.action.id,
              proposed.binding,
            ),
          });
        });
    },
    reset(input) {
      return review("reset", input.scope, input.expectedBaseVersion, input.approved, input.reviewDigest,
        () => Object.freeze({ ok: true as const, data: emptyInputActionOverrides(input.scope) }));
    },
  });
}
