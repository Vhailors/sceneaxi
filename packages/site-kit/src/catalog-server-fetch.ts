import { isJsonValue, snapshotPlainRecord } from "@sceneaxi/schemas";

type CatalogSessionInput = Parameters<typeof isJsonValue>[0];

type RawCatalogSessionRecord = NonNullable<ReturnType<typeof snapshotPlainRecord>>;

/** Server-only, explicit-carry reader of the umbrella's authoritative own session.
 * No environment, request Host, cookies, credential issuance or second auth stack.
 * Deployment code must approve a fixed origin; importing this file performs no I/O.
 */
import { type CatalogIdentityPlane } from "./catalog-identity.js";
import { CLIENT_ROLE_CLAIM_KEYS, createIdentityPlane, type SiteIdentityPort, type SiteIdentityAdapter, type SiteIdentityRequest, type SitePrincipal } from "./ports.js";
import { ok, refuse, SITE_REFUSAL_REASONS, type SiteRefusalReason, type SiteResult } from "./refusals.js";
import { SITE_COOKIE_OCTET_RE, SITE_SESSION_HEADER } from "./site-session.js";

export const CATALOG_SESSION_MAX_RESPONSE_BYTES = 16_384;

export const CATALOG_SESSION_TIMEOUT_MS = 2_000;

export type CatalogServerFetchOptions = {
  /** Explicit server deployment approval, never derived from incoming headers. */
  readonly approved?: boolean;
  readonly configuredOrigin?: string | null;
  /** Only canonical localhost/127.0.0.1/[::1] HTTP, never a production fallback. */
  readonly allowLoopbackDevelopment?: boolean;
  readonly transport?: typeof fetch;
  /** May lower, never raise, the fixed production deadline. */
  readonly timeoutMs?: number;
  readonly now?: () => string;
};

function serverRuntime(): boolean {
  return typeof process !== "undefined" && isBoundaryString(process.versions.node) && !("window" in globalThis) && !("WorkerGlobalScope" in globalThis);
}

/** Capture only data descriptors: no caller getter or Proxy get trap is read. */
function captureOptions(options: CatalogServerFetchOptions): CatalogServerFetchOptions | null {
  try {
    if (!isBoundaryObjectOrNull(options) || options === null ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(options))) return null;
    const keys = Reflect.ownKeys(options);

    if (keys.some(key => !isBoundaryString(key) || !["approved", "configuredOrigin", "allowLoopbackDevelopment", "transport", "timeoutMs", "now"].includes(key))) return null;
    const descriptors = Object.getOwnPropertyDescriptors(options);

    if (Object.values(descriptors).some(descriptor => !("value" in descriptor))) return null;
    const snapshot: CatalogServerFetchOptions = {};
    Object.defineProperties(snapshot, descriptors);

    if (snapshot.approved !== undefined && !isBoundaryBoolean(snapshot.approved) ||
      snapshot.configuredOrigin !== undefined && snapshot.configuredOrigin !== null && !isBoundaryString(snapshot.configuredOrigin) ||
      snapshot.allowLoopbackDevelopment !== undefined && !isBoundaryBoolean(snapshot.allowLoopbackDevelopment) ||
      snapshot.transport !== undefined && !isBoundaryCallable(snapshot.transport) ||
      snapshot.now !== undefined && !isBoundaryCallable(snapshot.now) ||
      snapshot.timeoutMs !== undefined && !isBoundaryNumber(snapshot.timeoutMs)) return null;

    return Object.freeze(snapshot);
  } catch { return null; }
}

function configuredOrigin(options: CatalogServerFetchOptions): string | null {
  const value = options.configuredOrigin;

  if (!isBoundaryString(value) || value.length > 512) return null;

  try {
    const url = new URL(value);

    if (url.origin !== value || url.username !== "" || url.password !== "") return null;
    const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);

    if (loopback) return options.allowLoopbackDevelopment === true && url.protocol === "http:" ? value : null;

    if (url.protocol !== "https:" || url.hostname.endsWith(".")) return null;

    // Only configured DNS origins; all IP literals and local pseudo-domains refuse.
    if (!/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z](?:[a-z0-9-]*[a-z0-9])?$/.test(url.hostname)) return null;

    if (/\.(?:localhost|local|internal)$/.test(url.hostname)) return null;

    return value;
  } catch { return null; }
}

function recordWithKeys(value: CatalogSessionInput, keys: readonly string[]): value is RawCatalogSessionRecord {
  if (!isBoundaryObjectOrNull(value) || value === null || Object.getPrototypeOf(value) !== Object.prototype) return false;
  const ownKeys = Reflect.ownKeys(value);

  return ownKeys.length === keys.length && ownKeys.every(key => isBoundaryString(key) && keys.includes(key) && Object.getOwnPropertyDescriptor(value, key)?.get === undefined && Object.getOwnPropertyDescriptor(value, key)?.set === undefined);
}

/** Bounded descriptor-only scan before the existing plane's recursive scanner.
 * Encoded JSON credentials receive the same role-claim check as ordinary records.
 */
function inspectRequest(request: CatalogSessionInput): SiteRefusalReason | null {
  const pending = [{ value: request, depth: 0 }];
  const seen = new WeakSet<object>();
  let nodes = 0;

  try {
    while (pending.length > 0) {
      const next = pending.pop();

      if (next === undefined) break;

      if (++nodes > 256 || next.depth > 32) return "SITE_REQUEST_MALFORMED";
      const value = next.value;

      if (isBoundaryString(value)) {
        if (value.length > 4096) return "SITE_REQUEST_MALFORMED";
        const text = value.trim();

        if ((text.startsWith("{") && text.endsWith("}")) || (text.startsWith("[") && text.endsWith("]"))) pending.push({ value: JSON.parse(text), depth: next.depth + 1 });
        continue;
      }

      if (value === undefined || value === null || isBoundaryBoolean(value) || (isBoundaryNumber(value) && Number.isFinite(value))) continue;

      if (!isBoundaryObjectOrNull(value) || seen.has(value)) return "SITE_REQUEST_MALFORMED";
      seen.add(value);
      const prototype = Object.getPrototypeOf(value);

      if (prototype !== Object.prototype && prototype !== null && !(Array.isArray(value) && prototype === Array.prototype)) return "SITE_REQUEST_MALFORMED";
      const keys = Reflect.ownKeys(value);

      if (keys.length > 256) return "SITE_REQUEST_MALFORMED";

      for (const key of keys) {
        if (!isBoundaryString(key)) return "SITE_REQUEST_MALFORMED";

        if (CLIENT_ROLE_CLAIM_KEYS.some(roleKey => roleKey === key)) return "ROLE_CLAIM_FROM_CLIENT_DENIED";
        const descriptor = Object.getOwnPropertyDescriptor(value, key);

        if (descriptor === undefined || !("value" in descriptor)) return "SITE_REQUEST_MALFORMED";
        pending.push({ value: descriptor.value, depth: next.depth + 1 });
      }
    }

    if (!isBoundaryObjectOrNull(request) || request === null || Array.isArray(request)) return "SITE_REQUEST_MALFORMED";

    if (Reflect.ownKeys(request).some(key => !isBoundaryString(key) || !["surface", "sessionToken", "credentials"].includes(key))) return "SITE_REQUEST_MALFORMED";
    const credentials = Object.getOwnPropertyDescriptor(request, "credentials")?.value;

    if (credentials !== undefined && credentials !== null) return "SITE_REQUEST_MALFORMED";
  } catch { return "SITE_REQUEST_MALFORMED"; }

  return null;
}

function boundedText(value: CatalogSessionInput, max: number): value is string {
  return isBoundaryString(value) && value.length > 0 && value.length <= max && Array.from(value).every(character => character.charCodeAt(0) > 31 && character.charCodeAt(0) !== 127);
}

function parsePrincipal(value: CatalogSessionInput): SitePrincipal | null {
  if (!recordWithKeys(value, ["user", "role", "session"])) return null;
  const user = value["user"];
  const session = value["session"];
  const role = value["role"];

  if (!recordWithKeys(user, ["userId", "email", "emailVerified", "disabled"]) || !recordWithKeys(session, ["sessionId", "userId", "surface", "issuedAt", "expiresAt"])) return null;
  const userId = user["userId"], email = user["email"], emailVerified = user["emailVerified"], disabled = user["disabled"];
  const sessionId = session["sessionId"], sessionUserId = session["userId"], surface = session["surface"], issuedAt = session["issuedAt"], expiresAt = session["expiresAt"];

  if (!boundedText(userId, 256) || !boundedText(email, 320) || !isBoundaryBoolean(emailVerified) || !isBoundaryBoolean(disabled) || (role !== "user" && role !== "admin") || !boundedText(sessionId, 256) || !boundedText(sessionUserId, 256) || surface !== "site" || !boundedText(issuedAt, 32) || !boundedText(expiresAt, 32)) return null;

  return { user: { userId, email, emailVerified, disabled }, role, session: { sessionId, userId: sessionUserId, surface, issuedAt, expiresAt } };
}

function refusalStatus(reason: SiteRefusalReason): number {
  if (reason === "SITE_REQUEST_MALFORMED" || reason === "SITE_SURFACE_UNKNOWN") return 400;

  if (["IDENTITY_SESSION_ABSENT", "IDENTITY_SESSION_EXPIRED", "IDENTITY_SESSION_NOT_YET_VALID"].includes(reason)) return 401;

  if (["SITE_REQUEST_CROSS_ORIGIN", "ROLE_CLAIM_FROM_CLIENT_DENIED", "KIDS_SURFACE_DENIED", "IDENTITY_USER_DISABLED", "IDENTITY_SESSION_SURFACE_MISMATCH"].includes(reason)) return 403;

  return 503;
}

function parseWire(value: CatalogSessionInput, status: number): SiteResult<SitePrincipal> {
  const invalid = () => refuse("IDENTITY_ADAPTER_OUTPUT_INVALID");

  if (recordWithKeys(value, ["version", "ok", "reason"]) && value["version"] === 1 && value["ok"] === false) {
    const reason = SITE_REFUSAL_REASONS.find(reason => reason === value["reason"]);

    if (reason === undefined || status !== refusalStatus(reason) || !(reason.startsWith("IDENTITY_") || ["SITE_REQUEST_MALFORMED", "SITE_SURFACE_UNKNOWN", "SITE_REQUEST_CROSS_ORIGIN", "ROLE_CLAIM_FROM_CLIENT_DENIED", "KIDS_SURFACE_DENIED"].includes(reason))) return invalid();

    return refuse(reason);
  }

  if (!recordWithKeys(value, ["version", "ok", "value"]) || value["version"] !== 1 || value["ok"] !== true || status !== 200) return invalid();
  const principal = parsePrincipal(value["value"]);

  return principal === null ? invalid() : ok(principal);
}

/** Adapter is independently defensive even when called outside a catalog port. */
export function createCatalogServerFetchAdapter(options: CatalogServerFetchOptions = {}): SiteIdentityPort {
  return capturedAdapter(captureOptions(options));
}

function capturedAdapter(snapshot: CatalogServerFetchOptions | null): SiteIdentityPort {
  // Capture configuration once, not a mutable caller's options or inbound URL.
  const options = snapshot ?? {};
  const origin = configuredOrigin(options);
  const approved = options.approved === true;
  const hasOrigin = options.configuredOrigin !== undefined && options.configuredOrigin !== null;
  const transport = options.transport ?? globalThis.fetch;
  const now = options.now;
  const requestedTimeout = options.timeoutMs ?? CATALOG_SESSION_TIMEOUT_MS;
  const timeoutMs = Number.isInteger(requestedTimeout) && requestedTimeout > 0 && requestedTimeout <= CATALOG_SESSION_TIMEOUT_MS ? requestedTimeout : CATALOG_SESSION_TIMEOUT_MS;

  const readerAdapter: SiteIdentityAdapter = {
    async resolvePrincipal(request: SiteIdentityRequest): Promise<SiteResult<SitePrincipal>> {
      if (!approved || !hasOrigin) return refuse("IDENTITY_PLANE_NOT_WIRED");

      if (origin === null) return refuse("SITE_REQUEST_CROSS_ORIGIN");
      const credential = request.sessionToken;

      if (credential === undefined || credential === null) return refuse("IDENTITY_SESSION_ABSENT");
      const separator = credential.indexOf(".");

      if (credential.length > 4096 || !SITE_COOKIE_OCTET_RE.test(credential) || separator <= 0 || separator === credential.length - 1) return refuse("SITE_REQUEST_MALFORMED");
      const controller = new AbortController();
      let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
      let response: Response | undefined;
      let timer: ReturnType<typeof setTimeout> | undefined;

      const deadline = new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => { controller.abort(); reject(new Error("CATALOG_SESSION_DEADLINE")); }, timeoutMs);
      });

      const invalid = () => refuse("IDENTITY_ADAPTER_OUTPUT_INVALID");

      try {
        const incoming = Promise.resolve(transport(origin + "/api/auth/own-session", {
          method: "GET", headers: { Accept: "application/json", Origin: origin, [SITE_SESSION_HEADER]: credential },
          credentials: "omit", cache: "no-store", redirect: "error", signal: controller.signal,
        })).then(result => {
          if (controller.signal.aborted) void result.body?.cancel().catch(() => undefined);

          return result;
        });

        response = await Promise.race([incoming, deadline]);

        if (response.redirected || (response.url !== "" && response.url !== origin + "/api/auth/own-session") || response.status >= 300 && response.status < 400 || !/^application\/json(?:\s*;|$)/i.test(response.headers.get("content-type") ?? "") || !(response.headers.get("cache-control") ?? "").split(",").some(part => part.trim().toLowerCase() === "no-store")) return invalid();
        const length = response.headers.get("content-length");

        if (length !== null && (!/^\d+$/.test(length) || Number(length) > CATALOG_SESSION_MAX_RESPONSE_BYTES)) return invalid();

        if (response.body === null) return invalid();
        reader = response.body.getReader();
        let total = 0;
        const chunks: Uint8Array[] = [];

        while (true) {
          const chunk = await Promise.race([reader.read(), deadline]);

          if (chunk.done) break;

          if (chunk.value.byteLength === 0) return invalid();
          total += chunk.value.byteLength;

          if (total > CATALOG_SESSION_MAX_RESPONSE_BYTES) return invalid();
          chunks.push(chunk.value);
        }

        const bytes = new Uint8Array(total);
        let offset = 0;

        for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }

        let wire: unknown;

        try { wire = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
        catch { return invalid(); }

        const result = parseWire(wire, response.status);

        // A captured response for a different carried session is not a valid replay.
        if (result.ok && result.value.session.sessionId !== credential.slice(0, separator)) return invalid();

        return result;
      } catch { return refuse("IDENTITY_PLANE_UNAVAILABLE"); }
      finally {
        if (timer !== undefined) clearTimeout(timer);

        if (reader !== undefined) { void reader.cancel().catch(() => undefined); reader.releaseLock(); }
        else if (response?.body !== null && response?.body !== undefined) void response.body.cancel().catch(() => undefined);
      }
    },
  };

  const planeOptions: CatalogIdentityPlaneOptionsBuilder = { adapter: readerAdapter };

  if (now !== undefined) planeOptions.now = now;
  const plane = createIdentityPlane(planeOptions);

  return Object.freeze({
    async resolvePrincipal(request: SiteIdentityRequest): Promise<SiteResult<SitePrincipal>> {
      // Capture top-level descriptors ONCE before an outer port reads credentials.
      try {
        if (!isBoundaryObjectOrNull(request) || request === null) return refuse("SITE_REQUEST_MALFORMED");
        const descriptors = Object.getOwnPropertyDescriptors(request);

        if (descriptors["surface"]?.value === "kids") return refuse("KIDS_SURFACE_DENIED");

        if (!serverRuntime()) return refuse("IDENTITY_PLANE_NOT_WIRED");

        if (snapshot === null) return refuse("SITE_REQUEST_MALFORMED");
        const captured: RawCatalogSessionRecord = {};
        Object.defineProperties(captured, descriptors);
        // Never launder arrays/prototypes into plain records.
        const prototype = Object.getPrototypeOf(request);

        if (prototype !== Object.prototype && prototype !== null || Reflect.ownKeys(request).some(key => !isBoundaryString(key))) return refuse("SITE_REQUEST_MALFORMED");
        const invalid = inspectRequest(captured);

        if (invalid !== null) return refuse(invalid);
        const surface: unknown = descriptors["surface"]?.value;

        if (surface !== "site") return refuse("IDENTITY_SESSION_SURFACE_MISMATCH");
        const credential: unknown = descriptors["sessionToken"]?.value;

        if (credential !== undefined && credential !== null && !isBoundaryString(credential)) return refuse("SITE_REQUEST_MALFORMED");

        const principalRequest: SiteIdentityRequestBuilder = { surface: "site" };

        if (credential !== undefined) principalRequest.sessionToken = credential;

        return plane.resolvePrincipal(Object.freeze(principalRequest));
      } catch { return refuse("SITE_REQUEST_MALFORMED"); }
    },
  });
}

/** Honest deployment composition: no adapter installed without approved safe origin. */
export function createCatalogServerIdentityPlane(options: CatalogServerFetchOptions = {}): CatalogIdentityPlane {
  const snapshot = captureOptions(options);
  const enabled = snapshot !== null && serverRuntime() && snapshot.approved === true && configuredOrigin(snapshot) !== null;

  // Already invokes authoritative validation after its descriptor guard.
  // Another createIdentityPlane would read credentials before the guard.
  return Object.freeze({ identity: capturedAdapter(snapshot), wired: enabled });
}

function isBoundaryString(value: CatalogSessionInput): value is string {
  return typeof value === "string";
}

function isBoundaryBoolean(value: CatalogSessionInput): value is boolean {
  return typeof value === "boolean";
}

function isBoundaryNumber(value: CatalogSessionInput): value is number {
  return typeof value === "number";
}

function isBoundaryObjectOrNull(value: CatalogSessionInput): value is object | null {
  return isBoundaryObjectValue(value);
}

function isBoundaryCallable(value: CatalogSessionInput): value is CallableFunction {
  return typeof value === "function";
}

type CatalogIdentityPlaneOptions = NonNullable<Parameters<typeof createIdentityPlane>[0]>;

type CatalogIdentityPlaneOptionsBuilder = { -readonly [Key in keyof CatalogIdentityPlaneOptions]: CatalogIdentityPlaneOptions[Key] };

type SiteIdentityRequestBuilder = { -readonly [Key in keyof SiteIdentityRequest]: SiteIdentityRequest[Key] };

type BoundaryObjectValue = object | null;

function isBoundaryObjectValue<Input>(value: Input): value is Input & Readonly<BoundaryObjectValue> {
  return typeof value === "object";
}
