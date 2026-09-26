import { umbrellaRequestAuthority } from "../../../lib/request-authority.js";
import { serverLog } from "../../../lib/server-logger.js";

export const dynamic = "force-dynamic";

export function GET() {
  const { planes } = umbrellaRequestAuthority().health();
  for (const [plane, state] of Object.entries(planes)) {
    if (state === "misconfigured") serverLog("error", "umbrella.health.misconfigured", { plane });
  }

  return Response.json(
    {
      ok: Object.values(planes).every((state) => state !== "misconfigured"),
      planes,
      commit: process.env.SCENEAXI_BUILD_COMMIT ?? "unknown",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
