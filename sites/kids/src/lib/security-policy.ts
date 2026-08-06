import securityPolicy from "../../security-headers.json" with { type: "json" };

/** Browser-enforced companion to the Kids site's dependency and source gates. */
export const KIDS_SECURITY_HEADERS = Object.freeze(
  securityPolicy.headers.map((header) => Object.freeze({ ...header })),
);

const contentSecurityPolicy = KIDS_SECURITY_HEADERS.find(
  (header) => header.key === "Content-Security-Policy",
);
if (contentSecurityPolicy === undefined) {
  throw new Error("The isolated Kids site has no Content-Security-Policy header.");
}

export const KIDS_CONTENT_SECURITY_POLICY = contentSecurityPolicy.value;

/** Next's own name for the phase that only `next dev` ever runs in. */
export const KIDS_DEVELOPMENT_SERVER_PHASE = "phase-development-server";

/**
 * The local development server cannot run under the shipped policy: its hot-reload
 * channel is a socket `connect-src` governs, and its compiler wraps modules in
 * `eval`. `security-headers.json` therefore declares a second, fully written-out
 * header list for that one phase, so this module and `next.config.ts` both *select*
 * a list rather than each deriving one — Next's config transpiler cannot reach this
 * file, and a rule copied into two places is a rule enforced in neither.
 */
export const KIDS_DEVELOPMENT_SERVER_HEADERS = Object.freeze(
  securityPolicy.developmentServerHeaders.map((header) => Object.freeze({ ...header })),
);

/**
 * Response headers for one Next phase.
 *
 * Every phase but the development server receives the shipped policy unchanged —
 * the deployed Kids origin keeps `connect-src 'none'` and its external-data denial
 * exactly as `security-headers.json` states it.
 */
export function kidsSecurityHeadersForPhase(phase: string) {
  return phase === KIDS_DEVELOPMENT_SERVER_PHASE
    ? KIDS_DEVELOPMENT_SERVER_HEADERS
    : KIDS_SECURITY_HEADERS;
}
