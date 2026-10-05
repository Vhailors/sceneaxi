# Launcher security — explicit source handback; native integration pending

Edited: `packages/authoring-core/src/local-project-build.ts:275,301,343,370` and `packages/authoring-core/test/local-project-build.test.ts:176`. Matching schema source/test remain byte-identical; no schema/public-export change required.

CAP-01 historical red: review-capabilities/report.json records runtime symlink substitution executing a harmless marker before refusal, source SHA-256 `6465dba1a3d3e4a0bf42af916b882cc938c19d1a5f52ca5b86a5a753233342f0`. Retry source already contained a verified private-snapshot repair. New real-child red reproduced owned snapshot runtime substitution: `red-owned-before.log`, exit1, marker existed (`expected true to be false`). Initial whole-file red attempt timed out after30s without an assertion result; not counted as proof.

Fix: execute a separately generated approved bootstrap outside the artifact via child fd5, acquired from its exclusive writer descriptor, checked for regular-file identity/owner/size/digest and made read-only. Retain artifact fd4/private root for actual exported project data. No writable bootstrap handle survives spawn. Cleanup restores directory permissions only and never reopens substituted files/symlinks. The bootstrap remains named for native module-loader compatibility; it is not a sealed memfd.

Green: normal default public suites (authoring local, schema local, signed gate) **41 passed, 0 failed, 0 skipped**, `green-bootstrap.log`; focused ESLint exit0, `lint-bootstrap.log`. No bridge alias or fake verifier. Assertions preserve original-path runtime rewrite/symlink/directory negatives before spawn; late original-path and owned artifact/bootstrap symlink replacement cannot execute the safe marker; approved bootstrap bytes/mode, receipts, containment, timeout/output limits and namespace removal pass. Signed release/v1/Kids semantics remain unchanged.

Final SHA-256:
- Authoring source: `c57134d87891c2b2b7098a9efb18c58094788a9f24a04ec4df066bd37f83447f`
- Authoring test: `194fe7b6bb6cc59b3958a4249ce0021b6b8ff547bb1587cf6c249659540b0fc7`
- Schema source (unchanged): `9493b82e88d6eea649be33a91b3d133d5daddc2bc160744b9599a5750dd8cff5`
- Schema test (unchanged): `5a71f3f7e718a900a3fa3965fd530e7dd18444551b37f6c54df5ed7531a617dd`

Deferred: serial-owner native command `sh docs/audits/production-swarm/implementation-expansion-2026-10-02/unsigned-project-build/deferred-native-smoke.sh` with approved SCENEAXI_LOCAL_ELECTRON, existing SCENEAXI_LOCAL_RENDERER and SCENEAXI_LOCAL_PUBLISHER. Verify Electron fd5 entrypoint loading, actual saved-document digest, pixels/PNG and exact exit0 after trusted profile/held-key action wiring. Full gate/build, browser/native and actual pixels NOT RUN. Fresh schemas declarations/authoring typecheck remain deferred; prior diagnostic is not relabeled green. All bounded test children terminate; fixture/namespace removal asserted. Explicit process check found no surviving matching test/child process; no persistent service started.

Semantic risk: file modes/private namespaces/pinned handles do not isolate a fully compromised same-UID/root process (which can chmod/write/reopen descriptors or ptrace). This protocol prevents artifact/path substitutions; it is not cryptographic OS immutability. Executable approval remains caller-owned and actual native loading is unverified. Original-project changes may still produce post-exit receipt refusal without redirecting executed bootstrap. No signed/portable/release-ready claim.

**Explicit source handback:** edits complete; ownership released to parent/serial integrator. No shared indices, manifests, global ledger, authority or gate changes.
