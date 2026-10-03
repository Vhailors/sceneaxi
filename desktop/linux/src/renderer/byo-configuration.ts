/** Renderer binding for the desktop-only BYOK configuration surface. */
import {
  DESKTOP_BYO_PROVIDER_LABELS,
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
.desktop-byo-config{display:flex;flex:none;flex-direction:column;gap:var(--space-2);padding:var(--space-3);border:1px solid var(--line-control);border-radius:var(--r-control);background:var(--well);min-width:0}
.desktop-byo-config[hidden]{display:none}
.desktop-byo-config-head{display:flex;align-items:flex-start;justify-content:space-between;gap:var(--space-2);min-width:0;flex-wrap:wrap}
.desktop-byo-config-title{font-size:12px;font-weight:650;color:var(--text)}
.desktop-byo-config-state{font-family:var(--mono);font-size:10px;line-height:1.5;color:var(--dim);overflow-wrap:anywhere;text-align:right}
.desktop-byo-config-field{display:flex;flex-direction:column;gap:4px;min-width:0}
.desktop-byo-config-label{font-size:11px;color:var(--dim)}
.desktop-byo-config select,.desktop-byo-config input{box-sizing:border-box;width:100%;min-width:0;height:36px;border:1px solid var(--line-control);border-radius:6px;background:var(--panel);color:var(--text);font:12px var(--sans);padding:0 var(--space-2)}
.desktop-byo-config input::placeholder{color:var(--dim)}
.desktop-byo-config select:focus-visible,.desktop-byo-config input:focus-visible,.desktop-byo-config button:focus-visible{outline:2px solid var(--accent);outline-offset:2px;box-shadow:0 0 0 4px var(--well);scroll-margin:var(--space-3)}
.desktop-byo-config :is(input,select):enabled:hover{border-color:var(--line-hover)}
.desktop-byo-config input:user-invalid{border-color:var(--refuse)}
@media (forced-colors:active){.desktop-byo-config :focus-visible{outline:2px solid Highlight;outline-offset:-2px;box-shadow:none}}
.desktop-byo-config-actions{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:var(--space-2)}
.desktop-byo-config button{min-width:0;min-height:32px;padding:var(--space-1) var(--space-2);border-radius:6px;border:1px solid var(--line-control);background:var(--panel);color:var(--text);font:600 11px var(--sans);transition:background-color .14s ease,border-color .14s ease}
.desktop-byo-config button:not(:disabled):hover{border-color:var(--accent);background:var(--header)}
.desktop-byo-config button[data-primary]{border-color:var(--accent);color:var(--accent)}
/* Disabled labels keep AA contrast: paint with the inert token, never composite opacity. */
.desktop-byo-config button:disabled,.desktop-byo-config input:disabled,.desktop-byo-config select:disabled{cursor:not-allowed;color:var(--inert);border-color:var(--line-control)}
/* The same stable status well serves configured and unavailable states without implying success. */
.desktop-byo-config-message{margin:var(--space-1) 0 0;min-width:0;padding:var(--space-2);border-left:2px solid var(--line-hover);background:var(--panel);font-size:11px;line-height:1.6;color:var(--dim);overflow-wrap:anywhere;user-select:text}
.desktop-byo-config-message:empty{display:none}
.desktop-byo-config-message[role="alert"]{border-left-color:var(--refuse);color:var(--text)}
.desktop-byo-config button:not(:disabled):active{box-shadow:inset 0 0 0 2px var(--line-hover)}
.desktop-byo-config button:not(:disabled):active:focus-visible{box-shadow:0 0 0 4px var(--well),inset 0 0 0 2px var(--line-hover)}
@media (prefers-reduced-motion: reduce){.desktop-byo-config button{transition:none}}
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
  options: Readonly<{ signal?: AbortSignal }> = {},
): boolean {
  const signal = options.signal;

  if (signal?.aborted) return false;
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
  title.textContent = "OpenCode Flash key";
  const state = element("span", "desktop-byo-config-state");
  state.textContent = "Checking…";
  head.append(title, state);

  const providerField = element("label", "desktop-byo-config-field");
  const providerLabel = element("span", "desktop-byo-config-label");
  providerLabel.textContent = "Provider";
  const provider = element("select");
  provider.setAttribute("aria-label", "BYOK provider");
  provider.hidden = true;
  providerField.hidden = true;

  for (const id of DESKTOP_BYO_PROVIDERS) {
    const option = element("option");
    option.value = id;
    option.textContent = DESKTOP_BYO_PROVIDER_LABELS[id];
    provider.append(option);
  }

  provider.value = "opencode";
  providerField.append(providerLabel, provider);

  const keyField = element("label", "desktop-byo-config-field");
  const keyLabel = element("span", "desktop-byo-config-label");
  keyLabel.textContent = "API key";
  const keyInput = element("input");
  keyInput.type = "password";
  keyInput.autocomplete = "off";
  keyInput.spellcheck = false;
  keyInput.placeholder = "Paste OpenCode key, then Save";
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
  const previousControls = byoRoute.getAttribute("aria-controls");
  const previousExpanded = byoRoute.getAttribute("aria-expanded");
  byoRoute.setAttribute("aria-controls", SURFACE_ID);

  const render = (response: DesktopByoConfigurationResponse): void => {
    if (signal?.aborted) return;
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
    if (signal?.aborted) return;

    if (port.configureByo === undefined) {
      unavailable(
        DESKTOP_BYO_CONFIGURATION_REFUSALS.providerSessionUnavailable,
        "The privileged BYOK configuration channel is not exposed.",
      );

      return;
    }

    let cancel: (() => void) | undefined;

    try {
      const configured = port.configureByo(input);

      const response = signal === undefined
        ? await configured
        : await new Promise<DesktopByoConfigurationResponse | undefined>((resolve, reject) => {
          // Settle the renderer task on teardown even if privileged IPC is still
          // pending. Both late outcomes remain handled without painting the DOM.
          cancel = () => resolve(undefined);
          configured.then(resolve, reject);

          if (signal.aborted) cancel();
          else signal.addEventListener("abort", cancel, { once: true });
        });

      if (signal?.aborted || response === undefined) return;
      render(response);
    } catch {
      if (signal?.aborted) return;
      // IPC/provider errors can contain request internals. Only a stable generic
      // refusal reaches the surface; never echo a thrown message after submission.
      unavailable(
        DESKTOP_BYO_CONFIGURATION_REFUSALS.providerSessionFailed,
        "The privileged BYOK configuration request failed.",
      );
    } finally {
      if (cancel !== undefined) signal?.removeEventListener("abort", cancel);
    }
  };

  // SAFETY: the first cast only permits the membership query; the returned cast follows a successful synchronous includes check on the locally created select, with no intervening mutation.
  const selectedProvider = (): (typeof DESKTOP_BYO_PROVIDERS)[number] =>
    DESKTOP_BYO_PROVIDERS.includes(provider.value as (typeof DESKTOP_BYO_PROVIDERS)[number])
      ? (provider.value as (typeof DESKTOP_BYO_PROVIDERS)[number])
      : DESKTOP_BYO_PROVIDERS[0];

  const refresh = async (): Promise<void> => {
    if (signal?.aborted) return;
    const profile = assistantProfile(shell);

    if (profile === "@sceneaxi/profile-kids") return;
    await request({
      action: "status",
      profile,
      provider: selectedProvider(),
    });
  };

  const synchronizeVisibility = (): void => {
    if (signal?.aborted) return;
    const kids = assistantProfile(shell) === "@sceneaxi/profile-kids";
    // Configuration is a view of the user's route, never a route-selection authority.
    const visible = !kids && shell.dataset.assistantRoute === "byo";
    surface.hidden = !visible;
    byoRoute.setAttribute("aria-expanded", String(visible));

    if (!visible) keyInput.value = "";

    if (visible) void refresh();
  };

  const onSave = (): void => {
    if (signal?.aborted) return;
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
          provider: selectedProvider(),
          key: submittedKey,
        });
      } finally {
        if (!signal?.aborted) keyInput.value = "";
      }
    })();
  };

  const onRemove = (): void => {
    if (signal?.aborted) return;
    const profile = assistantProfile(shell);

    if (profile === "@sceneaxi/profile-kids") return;
    void request({
      action: "remove",
      profile,
      provider: selectedProvider(),
    });
  };

  const onProviderChange = (): void => {
    if (signal?.aborted) return;
    void refresh();
  };

  const onRouteClick = (event: Event): void => {
    if (signal?.aborted) return;
    const target = event.target;

    if (!(target instanceof Element)) return;

    if (target.closest("[data-action='assistant-route'], [data-action='profile']") === null) return;
    queueMicrotask(synchronizeVisibility);
  };

  save.addEventListener("click", onSave);
  remove.addEventListener("click", onRemove);
  provider.addEventListener("change", onProviderChange);
  document.addEventListener("click", onRouteClick);

  const dispose = (): void => {
    save.removeEventListener("click", onSave);
    remove.removeEventListener("click", onRemove);
    provider.removeEventListener("change", onProviderChange);
    document.removeEventListener("click", onRouteClick);
    signal?.removeEventListener("abort", dispose);
    // Erase the field synchronously at the boundary, not in a late save finally.
    keyInput.value = "";
    surface.remove();

    if (previousControls === null) byoRoute.removeAttribute("aria-controls");
    else byoRoute.setAttribute("aria-controls", previousControls);

    if (previousExpanded === null) byoRoute.removeAttribute("aria-expanded");
    else byoRoute.setAttribute("aria-expanded", previousExpanded);
  };

  signal?.addEventListener("abort", dispose, { once: true });
  synchronizeVisibility();

  return true;
}
