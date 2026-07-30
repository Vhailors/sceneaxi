/**
 * Test-only issuance seam for genuine principal fixtures.
 *
 * Reached only through the visibly test-only
 * `@sceneaxi/auth/testing/principal-issuance` subpath, never from the package
 * root barrel, and never from production source: the boundary checker refuses
 * any file under a package, app, or site `src` tree that imports a `testing/`
 * subpath, whether by package name or by relative path.
 *
 * Tests pass a structural fixture through the real schema validator, then
 * receive the exact object recorded by the same provenance witness as
 * identity-port sign-in and session verification.
 */

import { validatePrincipal, type Principal } from "@sceneaxi/schemas";
import { issuePrincipalProvenance } from "../principal-provenance.js";

export function issuePrincipalForTest(value: unknown): Principal {
  const validated = validatePrincipal(value);
  if (!validated.ok) {
    throw new Error(
      `principal fixture is invalid (${validated.code}): ${validated.message}`,
    );
  }
  return issuePrincipalProvenance(validated.value);
}
