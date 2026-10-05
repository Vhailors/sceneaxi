import { ok, refuse, type SiteResult } from "./refusals.js";

/** A caller cannot substitute a recent timestamp, role, or fresh local session row for a password check. */
export async function verifySiteAdminReauthentication(input: {
  credential: unknown; password: unknown;
  verify?: ((credential: string, password: string) => Promise<boolean>) | undefined;
}): Promise<SiteResult<true>> {
  if (typeof input.credential !== "string" || input.credential.length > 641 || !/^[^\s;]+\.[^\s;]+$/.test(input.credential) || typeof input.password !== "string" || input.password.length < 1 || input.password.length > 128 || input.verify === undefined) return refuse("ADMIN_REAUTHENTICATION_REQUIRED");

  try { return await input.verify(input.credential, input.password) === true ? ok(true) : refuse("ADMIN_REAUTHENTICATION_REQUIRED"); }
  catch { return refuse("ADMIN_REAUTHENTICATION_REQUIRED"); }
}
