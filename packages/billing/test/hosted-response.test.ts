import { describe, expect, it, vi } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import ts from "typescript";
import { resolveAdminIdentity } from "@sceneaxi/auth";
import { issuePrincipalForTest } from "@sceneaxi/auth/testing/principal-issuance";
import {
  appendCreditEntry, BILLING_REFUSE_REASONS, createCreditStore,
  createHostedAiPricingPolicy, createInMemoryCreditStore, createLedgerState,
  runMeteredModelCall, snapshotHostedResponse, HOSTED_RESPONSE_MAX_BYTES, type CreditStore, type HostedCallOperation,
} from "@sceneaxi/billing";
import type { CreditAccount } from "@sceneaxi/schemas";

const now = Date.parse("2026-10-02T00:00:00Z");
const account: CreditAccount = { schemaVersion: 1, kind: "sceneaxi.credit-account", accountId: "acc_response", userId: "usr_response", createdAt: "2026-10-01T00:00:00Z" };
const resolved = resolveAdminIdentity({ SCENEAXI_ADMIN_EMAIL: "captain@example.com" });
if (!resolved.ok) throw new Error(resolved.message);
const admin = resolved.value;
const principal = issuePrincipalForTest({
  user: { schemaVersion: 1, kind: "sceneaxi.user", userId: account.userId, email: "crew@example.com", emailVerified: true, disabled: false, createdAt: account.createdAt },
  role: { schemaVersion: 1, kind: "sceneaxi.role-assignment", userId: account.userId, role: "user", source: "default-user", assignedAt: account.createdAt },
  session: { schemaVersion: 1, kind: "sceneaxi.session", sessionId: "ses_response", userId: account.userId, surface: "web-shell", issuedAt: account.createdAt, expiresAt: "2026-10-03T00:00:00Z", tokenDigest: "a".repeat(64) },
});
const operation: HostedCallOperation = { accountId: account.accountId, idempotencyKey: "usage:acc_response:answer", amount: 7, reason: "answer", model: "fixture", operation: "turn", now };
function fixture() {
  const funded = appendCreditEntry(createLedgerState(account), { entryId: "ent_response", movement: "grant", delta: 100, reason: "fixture", idempotencyKey: "fixture", now });
  if (!funded.ok) throw new Error(funded.message);
  const state = funded.value.state;
  const store = createInMemoryCreditStore({ accounts: [account], entries: state.entries });
  const request = { route: "hosted", capability: "hosted-ai-assistant", now, principal, admin, state, store, creditAmount: 7, reason: "answer", idempotencyKey: "answer", model: "fixture", operation: "turn", hostedAi: { enabled: true, pricing: createHostedAiPricingPolicy([{ model: "fixture", operation: "turn", capability: "hosted-ai-assistant", credits: 7 }]) } };
  return { store, request };
}
const unsupported: ReadonlyArray<readonly [string, () => unknown]> = [
  ["Map", () => new Map([["answer", "paid answer"]])],
  ["Date", () => new Date(now)],
  ["BigInt", () => 1n],
  ["undefined", () => ({ answer: undefined })],
  ["negative zero", () => -0],
  ["NaN", () => Number.NaN],
  ["sparse array", () => new Array(2)],
];
describe("durable hosted response contract", () => {
  it.each(unsupported)("refuses %s without marking response-ready or changing its value", async (_name, make) => {
    const { store } = fixture();
    expect(await store.hostedCalls.reserve(operation)).toEqual({ status: "acquired" });
    await expect(Promise.resolve().then(() => store.hostedCalls.saveResponse(operation, make()))).rejects.toThrow();
    expect(await store.hostedCalls.reserve(operation)).toEqual({ status: "pending" });
  });
  it.each(["accessor", "toJSON"])("does not invoke %s", async (kind) => {
    const { store } = fixture();
    const hook = vi.fn(() => "mutated answer");
    const answer = kind === "accessor" ? Object.defineProperty({}, "answer", { enumerable: true, get: hook }) : { toJSON: hook, answer: "original" };
    await store.hostedCalls.reserve(operation);
    await expect(Promise.resolve().then(() => store.hostedCalls.saveResponse(operation, answer))).rejects.toThrow();
    expect(hook).not.toHaveBeenCalled();
    expect(await store.hostedCalls.reserve(operation)).toEqual({ status: "pending" });
  });
  it("unsupported paid answer leaves a held reservation, no debit, and retry never invokes provider twice", async () => {
    const { store, request } = fixture();
    const call = vi.fn(() => new Map([["answer", "original"]]));
    const first = await runMeteredModelCall({ ...request, call });
    expect(first).toMatchObject({ ok: false, reason: BILLING_REFUSE_REASONS.storeFailed });
    expect(store.entryCount(account.accountId)).toBe(1);
    const second = await runMeteredModelCall({ ...request, call });
    expect(second).toMatchObject({ ok: false, reason: BILLING_REFUSE_REASONS.storeFailed });
    expect(call).toHaveBeenCalledTimes(1);
  });
  it("restarts from response-ready with exact answer, charges once, and never re-enters provider", async () => {
    const { store, request } = fixture();
    const answer = { text: "paid answer", tokens: [1, null, true], nested: { unicode: "é😀" } };
    const call = vi.fn(() => answer);
    const append = vi.fn(() => { throw new Error("simulated lost DB connection before debit"); });
    const firstStore: CreditStore = createCreditStore({ ...store, appendOrReplayEntry: append });
    expect(await runMeteredModelCall({ ...request, store: firstStore, call })).toMatchObject({ ok: false, reason: BILLING_REFUSE_REASONS.storeFailed });
    const restarted = createCreditStore({ ...store });
    const resumed = await runMeteredModelCall({ ...request, store: restarted, call });
    expect(resumed.ok).toBe(true);
    if (!resumed.ok || resumed.value.replayed) throw new Error("response was not recovered");
    expect(resumed.value.response).toEqual(answer);
    expect(resumed.value.balance).toBe(93);
    expect(call).toHaveBeenCalledTimes(1);
    expect(store.entryCount(account.accountId)).toBe(2);
    expect(await runMeteredModelCall({ ...request, store: restarted, state: resumed.value.state, call })).toMatchObject({ ok: true, value: { replayed: true } });
    expect(call).toHaveBeenCalledTimes(1);
  });
  it("invalid recovered answer refuses without provider/debit/finish", async () => {
    const { request, store } = fixture();
    const call = vi.fn(() => "new answer");
    const finish = vi.fn();
    const badStore = createCreditStore({ ...store, hostedCalls: { reserve: () => ({ status: "response-ready", response: new Map([["answer", "original"]]) }), saveResponse: vi.fn(), release: vi.fn(), finish } });
    expect(await runMeteredModelCall({ ...request, store: badStore, call })).toMatchObject({ ok: false, reason: BILLING_REFUSE_REASONS.storeFailed });
    expect(call).not.toHaveBeenCalled();
    expect(finish).not.toHaveBeenCalled();
    expect(store.entryCount(account.accountId)).toBe(1);
  });
});
describe("hostile capability diagnostics", () => {
  const cases: ReadonlyArray<readonly [string, () => unknown]> = [
    ["throwing toString", () => ({ toString() { throw new Error("HOSTILE STRINGIFICATION"); } })],
    ["throwing primitive", () => ({ [Symbol.toPrimitive]() { throw new Error("HOSTILE PRIMITIVE"); } })],
    ["accessor", () => Object.defineProperty({}, "toString", { get() { throw new Error("HOSTILE GETTER"); } })],
    ["proxy", () => new Proxy({}, { get() { throw new Error("HOSTILE PROXY"); } })],
    ["revoked proxy", () => { const { proxy, revoke } = Proxy.revocable({}, {}); revoke(); return proxy; }],
  ];
  it.each(cases)("%s returns named refusal with zero provider/store/conversion calls", async (_name, make) => {
    const call = vi.fn();
    const get = vi.fn(() => { throw new Error("store reached"); });
    const store = new Proxy(fixture().store, { get });
    const result = await runMeteredModelCall({ route: "hosted", capability: make(), call, now, hostedAi: { enabled: true }, store });
    expect(result).toMatchObject({ ok: false, reason: BILLING_REFUSE_REASONS.capabilityUnknown });
    expect(call).not.toHaveBeenCalled();
    expect(get).not.toHaveBeenCalled();
  });
  it("String objects and symbols are not accepted or converted", async () => {
    const conversion = vi.fn(() => "hosted-ai-assistant");
    const boxed = Object.assign(new String("hosted-ai-assistant"), { toString: conversion });
    const call = vi.fn();
    for (const capability of [boxed, Symbol("hosted-ai-assistant")]) expect(await runMeteredModelCall({ route: "hosted", capability, call, now, hostedAi: { enabled: true } })).toMatchObject({ ok: false, reason: BILLING_REFUSE_REASONS.capabilityUnknown });
    expect(conversion).not.toHaveBeenCalled();
    expect(call).not.toHaveBeenCalled();
  });
  it("request capability accessors and throwing request proxies refuse without reading getter/provider/store", async () => {
    const { request } = fixture();
    const call = vi.fn();
    const getter = vi.fn(() => { throw new Error("getter reached"); });
    const candidate = Object.defineProperty({ ...request, call }, "capability", { enumerable: true, get: getter });
    expect(await runMeteredModelCall(candidate)).toMatchObject({ ok: false, reason: BILLING_REFUSE_REASONS.requestInvalid });
    const proxy = new Proxy({ ...request, call }, { ownKeys() { throw new Error("request proxy"); } });
    expect(await runMeteredModelCall(proxy)).toMatchObject({ ok: false, reason: BILLING_REFUSE_REASONS.requestInvalid });
    expect(getter).not.toHaveBeenCalled();
    expect(call).not.toHaveBeenCalled();
  });
  it("does not even inspect a conversion hook on an invalid capability", async () => {
    const hook = vi.fn(() => "metered-model-port");
    const getter = vi.fn(() => hook);
    const capability = Object.defineProperty({}, Symbol.toPrimitive, { get: getter });
    expect(await runMeteredModelCall({ route: "byo", capability, call: vi.fn(), now })).toMatchObject({ ok: false, reason: BILLING_REFUSE_REASONS.capabilityUnknown });
    expect(getter).not.toHaveBeenCalled();
    expect(hook).not.toHaveBeenCalled();
  });
});

describe("bounded owned response snapshot", () => {
  it("bounds UTF8 wire bytes before hooks and admits the exact inclusive limit", () => {
    expect(snapshotHostedResponse("a".repeat(HOSTED_RESPONSE_MAX_BYTES - 2))?.json.length).toBe(HOSTED_RESPONSE_MAX_BYTES);
    expect(snapshotHostedResponse("a".repeat(HOSTED_RESPONSE_MAX_BYTES - 1))).toBeUndefined();
    expect(snapshotHostedResponse("😀".repeat(HOSTED_RESPONSE_MAX_BYTES / 4))).toBeUndefined();
    expect(snapshotHostedResponse("\\".repeat(HOSTED_RESPONSE_MAX_BYTES / 2))).toBeUndefined();
  });
  it("rejects depth/value limits, cycles, hidden/symbol properties and jsonb-invalid Unicode", () => {
    let deep: unknown = null;
    for (let i = 0; i < 66; i++) deep = [deep];
    const cycle: { self?: object } = {}; cycle.self = cycle;
    for (const answer of [deep, new Array(32769).fill(null), cycle, { [Symbol("hidden")]: "lost" }, Object.defineProperty({}, "hidden", { value: "lost" }), "\0", "\uD800", "\uDC00"]) expect(snapshotHostedResponse(answer)).toBeUndefined();
  });
  it("takes an owned frozen descriptor snapshot, preserves dangerous keys and cannot be changed by the producer", () => {
    const answer = JSON.parse('{"__proto__":{"answer":"original"},"toJSON":"ordinary data","array":[{"value":1}]}');
    const snapshot = snapshotHostedResponse(answer);
    expect(snapshot).toBeDefined();
    if (snapshot === undefined) throw new Error("fixture refused");
    answer.array[0].value = 999;
    expect(JSON.parse(snapshot.json)).toEqual({ ["__proto__"]: { answer: "original" }, toJSON: "ordinary data", array: [{ value: 1 }] });
    expect(snapshot.value).toEqual(JSON.parse(snapshot.json));
    expect(Object.isFrozen(snapshot.value)).toBe(true);
  });
  it("fresh process decodes exact persisted JSON using current source and cleans its disposable file", () => {
    const directory = mkdtempSync(join(tmpdir(), "sceneaxi-response-proof-"));
    try {
      const answer = { answer: "paid answer", nested: [true, null, "é😀", 0.0001] };
      const snapshot = snapshotHostedResponse(answer);
      if (snapshot === undefined) throw new Error("fixture refused");
      const file = join(directory, "response.json");
      writeFileSync(file, snapshot.json);
      const source = readFileSync(new URL("../src/hosted-response.ts", import.meta.url), "utf8");
      const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
      const child = spawnSync(process.execPath, ["--input-type=module", "-e", `import { readFileSync } from "node:fs"; const {snapshotHostedResponse} = await import(${JSON.stringify("data:text/javascript;base64," + Buffer.from(compiled).toString("base64"))}); const result = snapshotHostedResponse(JSON.parse(readFileSync(process.argv[1], "utf8"))); if (!result) throw new Error("restore refused"); process.stdout.write(result.json);`, file], { encoding: "utf8", timeout: 10000 });
      expect(child.status, child.stderr).toBe(0);
      expect(JSON.parse(child.stdout)).toEqual(answer);
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });
});
