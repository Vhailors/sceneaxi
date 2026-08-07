/**
 * The BYOK settings surface as data, decided outside the window.
 *
 * Every honesty rule the panel has to keep lives here rather than in DOM
 * conditionals: a control is offered only when the response says the capability
 * behind it is reachable, and both the state label and the copy state the cause
 * the runtime reported and nothing else — no label may claim the platform failed
 * unless the refusal was about the platform. The renderer binds this projection;
 * `tests/desktop/` executes it.
 */
import {
  desktopByoRefusalContext,
  type DesktopByoConfigurationResponse,
} from "./byo-configuration-contract.js";

export type DesktopByoConfigurationView = Readonly<{
  state: string;
  message: string;
  /** `null` leaves the rendered label untouched, which a refusal never renames. */
  saveLabel: string | null;
  keyFieldEnabled: boolean;
  saveEnabled: boolean;
  removeEnabled: boolean;
}>;

function refusalView(
  response: Extract<DesktopByoConfigurationResponse, { ok: false }>,
): DesktopByoConfigurationView {
  const removable = response.removable === true;
  const context = desktopByoRefusalContext(response.reason);
  // A rejected submission is the one refusal that says nothing about the
  // platform: it is decided before the backend is consulted, so the field and
  // Save stay live for the retype rather than stranding the user behind a
  // capability failure that was never reported.
  const resubmittable = context === "request-invalid";
  const offer = !removable
    ? ""
    : context === "storage-unavailable"
      ? " Secure storage is unavailable, so Remove can delete the existing envelope without unlocking it."
      : context === "envelope-invalid"
        ? " The stored entry is invalid and can be removed."
        : " A stored entry is present and can be removed.";
  const state = resubmittable
    ? "Entry rejected"
    : !removable
      ? "Unavailable"
      : context === "storage-unavailable"
        ? "Stored · storage unavailable"
        : context === "envelope-invalid"
          ? "Stored · unusable"
          : "Stored";
  return Object.freeze({
    state,
    message: `${response.reason} — ${response.message}${offer}`,
    saveLabel: null,
    keyFieldEnabled: resubmittable,
    saveEnabled: resubmittable,
    removeEnabled: removable,
  });
}

export function desktopByoConfigurationView(
  response: DesktopByoConfigurationResponse,
): DesktopByoConfigurationView {
  if (!response.ok) return refusalView(response);

  const storageReady = response.storageStatus === "ready";
  const configured = response.keyStatus === "configured";
  const operation = response.operation === "status"
    ? configured
      ? "A provider key is securely stored."
      : "No provider key is stored."
    : response.operation === "replaced"
      ? "The stored provider key was replaced."
      : response.operation === "saved"
        ? "The provider key was saved."
        : response.operation === "removed"
          ? "The provider key was removed."
          : "No provider key was stored.";
  const capability = !storageReady
    ? "Secure storage is unavailable, so saving and replacing stay refused."
    : response.runtimeStatus === "ready"
      ? "BYOK is ready for this provider."
      : "Provider execution is unavailable in this desktop build.";

  return Object.freeze({
    state: !storageReady ? "Storage unavailable" : configured ? "Key saved" : "No key",
    message: `${operation} ${capability}`,
    saveLabel: configured ? "Replace key" : "Save key",
    keyFieldEnabled: storageReady,
    saveEnabled: storageReady,
    removeEnabled: configured,
  });
}
