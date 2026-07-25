import { SITE_CATALOG_POLICY_CITES } from "@sceneaxi/site-kit";

/**
 * Documentation index.
 *
 * Points at the contracts that actually govern the engine rather than restating them,
 * because the repo docs are the source of truth and a paraphrase here would drift.
 * Every path below ships inside the engine SDK archive or the repository.
 */
const CONTRACTS = [
  {
    path: "docs/web-consumer.md",
    title: "Web-consumer contract",
    note: "How a product consumes SceneAxi as versioned packages, and the pinning and refusal rules. Ships inside the SDK archive.",
  },
  {
    path: "docs/scene-composition.md",
    title: "Scene composition",
    note: "Composing several sculpt artifacts into one openable scene. Placement is axis-aligned in v1 and never rewrites an artifact.",
  },
  {
    path: "docs/authoring-contracts.md",
    title: "Authoring contracts",
    note: "E1 is normative; general E2 stays specified-not-built. The bounded hybrid Minimum E2 exception is ADR 0003.",
  },
  {
    path: "docs/sculpt-quality.md",
    title: "Sculpt quality",
    note: "Multi-pass quality gates and the named refusals that fail closed.",
  },
  {
    path: "docs/delivery-handoff.md",
    title: "Delivery handoff",
    note: "The delivery-neutral export contract. Provider adapters, credentials, and releases stay outside core.",
  },
  {
    path: "docs/plugins.md",
    title: "Plugins",
    note: "Manifests may claim only IDs from the versioned public capability registry. Unknown IDs refuse.",
  },
  {
    path: "docs/websites-deploy.md",
    title: "Websites deploy",
    note: "This site and the two catalogs: Vercel project map, the env var list, and the identity-plane activation steps.",
  },
  {
    path: "docs/adr/",
    title: "Architecture decision records",
    note: "Settled design decisions, each separating what is settled from adjacent open captain holds.",
  },
] as const;

const CLI = [
  ["project propose", "Produce a reviewed proposal against a text-canonical document."],
  ["project apply", "Apply a proposal, or refuse with a named diagnostic."],
] as const;

export default function DocsPage() {
  return (
    <>
      <p className="eyebrow">Documentation</p>
      <h1>Contracts first</h1>
      <p className="lede">
        SceneAxi is specified before it is implemented. These are the documents that
        govern the engine, the CLI, and the profiles — the code follows them, not the
        other way round.
      </p>

      <h2>Governing documents</h2>
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
              <tr key={entry.path}>
                <td className="wrap">
                  <strong>{entry.title}</strong>
                  <br />
                  <code style={{ color: "var(--ink-faint)" }}>{entry.path}</code>
                </td>
                <td className="wrap">{entry.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Free path: the CLI with your own AI provider</h2>
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

      <h2>Asset policy</h2>
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
    </>
  );
}
