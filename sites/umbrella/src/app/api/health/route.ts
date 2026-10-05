import { umbrellaRequestAuthority } from "../../../lib/request-authority.js";
import { serverLog } from "../../../lib/server-logger.js";


export const dynamic = "force-dynamic";

// Configuration is fixed per process, so each misconfigured plane is logged once,
// not on every probe of this endpoint.
const reported = new Set<string>();

export function GET() {
  const { planes, configuration, construction } = umbrellaRequestAuthority().health();
  // Exhaustive, one-to-one public labels preserve each diagnostic state without
  // exposing deployment environment names or their values. Internal keys stay unchanged.
  const publicConfigurationKeys = {
    database: "DATABASE_URL",
    identityOrigin: "BETTER_AUTH_ORIGIN",
    identitySigning: "BETTER_AUTH_SECRET",
    administratorEmail: "SCENEAXI_ADMIN_EMAIL",
    administratorBootstrap: "SCENEAXI_ADMIN_BOOTSTRAP_SECRET",
    paymentApi: "STRIPE_SECRET_KEY",
    paymentWebhook: "STRIPE_WEBHOOK_SECRET",
    billingMode: "SCENEAXI_BILLING_MODE",
    umbrellaOrigin: "NEXT_PUBLIC_SCENEAXI_UMBRELLA_ORIGIN",
    gameCatalogOrigin: "NEXT_PUBLIC_SCENEAXI_GAME_CATALOG_ORIGIN",
    webCatalogOrigin: "NEXT_PUBLIC_SCENEAXI_WEB_CATALOG_ORIGIN",
    editorPreview: "SCENEAXI_SITE_EDITOR_PREVIEW",
  } as const satisfies Readonly<Record<string, keyof typeof configuration>>;
  const mappedKeys: ReadonlySet<string> = new Set(Object.values(publicConfigurationKeys));
  if (mappedKeys.size !== Object.keys(configuration).length ||
      Object.keys(configuration).some((key) => !mappedKeys.has(key))) {
    throw new Error("Unmapped health configuration state");
  }
  const configurationStates: Readonly<Record<string, string>> = configuration;
  const variables = Object.fromEntries(Object.entries(publicConfigurationKeys).map(
    ([label, name]) => [label, configurationStates[name]],
  ));

  for (const [plane, state] of Object.entries(planes)) {
    if (state !== "misconfigured" || reported.has(plane)) continue;
    reported.add(plane);
    serverLog("error", "umbrella.health.misconfigured", { plane });
  }

  return Response.json(
    {
      ok: Object.values(planes).every((state) => state !== "misconfigured"),
      planes,
      variables,
      construction,
      commit: process.env.SCENEAXI_BUILD_COMMIT ?? "unknown",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
