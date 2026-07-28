import { SITE_CAPABILITIES, SITE_CAPABILITY_IDS } from "@sceneaxi/site-kit";

const REQUIRES_COPY: Readonly<Record<string, string>> = {
  nothing: "nothing — anonymous",
  entitlement: "credits or the starter allotment",
  credits: "credits above zero",
  "credits-and-tier-6b": "credits and tier-6b marketplace activation",
  billing: "the billing plane",
};

const CAPABILITY_COPY: Readonly<Record<string, string>> = {
  "docs-and-product": "Product pages and documentation",
  "engine-sdk-download": "Public engine SDK zip and checksum",
  "cli-byo-ai-docs": "CLI use with your own AI provider",
  "catalog-browse": "Browsing either asset catalog",
  "catalog-detail": "Catalog item detail, rights, and provenance",
  "web-editor": "Minimum E2 sculpt/scene web editor",
  "hosted-ai": "Hosted AI generation",
  "catalog-purchase": "Buying a catalog asset",
  "credit-pack-checkout": "Buying credit packs",
};

/** The published free-vs-paid matrix, rendered from the same data the gate asserts. */
export function CapabilityTable() {
  return (
    <div className="scroll-x">
      <table>
        <thead>
          <tr>
            <th className="wrap">Capability</th>
            <th>Tier</th>
            <th className="wrap">Requires</th>
          </tr>
        </thead>
        <tbody>
          {SITE_CAPABILITY_IDS.map((id) => {
            const spec = SITE_CAPABILITIES[id];
            return (
              <tr key={id}>
                <td className="wrap">
                  {CAPABILITY_COPY[id] ?? id}
                  <br />
                  <code className="note">{id}</code>
                </td>
                <td>
                  <span className={`chip chip-${spec.tier}`}>{spec.tier}</span>
                </td>
                <td className="wrap">{REQUIRES_COPY[spec.requires] ?? spec.requires}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
