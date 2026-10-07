import { SignalIcon } from "./signal-icon.js";

/**
 * The home hero: one Change Review, played as propose, inspect, commit
 * (docs/redesign-v6/DIRECTION.md §4, concepts/a-rich/SPEC-DELTA.md).
 *
 * A server component with no script. The decision is a native radio group, so arrow keys
 * move between the three choices and the board reads the checked one through `:has()`.
 * The sequence plays only under `prefers-reduced-motion: no-preference` and stops ARMED:
 * the proposal waits for a decision and nothing is written until a reader chooses Accept.
 * Choosing "Review" again replays it. Under reduced motion the three acts stand as stills.
 *
 * The edit is synthetic and says so; the digests are illustrative, not a real file's.
 */
const POINTER = "/data/entities/0/x";

const BEFORE_DIGEST = "812139d4…6292a5";

const AFTER_DIGEST = "5c70561b…5ce5cc";

export function ChangeReviewHero() {
  return (
    <section className="cr" aria-labelledby="cr-title">
      <div className="cr-head">
        <h2 id="cr-title" className="cr-title">
          A proposed change, inspected before it is written
        </h2>
        <span className="cr-doc">scene.json</span>
        <span className="cr-state" data-when="review">
          <span className="sx-plate" data-state="pending">
            <SignalIcon name="pending" />
            Pending review
          </span>
        </span>
        <span className="cr-state" data-when="accept">
          <span className="sx-plate" data-state="verified">
            <SignalIcon name="verified" />
            Written
          </span>
        </span>
        <span className="cr-state" data-when="reject">
          <span className="sx-plate" data-state="refused">
            <SignalIcon name="refused" />
            Discarded
          </span>
        </span>
      </div>

      <ol className="cr-route" aria-label={`The edited pointer ${POINTER}`}>
        <li>/data</li>
        <li>/entities</li>
        <li>/0</li>
        <li>/x</li>
      </ol>

      <dl className="cr-readout">
        <div className="cr-row cr-before">
          <dt>Before</dt>
          <dd className="cr-val">1</dd>
          <dd className="cr-digest">{BEFORE_DIGEST}</dd>
        </div>
        <div className="cr-row cr-after">
          <dt>After</dt>
          <dd className="cr-val">42</dd>
          <dd className="cr-diff">
            <SignalIcon name="inspect" />
            Differs
          </dd>
          <dd className="cr-digest">{AFTER_DIGEST}</dd>
        </div>
      </dl>

      <ol className="cr-acts" aria-label="Three acts">
        <li data-act="propose">
          <span className="cr-act">1 · Propose</span>
          <span className="cr-note">The change arrives unwritten.</span>
        </li>
        <li data-act="inspect">
          <span className="cr-act">
            <SignalIcon name="inspect" />2 · Inspect
          </span>
          <span className="cr-note">Before, after and both digests.</span>
        </li>
        <li data-act="commit">
          <span className="cr-act">3 · Commit</span>
          <span className="cr-note">Armed. Waits for your decision.</span>
        </li>
      </ol>

      <fieldset className="cr-decide">
        <legend className="cr-legend">Decide the proposal</legend>
        <label className="cr-choice cr-accept">
          <input type="radio" name="cr-decision" value="accept" />
          <SignalIcon name="verified" />
          Accept
        </label>
        <label className="cr-choice">
          <input type="radio" name="cr-decision" value="reject" />
          Reject
        </label>
        <label className="cr-choice">
          <input type="radio" name="cr-decision" value="review" defaultChecked />
          <SignalIcon name="restart" />
          Review
        </label>
      </fieldset>

      <div className="cr-outcome" aria-live="polite">
        <p data-when="review">
          <b>Accept writes</b> <code>{POINTER}</code> whole or not at all. <b>Reject</b>{" "}
          leaves the file at <code>{BEFORE_DIGEST}</code>.
        </p>
        <p data-when="accept">
          <b>Written.</b> <code>scene.json</code> now reads <code>{AFTER_DIGEST}</code>. To
          return, propose <code>1</code> at the same pointer.
        </p>
        <p data-when="reject">
          <b>Nothing was written.</b> <code>scene.json</code> still reads{" "}
          <code>{BEFORE_DIGEST}</code>.
        </p>
      </div>
      <p className="cr-synthetic">Synthetic demonstration · digests are illustrative</p>
    </section>
  );
}
