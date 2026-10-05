import { umbrellaRequestAuthority } from "../../../../lib/request-authority.js";
import { createOwnSessionHandler } from "../../../../provider/own-session.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Lazy facade access keeps all configuration/provider failures inside the no-store
// handler. The only deployment setting exposed here is development loopback policy.
export const GET = createOwnSessionHandler({
  verifyFormOrigin: (signals) => umbrellaRequestAuthority().verifyFormOrigin(signals),
  plane: (request) => umbrellaRequestAuthority().plane(request),
}, {
  allowLoopbackDevelopment: process.env.NODE_ENV === "development",
  configuredOrigin: () => process.env.NEXT_PUBLIC_SCENEAXI_UMBRELLA_ORIGIN,
});

// Explicit method refusals preserve the same private response policy as GET.
export const POST = GET;
export const PUT = GET;
export const PATCH = GET;
export const DELETE = GET;
export const HEAD = GET;
export const OPTIONS = GET;
