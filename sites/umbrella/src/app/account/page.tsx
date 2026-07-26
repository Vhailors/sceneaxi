import { SITE_STARTER_CREDIT_ALLOTMENT, resolveEditorAccess } from "@sceneaxi/site-kit";
import { readSessionToken } from "../_session.js";
import {
  IDENTITY_PLANE_DOC,
  IDENTITY_PLANE_PENDING_NOTE,
  createUmbrellaIdentityPlane,
} from "../../lib/identity-plane.js";
import { StatePanel } from "../_components/state-panel.js";

/**
 * The account surface: anonymous, authenticated, or refused.
 *
 * Identity and credits are owned by `@sceneaxi/auth` and `@sceneaxi/billing`. This
 * page renders whatever those ports return and nothing else — no fake session, no
 * fake balance, and no client-supplied role. A role claim arriving from a client is
 * refused by the port before any adapter is consulted.
 */
export default async function AccountPage() {
  const sessionToken = await readSessionToken();
  const plane = createUmbrellaIdentityPlane(process.env, { sessionToken });
  const resolved = await resolveEditorAccess({
    identity: plane.identity,
    credits: plane.credits,
    request: { surface: "site", sessionToken },
  });

  // A signed-out visitor is its own phase. `IDENTITY_SESSION_ABSENT` is the plane
  // saying "nobody is signed in here", which must not read like a broken deployment.
  const signedOut =
    !resolved.identity.ok && resolved.identity.reason === "IDENTITY_SESSION_ABSENT";
  const phase =
    resolved.principal !== null ? "authenticated" : signedOut ? "anonymous" : "refused";

  return (
    <>
      <p className="eyebrow">Account</p>
      <h1>Your SceneAxi account</h1>
      <p className="lede">
        Signing in unlocks the Minimum E2 web editor and hosted AI. New accounts receive{" "}
        {SITE_STARTER_CREDIT_ALLOTMENT} credits once; the sole administrator is
        bootstrapped from a server environment secret and can never be claimed by a
        client.
      </p>

      <dl className="dl">
        <dt>Phase</dt>
        <dd>
          <code>{phase}</code>
        </dd>
        <dt>Identity plane</dt>
        <dd>
          <code>{plane.wired.identity ? "wired" : "not wired"}</code>
        </dd>
        <dt>Credits plane</dt>
        <dd>
          <code>{plane.wired.credits ? "wired" : "not wired"}</code>
        </dd>
        <dt>Billing plane</dt>
        <dd>
          <code>
            {plane.wired.billing ? "wired" : "not wired"} · mode {plane.billingMode}
          </code>
        </dd>
      </dl>

      {resolved.principal !== null ? (
        <>
          <StatePanel tone="ok" title="Signed in">
            <p>
              <code>{resolved.principal.user.email}</code> · role{" "}
              <code>{resolved.principal.role}</code>
            </p>
          </StatePanel>
          <h2>Credits</h2>
          {resolved.credits === null ? (
            <p>
              This account is an administrator, so editor access does not depend on a
              credit balance and none was read.
            </p>
          ) : resolved.credits.ok ? (
            <dl className="dl">
              <dt>Balance</dt>
              <dd>{resolved.credits.value.balance}</dd>
              <dt>Starter grant</dt>
              <dd>{resolved.credits.value.starterGrantConsumed ? "used" : "available"}</dd>
            </dl>
          ) : (
            <StatePanel
              tone="deny"
              title="The balance could not be read"
              reason={resolved.credits.reason}
            >
              <p>{resolved.credits.message}</p>
            </StatePanel>
          )}
          <h2>Editor access</h2>
          {resolved.entitlement.entitled ? (
            <StatePanel tone="ok" title={`Entitled — ${resolved.entitlement.basis}`}>
              <p>
                <a href="/editor">Open the Minimum E2 editor</a>
              </p>
            </StatePanel>
          ) : (
            <StatePanel
              tone="deny"
              title="Not entitled"
              reason={resolved.entitlement.reason}
            >
              <p>{resolved.entitlement.message}</p>
              <p>
                <a href="/pricing">Buy credits</a> to open the editor.
              </p>
            </StatePanel>
          )}
        </>
      ) : (
        <StatePanel
          tone="deny"
          title={signedOut ? "You are not signed in" : "Sign-in is not available on this deployment"}
          reason={resolved.identity.ok ? undefined : resolved.identity.reason}
        >
          <p>
            {resolved.identity.ok
              ? "No session is present."
              : resolved.identity.message}
          </p>
          {!signedOut && (
            <>
              <p>{IDENTITY_PLANE_PENDING_NOTE}</p>
              <p>
                The wiring steps and the exact environment variables are documented in{" "}
                <code>{IDENTITY_PLANE_DOC}</code>.
              </p>
            </>
          )}
          <p>
            Everything free stays available now:{" "}
            <a href="/engine">the engine SDK download</a>, <a href="/docs">the docs</a>,
            and browsing either catalog.
          </p>
        </StatePanel>
      )}
    </>
  );
}
