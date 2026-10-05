import { ok, refuse, type SiteResult } from "./refusals.js";

function isString(value: unknown): value is string { return typeof value === "string"; }

/** A caller cannot substitute a recent timestamp, role, or fresh local session row for a password check. */
export async function verifySiteAdminReauthentication(input: {
  credential: unknown; password: unknown;
  verify?: ((credential: string, password: string) => Promise<boolean>) | undefined;
}): Promise<SiteResult<true>> {
  if (!isString(input.credential) || input.credential.length > 641 || !/^[^\s;]+\.[^\s;]+$/.test(input.credential) || !isString(input.password) || input.password.length < 1 || input.password.length > 128 || input.verify === undefined) return refuse("ADMIN_REAUTHENTICATION_REQUIRED");

  try { return await input.verify(input.credential, input.password) === true ? ok(true) : refuse("ADMIN_REAUTHENTICATION_REQUIRED"); }
  catch { return refuse("ADMIN_REAUTHENTICATION_REQUIRED"); }
}
