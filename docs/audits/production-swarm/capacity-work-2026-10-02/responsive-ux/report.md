# responsive-ux — PARTIAL auxiliary proof

Task ID: responsive-ux. Frozen product tree untouched. Not a duplicate full review or production/PR acceptance.

## Executed
- `python3 docs/audits/production-swarm/capacity-work-2026-10-02/responsive-ux/validate_receipts.py`: exit 0; **20 actual historical PNGs** (editor, account, both catalogs and Kids, 390/1440, before/after) validated SHA256, bytes, PNG CRC/chunks/IHDR and recorded document-width metrics. Exact paths/hashes/dimensions/DOM observations: `receipt-validation.json`.
- Two in-memory corrupted expected digests refused exactly `PNG_HASH_MISMATCH`; original files untouched.
- `sites/catalog-game/test/visual-evidence/postpr/before.json:49-53` vs `after.json:49-53`: foreground #7A6448 → #8A929C; on declared #0D0F12, 3.421712 → 6.097978:1. This is historical recorded color arithmetic, not fresh rendered contrast.
- Current four CSS files match historical after hashes. Seven-source fingerprint **99e295737a6e1018ccaf0cb49bf65253b0bcf4d6cde3ebf015286af54da1b37e**, HEAD 4e532e2fbf43e9948741578ab6208a3277870405; scoped identity, never a complete build identity.
- Executable validator and deferred browser driver: Python AST / embedded Node syntax pass; default driver emits NOT_RUN without browser launch. Initial validator failed with FileNotFoundError from one-parent root miscalculation; fixed auxiliary path, rerun passed unchanged assertions.

## Gaps and exact handoff
Historical receipts lack raw HTTP/page-error and complete artifact bindings. Signed-out account screenshots do not prove authenticated purchase history. Real long-ID/hash/diff/error/refusal wrapping, forced colors, themes and compact desktop geometry remain **NOT RUN**. Deep-review08:75-79 and desktop04:27-49 retain blank refusal/coverage gaps, not independently rerun here. Repeated samples are not unique requirements.

`intended-spec.json` is hash-bound in report.json; `browser_edges.py` supplies deferred real-control driver with mandatory seven-state admission, loopback-only networking, candidate/source/build hashes, real input/diagnostic observations, PNGs, Tab geometry and raw errors. It does not inject DOM fixture text or infer current builds from old screenshots. Geometry is bounded and does not claim full ring/modal/contrast certification; complement existing repair-accessibility-proof.mjs:37-69 and keyboard-ux.

Serial integrator: preserve `.ed-cr-current` at `sites/umbrella/src/app/globals.css:3541-3545` (fg-2 + strike-through); current source already contains the contrast fix. `integration-proposal.md` gives exact code and acceptance handoff, no redundant CSS edit. Current purchase-history presentation at :4633-4647 requires real authorized fixture evidence. After explicit Astra handoff provide stable loopback builds/source-backed edge fixtures and run deferred-plan.json command. No browser/build/full suite executed; no source/staging/commit/push/deploy/install. No temporary resources allocated. All auxiliary files remain under this directory.
