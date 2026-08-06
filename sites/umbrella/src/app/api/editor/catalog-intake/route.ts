import { NextResponse, type NextRequest } from "next/server";
import {
  EDITOR_DEEP_LINK_PATH,
  readEditorState,
  renderEditorState,
  sitePathWithSearchParams,
} from "@sceneaxi/site-kit";
import { umbrellaRequestAuthority } from "../../../../lib/request-authority.js";
import {
  buildUmbrellaCatalogIntakeView,
  umbrellaCatalogIntake,
  umbrellaEditorStateFromFields,
} from "../../../../lib/catalog-submission.js";
import { verifyLoginRequestOrigin } from "../../../../lib/login-flow.js";
import { resolveUmbrellaEditorAccess } from "../../../../lib/site-config.js";
import { readSessionToken, readSiteMutationRequestSignals } from "../../../_session.js";

/**
 * The one place a catalog intake submission may happen (sceneaxi#218).
 *
 * `POST` only, and there is no `GET`: submitting is an action a person takes, never
 * something a page render, a prefetch, or a crawler does. `/editor` renders the panel
 * from `readUmbrellaCatalogIntakePanel()`, which reads and never writes, and the panel's
 * one control posts here.
 *
 * Everything this handler decides, it decides again rather than trusting the form: the
 * submission must prove it came from this deployment's own pages, entitlement is
 * re-resolved from the request's own session credential, and the editor state is read
 * and rendered through the same `readEditorState()`/`renderEditorState()` the page used —
 * so the digests that reach intake are this render's own, and a tampered hidden field
 * refuses here instead of describing a session nobody opened.
 *
 * Outcomes follow the shape `/api/checkout` already established: a refusal is the seam's
 * own named reason as JSON, and success is a 303 back to the editor, whose panel then
 * reads the stored record back. Never 307 — a method-preserving redirect would re-post
 * the submission at the destination.
 */
export const dynamic = "force-dynamic";

function refusalResponse(reason: string, message: string, status: number): Response {
  return NextResponse.json({ ok: false, reason, message }, { status });
}

export async function POST(request: NextRequest) {
  const signals = readSiteMutationRequestSignals(request);
  // The deployment's one same-origin form proof — site-kit's `verifySiteFormOrigin`
  // with the configured-origin precedence the session cookie already uses. `SameSite=Lax`
  // does not withhold a cookie from a cross-site POST navigation, so this is checked
  // before a field is read or a provider is reached.
  const requestOrigin = verifyLoginRequestOrigin(process.env, signals.formOrigin);
  if (!requestOrigin.ok) {
    return refusalResponse(requestOrigin.reason, requestOrigin.message, 403);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return refusalResponse("SITE_REQUEST_MALFORMED", "The submission could not be read.", 400);
  }

  const params = umbrellaEditorStateFromFields(
    [...form.entries()].flatMap(([name, value]) =>
      typeof value === "string" ? [{ name, value }] : [],
    ),
  );

  const sessionToken = await readSessionToken();
  const plane = umbrellaRequestAuthority().plane({ sessionToken });
  const resolved = await resolveUmbrellaEditorAccess({ plane, env: process.env, sessionToken });
  if (!resolved.decision.granted) {
    return refusalResponse(resolved.decision.reason, resolved.decision.message, 403);
  }

  const state = readEditorState(params);
  if (!state.ok) return refusalResponse(state.reason, state.message, 400);
  const render = renderEditorState(state.value);
  if (!render.ok) return refusalResponse(render.reason, render.message, 400);

  const submitted = await buildUmbrellaCatalogIntakeView({
    access: resolved,
    render: render.value,
    profile: state.value.profileId,
    surface: state.value.profileId === "web" ? "catalog-web" : "catalog-game",
    injection: umbrellaCatalogIntake(),
  });
  if (!submitted.ok) return refusalResponse(submitted.reason, submitted.message, 409);

  return new Response(null, {
    status: 303,
    headers: new Headers({ Location: sitePathWithSearchParams(EDITOR_DEEP_LINK_PATH, params) }),
  });
}
