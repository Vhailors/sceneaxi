/** Framework-neutral shape of one site request's decoded query parameters. */
export type SearchParams = Readonly<
  Record<string, string | readonly string[] | undefined>
>;

/**
 * Rebuild the same-site request target a guarded page should resume after login.
 *
 * Values are encoded only as query data, so they cannot alter the fixed route.
 * Repeated parameters remain repeated and malformed editor state remains malformed
 * after sign-in rather than silently becoming a different request.
 */
export function sitePathWithSearchParams(
  path: `/${string}`,
  params: SearchParams,
): string {
  const query = new URLSearchParams();
  for (const [name, value] of Object.entries(params)) {
    if (typeof value === "string") {
      query.append(name, value);
      continue;
    }
    if (value !== undefined) {
      for (const entry of value) query.append(name, entry);
    }
  }
  const serialized = query.toString();
  return serialized.length === 0 ? path : `${path}?${serialized}`;
}
