import type { Metadata } from "next";
import {
  describeSiteAccessState,
  readEditorPreviewFlag,
  type SearchParams,
} from "@sceneaxi/site-kit";
import { umbrellaRequestAuthority } from "../../lib/request-authority.js";
import {
  LOGIN_DEFAULT_DESTINATION,
  readLoginRefusalReason,
  resolveLoginDestination,
} from "../../lib/login-flow.js";
import { readSessionToken } from "../_session.js";
import { StatePanel } from "../_components/state-panel.js";

/** Signed-in surface: never indexed, whatever a crawler is told elsewhere. */
export const metadata: Metadata = {
  title: "Sign in — SceneAxi",
  robots: { index: false, follow: false },
};

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
 * on this deployment, and the form —
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
      <div className="page page-narrow page-state">
        <div className="page-head">
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
          <form method="post" action="/api/logout" className="form-inline">
            <button className="button button-quiet" type="submit">
              Sign out
            </button>
          </form>
        </StatePanel>
        <section aria-labelledby="account-controls">
          <h2 id="account-controls">Account controls</h2>
          <p>Sign in again within five minutes and confirm your current password for each sensitive action.</p>
          <form method="post" action="/api/auth/account/export" className="form-plain">
            <label htmlFor="export-password">Current password for export</label>{" "}
            <input id="export-password" name="password" type="password" autoComplete="current-password" required maxLength={128} />{" "}
            <button className="button button-quiet" type="submit">Download identity and billing records</button>
          </form>
          <p>This bounded export contains identity, credit account, ledger and checkout records, not a complete legal privacy export.</p>
          <form method="post" action="/api/auth/account/disable" className="form-plain">
            <label htmlFor="disable-password">Current password to disable access</label>{" "}
            <input id="disable-password" name="password" type="password" autoComplete="current-password" required maxLength={128} />
            <p><label><input name="confirm" type="checkbox" value="disable-access" required /> I understand this disables access and revokes all my sessions. It does not erase identity or financial records.</label></p>
            <button className="button button-quiet" type="submit">Disable my access</button>
          </form>
          <p>Financial history remains append-only. Identity records and backups await a reviewed category-level retention policy; no legal retention period is claimed. Self-service erasure, email recovery and MFA are unavailable on this deployment.</p>
        </section>
      </div>
    );
  }

  if (!plane.wired.login) {
    return (
      <div className="page page-narrow page-state">
        <div className="page-head">
          <h1>Sign-in is not activated on this deployment</h1>
        </div>
        <StatePanel
          tone="deny"
          level={2}
          title="Sign-in is unavailable"
          reason="IDENTITY_PLANE_NOT_WIRED"
        >
          <p>Sign-in is not available right now. Your named reason is shown above.</p>
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
    <div className="page page-narrow page-state">
      <div className="page-head">
        <h1>Sign in to SceneAxi</h1>
        <p className="lede">
          Signing in establishes identity for access checks. Editor access still needs an entitlement; hosted AI remains default-off. Your role is
          derived on the server from its own configuration — there is nothing a browser
          can claim.
        </p>
      </div>

      {refusal !== null && (
        <StatePanel tone="deny" title={refusal.title} reason={refusal.reason}>
          <p>{refusal.body}</p>
        </StatePanel>
      )}

      <form method="post" action="/api/login" className="form-card">
        {next !== LOGIN_DEFAULT_DESTINATION && (
          <input type="hidden" name="next" value={next} />
        )}
        <div className="form-stack">
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
          <button className="button button-block" type="submit">
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
