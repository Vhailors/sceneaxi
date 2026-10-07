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

/*
 * Operate dialect (docs/redesign-v6/DIRECTION.md §5). Every value is a chrome custom property that
 * apps/desktop-shell emits from visual-tokens.ts (`styles()` + `uiKitStyles()`), so this surface
 * mirrors the desktop tokens at runtime and carries no colour literal. Density follows the shell's
 * `data-density` through `--ui-control` / `--ui-text` (comfortable 28px default, compact 24px; text
 * never below the 13px floor). The pending plate is the shared `sx-plate--pending` class, which
 * ships the yellow fill together with its boundary line; it is never painted here.
 * Rule notes (kept out of the shipped CSS for the 1.3x byte budget): neutral state paint yields to
 * the shared pending plate; buttons keep a 32px floor at both densities (pinned) while fields follow
 * density; the primary is the enamel plate, not the yellow commit fill; disabled labels paint with
 * --inert, never composite opacity; one stable status well serves configured and unavailable states
 * without implying success. Motion: the surface enters by keyframe when [hidden] lifts and leaves at
 * once (row 6); the chrome's live-line wipe settles state/message text (row 10); a request in flight
 * marks its button aria-busy, which draws the chrome's loading bar.
 */
function installStyles(): void {
  if (document.getElementById(STYLE_ID) !== null) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
.desktop-byo-config{display:flex;flex:none;flex-direction:column;gap:var(--space-2);padding:var(--space-3);border:1px solid var(--line-control);border-radius:var(--r-control);background:var(--well);min-width:0;font:var(--ui-text,13px)/1.5 var(--sans)}
.shell[data-density="compact"] .desktop-byo-config{gap:var(--space-1);padding:var(--space-2)}
.desktop-byo-config[hidden]{display:none}
.desktop-byo-config-head{display:flex;align-items:center;justify-content:space-between;gap:var(--space-2);min-width:0;flex-wrap:wrap}
.desktop-byo-config-title{font-weight:600;color:var(--text)}
.desktop-byo-config-state{display:inline-flex;align-items:center;gap:var(--space-1);padding:0 var(--space-2);min-height:22px;border:1px solid var(--line-control);border-radius:var(--r-control);font-weight:600;overflow-wrap:anywhere}
.desktop-byo-config-state:not(.sx-plate--pending){background:var(--panel);color:var(--text-2)}
.desktop-byo-config-state::before{content:"";flex:none;box-sizing:border-box;width:10px;height:0;border-top:2px solid currentColor}
.desktop-byo-config-state[data-state="pending"]::before{height:10px;border:2px solid currentColor;border-radius:50%}
.desktop-byo-config-state[data-state="verified"]{color:var(--ok)}
.desktop-byo-config-state[data-state="verified"]::before{width:6px;height:10px;border:solid currentColor;border-width:0 2px 2px 0;rotate:45deg;translate:0 -1px}
.desktop-byo-config-state[data-state="refused"]{color:var(--refuse)}
.desktop-byo-config-state[data-state="refused"]::before{width:8px;height:8px;border:4px solid currentColor;rotate:45deg}
.desktop-byo-config-field{display:flex;flex-direction:column;gap:var(--space-1);min-width:0}
.desktop-byo-config-label{color:var(--text-2)}
.desktop-byo-config button{box-sizing:border-box;min-width:0;min-height:32px;padding:var(--space-1) var(--space-2);border:1px solid var(--line-control);border-radius:var(--r-control);background:var(--panel);color:var(--text);font:600 var(--ui-text,13px)/1.5 var(--sans);cursor:pointer}
.desktop-byo-config select,.desktop-byo-config input{box-sizing:border-box;width:100%;min-width:0;height:max(var(--ui-control,28px),28px);border:1px solid var(--line-control);border-radius:var(--r-control);background:var(--panel);color:var(--text);font:inherit;padding:0 var(--space-2)}
.desktop-byo-config input::placeholder{color:var(--dim)}
.desktop-byo-config :focus-visible{outline:2px solid var(--accent);outline-offset:2px;box-shadow:0 0 0 4px var(--well);scroll-margin:var(--space-3)}
.desktop-byo-config :is(input,select):enabled:hover{border-color:var(--line-hover)}
.desktop-byo-config :is(input,select):focus-visible{border-color:var(--accent)}
.desktop-byo-config input:user-invalid{border-color:var(--refuse)}
.desktop-byo-config-actions{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:var(--space-2)}
.desktop-byo-config button:not(:disabled):hover{border-color:var(--line-hover);background:var(--hover)}
.desktop-byo-config button[data-primary]:not(:disabled){border-color:var(--accent);background:var(--accent);color:var(--on-accent)}
.desktop-byo-config button[data-primary]:not(:disabled):hover{border-color:var(--accent-hover);background:var(--accent-hover)}
.desktop-byo-config button:disabled,.desktop-byo-config input:disabled,.desktop-byo-config select:disabled{cursor:not-allowed;color:var(--inert);background:var(--panel);border-color:var(--line-control);border-style:dashed}
.desktop-byo-config-message{margin:var(--space-1) 0 0;min-width:0;padding:var(--space-2);border-left:2px solid var(--line-hover);background:var(--panel);line-height:1.55;color:var(--text-2);overflow-wrap:anywhere;user-select:text}
.desktop-byo-config-message:empty{display:none}
.desktop-byo-config-message[role="alert"]{border-left-color:var(--refuse);color:var(--text)}
.desktop-byo-config button:not(:disabled):active{box-shadow:inset 0 0 0 2px var(--line-hover)}
.desktop-byo-config button:not(:disabled):active:focus-visible{box-shadow:0 0 0 4px var(--well),inset 0 0 0 2px var(--line-hover)}
@media (forced-colors:active){.desktop-byo-config :focus-visible{outline:2px solid Highlight;outline-offset:-2px;box-shadow:none}.desktop-byo-config button[data-primary]:not(:disabled){border:2px solid ButtonText}.desktop-byo-config-state{border-color:CanvasText}}
@keyframes desktop-byo-config-in{from{opacity:0;translate:0 var(--motion-distance-sm,4px)}to{opacity:1;translate:0 0}}
@media (prefers-reduced-motion: no-preference){.desktop-byo-config:not([hidden]){animation:desktop-byo-config-in var(--motion-duration-panel,280ms) var(--motion-ease-out-expo,cubic-bezier(0.16, 1, 0.3, 1)) backwards}}
@media (prefers-reduced-motion: reduce){.desktop-byo-config button{transition:none}.desktop-byo-config *{scroll-behavior:auto}}
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
  // The state label is a plate: label text plus a CSS glyph keyed by data-state (never colour alone).
  // Checking is the only pending state, so it borrows the shared pending plate (fill + line).
  const state = element("span", "desktop-byo-config-state sx-plate--pending");
  state.dataset.state = "pending";
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
    // Tone follows the response, never the label wording: a refusal or unready storage is refused,
    // a removable (stored) key is verified, anything else (no key) is neutral.
    state.dataset.state = !response.ok || !view.keyFieldEnabled
      ? "refused"
      : view.removeEnabled ? "verified" : "neutral";
    state.className = "desktop-byo-config-state";
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

  // Loading state for the button whose request is in flight; the label stays.
  // Never painted after teardown, like every other late outcome here.
  const busy = (button: HTMLButtonElement, pending: boolean): void => {
    if (signal?.aborted) return;

    if (pending) button.setAttribute("aria-busy", "true");
    else button.removeAttribute("aria-busy");
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

      busy(save, true);

      try {
        await request({
          action: "save",
          profile,
          provider: selectedProvider(),
          key: submittedKey,
        });
      } finally {
        if (!signal?.aborted) keyInput.value = "";
        busy(save, false);
      }
    })();
  };

  const onRemove = (): void => {
    if (signal?.aborted) return;
    const profile = assistantProfile(shell);

    if (profile === "@sceneaxi/profile-kids") return;
    busy(remove, true);
    void request({
      action: "remove",
      profile,
      provider: selectedProvider(),
    }).finally(() => busy(remove, false));
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
