/** Renderer binding for the desktop-only BYOK configuration surface. */
import {
  DESKTOP_BYO_PROVIDERS,
  DESKTOP_BYO_CONFIGURATION_REFUSALS,
  type DesktopByoConfigurationRefusalReason,
  type DesktopByoConfigurationRequest,
  type DesktopByoConfigurationResponse,
} from "../lib/byo-configuration-contract.js";
import { desktopByoConfigurationView } from "../lib/byo-configuration-view.js";

export type DesktopByoConfigurationPort = Readonly<{
  configureByo?(request: DesktopByoConfigurationRequest): Promise<DesktopByoConfigurationResponse>;
}>;

const SURFACE_ID = "desktop-byo-configuration";
const STYLE_ID = "desktop-byo-configuration-style";

function assistantProfile(shell: HTMLElement): DesktopByoConfigurationRequest["profile"] {
  return shell.dataset.profile === "web"
    ? "@sceneaxi/profile-web"
    : shell.dataset.profile === "kids"
      ? "@sceneaxi/profile-kids"
      : "@sceneaxi/profile-game";
}

function installStyles(): void {
  if (document.getElementById(STYLE_ID) !== null) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
.desktop-byo-config{display:flex;flex-direction:column;gap:8px;padding:9px;border:1px solid var(--line-control);border-radius:5px;background:var(--well);min-width:0}
.desktop-byo-config[hidden]{display:none}
.desktop-byo-config-head{display:flex;align-items:center;justify-content:space-between;gap:8px;min-width:0}
.desktop-byo-config-title{font-size:10px;font-weight:650;color:var(--text)}
.desktop-byo-config-state{font-family:var(--mono);font-size:8px;color:var(--dim);overflow-wrap:anywhere;text-align:right}
.desktop-byo-config-field{display:flex;flex-direction:column;gap:4px;min-width:0}
.desktop-byo-config-label{font-size:9px;color:var(--dim)}
.desktop-byo-config select,.desktop-byo-config input{box-sizing:border-box;width:100%;min-width:0;height:29px;border:1px solid var(--line-control);border-radius:3px;background:var(--panel);color:var(--text);font:11px var(--sans);padding:0 8px;outline:none}
.desktop-byo-config input::placeholder{color:var(--dim)}
.desktop-byo-config select:focus-visible,.desktop-byo-config input:focus-visible,.desktop-byo-config button:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.desktop-byo-config-actions{display:flex;gap:6px;flex-wrap:wrap}
.desktop-byo-config button{min-height:27px;padding:0 9px;border-radius:3px;border:1px solid var(--line-control);background:var(--panel);color:var(--text);font:600 9px var(--sans)}
.desktop-byo-config button[data-primary]{border-color:var(--accent);color:var(--accent)}
.desktop-byo-config button:disabled,.desktop-byo-config input:disabled,.desktop-byo-config select:disabled{cursor:not-allowed;opacity:.52}
.desktop-byo-config-message{margin:0;font-size:9px;line-height:1.45;color:var(--dim);overflow-wrap:anywhere}
@media (prefers-reduced-motion: reduce){.desktop-byo-config *{scroll-behavior:auto}}
`;
  document.head.append(style);
}

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
): HTMLElementTagNameMap[K] {
  const value = document.createElement(tag);
  if (className !== undefined) value.className = className;
  return value;
}

export function installDesktopByoConfigurationSurface(
  port: DesktopByoConfigurationPort,
): boolean {
  const shell = document.querySelector<HTMLElement>(".shell");
  const routes = document.querySelector<HTMLElement>(".assistant-routes");
  const byoRoute = document.querySelector<HTMLElement>("#assistant-route-byo");
  if (shell === null || routes === null || byoRoute === null) return false;

  installStyles();
  const surface = element("section", "desktop-byo-config");
  surface.id = SURFACE_ID;
  surface.hidden = true;
  surface.setAttribute("aria-label", "BYOK provider configuration");

  const head = element("div", "desktop-byo-config-head");
  const title = element("strong", "desktop-byo-config-title");
  title.textContent = "Provider key";
  const state = element("span", "desktop-byo-config-state");
  state.textContent = "Checking…";
  head.append(title, state);

  const providerField = element("label", "desktop-byo-config-field");
  const providerLabel = element("span", "desktop-byo-config-label");
  providerLabel.textContent = "Provider";
  const provider = element("select");
  provider.setAttribute("aria-label", "BYOK provider");
  const option = element("option");
  option.value = DESKTOP_BYO_PROVIDERS[0];
  option.textContent = "OpenRouter";
  provider.append(option);
  providerField.append(providerLabel, provider);

  const keyField = element("label", "desktop-byo-config-field");
  const keyLabel = element("span", "desktop-byo-config-label");
  keyLabel.textContent = "API key";
  const keyInput = element("input");
  keyInput.type = "password";
  keyInput.autocomplete = "off";
  keyInput.spellcheck = false;
  keyInput.placeholder = "Paste a provider key";
  keyInput.setAttribute("aria-describedby", `${SURFACE_ID}-message`);
  keyField.append(keyLabel, keyInput);

  const actions = element("div", "desktop-byo-config-actions");
  const save = element("button");
  save.type = "button";
  save.dataset.primary = "true";
  save.textContent = "Save key";
  const remove = element("button");
  remove.type = "button";
  remove.textContent = "Remove";
  actions.append(save, remove);

  const message = element("p", "desktop-byo-config-message");
  message.id = `${SURFACE_ID}-message`;
  message.setAttribute("role", "status");
  message.setAttribute("aria-live", "polite");
  message.textContent =
    "Stored by the operating system. The key is cleared from this field after submission.";
  surface.append(head, providerField, keyField, actions, message);
  routes.insertAdjacentElement("afterend", surface);
  byoRoute.setAttribute("aria-controls", SURFACE_ID);

  const render = (response: DesktopByoConfigurationResponse): void => {
    const view = desktopByoConfigurationView(response);
    state.textContent = view.state;
    message.textContent = view.message;
    if (view.saveLabel !== null) save.textContent = view.saveLabel;
    keyInput.disabled = !view.keyFieldEnabled;
    save.disabled = !view.saveEnabled;
    remove.disabled = !view.removeEnabled;
  };

  const unavailable = (
    reason: DesktopByoConfigurationRefusalReason,
    detail: string,
  ): void => {
    render(Object.freeze({ ok: false as const, reason, message: detail }));
  };

  const request = async (
    input: DesktopByoConfigurationRequest,
  ): Promise<void> => {
    if (port.configureByo === undefined) {
      unavailable(
        DESKTOP_BYO_CONFIGURATION_REFUSALS.providerSessionUnavailable,
        "The privileged BYOK configuration channel is not exposed.",
      );
      return;
    }
    try {
      render(await port.configureByo(input));
    } catch {
      // IPC/provider errors can contain request internals. Only a stable generic
      // refusal reaches the surface; never echo a thrown message after submission.
      unavailable(
        DESKTOP_BYO_CONFIGURATION_REFUSALS.providerSessionFailed,
        "The privileged BYOK configuration request failed.",
      );
    }
  };

  const refresh = async (): Promise<void> => {
    const profile = assistantProfile(shell);
    if (profile === "@sceneaxi/profile-kids") return;
    await request({ action: "status", profile, provider: DESKTOP_BYO_PROVIDERS[0] });
  };

  const synchronizeVisibility = (): void => {
    const kids = assistantProfile(shell) === "@sceneaxi/profile-kids";
    const visible = !kids && shell.dataset.assistantRoute === "byo";
    surface.hidden = !visible;
    byoRoute.setAttribute("aria-expanded", String(visible));
    if (!visible) keyInput.value = "";
    if (visible) void refresh();
  };

  save.addEventListener("click", () => {
    void (async () => {
      const profile = assistantProfile(shell);
      // Refuse before reading the key field. Switching to Kids and clicking in
      // the same turn therefore cannot submit or access secure storage.
      if (profile === "@sceneaxi/profile-kids") {
        keyInput.value = "";
        return;
      }
      const submittedKey = keyInput.value;
      keyInput.value = "";
      try {
        await request({
          action: "save",
          profile,
          provider: DESKTOP_BYO_PROVIDERS[0],
          key: submittedKey,
        });
      } finally {
        keyInput.value = "";
      }
    })();
  });

  remove.addEventListener("click", () => {
    const profile = assistantProfile(shell);
    if (profile === "@sceneaxi/profile-kids") return;
    void request({
      action: "remove",
      profile,
      provider: DESKTOP_BYO_PROVIDERS[0],
    });
  });

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest("[data-action='assistant-route'], [data-action='profile']") === null) return;
    queueMicrotask(synchronizeVisibility);
  });

  synchronizeVisibility();
  return true;
}
