import {
  DESKTOP_PROJECT_ACTIONS,
  DESKTOP_PROJECT_REFUSALS,
  projectOk,
  projectRefuse,
  type DesktopProjectResponse,
} from "./project-lifecycle-contract.js";
import type { DesktopProjectLifecycle } from "./project-lifecycle.js";

export type DesktopProjectDialogPort = Readonly<{
  chooseNewProjectRoot(): Promise<string | null>;
  chooseOpenProjectRoot(): Promise<string | null>;
}>;

export type DesktopProjectHostOptions = Readonly<{
  lifecycle: DesktopProjectLifecycle;
  dialogs: DesktopProjectDialogPort;
  activate(root: string): Promise<unknown> | unknown;
}>;

export type DesktopProjectHost = Readonly<{
  handle(request: unknown): Promise<DesktopProjectResponse>;
}>;

/**
 * Whether a project response moved the window off the root it currently mounts.
 *
 * The status a bound project answers with carries its root; an unbound one
 * carries `null`, which is the same "no root" the caller holds before the
 * request. Both sides are therefore normalized to `null` before they are
 * compared, because the chrome asks for `status` on every load: reading an
 * unbound answer as a change would reload the window, which would ask again.
 */
export function desktopProjectReloadRequired(
  mountedRoot: string | null,
  response: DesktopProjectResponse,
): boolean {
  if (!response.ok) return false;
  return (response.data.status.active?.root ?? null) !== mountedRoot;
}

function field(value: unknown, name: string): unknown {
  if (typeof value !== "object" || value === null) return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(value, name);
  return descriptor !== undefined && "value" in descriptor ? descriptor.value : undefined;
}

export function createDesktopProjectHost(
  options: DesktopProjectHostOptions,
): DesktopProjectHost {
  const activate = async (response: DesktopProjectResponse) => {
    if (!response.ok || response.data.status.active === null) return response;
    try {
      await options.activate(response.data.status.active.root);
      return response;
    } catch (error) {
      return projectRefuse(
        DESKTOP_PROJECT_REFUSALS.activationFailed,
        "The selected project was valid, but its desktop bridge could not be activated.",
        error instanceof Error ? error.message : String(error),
      );
    }
  };

  return Object.freeze({
    async handle(request: unknown): Promise<DesktopProjectResponse> {
      const action = field(request, "action");
      const profile = field(request, "profile");
      if (profile === "kids") {
        return projectRefuse(
          DESKTOP_PROJECT_REFUSALS.kidsDenied,
          "The shared desktop Kids profile is refuse-only; project storage was not read or changed.",
        );
      }
      if (profile !== "game" && profile !== "web") {
        return projectRefuse(
          DESKTOP_PROJECT_REFUSALS.requestMalformed,
          "A project lifecycle request requires the active game or web profile.",
        );
      }
      if (
        typeof action !== "string" ||
        !(DESKTOP_PROJECT_ACTIONS as readonly string[]).includes(action)
      ) {
        return projectRefuse(
          DESKTOP_PROJECT_REFUSALS.requestMalformed,
          `Unknown project lifecycle action ${JSON.stringify(action)}.`,
        );
      }
      if (action === "status") return activate(options.lifecycle.startup());
      if (action === "choose-new" || action === "choose-open") {
        const selected =
          action === "choose-new"
            ? await options.dialogs.chooseNewProjectRoot()
            : await options.dialogs.chooseOpenProjectRoot();
        if (selected === null) {
          const current = options.lifecycle.status();
          if (!current.ok) return current;
          return projectOk("cancelled", current.data.status);
        }
        return activate(
          action === "choose-new"
            ? options.lifecycle.createProject(selected)
            : options.lifecycle.openProject(selected),
        );
      }
      const root = field(request, "root");
      if (typeof root !== "string") {
        return projectRefuse(
          DESKTOP_PROJECT_REFUSALS.requestMalformed,
          `${action} requires a root string already present in the validated recent list.`,
        );
      }
      if (action === "open-recent") {
        return activate(options.lifecycle.openRecent(root));
      }
      return options.lifecycle.removeRecent(root);
    },
  });
}
