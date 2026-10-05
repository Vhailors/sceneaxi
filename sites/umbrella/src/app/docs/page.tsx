import { SITE_CATALOG_POLICY_CITES } from "@sceneaxi/site-kit";
import { docsRefusalCodes } from "../../lib/site-content.js";
import { HELP_DOCS } from "../../lib/help-docs.js";

/**
 * Documentation index, in the accepted three-column docs shell.
 *
 * The rail and the on-this-page column navigate *this* page: every entry is an anchor
 * to a section rendered below it. Nothing here links to a docs route that does not
 * exist, and nothing paraphrases a contract — the repository documents are the source
 * of truth and a summary here would drift. Every path below ships inside the engine SDK
 * archive or the repository.
 */
interface Contract {
  readonly id: string;
  /**
   * The rail group this row files under. Typed against `RAIL_GROUPS` below, because the
   * rail renders a row only where the two agree: an unlisted group would compile and
   * then render nowhere, which is a document silently missing from the index.
   */
  readonly group: (typeof RAIL_GROUPS)[number];
  readonly path: string;
  readonly title: string;
  readonly note: string;
}

const CONTRACTS: readonly Contract[] = [
  {
    id: "web-consumer",
    group: "Start",
    path: "docs/web-consumer.md",
    title: "Web-consumer contract",
    note: "How a product consumes SceneAxi as versioned packages, and the pinning and refusal rules. Ships inside the SDK archive.",
  },
  {
    id: "adr",
    group: "Start",
    path: "docs/adr/",
    title: "Architecture decision records",
    note: "Settled design decisions, each separating what is settled from adjacent open captain holds.",
  },
  {
    id: "authoring-contracts",
    group: "Sculpt",
    path: "docs/authoring-contracts.md",
    title: "Authoring contracts",
    note: "E1 is normative; general E2 stays specified-not-built. The bounded hybrid Minimum E2 exception is ADR 0003.",
  },
  {
    id: "sculpt-quality",
    group: "Sculpt",
    path: "docs/sculpt-quality.md",
    title: "Sculpt quality",
    note: "Multi-pass quality gates and the named refusals that fail closed.",
  },
  {
    id: "scene-composition",
    group: "Scenes",
    path: "docs/scene-composition.md",
    title: "Scene composition",
    note: "Composing several sculpt artifacts into one openable scene. Placement is axis-aligned in v1 and never rewrites an artifact.",
  },
  {
    id: "plugins",
    group: "Automation",
    path: "docs/plugins.md",
    title: "Plugins",
    note: "Manifests may claim only IDs from the versioned public capability registry. Unknown IDs refuse.",
  },
  {
    id: "delivery-handoff",
    group: "Automation",
    path: "docs/delivery-handoff.md",
    title: "Delivery handoff",
    note: "The delivery-neutral export contract. Provider adapters, credentials, and releases stay outside core.",
  },
  {
    id: "websites-deploy",
    group: "Automation",
    path: "docs/websites-deploy.md",
    title: "Websites deploy",
    note: "This site and the two catalogs: Vercel project map, the env var list, and the deployment mechanics the identity plane requires before it is wired.",
  },
] as const;

const RAIL_GROUPS = ["Start", "Sculpt", "Scenes", "Automation"] as const;

const CLI = [
  ["project propose", "Produce a reviewed proposal against a text-canonical document."],
  ["project apply", "Apply a proposal, or refuse with a named diagnostic."],
] as const;

const SECTIONS = [
  { id: "governing", name: "Governing documents" },
  { id: "free-path", name: "The free path" },
  { id: "refusals", name: "Why a sculpt is refused" },
  { id: "assets", name: "Asset policy" },
    { id: "service-status", name: "Service status and support" },
] as const;

export default function DocsPage() {
  return (
    <div className="docs-shell">
      <nav className="docs-rail" aria-label="Documents">
        {RAIL_GROUPS.map((group) => (
          <div className="docs-rail-group" key={group}>
            <p className="docs-rail-title">{group}</p>
            {CONTRACTS.flatMap((entry) => entry.group === group ? [(
              <a key={entry.id} href={`#${entry.id}`}>
                {entry.title}
              </a>
            )] : [])}
          </div>
        ))}
      </nav>

      <article className="docs-main">
        <ol className="crumbs">
          <li>SceneAxi</li>
          <li>Docs</li>
          <li>Contracts</li>
        </ol>

        <h1>SceneAxi help</h1>
        <p className="lede">Practical guides for installing, opening scenes, credits, and the command line.</p>
        <nav aria-label="Help topics" className="guide-list">
          {HELP_DOCS.map((doc) => (
            <a className="guide-link" href={`/docs/${doc.slug}`} key={doc.slug}>
              <h2>{doc.title}</h2>
              <p>{doc.sections[0]?.body}</p>
              <code className="guide-route">/docs/{doc.slug}</code>
            </a>
          ))}
        </nav>
        <section aria-labelledby="service-status">
                    <h2 id="service-status">Service status and support</h2>
                    <p>Live service status is not available here. These local help pages are not an uptime report or confirmation that sign-in, checkout, or hosted AI is operational.</p>
                    <p>No verified support contact is published yet. Do not send passwords, provider keys, payment details, or private project files to an unverified address.</p>
                    <p>Reviewed terms, privacy, refund, and legal contact information are not yet published. This notice is not a legal policy or approval for a public paid launch.</p>
                  </section>
                  <h2>Engine contracts</h2>
        <p className="lede">
          SceneAxi is specified before it is implemented. These are the documents that
          govern the engine, the CLI, and the profiles — the code follows them, not the
          other way round.
        </p>

        <div className="rule-card">
          <span className="chip chip-experimental">
            <span className="dot" aria-hidden="true" />
            Rule
          </span>
          <p>
            Where a page and a contract disagree, the contract wins. Nothing on this site
            restates a rule it does not own; it points at the document that does.
          </p>
        </div>

        <h2 id="governing">Governing documents</h2>
        <div className="scroll-x">
          <table>
            <thead>
              <tr>
                <th className="wrap">Document</th>
                <th className="wrap">What it settles</th>
              </tr>
            </thead>
            <tbody>
              {CONTRACTS.map((entry) => (
                <tr key={entry.path} id={entry.id}>
                  <td className="wrap">
                    <strong>{entry.title}</strong>
                    <br />
                    <code className="note">{entry.path}</code>
                  </td>
                  <td className="wrap">{entry.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 id="free-path">The free path: the CLI with your own AI provider</h2>
        <p>
          The CLI burns no credits. Bring your own provider key and author locally; the
          Model Provider Port injects adapters and per-profile filters, and refuses a
          missing policy, adapter, or capability rather than falling back to a default.
        </p>
        <div className="scroll-x">
          <table>
            <thead>
              <tr>
                <th>Verb</th>
                <th className="wrap">Purpose</th>
              </tr>
            </thead>
            <tbody>
              {CLI.map(([verb, note]) => (
                <tr key={verb}>
                  <td>
                    <code>sceneaxi {verb}</code>
                  </td>
                  <td className="wrap">{note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          Start from the <a href="/engine">engine SDK archive</a>, which carries the
          package sources and the consumption contract.
        </p>

        <h2 id="refusals">Why a sculpt is refused</h2>
        <p>
          A refusal is a product feature here, not an error state to hide. These are the
          stable reconstruction refusal codes; each names what failed rather than
          delivering an object that quietly missed the brief.
        </p>
        <dl className="code-defs">
          {docsRefusalCodes().map((refusal) => (
            <div className="contents" key={refusal.code}>
              <dt>{refusal.code}</dt>
              <dd>{refusal.what}</dd>
            </div>
          ))}
        </dl>

        <h2 id="assets">Asset policy</h2>
        <p>
          Asset packaging and ingestion policy is owned upstream and cited rather than
          restated:{" "}
          <a href={SITE_CATALOG_POLICY_CITES.assetPackageInterchange}>
            asset package interchange
          </a>{" "}
          and{" "}
          <a href={SITE_CATALOG_POLICY_CITES.untrustedAssetIngestion}>
            untrusted asset ingestion
          </a>
          .
        </p>

        <nav className="guide-list guide-list-compact" aria-label="Next steps">
          <a className="guide-link" href="/engine">
            <h3>The engine SDK archive</h3>
            <code className="guide-route">/engine</code>
          </a>
          <a className="guide-link" href="/pricing">
            <h3>Credit packs and pricing</h3>
            <code className="guide-route">/pricing</code>
          </a>
        </nav>
      </article>

      <nav className="toc" aria-label="On this page">
        <p className="toc-title">On this page</p>
        {SECTIONS.map((section) => (
          <a key={section.id} href={`#${section.id}`}>
            {section.name}
          </a>
        ))}
      </nav>
    </div>
  );
}
