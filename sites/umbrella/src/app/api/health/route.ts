import { umbrellaConstructionDiagnostics, umbrellaRequestAuthority } from "../../../lib/request-authority.js";
import { serverLog } from "../../../lib/server-logger.js";

export const dynamic = "force-dynamic";

// Configuration is fixed per process, so each misconfigured plane is logged once,
// not on every probe of this endpoint.
const reported = new Set<string>();

export function GET() {
  const { planes, configuration } = umbrellaRequestAuthority().health();

  for (const [plane, state] of Object.entries(planes)) {
    if (state !== "misconfigured" || reported.has(plane)) continue;
    reported.add(plane);
    serverLog("error", "umbrella.health.misconfigured", { plane });
  }

  return Response.json(
    {
      ok: Object.values(planes).every((state) => state !== "misconfigured"),
      planes,
      variables: configuration,
      construction: umbrellaConstructionDiagnostics(),
      commit: process.env.SCENEAXI_BUILD_COMMIT ?? "unknown",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
