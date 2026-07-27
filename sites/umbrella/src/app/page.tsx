import {
  CREATOR_SHARE_ROUNDING_NOTE,
  CREATOR_SHARE_RULE,
  SITE_CAPABILITIES,
  SITE_CAPABILITY_IDS,
  SITE_STARTER_CREDIT_ALLOTMENT,
} from "@sceneaxi/site-kit";
import { LIVE_OPEN_COPY, LIVE_OPEN_PATH } from "../lib/live-open.js";
import {
  DIFF_ROWS,
  EXIT_CODES,
  FAMILY_CARDS,
  PROFILE_CARDS,
  RELEASE_MARKER,
  REVIEW_POINTS,
  SCULPT_PASSES,
  TERMINAL_LINES,
} from "../lib/site-content.js";
import { UMBRELLA_BRAND, resolveFamilyLinks } from "../lib/site-config.js";
import { CapabilityTable } from "./_components/capability-table.js";

/**
 * The overview.
 *
 * Every number on this page is read from the contract that owns it — the starter
 * allotment and the creator share from site-kit, the free-capability count from the
 * published capability matrix — so the marketing surface and the gate cannot disagree
 * about what SceneAxi costs. The hero art is a rendered gradient field rather than a
 * second renderer: `sculpt-viewport.tsx` is the tier's only renderer boundary, and the
 * real one is a click away at the live open path.
 */
export default function OverviewPage() {
  const family = resolveFamilyLinks(process.env);
  const freeCapabilityCount = SITE_CAPABILITY_IDS.filter(
    (id) => SITE_CAPABILITIES[id].tier === "free",
  ).length;

  // Family cards name a surface, never a hostname; a card is a link only when this
  // deployment actually resolved that surface's origin.
  const catalogHref: Readonly<Record<string, string | null>> = {
    "Game assets": family.gameCatalog,
    "Web assets": family.webCatalog,
  };

  return (
    <>
      <section className="hero">
        <div className="hero-field" aria-hidden="true" />
        <div className="hero-veil" aria-hidden="true" />

        <div className="hero-inner">
          <div className="hero-copy">
            <p className="badge">
              <span className="dot" aria-hidden="true" />
              {RELEASE_MARKER}
            </p>
            <h1>Describe the object. Get a real one.</h1>
            <p className="lede">{UMBRELLA_BRAND.summary}</p>

            <div className="actions">
              <a className="button" href="/engine">
                Download the engine SDK
              </a>
              <a className="button button-quiet button-arrow" href={LIVE_OPEN_PATH}>
                Open a real artifact
              </a>
            </div>

            <div className="stack stack-tight">
              <p className="command">
                <code>sceneaxi project propose --document scene.json</code>
              </p>
              <p className="note">
                The CLI ships inside the SDK archive. These are private <code>0.0.0</code>{" "}
                bootstrap packages, so there is no registry install yet —{" "}
                <a href="/engine">the download page</a> states exactly what is served.
              </p>
            </div>
          </div>
        </div>

        <div className="statbar">
          <dl className="statbar-inner">
            <div className="stat">
              <dt>starter credits, granted once</dt>
              <dd>{SITE_STARTER_CREDIT_ALLOTMENT}</dd>
            </div>
            <div className="stat">
              <dt>of a sale&rsquo;s credits to the creator</dt>
              <dd>{CREATOR_SHARE_RULE.creatorPercent}%</dd>
            </div>
            <div className="stat stat-accent">
              <dt>silent writes — every change is a proposal</dt>
              <dd>0</dd>
            </div>
            <div className="stat stat-ok">
              <dt>published capabilities that cost nothing</dt>
              <dd>{freeCapabilityCount}</dd>
            </div>
          </dl>
        </div>
      </section>

      {/* 01 — SCULPT */}
      <section className="band-inner">
        <div className="section-head">
          <div className="section-title">
            <p className="eyebrow">01 — Sculpt</p>
            <h2>A reference, a brief, and a list of what must be there.</h2>
          </div>
          <p className="section-aside">
            An object is reconstructed in visible passes. You name the details that
            matter; if they are not in the result, the sculpt is refused rather than
            quietly shipped.
          </p>
        </div>

        <div className="grid grid-5">
          {SCULPT_PASSES.map((pass) => (
            <article className={`panel tone-${pass.bar}`} key={pass.id}>
              <span className="panel-bar" aria-hidden="true" />
              <p className="panel-num">{pass.required ? pass.n : `${pass.n} · optional`}</p>
              <h3>{pass.name}</h3>
              <p>{pass.desc}</p>
            </article>
          ))}
        </div>
      </section>

      {/* 02 — REVIEW */}
      <section className="band band-sunk">
        <div className="band-inner band-inner-tight">
          <div className="split split-copy-first">
            <div className="stack split-copy">
              <p className="eyebrow">02 — Review</p>
              <h2>Nothing writes to your scene without you.</h2>
              <p className="prose">
                Every generated edit — from the assistant, a plugin, or an agent on your
                CI — arrives as a proposal with a readable diff and the document hash
                before and after. You accept or reject it. There is no second, quieter
                path that skips this.
              </p>
              <ul className="checks">
                {REVIEW_POINTS.map((point) => (
                  <li key={point}>
                    <span className="mark-box mark-yes" aria-hidden="true">
                      ✓
                    </span>
                    {point}
                  </li>
                ))}
              </ul>
            </div>

            <div className="frame">
              <div className="frame-bar">
                <span className="dot tone-accent" aria-hidden="true" />
                <span className="frame-bar-title">{DIFF_ROWS.length} proposed changes</span>
                <span className="frame-bar-spacer" />
                <span>illustration, not a recorded run</span>
              </div>
              {DIFF_ROWS.map((row) => (
                <div className="diff-row" key={`${row.dir}${row.leaf}`}>
                  <span
                    className={`mark-box ${row.badge === "+" ? "mark-yes" : "mark-part"}`}
                    aria-hidden="true"
                  >
                    {row.badge}
                  </span>
                  <span className="diff-path">
                    <span className="diff-dir">{row.dir}</span>
                    <span className="diff-leaf">{row.leaf}</span>
                  </span>
                  <span className="diff-after">{row.after}</span>
                </div>
              ))}
              <div className="diff-foot">
                <span className="hash-before">a4f2…9c1e</span>
                <span aria-hidden="true">→</span>
                <span className="hash-after">b7d0…41aa</span>
                <span className="diff-foot-note">
                  the same proposal in the editor, the CLI, and CI
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 03 — PROFILES */}
      <section className="band-inner">
        <div className="section-title">
          <p className="eyebrow">03 — Profiles</p>
          <h2>One runtime. Three products that share nothing they shouldn&rsquo;t.</h2>
        </div>

        <div className="grid grid-3">
          {PROFILE_CARDS.map((profile) => {
            const body = (
              <>
                <span className="card-accent-rail" aria-hidden="true" />
                <div className="profile-card-body">
                  <div className="panel-head">
                    <h3>{profile.name}</h3>
                    <span className={`tag tag-${profile.accent}`}>{profile.tag}</span>
                  </div>
                  <p>{profile.desc}</p>
                  <span className="panel-grow" />
                  <ul className="bullets panel-foot">
                    {profile.points.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                </div>
              </>
            );
            const className = `card-link profile-card tone-${profile.accent}`;

            // The Kids card carries no href: this site links to no Kids surface, and a
            // card styled as a link that leads nowhere would imply one exists here.
            return profile.href === null ? (
              <article className={className} key={profile.name}>
                {body}
              </article>
            ) : (
              <a className={className} key={profile.name} href={profile.href}>
                {body}
              </a>
            );
          })}
        </div>
      </section>

      {/* Free and paid */}
      <section className="band band-sunk">
        <div className="band-inner band-inner-tight">
          <div className="section-title">
            <p className="eyebrow">Free and paid</p>
            <h2>What costs nothing, and what costs credits.</h2>
            <p className="prose prose-wide">
              The engine SDK download, the CLI, and bringing your own AI provider are
              free. Hosted AI and catalog assets are paid. New accounts receive{" "}
              <strong>{SITE_STARTER_CREDIT_ALLOTMENT} credits once</strong>. The table
              below renders from the same capability matrix the gate asserts.
            </p>
          </div>
          <CapabilityTable />
          <div className="actions">
            <a className="button button-quiet" href="/pricing">
              Credit packs and pricing
            </a>
          </div>
        </div>
      </section>

      {/* 04 — AGENT-NATIVE */}
      <section className="band-inner">
        <div className="split split-copy-first">
          <div className="frame">
            <div className="frame-bar">
              <span className="dot dot-window" aria-hidden="true" />
              <span className="dot dot-window" aria-hidden="true" />
              <span className="dot dot-window" aria-hidden="true" />
              <span>zsh — sceneaxi</span>
            </div>
            <div className="frame-body">
              <pre className="terminal">
                {TERMINAL_LINES.map((line) => (
                  <span className="terminal-line" key={line.text}>
                    <span className="terminal-prompt">{line.prompt || " "}</span>{" "}
                    <span className={line.tone === "in" ? "" : `terminal-${line.tone}`}>
                      {line.text}
                    </span>
                  </span>
                ))}
              </pre>
            </div>
          </div>

          <div className="stack split-copy">
            <p className="eyebrow">04 — Agent-native</p>
            <h2>Every button is also a command.</h2>
            <p className="prose">
              The editor is a client of the same protocol your scripts use. Files and
              flags in, stable paths and typed exit codes out — no prompt, no TTY guess,
              no best-effort mutation. An agent can drive the CLI without a screen and
              produce byte-identical documents.
            </p>
            <dl className="exit-codes">
              {EXIT_CODES.map((row) => (
                <div className="exit-code" key={row.code}>
                  <dt>{row.code}</dt>
                  <dd>
                    <span className="exit-code-name">{row.name}</span>
                    <span className="exit-code-when">{row.when}</span>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* 05 — THE FAMILY */}
      <section className="band band-sunk">
        <div className="band-inner band-inner-tight">
          <div className="section-head">
            <div className="section-title">
              <p className="eyebrow">05 — The family</p>
              <h2>Where everything lives.</h2>
            </div>
            <p className="section-aside">
              Each surface owns its pages outright — the storefronts never duplicate the
              docs, and Kids is a separate origin rather than a route. Creators receive{" "}
              {CREATOR_SHARE_RULE.creatorPercent}% of the credits on a sale.
            </p>
          </div>

          <div className="grid grid-4">
            {FAMILY_CARDS.map((entry) => {
              const href = entry.linkable ? (catalogHref[entry.name] ?? null) : null;
              const inner = (
                <>
                  <div className="panel-head">
                    <span className="family-mark" aria-hidden="true" />
                    {href !== null && (
                      <span className="family-out" aria-hidden="true">
                        ↗
                      </span>
                    )}
                  </div>
                  <h3>{entry.name}</h3>
                  <p className="family-what">{entry.what}</p>
                  <p>{entry.desc}</p>
                </>
              );
              const className = `panel tone-${entry.accent}`;

              return href === null ? (
                <article className={className} key={entry.name}>
                  {inner}
                </article>
              ) : (
                <a className={`${className} card-link`} key={entry.name} href={href}>
                  {inner}
                </a>
              );
            })}
          </div>

          <p className="note">{CREATOR_SHARE_ROUNDING_NOTE}</p>
        </div>
      </section>

      {/* Closing */}
      <section className="band band-gradient">
        <div className="band-inner band-centered">
          <h2>Open a real artifact in the browser.</h2>
          <p className="lede">{LIVE_OPEN_COPY.teaser}</p>
          <div className="actions">
            <a className="button" href={LIVE_OPEN_PATH}>
              Open a scene
            </a>
            <a className="button button-quiet" href="/docs">
              Read the contracts
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
