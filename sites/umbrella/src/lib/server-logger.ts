const SAFE_FIELDS = new Set(["outcome", "reason", "eventType", "provider", "plane"]);
const SECRET = /(?:\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b|(?:sk_(?:test|live)_|whsec_|Bearer\s+|(?:password|token|secret)[=:]\s*)[^\s,;]+|https?:\/\/[^\s"']+)/gi;

export type ServerLogLevel = "info" | "warn" | "error";
export type ServerLogFields = Readonly<Record<string, string | number | boolean | undefined>>;

export function logWebhookOutcome(
  eventType: string | undefined,
  outcome:
    | { readonly ok: false; readonly reason: string }
    | { readonly ok: true; readonly ignored: true; readonly reason: string }
    | { readonly ok: true; readonly ignored: false; readonly replayed: boolean },
  write?: (level: ServerLogLevel, line: string) => void,
): void {
  serverLog(outcome.ok ? "info" : "warn", "umbrella.webhook.outcome", {
    eventType,
    outcome: !outcome.ok ? "refused" : outcome.ignored ? "ignored" : outcome.replayed ? "replayed" : "processed",
    reason: !outcome.ok ? outcome.reason : outcome.ignored ? outcome.reason : undefined,
  }, write);
}

/** Emit only named, non-secret diagnostic fields; never pass provider errors or request data. */
export function serverLog(
  level: ServerLogLevel,
  event: string,
  fields: ServerLogFields = {},
  write: (level: ServerLogLevel, line: string) => void = (severity, line) => {
    (severity === "error" ? console.error : severity === "warn" ? console.warn : console.info)(line);
  },
): void {
  const safe = Object.fromEntries(
    Object.entries(fields)
      .filter(([key, value]) => SAFE_FIELDS.has(key) && value !== undefined)
      .map(([key, value]) => [key, typeof value === "string" ? value.replace(SECRET, "[REDACTED]") : value]),
  );
  write(level, JSON.stringify({ event, ...safe }));
}
