import { DESKTOP_VISUAL_REFUSALS, kidsAssistantDenial, type DesktopVisualView } from "../../visual-model.js";
import { button, escapeHtml, promptInput } from "../core/markup.js";

/** Both bodies ship so profile switches reach the model's same denial. */
export function assistant(view: DesktopVisualView): string {
  const denial = kidsAssistantDenial();

  const assistantStatus =
    view.state.assistantRuntime === "local"
      ? "Ready. Type, then Send."
      : `${DESKTOP_VISUAL_REFUSALS.noPresentationRuntime} — assistant actions are unavailable until a packaged host binds.`;

  return `
<aside class="assistant" aria-label="Assistant">
  <div class="assistant-head">
    <span class="assistant-mark" aria-hidden="true"></span>
    <h2>Assistant</h2>
    <span class="assistant-model" data-assistant-model>${escapeHtml(view.assistant.modelLabel)}</span>
    ${button(view.assistant.close, "✕", "icon-button", ` data-action="assistant" aria-label="Close assistant"`)}
  </div>
  <div class="assistant-denied" role="note">
    <p class="assistant-denied-title">Kids writes here, safely</p>
    <p>This Kids space stays on a dedicated safe path. Engine and Website can use your OpenCode key.</p>
    <p class="assistant-denied-detail">${escapeHtml(denial.message)}</p>
    <p class="assistant-denied-code"><code>${escapeHtml(denial.lockCode)}</code></p>
  </div>
  <div class="assistant-body">
    <p class="assistant-empty assistant-empty-game">Type what you want. Pick Light, Mid, or Strong. Press Send. Flash does the work.</p>
    <p class="assistant-empty assistant-empty-web">Ask for a Three.js hero, a headline animation, or a new page section. This is a website, not a game level.</p>
    <div class="assistant-live" aria-hidden="true"><i></i><i></i><i></i></div>
    <p class="assistant-thinking" role="status" data-assistant-thinking${view.assistant.thinking ? "" : " hidden"}><span class="dot" aria-hidden="true"></span><span class="dot" aria-hidden="true"></span><span class="dot" aria-hidden="true"></span>Flash is live</p>
    <p class="assistant-progress" data-assistant-status role="status">${escapeHtml(assistantStatus)}</p>
    <div class="assistant-result" data-assistant-result hidden></div>
    ${button(view.assistant.retry, "Retry", "ghost-button assistant-retry", ` data-action="assistant-send" hidden`)}
    <p class="assistant-foot assistant-foot-game">What Flash makes appears in the scene. Stage keeps it.</p>
    <p class="assistant-foot assistant-foot-web">What Flash writes lands on the page. Stage keeps the HTML.</p>
  </div>
  <div class="assistant-composer">
    ${promptInput(view.assistant.prompt)}
    <div class="assistant-routes" role="group" aria-label="Assistant provider route">
      ${view.assistant.routes
        .map((route) =>
          button(
            route.control,
            `${escapeHtml(route.label)}${route.id === "hosted" ? `<small class="assistant-route-refusal">${escapeHtml(route.control.refusal ?? "")}</small>` : ""}`,
            "assistant-route",
            ` data-action="assistant-route" data-value="${escapeHtml(route.id)}" aria-pressed="${route.id === view.state.assistantRoute ? "true" : "false"}"`,
          ),
        )
        .join("")}
    </div>
    <div class="composer-actions">
      <div class="assistant-modes" role="group" aria-label="Assistant strength">
        ${view.assistant.modes
          .map((mode) =>
            button(
              mode.control,
              escapeHtml(mode.label),
              "assistant-mode",
              ` data-action="assistant-mode" data-value="${escapeHtml(mode.id)}" aria-pressed="${mode.active ? "true" : "false"}"`,
            ),
          )
          .join("")}
      </div>
      <span class="spacer"></span>
      ${button(view.assistant.send, "Send", "primary-button", ` data-action="assistant-send" aria-label="Send"`)}
    </div>
  </div>
</aside>`;
}
