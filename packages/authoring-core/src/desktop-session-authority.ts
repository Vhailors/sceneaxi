import {
  createProjectGitAuthoringAuthority,
  prepareProjectGitCommit,
  stageProjectGitPaths,
  type ProjectGitAuthoringState,
  type ProjectGitOptions,
} from "./project-git.js";

export type ProjectGitDesktopSessionBinding = Readonly<{
  stage(options: ProjectGitOptions, paths: readonly string[]): ReturnType<typeof stageProjectGitPaths>;
  prepare(
    options: ProjectGitOptions,
    paths: readonly string[],
    message: string,
  ): ReturnType<typeof prepareProjectGitCommit>;
}>;

export function createProjectGitDesktopSessionBinding(
  root: string,
  readState: () => ProjectGitAuthoringState,
): ProjectGitDesktopSessionBinding {
  const authority = createProjectGitAuthoringAuthority(root, readState);
  return Object.freeze({
    stage: (options: ProjectGitOptions, paths: readonly string[]) =>
      stageProjectGitPaths({ ...options, authoring: authority }, paths),
    prepare: (options: ProjectGitOptions, paths: readonly string[], message: string) =>
      prepareProjectGitCommit({ ...options, authoring: authority }, paths, message),
  });
}
