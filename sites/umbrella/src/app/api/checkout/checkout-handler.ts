import { SITE_REFUSALS, resolveCheckoutRedirectOrigin, type SiteBillingPort, type SiteResult, type SiteFormOriginSignals } from "@sceneaxi/site-kit";
import { verifyLoginRequestOrigin } from "../../../lib/login-flow.js";
import type { serverLog } from "../../../lib/server-logger.js";

type RefusalOptions = { status: number; headers?: { "Retry-After": string } };

type CheckoutPlane = {
  wired: { billing: boolean };
  identity: { resolvePrincipal(input: { surface: "site"; sessionToken: string | null }): Promise<SiteResult<{ user: { userId: string } }>> };
  billing: Pick<SiteBillingPort, "createCheckout">;
};

export type CheckoutDependencies = {
  environment(): Parameters<typeof verifyLoginRequestOrigin>[0];
  readRequestSignals(request: Request): { formOrigin: Omit<SiteFormOriginSignals, "configuredOrigin"> };
  readSessionToken(): Promise<string | null>;
  plane(sessionToken: string | null): CheckoutPlane;
  log: typeof serverLog;
  json(payload: { ok: false; reason: string; message: string }, options: RefusalOptions): Response;
  redirect(url: string, status: 303): Response;
};

/**
 * Credit-pack checkout — the request-bound path that reaches `SiteBillingPort`.
 *
 * The pricing page submits the selected `packId` and a per-render attempt token here;
 * this handler resolves the principal from the carried session token, asks the billing
 * port to create a Stripe TEST checkout, and redirects to the handoff URL it returns.
 * Every refusal — an unwired plane, an insecure URL, an unknown pack — is the port's own
 * named reason, never an invented checkout.
 *
 * The billing plane's own refusal is diagnosed first: an all-unwired deployment returns
 * `BILLING_PLANE_NOT_WIRED`, the named reason for the capability being attempted, rather
 * than the identity plane's. Identity is still resolved before a real checkout is created;
 * only the unwired-diagnosis order changes so the reason matches the capability.
 */
export function createCheckoutHandler(dependencies: CheckoutDependencies) {
  function refusalResponse(request: Request, reason: string, message: string): Response {
    dependencies.log("warn", "umbrella.checkout.refused", { reason });

    if (request.headers.get("accept")?.includes("application/json")) {
      const status = reason === "SITE_REQUEST_CROSS_ORIGIN" ? 403
        : reason === "BILLING_CHECKOUT_REQUEST_INVALID" ? 400
        : reason === "BILLING_CHECKOUT_RATE_LIMITED" ? 429 : 402;

      const options: RefusalOptions = { status };

      if (status === 429) options.headers = { "Retry-After": "300" };

      return dependencies.json({ ok: false, reason, message }, options);
    }

    // A same-site relative `Location`, as the login flow answers: nothing here is derived
    // from the request's own host.
    const signedOut = reason === "IDENTITY_SESSION_ABSENT";
    const query = new URLSearchParams(signedOut ? { next: "/pricing", reason } : { reason });

    return new Response(null, {
      status: 303,
      headers: { Location: `${signedOut ? "/login" : "/pricing"}?${query.toString()}` },
    });
  }

  return async function checkout(request: Request) {
    // The same same-origin form proof login, logout, and catalog intake require:
    // `SameSite=Lax` still sends the session cookie on a cross-site top-level POST.
    const signals = dependencies.readRequestSignals(request);
    const requestOrigin = verifyLoginRequestOrigin(dependencies.environment(), signals.formOrigin);

    if (!requestOrigin.ok) {
      return refusalResponse(
        request,
        requestOrigin.reason,
        SITE_REFUSALS[requestOrigin.reason],
      );
    }

    // Decode only a bounded form. An unsupported type, oversized body or truncated
    // multipart is user input, not an unhandled server/provider failure.
    let form: FormData;

    try {
      const contentType = request.headers.get("content-type") ?? "";

      if (!/^(application\/x-www-form-urlencoded|multipart\/form-data)(?:;|$)/i.test(contentType)) {
        throw new Error("unsupported checkout form");
      }

      if (request.signal.aborted) throw new Error("aborted checkout form");
      const reader = request.body?.getReader();

      if (reader === undefined) throw new Error("missing checkout form");
      const chunks: Uint8Array[] = [];
      let size = 0;
      let completed = false;
      let rejectStopped: (reason: Error) => void = () => {};
      const stopped = new Promise<never>((_, reject) => { rejectStopped = reject; });
      const onAbort = () => rejectStopped(new Error("aborted checkout form"));
      // One total budget for an 8 KiB form, below the server's 10s transport
      // budget. Receiving another chunk must not extend this deadline.
      const deadline = setTimeout(() => rejectStopped(new Error("checkout form deadline")), 5000);
      request.signal.addEventListener("abort", onAbort, { once: true });
      if (request.signal.aborted) onAbort();

      try {
        while (true) {
          const chunk = await Promise.race([reader.read(), stopped]);

          // A fulfilled read can win the microtask race with a concurrent abort.
          if (request.signal.aborted) throw new Error("aborted checkout form");

          if (chunk.done) { completed = true; break; }
          size += chunk.value.byteLength;

          if (size > 8192) {
            throw new Error("oversized checkout form");
          }

          chunks.push(chunk.value);
        }
      } finally {
        clearTimeout(deadline);
        request.signal.removeEventListener("abort", onAbort);
        // Initiate transport cleanup, but never let a stalled or rejected
        // cancellation hold the named refusal or produce an unhandled rejection.
        if (!completed) { void reader.cancel().catch(() => {}); }
        reader.releaseLock();
      }

      const bytes = new Uint8Array(size);
      let offset = 0;

      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }

      form = await new Response(bytes, { headers: { "content-type": contentType } }).formData();

      if ([...form.keys()].length !== 2 || form.getAll("packId").length !== 1 || form.getAll("attempt").length !== 1) {
        throw new Error("ambiguous checkout form");
      }
    } catch {
      return refusalResponse(request, "BILLING_CHECKOUT_REQUEST_INVALID", SITE_REFUSALS.BILLING_CHECKOUT_REQUEST_INVALID);
    }

    const packIdEntry = form.get("packId");

    const packId =
      packIdEntry === null || packIdEntry instanceof File ? "" : packIdEntry.trim();

    const attemptEntry = form.get("attempt");

    const attempt =
      attemptEntry === null || attemptEntry instanceof File ? "" : attemptEntry.trim();

    if (!/^[A-Za-z0-9_-]{16,128}$/.test(attempt)) {
      return refusalResponse(
        request,
        "BILLING_CHECKOUT_REQUEST_INVALID",
        SITE_REFUSALS.BILLING_CHECKOUT_REQUEST_INVALID,
      );
    }

    // The plane is bound to this request's session credential, so the billing port
    // authorizes the purchase against the session the server verified rather than
    // against the user id this form submitted.
    const sessionToken = await dependencies.readSessionToken();
    const plane = dependencies.plane(sessionToken);

    if (!plane.wired.billing) {
      return refusalResponse(request, "BILLING_PLANE_NOT_WIRED", SITE_REFUSALS.BILLING_PLANE_NOT_WIRED);
    }

    // Redirect targets come from the deployment's configured umbrella origin, never from
    // this request's `Host`: a forwarded or aliased host must not be able to point the
    // payment provider's post-payment redirect away from SceneAxi. Resolved after the
    // wiring check, so an unwired deployment is not misdiagnosed as a misconfigured origin.
    const origin = resolveCheckoutRedirectOrigin(dependencies.environment(), new URL(request.url).origin);

    if (!origin.ok) {
      return refusalResponse(request, origin.reason, origin.message);
    }

    const principal = await plane.identity.resolvePrincipal({
      surface: "site",
      sessionToken,
    });

    if (!principal.ok) {
      return refusalResponse(request, principal.reason, principal.message);
    }

    const checkout = await plane.billing.createCheckout({
      userId: principal.value.user.userId,
      packId,
      successUrl: `${origin.value}/account?checkout=success`,
      cancelUrl: `${origin.value}/pricing?checkout=cancelled`,
      idempotencyKey: `pack:${packId}:user:${principal.value.user.userId}:attempt:${attempt}`,
    });

    if (!checkout.ok) {
      return refusalResponse(request, checkout.reason, checkout.message);
    }

    // 303 See Other, never 307: this handler answers a form POST, and a method-preserving
    // redirect would re-issue that POST against the hosted checkout URL instead of
    // navigating the buyer to it. The billing port has already proven the URL is https.
    return dependencies.redirect(checkout.value.redirectUrl, 303);
  }
}
