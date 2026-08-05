/**
 * First-release Web Experience authoring contract (sceneaxi#197).
 *
 * This is vocabulary and policy, not an editor state machine. The Web profile
 * exposes it directly, while the deployable umbrella editor consumes it through
 * site-kit because ADR 0018 deliberately denies sites a profile-package edge.
 */

export const WEB_EXPERIENCE_AUTHORING_OPERATIONS = Object.freeze([
  "page.set-html",
  "site-canvas.configure",
  "asset.inject",
  "three.embed",
] as const);

export const WEB_EXPERIENCE_DESKTOP_ONLY_OPERATIONS = Object.freeze([
  "sculpt.edit",
  "scene.compose",
  "runtime.advance",
  "animation.timeline",
  "plugin.load",
  "native.export",
] as const);

export type WebExperienceAuthoringOperation =
  (typeof WEB_EXPERIENCE_AUTHORING_OPERATIONS)[number];
export type WebExperienceDesktopOnlyOperation =
  (typeof WEB_EXPERIENCE_DESKTOP_ONLY_OPERATIONS)[number];

export const WEB_EXPERIENCE_AUTHORING_REFUSALS = Object.freeze({
  WEB_EXPERIENCE_DESKTOP_ONLY_OPERATION:
    "The requested operation belongs to the desktop authoring surface.",
  WEB_EXPERIENCE_OPERATION_UNKNOWN:
    "The requested operation is not in the Web Experience authoring contract.",
} as const);

export type WebExperienceAuthoringRefusal =
  keyof typeof WEB_EXPERIENCE_AUTHORING_REFUSALS;

export type WebExperienceAuthoringDecision =
  | Readonly<{
      ok: true;
      operation: WebExperienceAuthoringOperation;
    }>
  | Readonly<{
      ok: false;
      operation: string | null;
      reason: WebExperienceAuthoringRefusal;
      message: string;
    }>;

const authoringOperationSet = new Set<string>(WEB_EXPERIENCE_AUTHORING_OPERATIONS);
const desktopOnlyOperationSet = new Set<string>(
  WEB_EXPERIENCE_DESKTOP_ONLY_OPERATIONS,
);

/** Fail-closed operation lookup for every Web Experience authoring caller. */
export function evaluateWebExperienceAuthoringOperation(
  requestedOperation: unknown,
): WebExperienceAuthoringDecision {
  if (
    typeof requestedOperation === "string" &&
    authoringOperationSet.has(requestedOperation)
  ) {
    return Object.freeze({
      ok: true as const,
      operation: requestedOperation as WebExperienceAuthoringOperation,
    });
  }

  const operation =
    typeof requestedOperation === "string" ? requestedOperation : null;
  if (operation !== null && desktopOnlyOperationSet.has(operation)) {
    return Object.freeze({
      ok: false as const,
      operation,
      reason: "WEB_EXPERIENCE_DESKTOP_ONLY_OPERATION" as const,
      message: `Operation '${operation}' belongs to the desktop authoring surface.`,
    });
  }

  return Object.freeze({
    ok: false as const,
    operation,
    reason: "WEB_EXPERIENCE_OPERATION_UNKNOWN" as const,
    message:
      "Unknown Web Experience authoring operation refused; the profile contract must be extended explicitly.",
  });
}

/**
 * Browser authority granted to user-authored HTML.
 *
 * An empty iframe `sandbox` grants no tokens. The CSP is defense in depth and
 * intentionally permits no script, network, navigation, form, frame, object, or
 * base authority. The safe Three embed is rendered outside this document through
 * the existing presentation seam.
 */
export const WEB_EXPERIENCE_SANDBOX_POLICY = Object.freeze({
  iframeSandbox: "" as const,
  contentSecurityPolicy:
    "default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'none'; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; navigate-to 'none'",
  allowsParentDom: false as const,
  allowsNetwork: false as const,
  allowsNavigation: false as const,
  allowsScripts: false as const,
});
