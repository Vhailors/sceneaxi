/**
 * Runtime provenance for identity-port principals.
 *
 * A `Principal` is a public structural contract, so shape alone cannot prove
 * that authentication produced it. This witness remembers only the exact
 * objects the identity port issued. Copies and hand-built look-alikes do not
 * carry that object identity.
 */

import {
  createProvenanceWitness,
  type Principal,
} from "@sceneaxi/schemas";

const principalProvenance = createProvenanceWitness<Principal>();

/** Whether this exact principal object was issued through the identity port. */
export function hasPrincipalProvenance(value: unknown): value is Principal {
  return principalProvenance.holds(value);
}

/**
 * Issue one validated principal.
 *
 * This is an internal package authority: it is deliberately absent from the
 * public package barrel. Production calls it only from `createIdentityPort`;
 * the package-local test fixture seam calls it from outside the published
 * `src` surface.
 */
export function issuePrincipalProvenance(principal: Principal): Principal {
  return principalProvenance.issue(principal);
}
