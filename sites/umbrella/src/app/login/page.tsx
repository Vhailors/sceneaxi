import {
  describeSiteAccessState,
  readEditorPreviewFlag,
  type SearchParams,
} from "@sceneaxi/site-kit";
import {
  IDENTITY_PLANE_DOC,
  IDENTITY_PLANE_PENDING_NOTE,
  umbrellaRequestAuthority,
} from "../../lib/request-authority.js";
import {
  LOGIN_DEFAULT_DESTINATION,
  readLoginRefusalReason,
  resolveLoginDestination,
} from "../../lib/login-flow.js";
import { readSessionToken } from "../_session.js";
import { StatePanel } from "../_components/state-panel.js";

/**
 * The hosted sign-in surface (sceneaxi#185).
 *
 * The form posts email and password to `/api/login`, which drives the identity
 * plane's login port — the same `@sceneaxi/auth` identity port a deployment
 * supplies through `umbrellaRequestAuthority()`. Nothing about who the visitor is
 * comes from this page: the browser proves credentials to the injected
 * provider, and role, identity, and session all come back server-derived.
 *
 * Three states, each named: already signed in (no form), sign-in not activated
 * on this deployment (a deployment fact with the wiring doc), and the form —
 * with any refused attempt's own named reason above it, carried back as a
 * validated registry key rather than free text.
 */
export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  readonly searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const sessionToken = await readSessionToken();
  const plane = umbrellaRequestAuthority().plane({ sessionToken });
  const current = await plane.identity.resolvePrincipal({ surface: "site", sessionToken });

  const refusalReason = readLoginRefusalReason(params["reason"]);
  const refusal = refusalReason === null ? null : describeSiteAccessState(refusalReason);
  const next = resolveLoginDestination(params["next"]);
  const previewEnabled = readEditorPreviewFlag(process.env);

  if (current.ok) {
    return (
      <div className="page">
        <div className="page-head">
          <p className="eyebrow">Sign in</p>
          <h1>You are already signed in</h1>
        </div>
        <StatePanel
          tone="ok"
          level={2}
          title="Signed in"
          evidence={[
            { term: "Email", value: current.value.user.email },
            { term: "Role", value: current.value.role },
          ]}
        >
          <p>
            This browser carries a live session, so there is nothing to sign in to.
          </p>
          <p>
            <a className="button" href="/account">
              Account
            </a>{" "}
            <a className="button button-quiet" href="/editor">
              Open the editor
            </a>
          </p>
          <form method="post" action="/api/logout">
            <button className="button button-quiet" type="submit">
              Sign out
            </button>
          </form>
        </StatePanel>
      </div>
    );
  }

  if (!plane.wired.login) {
    return (
      <div className="page">
        <div className="page-head">
          <p className="eyebrow">Sign in</p>
          <h1>Sign-in is not activated on this deployment</h1>
        </div>
        <StatePanel
          tone="deny"
          level={2}
          title="Identity plane not wired"
          reason="IDENTITY_PLANE_NOT_WIRED"
        >
          <p>{IDENTITY_PLANE_PENDING_NOTE}</p>
          <p>
            The wiring steps and the exact environment variables are documented in{" "}
            <code>{IDENTITY_PLANE_DOC}</code>.
          </p>
          {previewEnabled && (
            <p>
              This deployment sets the temporary server-side editor preview flag, so
              the Minimum E2 editor is demonstrable without an account. That flag is a
              stopgap, not the product path, and it is removed once sign-in activates
              here.
            </p>
          )}
          <p>
            Everything free stays available now:{" "}
            <a href="/engine">the engine SDK download</a>, <a href="/docs">the docs</a>,
            and browsing either catalog.
          </p>
        </StatePanel>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-head">
        <p className="eyebrow">Sign in</p>
        <h1>Sign in to SceneAxi</h1>
        <p className="lede">
          Signing in unlocks the Minimum E2 web editor and hosted AI. Your role is
          derived on the server from its own configuration — there is nothing a browser
          can claim.
        </p>
      </div>

      {refusal !== null && (
        <StatePanel tone="deny" title={refusal.title} reason={refusal.reason}>
          <p>{refusal.body}</p>
        </StatePanel>
      )}

      <form method="post" action="/api/login">
        {next !== LOGIN_DEFAULT_DESTINATION && (
          <input type="hidden" name="next" value={next} />
        )}
        <div className="row">
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              size={28}
            />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              size={28}
            />
          </div>
          <button className="button" type="submit">
            Sign in
          </button>
        </div>
      </form>

      <p className="note">
        The session is an HttpOnly cookie scoped to this site, bound to the session the
        identity provider issued, and it expires when that session does. Accounts are
        created by the deployment&rsquo;s identity provider; this form only signs an
        existing account in.
      </p>
    </div>
  );
}
