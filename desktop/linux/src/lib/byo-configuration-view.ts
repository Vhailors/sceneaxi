/**
 * The BYOK settings surface as data, decided outside the window.
 *
 * Every honesty rule the panel has to keep lives here rather than in DOM
 * conditionals: a control is offered only when the response says the capability
 * behind it is reachable, and the copy states the cause the runtime reported and
 * nothing else. The renderer binds this projection; `tests/desktop/` executes it.
 */
import {
  desktopByoRemovalContext,
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
  const context = desktopByoRemovalContext(response.reason);
  const offer = !removable
    ? ""
    : context === "storage-unavailable"
      ? " Secure storage is unavailable, so Remove can delete the existing envelope without unlocking it."
      : context === "envelope-invalid"
        ? " The stored entry is invalid and can be removed."
        : " A stored entry is present and can be removed.";
  return Object.freeze({
    state: !removable
      ? "Unavailable"
      : context === "envelope-invalid"
        ? "Stored · unusable"
        : "Stored · storage unavailable",
    message: `${response.reason} — ${response.message}${offer}`,
    saveLabel: null,
    keyFieldEnabled: false,
    saveEnabled: false,
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
