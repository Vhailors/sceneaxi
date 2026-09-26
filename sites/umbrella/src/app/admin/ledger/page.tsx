import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import { umbrellaRequestAuthority } from "../../../lib/request-authority.js";
import { readSessionToken } from "../../_session.js";
import { StatePanel } from "../../_components/state-panel.js";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Ledger support | SceneAxi",
  robots: { index: false, follow: false },
};

export default async function LedgerSupportPage({ searchParams }: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const sessionToken = await readSessionToken();
  const rawQuery = params["query"];
  const query = Array.isArray(rawQuery) ? "" : rawQuery ?? "";
  const kind = params["kind"] === "userId" ? "userId" : "email";

  const result = await umbrellaRequestAuthority().plane({ sessionToken }).ledgerSupport.lookup({
    surface: "site", target: query.length === 0 ? null : { kind, value: query },
  });

  if (!result.ok) {
    return (
      <div className="page">
        <h1>Ledger support</h1>
        <StatePanel tone="deny" title="Ledger support refused" reason={result.reason}>
          <p>{result.message}</p>
        </StatePanel>
        <p><a href="/login?next=%2Fadmin%2Fledger">Manage this session</a></p>
        <p><a href="/admin/ledger">Return to lookup</a></p>
      </div>
    );
  }

  const view = result.value;

  return (
    <div className="page ledger-support">
      <div className="page-head">
        <h1>Ledger support</h1>
        <p className="lede">Administrator only. Read a member&apos;s history or append one support adjustment. Existing entries cannot be changed.</p>
      </div>
      <form method="get" action="/admin/ledger" className="stack">
        <div className="row">
          <div className="field">
            <label htmlFor="lookup-kind">Look up by</label>
            <select id="lookup-kind" name="kind" defaultValue={kind}>
              <option value="email">Email</option>
              <option value="userId">User id</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="lookup-query">Email or user id</label>
            <input id="lookup-query" name="query" required maxLength={320} defaultValue={query} autoComplete="off" />
          </div>
          <button className="button" type="submit">Look up ledger</button>
        </div>
      </form>
      {view === null ? (
        <p className="note">Enter a member&apos;s exact email or user id. Lookup does not grant starter credits.</p>
      ) : (
        <>
          <h2>{view.user.email}</h2>
          <dl className="dl">
            <div className="dl-row"><dt>User id</dt><dd>{view.user.userId}</dd></div>
            <div className="dl-row"><dt>Account</dt><dd>{view.state.account.accountId}</dd></div>
            <div className="dl-row"><dt>Derived balance</dt><dd>{view.state.balance} credits</dd></div>
          </dl>
          <h2>Append adjustment</h2>
          <p>Positive credits add to the balance. Negative credits subtract from it. A debit below zero refuses. This does not issue a money refund or resolve a dispute.</p>
          <form method="post" action="/api/admin/ledger" className="stack">
            <input type="hidden" name="userId" value={view.user.userId} />
            <div className="field">
              <label htmlFor="adjustment-delta">Signed credits</label>
              <input id="adjustment-delta" name="delta" type="text" pattern="[+\-]?[0-9]+" required placeholder="For example, 25 or -25" />
            </div>
            <div className="field">
              <label htmlFor="adjustment-reason">Reason or support case reference</label>
              <textarea id="adjustment-reason" name="reason" required maxLength={1000} rows={3} />
            </div>
            <div className="field">
              <label htmlFor="adjustment-key">Idempotency key</label>
              <input id="adjustment-key" name="idempotencyKey" defaultValue={randomUUID()} required pattern="[A-Za-z0-9._\-]+" maxLength={128} aria-describedby="key-help" />
            </div>
            <p id="key-help" className="note">Keep this key for retries after an uncertain response. The same key and adjustment append at most once. Use a new key only for a new adjustment.</p>
            <div><button className="button" type="submit">Append adjustment</button></div>
          </form>
          <h2>Ledger entries</h2>
          {view.state.entries.length === 0 ? <p>No ledger entries.</p> : (
            <ol className="stack">
              {view.state.entries.map((entry) => (
                <li key={entry.entryId}>
                  <details>
                    <summary>#{entry.sequence} · {entry.delta > 0 ? "+" : ""}{entry.delta} credits · Balance {entry.balanceAfter} · {entry.occurredAt}</summary>
                    <pre>{JSON.stringify(entry, null, 2)}</pre>
                  </details>
                </li>
              ))}
            </ol>
          )}
          <h2>Checkout intents</h2>
          {view.checkoutIntents.length === 0 ? <p>No checkout intents.</p> : (
            <ul className="stack">
              {view.checkoutIntents.map((intent) => (
                <li key={intent.intentId}>
                  <details>
                    <summary>{intent.intentId} · {intent.purpose} · {intent.mode}</summary>
                    <pre>{JSON.stringify(intent, null, 2)}</pre>
                  </details>
                </li>
              ))}
            </ul>
          )}
          <h2>Reconciliation records</h2>
          <p className="note">Read-only provider evidence. A support adjustment does not mark a reconciliation record resolved. Refund and dispute decisions remain with the operator.</p>
          {view.reconciliations.length === 0 ? <p>No reconciliation records.</p> : (
            <ul className="stack">
              {view.reconciliations.map((record) => (
                <li key={`${record.mode}:${record.eventId}`}>
                  <details>
                    <summary>{record.eventId} · {record.reason}</summary>
                    <pre>{JSON.stringify(record, null, 2)}</pre>
                  </details>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
