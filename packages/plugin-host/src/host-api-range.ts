/**
 * hostApi range evaluator for the Plugin Manifest v1 dialect.
 * Supports the grammar documented by PLUGIN_MANIFEST_HOST_API_DIALECT.
 */

import { satisfies, valid } from "semver";

/**
 * Return true when `hostVersion` satisfies the manifest `hostApi` range.
 * Invalid host versions refuse closed (false).
 */
export function hostApiSatisfied(
  hostApiRange: string,
  hostVersion: string,
): boolean {
  return (
    valid(hostVersion) !== null &&
    satisfies(hostVersion, hostApiRange, {
      includePrerelease: false,
      loose: false,
    })
  );
}
