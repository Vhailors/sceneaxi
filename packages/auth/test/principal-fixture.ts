/**
 * Test-only issuance seam for genuine principal fixtures.
 *
 * This file is not part of `@sceneaxi/auth`'s published `src` surface. Tests
 * pass a structural fixture through the real schema validator, then receive
 * the exact object recorded by the same provenance witness as identity-port
 * sign-in and session verification.
 */

import { validatePrincipal, type Principal } from "@sceneaxi/schemas";
import { issuePrincipalProvenance } from "../src/principal-provenance.js";

export function issuePrincipalForTest(value: unknown): Principal {
  const validated = validatePrincipal(value);
  if (!validated.ok) {
    throw new Error(
      `principal fixture is invalid (${validated.code}): ${validated.message}`,
    );
  }
  return issuePrincipalProvenance(validated.value);
}
