#!/usr/bin/env python3
"""Read-only integration inventory; writes evidence only beside this script."""
from pathlib import Path
from datetime import datetime, timezone
import hashlib, json, re
ROOT = Path('/home/devuser/Documents/Projects/sceneaxi')
BASE = ROOT / 'docs/audits/production-swarm/implementation-expansion-2026-10-02'
OUT = Path(__file__).parent
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest() if p.is_file() else None
scopes = {
'own-session-endpoint': ('bg-110', ['sites/umbrella/src/provider/own-session.ts','sites/umbrella/src/app/api/auth/own-session/route.ts','sites/umbrella/test/own-session.test.ts']),
'catalog-session-adapter': ('bg-111', ['packages/site-kit/src/catalog-server-fetch.ts','packages/site-kit/test/catalog-server-fetch.test.ts','sites/catalog-game/src/lib/identity-plane.ts','sites/catalog-web/src/lib/identity-plane.ts']),
'checkout-deadline': ('bg-112', ['sites/umbrella/src/app/api/checkout/checkout-handler.ts','sites/umbrella/test/checkout-reader-bounds.test.ts']),
'desktop-keyboard': ('bg-113', ['apps/desktop-shell/src/chrome.ts','apps/desktop-shell/test/keyboard-geometry.test.ts','apps/desktop-shell/test/visual-postpr-evidence/retry/capture.mjs']),
'web-inspector-ux': ('bg-114', ['apps/web-shell/src/inspector-app.ts','apps/web-shell/test/inspector-accessibility.test.ts']),
'versioned-transforms': ('bg-115', ['packages/schemas/src/scene-composition.ts','packages/authoring-core/src/scene-composition.ts','packages/engine-presentation/src/scene-transforms.ts','packages/schemas/test/scene-transform-v2.test.ts','packages/authoring-core/test/scene-transform-v2.test.ts']),
'unsigned-project-build': ('bg-116', ['packages/schemas/src/desktop-project-build.ts','packages/authoring-core/src/local-project-build.ts','packages/schemas/test/local-project-build.test.ts','packages/authoring-core/test/local-project-build.test.ts']),
'importer-capacity': ('bg-117', ['packages/importers/src/contained-gltf.ts','packages/importers/src/asset-preparation-worker.ts','packages/importers/test/asset-preparation-bounds.test.ts']),
'catalog-ui-polish': ('bg-118', ['sites/catalog-game/src/app/globals.css','sites/catalog-game/src/app/_components/listing-card.tsx','sites/catalog-game/src/app/page.tsx','sites/catalog-game/test/catalog-ux-regression.test.ts']),
'web-catalog-ui': ('bg-119', ['sites/catalog-web/src/app/globals.css','sites/catalog-web/src/app/_components/listing-card.tsx','sites/catalog-web/src/app/page.tsx','sites/catalog-web/test/catalog-ux-regression.test.ts'])}
ids = {
'SITE-CATALOG-IDENTITY':['own-session-endpoint','catalog-session-adapter'],
'BD-002':['checkout-deadline'],'BD-003':['checkout-deadline'],'BD-004':['checkout-deadline'],
'IR-06':['desktop-keyboard'],'VD-03':['desktop-keyboard'],'VD-04':['desktop-keyboard'],
'VD-05':['desktop-keyboard','web-inspector-ux'],'VD-02':['web-inspector-ux'],'SH-T02':['web-inspector-ux'],
'VS-05':['desktop-keyboard','catalog-ui-polish','web-catalog-ui'],
'UI-001':['catalog-ui-polish','web-catalog-ui'],'UI-002':['catalog-ui-polish','web-catalog-ui'],
'LOCAL-070':['versioned-transforms'],'DR-006':['unsigned-project-build'],'GA-005':['unsigned-project-build'],'IR-07':['unsigned-project-build'],
'AP-PERF':['importer-capacity'],'DL-PERF-08':['importer-capacity'],'06-04':['importer-capacity']}
ledger_path = ROOT/'docs/audits/production-swarm/repair-review-2026-10-02/ledger.json'
ledger_start = sha(ledger_path)
ledger = json.loads(ledger_path.read_text())
shared = ['package.json','pnpm-lock.yaml','pnpm-workspace.yaml','docs/dependency-matrix.json','packages/site-kit/package.json','packages/site-kit/src/ports.ts','packages/site-kit/src/deep-link.ts','packages/site-kit/src/index.ts','packages/schemas/src/index.ts','packages/authoring-core/src/index.ts','packages/engine-presentation/src/index.ts','packages/importers/src/index.ts','vitest.config.ts']
shared_before = {p:sha(ROOT/p) for p in shared}
reports, sources, allpaths = [], [], []
for lane,(owner,paths) in scopes.items():
    jp,mp=BASE/lane/'report.json',BASE/lane/'report.md'
    d=json.loads(jp.read_text()) if jp.is_file() else {}
    text=mp.read_text() if mp.is_file() else ''
    hj,hm=sha(jp),sha(mp)
    # Only final handback reports read above are interpreted as source releases.
    handback=d.get('sourceHandback')
    complete=handback is True or isinstance(handback,dict) and handback.get('complete') is True
    if not complete:
        complete=bool(re.search(r'(?:handed back|handback complete|handback issued|source handed back)',text,re.I))
    rows=[]
    for p in paths:
        actual=sha(ROOT/p)
        # Exact current digest must occur in the child's receipt, not inferred from test success.
        digest_in_receipt=bool(actual and (actual in jp.read_text() or actual in text))
        row={'path':p,'builder':owner,'lane':lane,'sha256':actual,'matchesDigestInReceipt':digest_in_receipt,'nextWriter':'bg-109 only after explicit release'}
        rows.append(row); sources.append(row); allpaths.append(p)
    requests={k:v for k,v in d.items() if any(s in k.lower() for s in ['exportrequest','integrationrequest','contractrequest','sharedrequest','serialacceptance','registrationrequest'])}
    reports.append({'lane':lane,'builder':owner,'report':str(mp.relative_to(ROOT)),'reportJsonSha256':hj,'reportMarkdownSha256':hm,'builderStatus':d.get('status'),'sourceHandbackComplete':complete,'sourceCount':len(rows),'requestsVerbatim':requests,'acceptance':'NOTREADY; scoped builder results are not integrated acceptance'})
assert len(allpaths)==len(set(allpaths)), 'overlapping builder source assignment'
ledger_rows=[]; unmapped=[]
for id,lanes in ids.items():
    matches=[(i,r) for i,r in enumerate(ledger['rows']) if r.get('id')==id]
    if not matches:
        unmapped.append({'id':id,'lanes':lanes,'disposition':'Child alias/subject absent as exact ledger row id; no new row or fabricated closure'})
    for i,r in matches:
        ledger_rows.append({'id':id,'jsonPointer':f'/rows/{i}','lanes':lanes,'rootCause':r.get('rootCause'),'existingStatus':r.get('status'),'existingOwner':r.get('writeOwner',r.get('ownerLane')),'nextWriter':'serial controller only; no ledger mutation by reviewer','disposition':'PRESERVATION_ONLY' if id in ['BD-003','BD-004','UI-001','UI-002'] else 'NOTREADY_PENDING_INTEGRATED_PREDICATES'})
exports={
'packages/schemas/src/index.ts': {
'./scene-composition.js': {'values':'SCENE_COMPOSITION_SCHEMA_VERSION_V2 SCENE_MATRIX_CONVENTION_V2 multiplySceneMatricesV2 sceneMatrixFromSculptTransformV2 validateSceneCompositionIntakeV2 resolveScenePlacementsV2 migrateSceneCompositionIntakeV1ToV2 digestScenePlacementsV2 digestComposedSceneV2 projectSceneInstanceHierarchyV2 validateComposedSceneV2 composedSceneV2FromDocumentData'.split(),'types':'SceneMatrixV2 SceneCompositionIntakeV2 ResolvedScenePlacementV2 SceneBoundsV2 ComposedSceneInstanceV2 ComposedSceneV2 PlacedSceneInstanceHierarchyV2'.split()},
'./desktop-project-build.js':{'values':['evaluateLocalProjectBuild'],'types':[]}},
'packages/authoring-core/src/index.ts': {
'./scene-composition.js':{'values':'composeSceneV2 serializeComposedSceneV2 sceneDocumentFromComposedSceneV2 migrateComposedSceneV1ToV2'.split(),'types':['SceneCompositionResultV2']},
'./local-project-build.js':{'values':'LOCAL_PROJECT_BUILD_LIMITS LOCAL_PROJECT_BUILD_REFUSALS buildLocalProject verifyLocalProjectBuild launchLocalProjectBuild'.split(),'types':'LocalProjectBuildRefusal LocalProjectBuildReceipt LocalProjectBuildSuccess LocalProjectBuildResult LocalProjectBuildInput LocalProjectLaunchInput LocalProjectLaunchSuccess'.split()}},
'packages/engine-presentation/src/index.ts':{'./scene-transforms.js':{'values':['resolveScenePresentationV2'],'types':['ScenePresentationSourceV2']}},
'packages/importers/src/index.ts':{'./asset-preparation-worker.js':{'values':'startProjectAssetPreparation ASSET_PREPARATION_REFUSALS ASSET_PREPARATION_DEADLINE_MS'.split(),'types':'ProjectAssetPreparationInput ProjectAssetPreparationOutcome ProjectAssetPreparationJob'.split()}}}
export_checks=[]
for path,groups in exports.items():
    text=(ROOT/path).read_text()
    for module,kinds in groups.items():
        for kind,names in kinds.items():
            assert len(names)==len(set(names))
            for name in names:
                export_checks.append({'path':path,'module':module,'kind':kind,'symbol':name,'identifierPresent':bool(re.search(r'\b'+re.escape(name)+r'\b',text)),'owner':'bg-109','proofLimit':'lexical presence only; public compilation still required'})
reviews=[]
for lane in ['review-endpoints','review-ux','review-capabilities']:
    p=BASE/lane/'report.json'
    if p.is_file():
        d=json.loads(p.read_text()); reviews.append({'lane':lane,'sha256':sha(p),'verdict':d.get('verdict'),'report':str(p.relative_to(ROOT))})
    else: reviews.append({'lane':lane,'available':False,'verdict':'NOT_REVIEWED; no waiting/polling'})
shared_after={p:sha(ROOT/p) for p in shared}
changed_reports=[r['lane'] for r in reports if sha(BASE/r['lane']/'report.json')!=r['reportJsonSha256'] or sha(BASE/r['lane']/'report.md')!=r['reportMarkdownSha256']]
changed_sources=[s['path'] for s in sources if sha(ROOT/s['path'])!=s['sha256']]
blockers=[
 {'id':'H-01','status':'FAIL_FROM_INDEPENDENT_RECEIPT','anchor':'packages/site-kit/src/deep-link.ts:180-188','predicate':'Unsafe raw configured origin must refuse403 before any principal read; peer observed200/read1 for path/query/fragment/userinfo/whitespace','fix':'Validate raw value before normalization in authoritative shared seam; canonical positives and explicit development policy must remain'},
 {'id':'H-02','status':'FAIL_FROM_INDEPENDENT_RECEIPT','anchor':'packages/site-kit/src/ports.ts:314','predicate':'Composed catalog request must not invoke sessionToken getter; peer observed getterCalls1','fix':'Descriptor-only bounded validation before outer plane field access; preserve Kids/roles/refusal ordering'},
 {'id':'H-03','status':'NOTREADY','anchor':'sites/catalog-game/src/app/item/[itemId]/page.tsx:23-26,86; sites/catalog-web/src/app/item/[itemId]/page.tsx:23-26,86','predicate':'Real pages must consume approved new transport, not old default-unwired factory','fix':'Serial owner wires local identity-plane factories with explicit carried credential and approved raw canonical config; add site-kit ./catalog-server-fetch export'},
 {'id':'H-04','status':'NOTREADY','anchor':'packages/authoring-core/src/scene-composition.ts:33','predicate':'Regular public-index no-alias transform/local-build/worker tests must execute; importer receipt5pass5fail missing v2 exports','fix':'Apply grouped index requests exactly once, build in serial, rerun unmodified no-alias tests; no export-only probe as product PASS'},
 {'id':'H-05','status':'NOTREADY','anchor':'packages/engine-presentation/src/scene-transforms.ts:11','predicate':'V2 requires real dispatch/kernel advance/save/replay/presentation, not rest-pose helper alone','fix':'Use explicit schema2 branch, parent-times-child matrices retaining shear, preserve v1 bytes/caps and transaction/dispose guards; contract proposal promoted only by serial owner'},
 {'id':'H-06','status':'NOTREADY','anchor':'packages/authoring-core/src/local-project-build.ts:1','predicate':'Local unsigned user-document runtime must be wired and prove loaded digest/pixels/exact exit','fix':'Wire existing desktop/CLI through trusted profile/held-key authority; keep signed-release gate unchanged; run approved fixture native smoke'},
 {'id':'H-07','status':'NOTREADY','anchor':'packages/importers/src/asset-preparation-worker.ts:48','predicate':'Worker must install exact returned E1 proposal under generation/project/lease fence; native120s cause and original resource budgets still unverified','fix':'Serial desktop cancellation/control/bridge integration, ship built sibling worker; measure preparation/materialization/IPC/reload without budget increases'},
 {'id':'H-08','status':'NOTREADY','anchor':'apps/desktop-shell/src/chrome.ts:1253-1262; apps/web-shell/src/inspector-app.ts:838-997','predicate':'Actual keyboard geometry/contrast/refusal/focus recovery remains unexecuted','fix':'Rebuild frozen candidate then real desktop900/1100/1280 and web390/1440 light/dark/forced-colors browser predicates; retain inert and no-write-retry negatives'},
 {'id':'H-09','status':'NOTREADY','anchor':'sites/catalog-game/src/app/page.tsx:43; sites/catalog-web/src/app/page.tsx:20','predicate':'Catalog final handbacks are newer than review-ux catalog observations; current render and390px browser proof needs review','fix':'Execute both explicitly registered node:test suites plus unchanged storefront82-test regression, site typechecks/builds, GET/URL/empty/refusal/focus geometry'},
 {'id':'H-10','status':'CONDITIONAL_POLICY_FAIL_FROM_PEER','anchor':'apps/web-shell/src/dev-server.ts:299-300','predicate':'Existing unsafe-inline CSP is not strict nonce/hash-only CSP; not a new inspector regression','fix':'If strict CSP required, shared host owner supplies matching nonce/hash or same-origin assets with enforced browser negative tests; do not certify preservation as strict compliance'}]
blockers.append({'id':'CAP-01','status':'FAIL_FROM_INDEPENDENT_RECEIPT','anchor':'packages/authoring-core/src/local-project-build.ts:264,275,279,304','predicate':'Verified artifact path is mutable before spawn; actual replacement runtime executed and wrote marker before LAUNCH_UNVERIFIED refusal; assertion expected true to be false','fix':'Execute pinned trusted bootstrap outside mutable project artifacts and retain descriptor-contained resource identity through use; permanent runtime/directory/symlink substitution negatives before launch, not only post-execution hashes','evidence':'review-capabilities/launch-race.log'})
blockers.append({'id':'CAP-02','status':'NOTREADY','anchor':'packages/importers/src/asset-preparation-worker.ts:113; packages/importers/src/contained-gltf.ts:2490-2492','predicate':'Main-thread publication still synchronously reads/hashes full document/source without document byte cap','fix':'Measure completion/publication/IPC/reload on pre-populated capacity document against unchanged budgets; do not claim proposal offload closes GUI responsiveness'})
serial_order=[
 'Take exclusive serial ownership only of released paths; no child writer resumes without controller authorization.',
 'Repair H-01/H-02/CAP-01 and apply each grouped index export, site-kit subpath and v2 contract once; root manifests/index ownership unchanged.',
 'Wire item pages/raw approved config, explicit v2 runtime dispatch/kernel/presentation, unsigned local build action, and generation-fenced importer async/cancel integration. These are local work, not signer/provider blockers.',
 'Explicitly include own-session60, checkout20 and catalog Node13/17 tests omitted by generic scripts; rerun no-alias capability suites and unchanged negative oracles.',
 'Controller freezes exact post-integration source/artifact/dependency fingerprint; serial owner runs bounded fullbuild/gate and deferred browser/native/HTTP predicates. Do not transfer this pre-integration snapshot PASS to changed source.',
 'Only controller maps predicate evidence to existing ledger IDs and publication SHA; independent PASS requires stable exact fingerprint and preserved negatives. Historical failed pass remains failed.']
payload={'schemaVersion':1,'createdAt':datetime.now(timezone.utc).isoformat(),'verdict':'NOTREADY','root':str(ROOT),'sourceReadOnly':True,'productionCertified':False,'scope':'Serial integration packet, not behavioral rerun or whole-checkout freeze','lanes':reports,'sourceInventory':sources,'overlappingWriterPaths':[],'sharedOwner':'bg-109 remains sole index/manifest/contract/integration owner; controller owns ledger/publication','sharedSnapshotBefore':shared_before,'sharedSnapshotAfter':shared_after,'sharedChangedDuringSnapshot':[p for p in shared if shared_before[p]!=shared_after[p]],'sourceChangedDuringSnapshot':changed_sources,'reportChangedDuringSnapshot':changed_reports,'ledger':{'path':str(ledger_path.relative_to(ROOT)),'sha256Before':ledger_start,'sha256After':sha(ledger_path),'writes':0,'rows':ledger_rows,'unmappedAliases':unmapped},'deduplicatedExports':exports,'exportPresenceEvidence':export_checks,'companionReviews':reviews,'behavioralTestsRunByThisReviewer':[],'notRun':['root build/gate','site builds','browser/native/container','provider/network/DB','independent behavioral reruns'],'receiptInterpretation':'All reported suite counts remain attributed to original builder/reviewer; no totals added across overlapping suites. Missing exports/aliases do not prove deployed wiring. Historical failed visual passes stay failed.'}
payload['blockingPredicates']=blockers
payload['serialIntegrationOrder']=serial_order
payload['wireContract']={'method':'GET','path':'/api/auth/own-session','credential':'explicit x-sceneaxi-session only; no ambient Cookie/Authorization/SSO','origin':'approved raw canonical configured HTTPS DNS or explicit HTTP loopback development; no Host fallback','envelope':'{version:1,ok:true,value:SitePrincipal} | {version:1,ok:false,reason:SiteRefusalReason}','bounds':'credential4096 chars; response16384 bytes; catalog total2000ms; checkout8192 bytes/5000ms total','headers':'no-store; redirect refusal; Kids/client role claims denied before networking/identity dispatch','limits':'Provider provenance, own-session pending-authority timeout/disconnect and actual fresh Next route precedence remain unverified'}
payload['manifestRequest']={'owner':'bg-109','path':'packages/site-kit/package.json','subpath':'./catalog-server-fetch','target':'./src/catalog-server-fetch.ts','matrixChange':False,'rootBarrelChange':False}
payload['contractRequest']={'owner':'bg-109','target':'packages/schemas/contracts/scene-composition-v2.schema.json','sourceProposal':'docs/audits/production-swarm/implementation-expansion-2026-10-02/versioned-transforms/scene-composition-v2.schema.proposal.json','preserve':'v1 contract/bytes/caps; update actual inventory/docs without suppression'}
(OUT/'report.json').write_text(json.dumps(payload,indent=2)+'\n')
summary={'lanes':len(reports),'handedBack':sum(r['sourceHandbackComplete'] for r in reports),'sourcePaths':len(sources),'receiptHashMismatches':[s['path'] for s in sources if not s['matchesDigestInReceipt']],'missingRequestedExportIdentifiers':sum(not e['identifierPresent'] for e in export_checks),'ledgerRowsMapped':len(ledger_rows),'unmappedAliases':unmapped,'changedReports':changed_reports,'changedSources':changed_sources,'sharedChanged':payload['sharedChangedDuringSnapshot'],'ledgerUnchanged':ledger_start==sha(ledger_path)}
(OUT/'probe-evidence.json').write_text(json.dumps(summary,indent=2)+'\n')
print(json.dumps(summary,indent=2))
