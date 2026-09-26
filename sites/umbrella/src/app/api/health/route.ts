import { umbrellaRequestAuthority } from "../../../lib/request-authority.js";

export const dynamic = "force-dynamic";

export function GET() {
  const { planes } = umbrellaRequestAuthority().health();

  return Response.json(
    {
      ok: Object.values(planes).every((state) => state !== "misconfigured"),
      planes,
      commit: process.env.SCENEAXI_BUILD_COMMIT ?? "unknown",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
