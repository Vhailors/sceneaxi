/** Disposable PG17 only. Never reads DATABASE_URL, provider keys or production data. */
import { test } from 'node:test';
import { format } from 'node:url';
import process from 'node:process';
import { setTimeout } from 'node:timers';
import console from 'node:console';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { loadMigrations, migrate, psqlExecutor } from '../scripts/db-migrate.mjs';

const container = `sceneaxi-finish-pg-${process.pid}`;

const run = (command, args, options = {}) => {
  const p = spawnSync(command, args, { encoding: 'utf8', timeout: 60_000, ...options });
  assert.equal(p.status, 0, `${command} failed: ${p.stderr}`);

 return p.stdout.trim();
};

const asyncRun = (command, args, options = {}) => new Promise((resolve, reject) => {
  const p = spawn(command, args, options); let stdout = '', stderr = '';
  p.stdout.on('data', x => { stdout += x; }); p.stderr.on('data', x => { stderr += x; });
  p.on('error', reject); p.on('close', code => resolve({ code, stdout: stdout.trim(), stderr }));
});

await test('disposable real PostgreSQL17 billing/runner/restore acceptance', { timeout: 120_000 }, async t => {
  run('docker', ['run', '--rm', '-d', '--name', container, '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', '-p', '127.0.0.1::5432', 'postgres:17-alpine']);

  try {
    let ready = false;

    for (let i = 0; i < 100; i++) {
      if (spawnSync('docker', ['exec', container, 'pg_isready', '-U', 'postgres'], { stdio: 'ignore' }).status === 0) { ready = true; break; }

      await new Promise(r => setTimeout(r, 100));
    }

    assert.ok(ready, 'local PG17 must start');
    const port = run('docker', ['port', container, '5432/tcp']).split(':').at(-1);
    const env = { ...process.env, PGHOST: '127.0.0.1', PGPORT: port, PGUSER: 'postgres', PGDATABASE: 'postgres', PGPASSWORD: '', PGSSLMODE: 'disable' };
    const sql = (text, database = 'postgres') => run('psql', ['-XqAt', '-v', 'ON_ERROR_STOP=1', '-c', text], { env: { ...env, PGDATABASE: database } });
    const attempt = (text, database = 'postgres') => spawnSync('psql', ['-XqAt', '-v', 'ON_ERROR_STOP=1', '-c', text], { encoding: 'utf8', env: { ...env, PGDATABASE: database } });
    const parallel = (text) => asyncRun('psql', ['-XqAt', '-v', 'ON_ERROR_STOP=1', '-c', text], { env });
    const files = await loadMigrations();
    const ledger = (id, seq, delta, balance, key = id, account = 'acct') => `INSERT INTO credit_ledger_entries VALUES ('${id}','${account}',${seq},'${delta < 0 ? 'debit' : 'grant'}',${delta},${balance},'fixture','${key}','2026-01-01Z')`;
    const checkout = (id, at = '2026-01-01Z', user = 'u') => `INSERT INTO checkout_session_intents VALUES ('${id}','${user}','credit-pack','fixture',100,100,'usd','fixture_price','test','https://fixture.test/account','https://fixture.test/pricing','${id}','${at}')`;
    await t.test('whole-run runner refreshes history after lock; concurrent first installs apply exactly once', async () => {
      const holder = parallel('BEGIN; SELECT pg_advisory_xact_lock(70227001); SELECT pg_sleep(1); COMMIT;');
      await new Promise(r => setTimeout(r, 100));

      const databaseUrl = format({ protocol: "postgresql:", slashes: true,
          hostname: env.PGHOST, port: env.PGPORT, auth: env.PGUSER,
          pathname: env.PGDATABASE, query: { sslmode: env.PGSSLMODE } });

      const races = await Promise.all([0, 1].map(() => asyncRun(process.execPath, ['scripts/db-migrate.mjs'], { env: { ...env, DATABASE_URL: databaseUrl } })));
      await holder;

      for (const r of races) assert.equal(r.code, 0, r.stderr);
      assert.equal(sql('SELECT count(*) FROM schema_migrations'), '9');
      assert.equal(races.reduce((count, r) => count + r.stdout.split('\n').filter(x => x.startsWith('applied ')).length, 0), 9);
      assert.deepEqual(await migrate({ executor: psqlExecutor(databaseUrl), migrations: files }), []);
      assert.equal((await migrate({ executor: psqlExecutor(databaseUrl), migrations: files, status: true })).filter(x => x.applied).length, 9);
    });
    sql("INSERT INTO users VALUES ('u','u@fixture.test',true,false,'2026-01-01Z'),('v','v@fixture.test',true,false,'2026-01-01Z'); INSERT INTO credit_accounts VALUES ('acct','u','2026-01-01Z'),('other','v','2026-01-01Z');");
    sql(ledger('grant', 1, 1000, 1000));
    await t.test('race serializes next sequence and refuses stale witness without partial state', async () => {
      const races = await Promise.all([parallel(`BEGIN; ${ledger('race1', 2, -10, 990)}; SELECT pg_sleep(.1); COMMIT;`), parallel(`BEGIN; ${ledger('race2', 2, -10, 990)}; COMMIT;`)]);
      assert.equal(races.filter(r => r.code === 0).length, 1);
      assert.match(races.find(r => r.code !== 0).stderr, /CREDIT_LEDGER_CHAIN_INVALID/);
      assert.equal(sql("SELECT count(*),sum(delta) FROM credit_ledger_entries WHERE account_id='acct'"), '2|990');
    });

    for (const [label, seq, delta, balance] of [['sequence gap',4,1,991],['wrong witness',3,1,999],['unsafe delta',3,9007199254740992,9007199254741982],['negative balance',3,-1000,-10],['unsafe witness',3,9007199254740002,9007199254740992]]) {
      await t.test(`chain rejects ${label}`, () => {
        const result = attempt(ledger('invalid',seq,delta,balance)); assert.notEqual(result.status,0); assert.match(result.stderr,/CREDIT_LEDGER_CHAIN_INVALID/);
        assert.equal(sql("SELECT count(*) FROM credit_ledger_entries WHERE entry_id='invalid'"),'0');
      });
    }

    await t.test('exact old-key replay is quota free and creates no second ledger entry', () => {
      sql(`${ledger('grant',1,1000,1000)} ON CONFLICT (idempotency_key) DO NOTHING`);
      assert.equal(sql("SELECT count(*) FROM credit_ledger_entries WHERE idempotency_key='grant'"),'1');
    });
    await t.test('reservation race admits one affordable call; replay/conflict/balance anchors remain durable', async () => {
      const reserve = key => `SELECT status FROM sceneaxi_reserve_hosted_call('acct','${key}',700,'fixture','fixture/model','complete','2026-01-01Z')`;
      const r = await Promise.all([parallel(reserve('hosted1')),parallel(reserve('hosted2'))]);
      assert.deepEqual(r.map(x => x.stdout).sort(), ['acquired','insufficient']);
      const key = sql('SELECT idempotency_key FROM hosted_model_operations');
      assert.equal(sql(reserve(key)),'pending');
      assert.equal(sql(`SELECT status FROM sceneaxi_reserve_hosted_call('acct','${key}',701,'fixture','fixture/model','complete','2026-01-01Z')`),'conflict');
      assert.match(attempt(ledger('pending-debit',3,-700,290,key)).stderr,/HOSTED_DEBIT_CONFLICT/);
      assert.match(attempt(ledger('unreserved-debit',3,-500,490)).stderr,/CREDIT_BALANCE_RESERVED/);
      sql(`UPDATE hosted_model_operations SET status='response-ready',response='{"text":"fixture"}' WHERE idempotency_key='${key}'`);
      assert.equal(sql(reserve(key)),'response-ready');
      sql(ledger('hosted-debit',3,-700,290,key));
      sql(`UPDATE hosted_model_operations SET status='completed' WHERE idempotency_key='${key}'`);
      assert.equal(sql(reserve(key)),'completed');
      assert.match(attempt(`UPDATE hosted_model_operations SET response='{}' WHERE idempotency_key='${key}'`).stderr,/HOSTED_OPERATION_IMMUTABLE/);
    });
    await t.test('clock injected per-user fifth/sixth attempt, stable replay and window expiry', () => {
      for(let i=0;i<5;i++) sql(checkout(`intent${i}`));
      assert.match(attempt(checkout('intent5')).stderr,/BILLING_CHECKOUT_RATE_LIMITED/);
      sql(`${checkout('intent0')} ON CONFLICT (idempotency_key) DO NOTHING`);
      assert.equal(sql("SELECT count(*) FROM checkout_session_intents WHERE user_id='u'"),'5');
      sql(checkout('expired-window','2026-01-01T00:05:01Z'));
    });
    await t.test('concurrent new checkout attempts use durable user lock', async () => {
      const r = await Promise.all(Array.from({length:6},(_,i)=>parallel(checkout(`v${i}`,'2026-01-01Z','v'))));
      assert.equal(r.filter(x=>x.code===0).length,5); assert.match(r.find(x=>x.code!==0).stderr,/BILLING_CHECKOUT_RATE_LIMITED/);
    });
    await t.test('existing corrupt history blocks forward migration instead of repair', () => {
      sql('CREATE DATABASE corrupt');

      for (const f of files.slice(0,8)) sql(f.sql,'corrupt');
      sql("INSERT INTO users VALUES ('bad','bad@fixture.test',true,false,'2026-01-01Z'); INSERT INTO credit_accounts VALUES ('bad','bad','2026-01-01Z');",'corrupt');
      sql(ledger('bad',1,-100,0,'bad','bad'),'corrupt');
      const r=attempt(files[8].sql,'corrupt');assert.notEqual(r.status,0);assert.match(r.stderr,/CREDIT_LEDGER_HISTORY_INVALID/);
      assert.equal(sql("SELECT balance_after FROM credit_ledger_entries",'corrupt'),'0');
    });
    await t.test('bounded history/reconciliation query indexes exist', () => {
      assert.equal(sql("SELECT count(*) FROM pg_indexes WHERE indexname IN ('sceneaxi_checkout_history','sceneaxi_reconciliation_history','credit_ledger_entries_account_sequence','credit_reconciliation_intent','sceneaxi_credit_purchase_anchors','sceneaxi_hosted_pending')"),'6');
    });
    await t.test('populated pg_dump/pg_restore all table counts+digests and guards survive', () => {
      sql(`INSERT INTO credit_reconciliation_records VALUES ('evt_fixture','test','intent0','u','charge_fixture','charge.refunded','STRIPE_REFUND_NOT_FULL',50,'usd',NULL,NULL,'2026-01-01Z','${'a'.repeat(64)}')`);

      const facts = database => {
        const tables = sql("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename",database).split('\n');

        return tables.map(name => [name,sql(`SELECT count(*),md5(COALESCE(string_agg(row_to_json(t)::text,E'\\n' ORDER BY row_to_json(t)::text),'')) FROM "${name}" t`,database)]);
      };

      const before=facts('postgres');
      const dump=spawnSync('pg_dump',['-Fc','--no-owner','--no-acl'],{env,timeout:30000,maxBuffer:16*1024*1024});assert.equal(dump.status,0,String(dump.stderr));
      sql('CREATE DATABASE restored');
      const restore=spawnSync('pg_restore',['--exit-on-error','--no-owner','--no-acl','-d','restored'],{input:dump.stdout,env,timeout:30000});assert.equal(restore.status,0,String(restore.stderr));
      assert.deepEqual(facts('restored'),before);assert.equal(sql('SELECT count(*) FROM credit_reconciliation_records','restored'),'1');
      assert.match(attempt(ledger('restored-bad',4,10,301),'restored').stderr,/CREDIT_LEDGER_CHAIN_INVALID/);
      assert.notEqual(attempt('UPDATE credit_ledger_entries SET delta=1','restored').status,0);
      assert.notEqual(attempt('UPDATE checkout_session_intents SET credits=1','restored').status,0);
      console.log(`RESTORE_VERIFIED tables=${before.length} populated-ledger=3 reconciliation=1 counts+digests=exact`);
    });
  } finally { run('docker',['rm','-f',container]); }
});
