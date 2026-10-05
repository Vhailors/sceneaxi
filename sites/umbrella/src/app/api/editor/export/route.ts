import { buildOfflineWebExport, readWebExperienceEditorState, readEditorState } from "@sceneaxi/site-kit";
import { umbrellaRequestAuthority } from "../../../../lib/request-authority.js";
import { resolveUmbrellaEditorAccess } from "../../../../lib/site-config.js";
import { readSessionToken } from "../../../_session.js";

/** Read-only export: recheck real entitlement, never trust a checkpoint's owner. */
export async function GET(request: Request) {
  const sessionToken = await readSessionToken();
  const plane = umbrellaRequestAuthority().plane({ sessionToken });
  const access = await resolveUmbrellaEditorAccess({ plane, env: process.env, sessionToken });
  const headers = { "cache-control": "no-store", "x-content-type-options": "nosniff" };

  if (!access.decision.granted) return Response.json({ code: access.decision.reason }, { status: 403, headers });
  const url = new URL(request.url);

  if (url.searchParams.get("profile") !== "web") return Response.json({ code: "WEB_EXPORT_PROFILE_REQUIRED" }, { status: 400, headers });
  const params = Object.fromEntries([...url.searchParams.keys()].map(key => [key, url.searchParams.getAll(key).length === 1 ? url.searchParams.get(key) ?? "" : url.searchParams.getAll(key)]));
  const editor = readEditorState(params);

  if (!editor.ok) return Response.json({ code: editor.reason }, { status: 400, headers });
  const state = readWebExperienceEditorState(params);

  if (!state.ok) return Response.json({ code: state.reason }, { status: 400, headers });

  try {
    const bundle = buildOfflineWebExport(state.value);

    return new Response(Buffer.from(bundle.archive), { headers: { ...headers, "content-type": "application/zip", "content-disposition": 'attachment; filename="sceneaxi-offline-web.zip"', "x-sceneaxi-document-digest": bundle.documentDigest } });
  } catch {
    return Response.json({ code: "WEB_EXPORT_EXTERNAL_ASSET_UNSUPPORTED" }, { status: 400, headers });
  }
}
