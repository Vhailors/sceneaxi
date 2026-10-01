import type { Metadata } from "next";
import {
  SITE_STARTER_CREDIT_ALLOTMENT,
  describeSiteAccessState,
  resolveEditorAccess,
} from "@sceneaxi/site-kit";
import { readSessionToken } from "../_session.js";
import { umbrellaRequestAuthority } from "../../lib/request-authority.js";
import { CREDIT_LEDGER_FACTS, CREDIT_LEDGER_COPY } from "../../lib/site-content.js";
import { StatePanel } from "../_components/state-panel.js";

/** Signed-in surface: never indexed, whatever a crawler is told elsewhere. */
export const metadata: Metadata = {
  title: "Account — SceneAxi",
  robots: { index: false, follow: false },
};

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
type Mutable<Type> = { -readonly [Key in keyof Type]: Type[Key] };

function isSearchString<Value>(value: Value): value is Value & string { return typeof value === "string"; }

export default async function AccountPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const sessionToken = await readSessionToken();
  const plane = umbrellaRequestAuthority().plane({ sessionToken });

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

  const cursorRequested = params.beforeAt !== undefined || params.beforeId !== undefined;

  const before = cursorRequested ? {
    createdAt: isSearchString(params.beforeAt) ? params.beforeAt : "",
    intentId: isSearchString(params.beforeId) ? params.beforeId : "",
  } : undefined;

  const historyRequest: Mutable<Parameters<typeof plane.purchaseHistory.read>[0]> = { surface: "site", limit: 50 };

    if (before !== undefined) historyRequest.before = before;
    const history = resolved.principal === null ? null : await plane.purchaseHistory.read(historyRequest);

  return (
    <div className="page">
      <div className="page-head">
        <p className="eyebrow">Account</p>
        <h1>Your SceneAxi account</h1>
        <p className="lede">
          Signing in can unlock the Minimum E2 web editor. Hosted AI remains disabled. New accounts
          receive {SITE_STARTER_CREDIT_ALLOTMENT} credits once; the sole administrator is
          bootstrapped from a server environment secret and can never be claimed by a
          client.
        </p>
      </div>

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

          <h2>Purchase and intent history</h2>
          {history !== null && (history.ok ? <section aria-label="Purchase history">
            {history.value.purchases.length === 0 ? <p role="status">No purchase intents on this page.</p> : <ul>{history.value.purchases.map(item => <li key={item.intentId}>
              <code>{item.intentId}</code> — {item.itemId} — <time dateTime={item.createdAt}>{item.createdAt}</time> — {item.mode} — {item.status} — {item.credits} credits
            </li>)}</ul>}
            {history.value.reconciliationTruncated && <p role="status">Reconciliation evidence reached its bound; pending is not proof of payment.</p>}
            {history.value.next !== undefined && <a href={`/account?beforeAt=${encodeURIComponent(history.value.next.createdAt)}&beforeId=${encodeURIComponent(history.value.next.intentId)}`}>Older purchase intents</a>}
            {cursorRequested && <p><a href="/account">Newest purchase intents</a></p>}
          </section> : <StatePanel tone="deny" title="Purchase history unavailable" reason={history.reason}><p>{history.message}</p></StatePanel>)}

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
          <p>
            Everything free stays available now:{" "}
            <a href="/engine">the engine SDK download</a>, <a href="/docs">the docs</a>,
            and browsing either catalog.
          </p>
        </StatePanel>
      )}

      {params.checkout === "success" && (
        <StatePanel tone="warn" title="Returned from checkout — confirmation pending">
          <p>This return link is not proof of payment. Credits appear only after a verified payment is persisted in your ledger.</p>
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
