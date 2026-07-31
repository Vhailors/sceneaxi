import { desktopLinuxAppOffer, formatByteSize, readEngineSdkOffer } from "@sceneaxi/site-kit";
import { LIVE_OPEN_PRESENTATION } from "../../lib/live-open.js";
import { ENGINE_NOTES, PIPELINE, RELEASE_MARKER } from "../../lib/site-content.js";
import { StatePanel } from "../_components/state-panel.js";

/**
 * The engine surface: what the engine is, and the artifacts this repository stands
 * behind.
 *
 * Two of them, with different evidence models. The deterministic engine SDK archive
 * is built by `scripts/build-engine-sdk.mjs` during the site build, so its size,
 * entry count, and SHA-256 are read off the served file; when it is absent the page
 * renders the named reason rather than a button that leads nowhere. The Linux
 * desktop application (ADR 0024) is packaged by electron-builder, which is not
 * bit-reproducible, so its facts come from the committed recorded-build offer in
 * `@sceneaxi/site-kit` — held in lockstep with `docs/desktop-linux.md` by the gate —
 * and the site serves no binary: readers build from source or fetch the CI artifact.
 * No installer, size, or digest is typed into this page for either artifact, and
 * Windows/macOS are stated as not packaged rather than implied.
 *
 * The two evidence models fail independently, so they render independently: an absent
 * archive replaces the SDK cards with the named reason and takes nothing else with it,
 * because the desktop record is committed data that does not depend on a served file.
 */
export default function EnginePage() {
  const offer = readEngineSdkOffer(process.cwd());
  const desktopApp = desktopLinuxAppOffer();
  const sdk = offer.ok ? offer.value : null;
  const sdkRefusal = offer.ok ? null : { reason: offer.reason, message: offer.message };

  return (
    <div className="page">
      <div className="page-head">
        <p className="eyebrow">Download · {RELEASE_MARKER}</p>
        <h1>Get the engine.</h1>
        <p className="lede">
          {sdk === null
            ? "The SDK archive is not in this build, so there is nothing to download here. The packaged Linux desktop application below is a separate artifact and is unaffected."
            : "The public package surface as source, with the consumption contract. Everything in the archive runs locally. This is not an npm publish and not a dump of the monorepo."}
        </p>
      </div>

      {sdkRefusal !== null ? (
        <StatePanel tone="deny" level={2} title="No download to offer" reason={sdkRefusal.reason}>
          <p>{sdkRefusal.message}</p>
          <p>
            The archive is produced by <code>node scripts/build-engine-sdk.mjs</code>{" "}
            during the site build. A deployment without it serves no download rather
            than an empty file.
          </p>
        </StatePanel>
      ) : (
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
      )}

      <div className="stack">
        <div className="section-title">
          <p className="eyebrow">Desktop application · {desktopApp.platform}</p>
          <h2>{desktopApp.productName} for Linux.</h2>
          <p className="prose prose-wide">
            The Engine Desktop editor as a packaged Linux application: the accepted
            editor chrome in an Electron window over the real engine stack — kernel
            open path, the {LIVE_OPEN_PRESENTATION.coreLabel} drawing in the window,
            and the shared authoring propose/accept session. Built from{" "}
            <code>{desktopApp.sourceDir}</code> in the repository; the{" "}
            <code>{desktopApp.ciWorkflow}</code> CI workflow builds, smoke-tests, and
            uploads the same artifacts as <code>{desktopApp.ciArtifactName}</code>.
          </p>
        </div>

        <div className="grid grid-2">
          {desktopApp.artifacts.map((artifact) => (
            <article className="panel panel-roomy" key={artifact.kind}>
              <div className="panel-head">
                <span className="family-mark" aria-hidden="true" />
                <span className="tag">{artifact.kind}</span>
              </div>
              <h3 className="card-title">{artifact.fileName}</h3>
              <p className="meta">
                {formatByteSize(artifact.byteSize)} · {desktopApp.version} · recorded{" "}
                {desktopApp.recordedOn}
              </p>
              <p className="sha">sha256 {artifact.sha256}</p>
            </article>
          ))}
        </div>

        <article className="panel panel-roomy">
          <h3 className="card-title">Build it, verify it, prove it runs</h3>
          <p className="command">
            <code>{desktopApp.buildCommand}</code>
          </p>
          <p className="command">
            <code>{desktopApp.verifyCommand}</code>
          </p>
          <p className="command">
            <code>{desktopApp.smokeCommand}</code>
          </p>
          <p className="note">{desktopApp.reproducibilityNote}</p>
        </article>

        <StatePanel tone="warn" title="Platform status">
          <p>
            Linux is the only packaged platform. {desktopApp.notPackaged.join(" and ")}{" "}
            are not packaged yet — no installer for them exists, and this page will not
            pretend otherwise. The free SDK archive above remains the supported
            download for every platform.
          </p>
        </StatePanel>
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

        {sdk !== null && (
          <>
            <p className="eyebrow eyebrow-quiet">Packages in this archive</p>
            <div className="grid grid-3">
              {sdk.packages.map((name) => (
                <article className="panel panel-line" key={name}>
                  <p className="pkg">{name}</p>
                </article>
              ))}
            </div>
          </>
        )}
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
          This source is <strong>source-available for evaluation, not open-source</strong>.
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
