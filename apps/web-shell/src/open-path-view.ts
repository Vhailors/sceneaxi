/**
 * The open-path demo policy as the web shell renders it (sceneaxi#137).
 *
 * `web-shell` is a protocol *client* with no UI framework in this repo, so this
 * ships a **view model**, not markup — the same shape `account-panel.ts` ships
 * for identity.
 *
 * The view deliberately adds nothing. It reports `openPathPolicyView()`
 * verbatim, which is exactly what `sceneaxi profile open-path` and
 * `sceneaxi-desktop open-path` report, so the three surfaces stay in parity as a
 * data identity the root parity suite asserts rather than as three prose
 * descriptions someone has to keep aligned. If a renderer wants a different
 * sentence about a profile's open path, the policy is what has to change.
 *
 * Evaluation goes through the same shared decision function, so the Kids
 * refusal reaches a browser surface as a named refusal — never an empty list
 * that a renderer could mistake for "nothing to show here".
 */

import {
  OPEN_PATH_REFUSE_ONLY_PROFILE,
  evaluateOpenPathDemo,
  openPathPolicyView,
  openPathPolicyViewFor,
  type OpenPathDemoDecision,
  type OpenPathPolicyProjection,
  type OpenPathPolicyViewModel,
  type OpenPathPolicyViewRow,
} from "@sceneaxi/schemas";

export type OpenPathView = Readonly<{
  /** The shared payload, byte-identical to the CLI's and desktop shell's. */
  policy: OpenPathPolicyViewModel;
  /** The profile that refuses every open-path demo, named for the renderer. */
  refuseOnlyProfile: typeof OPEN_PATH_REFUSE_ONLY_PROFILE;
  /** One row, or undefined when the profile is not in the policy. */
  rowFor: (profile: string) => OpenPathPolicyViewRow | undefined;
  /**
   * The policy narrowed to one profile — the same projection the CLI and the
   * desktop shell report, so an off-policy profile refuses here with the same
   * named code instead of rendering as an absent row.
   */
  policyFor: (profile: string) => OpenPathPolicyProjection;
  /** Evaluate one demo operation through the shared policy. */
  evaluate: (profile: string, operation: string) => OpenPathDemoDecision;
}>;

export function createOpenPathView(): OpenPathView {
  const policy = openPathPolicyView();
  return Object.freeze({
    policy,
    refuseOnlyProfile: OPEN_PATH_REFUSE_ONLY_PROFILE,
    rowFor: (profile: string) =>
      policy.rows.find((row) => row.profile === profile),
    policyFor: (profile: string) => openPathPolicyViewFor(profile),
    evaluate: (profile: string, operation: string) =>
      evaluateOpenPathDemo({ profile, operation }),
  });
}
