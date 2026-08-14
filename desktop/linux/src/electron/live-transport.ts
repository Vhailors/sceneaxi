/**
 * Privileged OpenAI-compatible chat-completions transport for desktop BYOK.
 *
 * This module is Electron-only. It owns the live HTTPS call, the host allow
 * list, and the PRC-endpoint refusal required by the locked DeepSeek adoption
 * decision. Core packages stay offline; tests inject fixture transports.
 */
import {
  MODEL_PROVIDER_PORT_SCHEMA_VERSION,
  type ModelDescriptor,
} from "@sceneaxi/schemas";
import { DesktopByoRunnerRefusal } from "../lib/byo-configuration.js";
import { DESKTOP_BYO_CONFIGURATION_REFUSALS } from "../lib/byo-configuration-contract.js";
import type { ProviderKeyAccess } from "../lib/byo-configuration.js";

export const DESKTOP_OPENCODE_API_BASE = "https://opencode.ai/zen/v1";
const COMPLETE_TIMEOUT_MS = 45_000;

export const DESKTOP_DEEPSEEK_MODEL = Object.freeze({
  model: "deepseek-v4-flash",
  provider: "opencode",
  quantization: "v4-flash",
  version: "2026-08-14",
}) satisfies ModelDescriptor;

const ALLOWED_HOSTS = Object.freeze(["opencode.ai"]);
const REFUSED_HOSTS = Object.freeze([
  "api.deepseek.com",
  "www.deepseek.com",
  "chat.deepseek.com",
  "deepseek.com",
]);

export function extractCompletionJsonDocument(text: string): string {
  const trimmed = text.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  return (fenced?.[1] ?? trimmed).trim();
}

function refusedHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return REFUSED_HOSTS.some((blocked) => host === blocked || host.endsWith(`.${blocked}`));
}

function allowedHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return ALLOWED_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
}

function completionText(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) return null;
  const choices = (payload as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;
  const message = (choices[0] as { message?: { content?: unknown } }).message;
  return typeof message?.content === "string" ? message.content : null;
}

export function createDesktopOpenCodeLiveTransport(input: Readonly<{
  credential: ProviderKeyAccess;
  apiBase?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}>): Readonly<{
  complete(prompt: string, model: ModelDescriptor): Promise<string>;
}> {
  const apiBase = input.apiBase ?? DESKTOP_OPENCODE_API_BASE;
  const fetchImpl = input.fetchImpl ?? fetch;
  const timeoutMs = input.timeoutMs ?? COMPLETE_TIMEOUT_MS;
  return Object.freeze({
    async complete(prompt: string, model: ModelDescriptor) {
      let url: URL;
      try {
        url = new URL("chat/completions", apiBase.endsWith("/") ? apiBase : `${apiBase}/`);
      } catch {
        throw new DesktopByoRunnerRefusal(
          DESKTOP_BYO_CONFIGURATION_REFUSALS.providerSessionFailed,
          "The privileged DeepSeek transport received an invalid API base.",
        );
      }
      if (refusedHost(url.hostname)) {
        throw new DesktopByoRunnerRefusal(
          DESKTOP_BYO_CONFIGURATION_REFUSALS.providerSessionFailed,
          "The DeepSeek PRC endpoint is refused; desktop BYOK uses the named OpenCode path only.",
        );
      }
      if (!allowedHost(url.hostname)) {
        throw new DesktopByoRunnerRefusal(
          DESKTOP_BYO_CONFIGURATION_REFUSALS.providerSessionFailed,
          "The privileged DeepSeek transport refused an unnamed host.",
        );
      }
      let response: Response;
      try {
        response = await fetchImpl(url, {
          method: "POST",
          headers: {
            authorization: `Bearer ${input.credential.read()}`,
            "content-type": "application/json",
            accept: "application/json",
            "user-agent": "SceneAxi-Desktop/0.0.0 (Linux; BYOK complete-only)",
          },
          body: JSON.stringify({
            model: model.model,
            temperature: 0,
            max_tokens: 2048,
            messages: [{ role: "user", content: prompt }],
          }),
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (error) {
        const timedOut =
          error instanceof Error &&
          (error.name === "TimeoutError" || error.name === "AbortError");
        throw new DesktopByoRunnerRefusal(
          DESKTOP_BYO_CONFIGURATION_REFUSALS.providerSessionFailed,
          timedOut
            ? "Flash did not finish in time. Press Send again, or try a shorter prompt."
            : "Flash could not be reached. Check the network and press Send again.",
        );
      }
      if (!response.ok) {
        throw new DesktopByoRunnerRefusal(
          DESKTOP_BYO_CONFIGURATION_REFUSALS.providerSessionFailed,
          `The privileged DeepSeek provider refused the completion request (HTTP ${String(response.status)}).`,
        );
      }
      const payload: unknown = await response.json();
      const text = completionText(payload);
      if (text === null || text.trim().length === 0) {
        throw new DesktopByoRunnerRefusal(
          DESKTOP_BYO_CONFIGURATION_REFUSALS.providerSessionFailed,
          "The privileged DeepSeek provider returned no completion text.",
        );
      }
      return extractCompletionJsonDocument(text);
    },
  });
}

export function desktopOpenCodeCompleteResponse(text: string) {
  return Object.freeze({
    schemaVersion: MODEL_PROVIDER_PORT_SCHEMA_VERSION,
    operation: "complete" as const,
    text,
    finishReason: "stop" as const,
  });
}
