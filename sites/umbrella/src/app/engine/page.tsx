import { formatByteSize, readEngineSdkOffer } from "@sceneaxi/site-kit";
import { StatePanel } from "../_components/state-panel.js";

/**
 * The public engine SDK download.
 *
 * The archive is generated into `public/engine-sdk/` at build time by
 * `scripts/build-engine-sdk.mjs`, which is deterministic — so the bytes served here
 * and the bytes CI builds carry the same SHA-256. When the artifact is absent this
 * page renders the named reason rather than a button that leads nowhere.
 */
export default function EnginePage() {
  const offer = readEngineSdkOffer(process.cwd());

  if (!offer.ok) {
    return (
      <>
        <p className="eyebrow">Engine SDK</p>
        <h1>The SDK archive is not in this build</h1>
        <StatePanel tone="deny" title="No download to offer" reason={offer.reason}>
          <p>{offer.message}</p>
          <p>
            The archive is produced by <code>node scripts/build-engine-sdk.mjs</code>{" "}
            during the site build. A deployment without it serves no download rather
            than an empty file.
          </p>
        </StatePanel>
      </>
    );
  }

  const sdk = offer.value;

  return (
    <>
      <p className="eyebrow">Engine SDK · free · public</p>
      <h1>Download the SceneAxi engine SDK</h1>
      <p className="lede">
        The public package surface as source, with the consumption contract. This is not
        an npm publish and not a dump of the monorepo.
      </p>

      <div className="actions">
        <a className="button" href={sdk.href} download>
          {sdk.fileName}
        </a>
        <a className="button button-quiet" href={sdk.checksumHref}>
          Checksum file
        </a>
      </div>

      <h2>Archive facts</h2>
      <dl className="dl">
        <dt>Version</dt>
        <dd>
          <code>{sdk.version}</code>
        </dd>
        <dt>Size</dt>
        <dd>
          {formatByteSize(sdk.byteSize)} <span style={{ color: "var(--ink-faint)" }}>({sdk.byteSize} bytes)</span>
        </dd>
        <dt>Entries</dt>
        <dd>{sdk.entryCount}</dd>
        <dt>SHA-256</dt>
        <dd>
          <code>{sdk.sha256}</code>
        </dd>
      </dl>

      <h2>Verify what you downloaded</h2>
      <p>
        Run this next to the archive and the checksum file. The build is deterministic,
        so an independent rebuild from the same sources produces this same digest.
      </p>
      <pre>
        <code>{sdk.verifyCommand}</code>
      </pre>

      <h2>Packages in the archive</h2>
      <div className="scroll-x">
        <table>
          <thead>
            <tr>
              <th>Package</th>
            </tr>
          </thead>
          <tbody>
            {sdk.packages.map((name) => (
              <tr key={name}>
                <td>
                  <code>{name}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
    </>
  );
}
