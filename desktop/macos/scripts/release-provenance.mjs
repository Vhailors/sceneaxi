export const CANONICAL_REPOSITORY = "Vhailors/sceneaxi";

export const ALLOWED_RELEASE_EVENTS = Object.freeze(["workflow_dispatch"]);

export const isPositiveGitHubRunId = (value) =>
  typeof value === "string" &&
  /^[1-9][0-9]*$/.test(value) &&
  Number.isSafeInteger(Number(value));

export const resolveReleaseProvenance = (environment) => {
  const repository = environment.GITHUB_REPOSITORY?.trim() ?? "";
  const eventName = environment.GITHUB_EVENT_NAME?.trim() ?? "";
  const canonicalReleaseContext =
    environment.GITHUB_ACTIONS === "true" &&
    repository === CANONICAL_REPOSITORY &&
    ALLOWED_RELEASE_EVENTS.includes(eventName);
  const runIdValid = isPositiveGitHubRunId(environment.GITHUB_RUN_ID?.trim() ?? "");
  const serverValid = environment.GITHUB_SERVER_URL === "https://github.com";
  const workflowValid =
    environment.GITHUB_WORKFLOW_REF?.startsWith(
      `${CANONICAL_REPOSITORY}/.github/workflows/desktop-macos.yml@`,
    ) === true;

  return Object.freeze({
    canonicalReleaseContext,
    iaLinkable: canonicalReleaseContext && runIdValid && serverValid && workflowValid,
    runIdValid,
    serverValid,
    workflowValid,
  });
};
