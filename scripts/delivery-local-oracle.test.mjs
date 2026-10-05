import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { parse } from 'yaml';

const workflows = '.github/workflows';

const reviewed = new Map([
  ['actions/checkout','11d5960a326750d5838078e36cf38b85af677262'],
  ['pnpm/action-setup','b906affcce14559ad1aafd4ab0e942779e9f58b1'],
  ['actions/setup-node','49933ea5288caeca8642d1e84afbd3f7d6820020'],
  ['actions/upload-artifact','ea165f8d65b6e75b540449e92b4886f43607fa02'],
  ['actions/github-script','f28e40c7f34bde8b3046d885e986cb6290c5673b'],
]);

await test('every workflow action is reviewed immutable SHA with version comment and minimal permissions', async () => {
  for (const file of await readdir(workflows)) {
    if (!file.endsWith('.yml')) continue;
    const text = await readFile(`${workflows}/${file}`,'utf8'); const yaml = parse(text);
    assert.deepEqual(yaml.permissions, { contents: 'read' }, file);

    for (const line of text.split('\n').filter(line=>line.includes('uses:'))) {
      const match = /uses:\s*([^@\s]+)@([a-f0-9]{40})\s+#\s*v[0-9]/.exec(line);
      assert.ok(match, line); assert.equal(match[2], reviewed.get(match[1]),line);
    }
  }
});

await test('Kids frozen build job is independent of root/sites jobs and secret/data/deploy inputs', async () => {
  const workflow = parse(await readFile(`${workflows}/gate.yml`,'utf8'));
  assert.deepEqual(workflow.jobs['sites-build'].strategy.matrix.site,['umbrella','catalog-game','catalog-web']);
  const kids = workflow.jobs['kids-build'];
  const runs = kids.steps.filter(x=>x.run);
  assert.deepEqual(runs.map(x=>x.run),['pnpm install --frozen-lockfile','pnpm typecheck','pnpm build']);

  for(const step of runs) { assert.equal(step['working-directory'],'sites/kids'); assert.equal(step.env,undefined); }

  assert.doesNotMatch(JSON.stringify(kids),/secrets\.|deploy|upload|profile-kids/);
});

await test('Windows default path is bounded non-signing install/typecheck/stage/static smoke', async () => {
  const yaml = parse(await readFile(`${workflows}/desktop-windows.yml`,'utf8'));
  assert.equal(yaml.on.workflow_dispatch.inputs.native_candidate.default,false);
  const job=yaml.jobs['static-staging'];assert.equal(job['timeout-minutes'],20);assert.equal(job['runs-on'],'windows-latest');
  assert.equal(job.environment,undefined);assert.doesNotMatch(JSON.stringify(job),/secrets\.|CSC_|publish|upload|--packaged/);
  assert.ok(job.steps.some(x=>x.run==='pnpm typecheck' && x['working-directory']==='desktop/windows'));
  assert.ok(job.steps.some(x=>x.run==='pnpm build' && x['working-directory']==='desktop/windows'));
  assert.ok(job.steps.some(x=>x.run==='pnpm smoke' && x['working-directory']==='desktop/windows'));
});

await test('Windows native candidate is explicit default-off isolated secrets, no upload/publication', async () => {
  const text=await readFile(`${workflows}/desktop-windows.yml`,'utf8');const job=parse(text).jobs['native-candidate'];
  assert.equal(job.if,"github.event_name == 'workflow_dispatch' && inputs.native_candidate == true");
  assert.equal(job.environment,'approved-isolated-windows-native-candidate');assert.equal(job['timeout-minutes'],40);
  assert.deepEqual(job.permissions,{contents:'read'});assert.ok(job.steps.some(x=>x.run?.includes('WINDOWS_SIGNING_INPUTS_UNCONFIGURED')));
  assert.doesNotMatch(text,/upload-artifact|draft:upload|GH_TOKEN|contents:\s*write|--publish\s+(?!never)/);
});

await test('pnpm9.15.0 policy is consistent across independent roots; Kids approval remains frozen', async () => {
  const root=JSON.parse(await readFile('package.json','utf8'));assert.equal(root.packageManager,'pnpm@9.15.0');

  for(const directory of ['sites/umbrella','sites/catalog-game','sites/catalog-web','sites/kids','desktop/linux','desktop/macos','desktop/windows']) {
    const manifest=JSON.parse(await readFile(`${directory}/package.json`,'utf8'));assert.equal(manifest.packageManager??root.packageManager,'pnpm@9.15.0',directory);
    assert.match(await readFile(`${directory}/pnpm-lock.yaml`,'utf8'),/^lockfileVersion: ['"]?9\.0/m);
  }

  const kids=parse(await readFile('sites/kids/pnpm-workspace.yaml','utf8'));assert.deepEqual(kids.packages,['.']);assert.deepEqual(kids.allowBuilds,{sharp:true});
});

await test('local SBOM names exact source/dirty/toolchain/8lock hashes without fake signature or attestation', async () => {
  const { collectLocalSbom }=await import('./local-sbom.mjs'); const sbom=await collectLocalSbom();
  assert.equal(sbom.bomFormat,'CycloneDX');assert.equal(sbom.specVersion,'1.6');assert.ok(sbom.components.length>0);
  assert.equal(sbom.metadata.properties.filter(x=>x.name.endsWith('pnpm-lock.yaml')).length,8);

  for (const hash of sbom.metadata.properties.filter(x=>x.name.endsWith('pnpm-lock.yaml'))) assert.match(hash.value,/^[0-9a-f]{64}$/);
  assert.match(sbom.metadata.properties.find(x=>x.name==='sceneaxi:evidence-kind').value,/unsigned-local-lockfile-inventory-not-installed-or-deployed-attestation/);
  assert.equal(sbom.signature,undefined);assert.equal(sbom.attestation,undefined);
  assert.equal(new Set(sbom.components.map(x=>x['bom-ref'])).size,sbom.components.length);
});

await test('Windows unsigned native runtime is bounded dispatch-only default-off without secrets/signing/publication', async () => {
  const workflow = parse(await readFile(`${workflows}/desktop-windows.yml`, 'utf8'));
  assert.equal(workflow.on.workflow_dispatch.inputs.native_runtime.default, false);
  const job = workflow.jobs['native-runtime'];
  assert.equal(job.if, "github.event_name == 'workflow_dispatch' && inputs.native_runtime == true");
  assert.equal(job['timeout-minutes'], 25);
  assert.deepEqual(job.permissions, { contents: 'read' });
  assert.equal(job.environment, undefined);
  assert.doesNotMatch(JSON.stringify(job), /secrets\.|CSC_|pnpm dist|upload|publish|signing/);
  assert.ok(job.steps.some(step => step.run === 'node scripts/native-runtime-smoke.mjs'));
  const script = await readFile('desktop/windows/scripts/native-runtime-smoke.mjs', 'utf8');
  assert.match(script, /timeout: 120_000/);
  assert.match(script, /WINDOWS_RELEASE_HOST_REQUIRED/);
  assert.match(script, /latencyMs.every/);
});
