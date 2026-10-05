import { NextResponse, type NextRequest } from "next/server";
import { umbrellaRequestAuthority } from "../../../../lib/request-authority.js";
import { readSessionToken, readSiteMutationRequestSignals } from "../../../_session.js";
import { serverLog } from "../../../../lib/server-logger.js";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const authority = umbrellaRequestAuthority();
  const requestOrigin = authority.verifyFormOrigin(readSiteMutationRequestSignals(request).formOrigin);
  const headers = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" };

  if (!requestOrigin.ok) {
    serverLog("warn", "umbrella.admin.refused", { reason: requestOrigin.reason });

    return NextResponse.json(requestOrigin, { status: 403, headers });
  }

  const sessionToken = await readSessionToken();
  const support = authority.plane({ sessionToken }).ledgerSupport;
  const authorized = await support.lookup({ surface: "site", target: null });

  if (!authorized.ok) {
    serverLog("warn", "umbrella.admin.refused", { reason: authorized.reason });

    return NextResponse.json(authorized, { status: 403, headers });
  }

  let form: FormData;

  try {
    form = await request.formData();
  } catch {
    serverLog("warn", "umbrella.admin.refused", { reason: "SITE_REQUEST_MALFORMED" });

    return NextResponse.json({ ok: false, reason: "SITE_REQUEST_MALFORMED", message: "The adjustment form could not be read." }, { status: 400, headers });
  }

  const result = await support.adjust({
    surface: "site", requestOrigin,
    adminPassword: form.get("adminPassword"),
    fields: {
      userId: form.get("userId"), delta: form.get("delta"),
      reason: form.get("reason"), idempotencyKey: form.get("idempotencyKey"),
    },
  });

  const userId = form.get("userId");
  const query = new URLSearchParams(typeof userId === "string" && userId.length > 0 ? { kind: "userId", query: userId } : {});

  // A browser form gets the page back with the named refusal, never a raw JSON body.
  if (!result.ok) {
    serverLog("warn", "umbrella.admin.refused", { reason: result.reason });
    query.set("refused", result.reason);
  }

  return new Response(null, { status: 303, headers: { ...headers, Location: `/admin/ledger?${query}` } });
}
