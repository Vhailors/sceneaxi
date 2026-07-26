/** Types for the dependency-free publish-readiness checker in `check-publish-ready.mjs`. */

export const PUBLISH_PLAN: {
  readonly bootstrapVersion: string;
  readonly bootstrapCorePin: string;
  readonly registryPublishAuthorized: boolean;
};

export const CHECK_IDS: readonly string[];

export function exportEntries(
  exportsField: unknown,
): ReadonlyArray<readonly [subpath: string, target: string]>;

export function checkPublishReady(): string[];
