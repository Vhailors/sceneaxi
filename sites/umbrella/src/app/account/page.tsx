import {
  SITE_STARTER_CREDIT_ALLOTMENT,
  describeSiteAccessState,
  resolveEditorAccess,
} from "@sceneaxi/site-kit";
import { readSessionToken } from "../_session.js";
import {
  IDENTITY_PLANE_DOC,
  IDENTITY_PLANE_PENDING_NOTE,
  createUmbrellaIdentityPlane,
} from "../../lib/identity-plane.js";
import { CREDIT_LEDGER_FACTS, CREDIT_LEDGER_COPY } from "../../lib/site-content.js";
import { StatePanel } from "../_components/state-panel.js";

/**
 * The account surface: anonymous, authenticated, or refused.
 *
 * Identity and credits are owned by `@sceneaxi/auth` and `@sceneaxi/billing`. This
 * page renders whatever those ports return and nothing else — no fake session, no
 * fake balance, and no client-supplied role. A role claim arriving from a client is
 * refused by the port before any adapter is consulted.
 *
 * Under decision D5 this surface wears the archive's technical-document treatment: the
 * plane readout is an evidence block, each of the three phases is a designed named state
 * carrying its own key, and credits are explained as what they are. Two things the
 * archive assumes are deliberately absent, because the product does not have them —
 * there is **no seat, plan, tier, or subscription** anywhere on this page, and there is
 * no editable balance: `CreditAccount` carries no balance field because the append-only
 * ledger is the only source of truth, so this page reads a balance and never offers to
 * change one.
 */
export default async function AccountPage() {
  const sessionToken = await readSessionToken();
  const plane = createUmbrellaIdentityPlane(process.env, { sessionToken });
  const resolved = await resolveEditorAccess({
    identity: plane.identity,
    credits: plane.credits,
    request: { surface: "site", sessionToken },
  });

  // A refusal here is projected onto its own named access state — signed out,
  // expired, disabled, Kids, provider unavailable, not wired — with the one action
  // that can change it, the same projection `/editor` renders. Without it every
  // outcome but "signed out" claimed this deployment had no identity plane, which
  // is false for an expired or disabled session on a fully wired one.
  const identityRefusal = resolved.identity.ok ? null : resolved.identity;
  const outcome =
    identityRefusal === null ? null : describeSiteAccessState(identityRefusal.reason);
  // A signed-out visitor is its own phase: the plane saying "nobody is signed in
  // here", which must not read like a broken deployment.
  const signedOut = outcome?.key === "signed-out";
  const phase =
    resolved.principal !== null ? "authenticated" : signedOut ? "anonymous" : "refused";

  /** The plane readout, in the same evidence shape every other machine fact uses. */
  const planeEvidence = [
    { term: "Phase", value: phase },
    { term: "Identity plane", value: plane.wired.identity ? "wired" : "not wired" },
    { term: "Credits plane", value: plane.wired.credits ? "wired" : "not wired" },
    {
      term: "Billing plane",
      value: `${plane.wired.billing ? "wired" : "not wired"} · mode ${plane.billingMode}`,
    },
  ];

  return (
    <div className="page">
      <div className="page-head">
        <p className="eyebrow">Account</p>
        <h1>Your SceneAxi account</h1>
        <p className="lede">
          Signing in unlocks the Minimum E2 web editor and hosted AI. New accounts
          receive {SITE_STARTER_CREDIT_ALLOTMENT} credits once; the sole administrator is
          bootstrapped from a server environment secret and can never be claimed by a
          client.
        </p>
      </div>

      <h2>This deployment</h2>
      <dl className="dl">
        {planeEvidence.map((entry) => (
          <div className="dl-row" key={entry.term}>
            <dt>{entry.term}</dt>
            <dd>
              <code>{entry.value}</code>
            </dd>
          </div>
        ))}
      </dl>

      {resolved.principal !== null ? (
        <>
          <StatePanel
            tone="ok"
            title="Signed in"
            evidence={[
              { term: "Email", value: resolved.principal.user.email },
              { term: "Role", value: resolved.principal.role },
            ]}
          >
            <p>
              The role comes from the server&rsquo;s own configuration. There is no role
              field on a user record, so <code>admin</code> is unclaimable from a client.
            </p>
            <p>
              {/* This surface stays read-only; signing out lives on the sign-in surface. */}
              <a href="/login">Manage this session</a>
            </p>
          </StatePanel>

          <h2>Credits</h2>
          {resolved.credits === null ? (
            <StatePanel tone="ok" title="Administrator — no balance was read">
              <p>
                This account is an administrator, so editor access does not depend on a
                credit balance and none was read. Nothing was debited to render this page.
              </p>
            </StatePanel>
          ) : resolved.credits.ok ? (
            <>
              <dl className="dl">
                <div className="dl-row">
                  <dt>Balance</dt>
                  <dd>
                    <span className="ledger-balance">{resolved.credits.value.balance}</span>{" "}
                    credits
                  </dd>
                </div>
                <div className="dl-row">
                  <dt>Starter grant</dt>
                  <dd>
                    <span
                      className={`chip chip-${
                        resolved.credits.value.starterGrantConsumed ? "dormant" : "validated"
                      }`}
                    >
                      {resolved.credits.value.starterGrantConsumed ? "used" : "available"}
                    </span>
                  </dd>
                </div>
              </dl>
              <p className="note">{CREDIT_LEDGER_COPY.balanceIsDerived}</p>
            </>
          ) : (
            <StatePanel
              tone="deny"
              title="The balance could not be read"
              reason={resolved.credits.reason}
            >
              <p>{resolved.credits.message}</p>
              <p>{CREDIT_LEDGER_COPY.unreadableLedger}</p>
            </StatePanel>
          )}

          <h2>Editor access</h2>
          {resolved.entitlement.entitled ? (
            <StatePanel
              tone="ok"
              title="Entitled"
              evidence={[{ term: "Basis", value: resolved.entitlement.basis }]}
            >
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
                Entitlement is decided before a session exists, so a refused request
                reaches no editor and no canvas. <a href="/pricing">Buy credits</a> to open
                it.
              </p>
            </StatePanel>
          )}
        </>
      ) : (
        <StatePanel
          tone="deny"
          title={outcome === null ? "No session is present" : outcome.title}
          reason={identityRefusal?.reason}
        >
          <p>
            {outcome === null
              ? "The identity plane returned no principal for this request."
              : outcome.body}
          </p>
          {identityRefusal !== null && <p>{identityRefusal.message}</p>}
          {outcome?.action != null && (
            <p>
              <a className="button" href={outcome.action.href}>
                {outcome.action.label}
              </a>
            </p>
          )}
          {outcome?.key === "identity-not-wired" && (
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

      <h2>How credits work here</h2>
      <p className="prose prose-wide">{CREDIT_LEDGER_COPY.model}</p>
      <div className="grid grid-2">
        {CREDIT_LEDGER_FACTS.map((fact) => (
          <article className="note-card" key={fact.title}>
            <h3>
              <span className="dot" aria-hidden="true" />
              {fact.title}
            </h3>
            <p>{fact.body}</p>
          </article>
        ))}
      </div>
      <div className="actions">
        <a className="button button-quiet" href="/pricing">
          Credit packs and pricing
        </a>
      </div>
    </div>
  );
}
