import { formatByteSize, readEngineSdkOffer } from "@sceneaxi/site-kit";
import { LIVE_OPEN_PRESENTATION } from "../../lib/live-open.js";
import { ENGINE_NOTES, PIPELINE, RELEASE_MARKER } from "../../lib/site-content.js";
import { StatePanel } from "../_components/state-panel.js";

/**
 * The engine surface: what the engine is, and the one artifact this site hands out.
 *
 * The accepted screen has a separate download page offering platform installers with
 * sizes and digests. This repository builds exactly one downloadable artifact — the
 * deterministic engine SDK archive produced by `scripts/build-engine-sdk.mjs` — so
 * that layout is applied to the artifact that exists. Its size, entry count, and
 * SHA-256 are read off the served file; no installer, size, or digest is written into
 * this page. When the archive is absent the page renders the named reason rather than
 * a button that leads nowhere.
 */
export default function EnginePage() {
  const offer = readEngineSdkOffer(process.cwd());

  if (!offer.ok) {
    return (
      <div className="page">
        <div className="page-head">
          <p className="eyebrow">Engine SDK</p>
          <h1>The SDK archive is not in this build</h1>
        </div>
        <StatePanel tone="deny" level={2} title="No download to offer" reason={offer.reason}>
          <p>{offer.message}</p>
          <p>
            The archive is produced by <code>node scripts/build-engine-sdk.mjs</code>{" "}
            during the site build. A deployment without it serves no download rather
            than an empty file.
          </p>
        </StatePanel>
      </div>
    );
  }

  const sdk = offer.value;

  return (
    <div className="page">
      <div className="page-head">
        <p className="eyebrow">Download · {RELEASE_MARKER}</p>
        <h1>Get the engine.</h1>
        <p className="lede">
          The public package surface as source, with the consumption contract. Everything
          in the archive runs locally. This is not an npm publish and not a dump of the
          monorepo.
        </p>
      </div>

      <div className="grid grid-2">
        <article className="panel panel-roomy tone-accent">
          <div className="panel-head">
            <span className="family-mark" aria-hidden="true" />
            <span className="tag tag-accent">This build</span>
          </div>
          <h2 className="card-title">{sdk.fileName}</h2>
          <p className="meta">
            {formatByteSize(sdk.byteSize)} · {sdk.entryCount} entries · {sdk.version}
          </p>
          <a className="button button-block" href={sdk.href} download>
            Download the archive
          </a>
          <a className="button button-quiet button-block" href={sdk.checksumHref}>
            Checksum file
          </a>
          <p className="sha">sha256 {sdk.sha256}</p>
        </article>

        <article className="panel panel-roomy">
          <h2 className="card-title">Verify what you downloaded</h2>
          <p className="body-copy">
            The build is deterministic, so an independent rebuild from the same sources
            produces this same digest. Run this next to the archive and the checksum
            file.
          </p>
          <p className="command">
            <code>{sdk.verifyCommand}</code>
          </p>
          <dl className="dl">
            <dt>Version</dt>
            <dd>
              <code>{sdk.version}</code>
            </dd>
            <dt>Size</dt>
            <dd>
              {formatByteSize(sdk.byteSize)}{" "}
              <span className="note">({sdk.byteSize} bytes)</span>
            </dd>
            <dt>Entries</dt>
            <dd>{sdk.entryCount}</dd>
            <dt>SHA-256</dt>
            <dd>
              <code>{sdk.sha256}</code>
            </dd>
          </dl>
        </article>
      </div>

      <StatePanel tone="warn" title="Support status">
        <p>
          These are private <code>0.0.0</code> bootstrap packages. There is no supported
          external install until matching versions are published to a registry — read{" "}
          <code>docs/web-consumer.md</code> inside the archive before pinning anything.
          Reading and building against this source is free, as is CLI use and bringing
          your own AI provider.
        </p>
      </StatePanel>

      <div className="stack">
        <div className="section-title">
          <p className="eyebrow">The engine</p>
          <h2>A small, honest core with hard edges around it.</h2>
          <p className="prose prose-wide">
            Packages have declared boundaries and a checker that fails the build when one
            is crossed. The kernel cannot see presentation. The CLI cannot import the
            engine. Nothing in the tree may depend on the Kids profile.
          </p>
        </div>

        <p className="eyebrow eyebrow-quiet">Packages in this archive</p>
        <div className="grid grid-3">
          {sdk.packages.map((name) => (
            <article className="panel panel-line" key={name}>
              <p className="pkg">{name}</p>
            </article>
          ))}
        </div>
      </div>

      <div className="stack">
        <h2>How a change travels</h2>
        <div className="scroll-x pipeline">
          <div className="pipeline-grid">
            {PIPELINE.map((stage) => (
              <div className={`stack stack-tight tone-${stage.bar}`} key={stage.n}>
                <span className="pipeline-rail" aria-hidden="true" />
                <p className="pipeline-num">{stage.n}</p>
                <h3>{stage.name}</h3>
                <p className="note">{stage.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-2">
        {ENGINE_NOTES.map((note) => (
          <article
            className={note.tone === "plain" ? "note-card" : `note-card note-card-${note.tone}`}
            key={note.title}
          >
            <h3>
              <span className="dot" aria-hidden="true" />
              {note.title}
            </h3>
            <p>{note.body}</p>
          </article>
        ))}
        <article className="note-card note-card-info">
          <h3>
            <span className="dot" aria-hidden="true" />
            {LIVE_OPEN_PRESENTATION.coreLabel}
          </h3>
          <p>{LIVE_OPEN_PRESENTATION.decision}</p>
          <p>{LIVE_OPEN_PRESENTATION.seam}</p>
          <p>{LIVE_OPEN_PRESENTATION.notClaimed}</p>
        </article>
      </div>

      <div className="stack">
        <h2>Licence</h2>
        <p className="prose prose-wide">
          This archive is <strong>source-available for evaluation, not open-source</strong>.
          The packages are <code>UNLICENSED</code>, no licence file ships with the
          download, and <strong>no licence is granted</strong> to use, modify, copy, or
          redistribute the source beyond evaluating it here. It is not redistributable
          under MIT, Apache-2.0, BSL, or any other public licence. A grant of rights is a
          separate decision that has not been made.
        </p>
      </div>
    </div>
  );
}
