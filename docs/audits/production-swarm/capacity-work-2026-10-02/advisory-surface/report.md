# advisory-surface — bounded independent evidence

Task `advisory-surface`, source finding `06-05`: **PASS_BOUNDED_ONLY; production acceptance NOTRUN**. Product tree frozen, no source/config/test changes. Read AGENTS.md, docs/agents/layout.md:42–66, repair integration/ledger, fix-security-delivery pair and deep-review 08-FINAL:79. This is supplementary proof, not a duplicate full review.

## Artifact identity and executed acceptance

`report.json` records all input hashes, exact bytes/base64, runtime refusals, native/dependency artifact hashes and Git identity. Current HEAD `4e532e2fbf43e9948741578ab6208a3277870405` is not a clean-tree claim. Sixteen manifests/locks/config/header inputs fingerprint: `4f8879ecc3539d31d779b0851e97b4ca9f989a6e6dfa1d1e405659947383cc4c`. Installed dependencies are a separate hashed runtime subject; no site dist was used or assumed source-matched.

Executed `python3 docs/audits/production-swarm/capacity-work-2026-10-02/advisory-surface/check.py --refresh-official`, then offline reruns after harness corrections. Final exit **0**, four sites × seven actual Next cases = **28 case observations**, not 28 unique requirements. All four locks and optimizer-resolved sharp are **0.35.5**, Next **15.5.24**. Existing Next semver implementation checks actual sharp against Next's optional range and Node against sharp's engine range. Root/site lockfiles untouched.

Cases: valid 16×16 PNG→8×8; pixel budget1 refuses `Input image exceeds pixel limit`; malformed bytes refuse unsupported format; benign SVG low-level rasterization succeeds; actual Next `imageOptimizer` front-door SVG rejects **400**, `"url" parameter is valid but image type is not allowed`; remote URL validation rejects `"url" parameter is not allowed`; local path admits (not HTTP proof). Negative controls classify old sharp0.34.5 affected by all three 2026 advisories and execute real decoder/URL refusals. No malicious exploit inputs or network image fetches.

## Authoritative advisory ranges

Fetched official public maintainer API `https://api.github.com/repos/lovell/sharp/security-advisories`; raw `official-advisories.json` SHA256 `e932e645d29bcabead6bcf36ece6b6c565e636102e76b9b34adf7f2c2b53445c`. Initial receipt proves fresh fetch; final offline run honestly records `freshFetchThisRun:false`. Per-advisory URLs, descriptions, historical advisories and fixed ranges retained verbatim.

|Official GHSA|Affected sharp|Fixed sharp|
|---|---|---|
|GHSA-wq5f-xc86-pv6w|<0.35.5|>=0.35.5|
|GHSA-rgj7-g3m4-5g8c|<0.35.4|>=0.35.4|
|GHSA-f88m-g3jw-g9cj|<0.35.0|>=0.35.0|

No invented CVE/exploitability conclusion. Maintainer conditions distinguish prebuilt dependencies, global native libraries and runtime/platform conditions; actual `sharp.versions` is recorded. Historical published lock inspection is explicitly pinned to `346933c105305224d575bf9319256301c1eeabfa`, not a live PR/current publication claim.

## Important refutation / exact owner handoff

**Correct `repair-review-2026-10-02/fix-security-delivery.json:1736`: current installed Next does NOT block SVG decoding.** `sites/umbrella/node_modules/next/dist/server/image-optimizer.js:getSharp:194–215` explicitly unblocks SVG at211 and TIFF at212; actual benign SVG decodes in all four roots. `imageOptimizer:981–985` instead rejects SVG at the front door under default `dangerouslyAllowSVG:false`. Retained `svg-claim-refuted.json` reports the failed old expectation (`benign-SVG-decoder-blocked: undefined`), not a product vulnerability. Initial harness resolution failure `ERR_PACKAGE_PATH_NOT_EXPORTED` is retained in `initial-harness-failure.json`; corrected by resolving the real sharp entry then reading its containing manifest, not adding a Kids dependency.

Kids browser no-network evidence does **not** disable its installed server image optimizer. `sites/kids/next.config.ts:7–24` does not override images; other site configs likewise leave defaults. Default remote patterns deny arbitrary remote URLs, while local paths admit. No-browser observation cannot establish absence of server-side image capabilities. Static source usage inventory in JSON is not deployed reachability proof.

**Serial integration after explicit handoff**, with security-delivery owning manifests/locks: preserve existing narrow `sharp@<0.35.5: 0.35.5` override (`sites/kids/package.json:37`, umbrella:59; all four roots) and lock resolution, correct stale advisory report claim, integrate this auxiliary check. No additional product source patch is supported by these results. This is a compatible dependency selection under the actual Next optional range, **not** a reason to perform a major Next upgrade. Sharp's 0.34→0.35 transition is not itself a patch-version bump; compatibility is evidenced by declared support plus bounded raster checks, not guaranteed for every image format/platform. Disabling optimization globally or expanding SVG/remote allowlists would be separate product/security policy decisions and is not proposed.

## Deferred exact-candidate acceptance

`deferred-http.py` is executable acceptance for an existing isolated **loopback-only** Next production server, refuses redirects/proxies, uses bounded bodies/timeouts, and tests real `/_next/image` missing-query/remote negatives plus an existing raster positive. **NOTRUN**: no builds, server starts, browser, dependency installs, full suites, credentials/providers or production access. Preconditions: serial owner freezes candidate, rebuilds site under separate heavy-job authority, records production artifact/native hashes and source binding, starts unique owned port, supplies a real local PNG path; then runs `python3 .../advisory-surface/deferred-http.py --url http://127.0.0.1:PORT --fixture /known.png --candidate SHA256` once per site, retains JSON, and stops only its own server. Operator-provided candidate digest is not automatically independently attested. Require package tracing contains patched sharp/native dependencies on deployment target; do not transfer local Node success to deployment. Full gate/build/browser and global-native-library/platform exploitability remain separate NOTRUN predicates.

Resources: no services/ports/temp fixtures created; only owned auxiliary files written. Both Python artifacts syntax-checked without bytecode writes; HTTP driver help only, not HTTP execution.
