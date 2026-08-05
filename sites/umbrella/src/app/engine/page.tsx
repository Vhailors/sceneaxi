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
 * bit-reproducible, so its facts come from one committed, verified workflow-artifact
 * offer in `@sceneaxi/site-kit` — held in lockstep with `docs/desktop-linux.md` by the
 * gate. The CTA names that exact repository run, or refuses if its record is invalid.
 * No installer, size, or digest is typed into this page for either artifact, and
 * Windows/macOS are stated as not packaged rather than implied.
 *
 * The two evidence models fail independently, so they render independently: an absent
 * archive replaces the SDK cards with the named reason and takes nothing else with it,
 * because the desktop record is committed data that does not depend on a served file.
 */
export default function EnginePage() {
  const offer = readEngineSdkOffer(process.cwd());
  const desktopOffer = desktopLinuxAppOffer();
  const sdk = offer.ok ? offer.value : null;
  const sdkRefusal = offer.ok ? null : { reason: offer.reason, message: offer.message };
  const desktopApp = desktopOffer.ok ? desktopOffer.value : null;
  const desktopRefusal = desktopOffer.ok
    ? null
    : { reason: desktopOffer.reason, message: desktopOffer.message };

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
      ) : sdk !== null ? (
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
      ) : null}

      {desktopRefusal !== null ? (
        <StatePanel
          tone="deny"
          title="Desktop artifact unavailable"
          reason={desktopRefusal.reason}
        >
          <p>{desktopRefusal.message}</p>
          <p>
            No fallback URL is offered. Build from the repository until a verified
            record lands.
          </p>
        </StatePanel>
      ) : desktopApp !== null ? (
        <div className="stack">
          <div className="section-title">
            <p className="eyebrow">Desktop application · {desktopApp.platform}</p>
            <h2>{desktopApp.productName} for Linux.</h2>
            <p className="prose prose-wide">
              The Engine Desktop editor as a packaged Linux application: the accepted
              editor chrome in an Electron window over the real engine stack — kernel
              open path, the {LIVE_OPEN_PRESENTATION.coreLabel} drawing in the window,
              and the shared authoring propose/accept session. Built from{" "}
              <code>{desktopApp.sourceDir}</code> in the repository and verified from
              source commit <code>{desktopApp.sourceCommit.slice(0, 12)}</code>.
            </p>
          </div>

          <article className="panel panel-roomy tone-accent">
            <div className="panel-head">
              <span className="family-mark" aria-hidden="true" />
              <span className="tag tag-accent">Linux available</span>
            </div>
            <h3 className="card-title">Download the verified Linux bundle</h3>
            <p className="body-copy">
              The repository workflow run contains{" "}
              <code>{desktopApp.ciArtifactName}</code>: both installers plus{" "}
              <code>{desktopApp.checksumFileName}</code>. GitHub may ask you to sign in
              with repository access; on the run page, choose that artifact under{" "}
              <strong>Artifacts</strong>.
            </p>
            <a className="button button-block" href={desktopApp.downloadHref}>
              Open Linux download
            </a>
            <p className="meta">
              Version {desktopApp.version} · workflow run {desktopApp.workflowRunId} ·
              verified {desktopApp.verifiedOn}
            </p>
          </article>

          <div className="grid grid-2">
            {desktopApp.artifacts.map((artifact) => (
              <article className="panel panel-roomy" key={artifact.kind}>
                <div className="panel-head">
                  <span className="family-mark" aria-hidden="true" />
                  <span className="tag">{artifact.kind}</span>
                </div>
                <h3 className="card-title">{artifact.kind}</h3>
                <dl className="dl">
                  <dt>Version</dt>
                  <dd>
                    <code>{desktopApp.version}</code>
                  </dd>
                  <dt>Platform</dt>
                  <dd>{artifact.platform}</dd>
                  <dt>Filename</dt>
                  <dd>
                    <code>{artifact.fileName}</code>
                  </dd>
                  <dt>Size</dt>
                  <dd>
                    {formatByteSize(artifact.byteSize)}{" "}
                    <span className="note">({artifact.byteSize} bytes)</span>
                  </dd>
                  <dt>SHA-256</dt>
                  <dd>
                    <code>{artifact.sha256}</code>
                  </dd>
                </dl>
                <p className="eyebrow eyebrow-quiet">Copy and verify this file</p>
                <p className="command">
                  <code>{artifact.verifyCommand}</code>
                </p>
              </article>
            ))}
          </div>

          <article className="panel panel-roomy">
            <h3 className="card-title">Verify the whole download</h3>
            <p className="body-copy">
              Extract <code>{desktopApp.ciArtifactName}.zip</code>, enter that directory,
              then check both files against the checksum list shipped beside them.
            </p>
            <p className="command">
              <code>{desktopApp.verifyCommand}</code>
            </p>
            <p className="note">{desktopApp.reproducibilityNote}</p>
          </article>

          <div className="grid grid-2">
            <article className="panel panel-roomy">
              <h3 className="card-title">Install and open</h3>
              <p className="body-copy">Choose one package after checksum verification.</p>
              <p className="command">
                <code>{"chmod +x SceneAxi-Engine-Desktop-0.0.0-linux-x86_64.AppImage && ./SceneAxi-Engine-Desktop-0.0.0-linux-x86_64.AppImage"}</code>
              </p>
              <p className="command">
                <code>{"sudo apt install ./SceneAxi-Engine-Desktop-0.0.0-linux-amd64.deb"}</code>
              </p>
              <p className="note">
                This first artifact has no code-signing claim and no auto-update
                support. Install future builds manually after verifying their own
                checksums.
              </p>
            </article>

            <article className="panel panel-roomy">
              <h3 className="card-title">First launch</h3>
              <p className="body-copy">
                SceneAxi creates a persistent project directory in the application's
                user data and seeds <code>scene.json</code> only when it is absent.
                Existing project bytes are not replaced on later launches.
              </p>
              <p className="body-copy">
                The top profile tabs are <strong>Game</strong>,{" "}
                <strong>Website (Web)</strong>, and <strong>Kids</strong>. Game is the
                initial profile; Website selects the web-experience projection. Kids is
                visible but refuse-only in this release: it names the safety refusal and
                asks you to switch back to Game or Website, rather than presenting an
                authoring surface that is not shipped.
              </p>
            </article>
          </div>

          <StatePanel tone="warn" title="Other platforms are coming soon">
            <p>
              Linux is the only available first-party desktop artifact. macOS and
              Windows remain unavailable until their packaging and signing work lands.{" "}
              {sdk === null
                ? "The SDK archive is not in this build either, so there is no cross-platform download to fall back on here — build from source."
                : "The free SDK archive above remains the supported download for every platform."}
            </p>
            <dl className="dl">
              {desktopApp.unavailablePlatforms.map((platform) => (
                <div key={platform.platform}>
                  <dt>
                    {platform.platform} · {platform.status}
                  </dt>
                  <dd>{platform.reason}</dd>
                </div>
              ))}
            </dl>
          </StatePanel>
        </div>
      ) : null}

      <StatePanel tone="warn" title="Support status">
        <p>
          The SDK archive contains private <code>0.0.0</code> bootstrap packages. There
          is no supported external install until matching versions are published to a
          registry — read{" "}
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
