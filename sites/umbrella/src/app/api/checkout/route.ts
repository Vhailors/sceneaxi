import { NextResponse, type NextRequest } from "next/server";
import { umbrellaRequestAuthority } from "../../../lib/request-authority.js";
import { readSessionToken, readSiteMutationRequestSignals } from "../../_session.js";
import { serverLog } from "../../../lib/server-logger.js";
import { createCheckoutHandler } from "./checkout-handler.js";

export const dynamic = "force-dynamic";

const checkout = createCheckoutHandler({
  environment: () => process.env,
  readRequestSignals: readSiteMutationRequestSignals,
  readSessionToken,
  plane: (sessionToken) => umbrellaRequestAuthority().plane({ sessionToken }),
  log: serverLog,
  json: (payload, options) => NextResponse.json(payload, options),
  redirect: (url, status) => NextResponse.redirect(url, status),
});

export async function POST(request: NextRequest) {
  return checkout(request);
}
