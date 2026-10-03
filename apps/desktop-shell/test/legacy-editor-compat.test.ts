import { describe, expect, it } from 'vitest';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { frameScript } from '../src/chrome/frame/script.js';
import { script } from '../src/chrome/core/script.js';
import { createDesktopVisualState, desktopVisualView } from '../src/index.js';

function declarations(names: string[]): string {
  const source = script(desktopVisualView(createDesktopVisualState()));
  const ast = ts.createSourceFile('chrome.js', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const found = new Map<string, string>();

  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && names.includes(node.name.text)) {
      found.set(node.name.text, node.parent.parent.getText(ast));
    }

    ts.forEachChild(node, visit);
  };

  visit(ast);

  return names.map((name) => { const value = found.get(name);

 if (!value) throw new Error('Missing '+name);

 return value; }).join('\n');
}

describe('reconciled keyboard modifier matching', () => {
  // SAFETY: the owned generated function accepts only plain test bindings/events.
  const matches = runInNewContext(frameScript() + '\nkeyboardBindingMatches') as
    (binding: KeyboardFixtureBinding, event: KeyboardFixtureEvent) => boolean;

  const binding = { device: 'keyboard', code: 'F12', modifiers: ['alt', 'control', 'shift'] };
  it('admits explicit Ctrl/Alt/Shift F12, including key fallback', () => {
    expect(matches(binding, { code: 'F12', ctrlKey: true, altKey: true, shiftKey: true })).toBe(true);
    expect(matches(binding, { key: 'F12', ctrlKey: true, altKey: true, shiftKey: true })).toBe(true);
  });
  it('refuses missing modifiers, extra Meta, wrong key and unmodified bindings with Ctrl', () => {
    for (const key of ['ctrlKey', 'altKey', 'shiftKey']) {
      expect(matches(binding, { code: 'F12', ctrlKey: true, altKey: true, shiftKey: true, [key]: false })).toBe(false);
    }

    expect(matches(binding, { code: 'F12', ctrlKey: true, metaKey: true, altKey: true, shiftKey: true })).toBe(false);
    expect(matches(binding, { code: 'F11', ctrlKey: true, altKey: true, shiftKey: true })).toBe(false);
    expect(matches({ ...binding, modifiers: [] }, { code: 'F12', ctrlKey: true })).toBe(false);
  });
  it('preserves primary Ctrl/Cmd and single-letter fallback without undeclared Alt/Shift', () => {
    const primary = { device: 'keyboard', code: 'KeyS', modifiers: ['primary'] };
    expect(matches(primary, { key: 's', ctrlKey: true })).toBe(true);
    expect(matches(primary, { key: 's', metaKey: true })).toBe(true);
    expect(matches(primary, { key: 's' })).toBe(false);
    expect(matches(primary, { key: 's', ctrlKey: true, altKey: true })).toBe(false);
    expect(matches(primary, { key: 's', metaKey: true, shiftKey: true })).toBe(false);
  });
});

describe('generated chrome audio authority boundary (not native audio)', () => {
  function harness() {
    const events: Array<string | null> = [];
    let active = { root: '/owned/project' };
    const shell = { dataset: { profile: 'game' } };
    let reply: (value: ChromeAuthorityReply) => void = () => { throw new Error('No pending request'); };

    const request = () => { expect(events.at(-1)).toBeNull();

 return new Promise<ChromeAuthorityReply>((resolve) => { reply = resolve; }); };

    const context = {
      document: { dispatchEvent: (event: { detail: { profile: string | null } }) => events.push(event.detail.profile) },
      CustomEvent: class { constructor(readonly type: string, readonly init: { detail: { profile: string | null } }) {} get detail() { return this.init.detail; } },
      shell, desktopPort: () => ({ request }), projectPort: () => ({ project: request }),
      T: { product: { refusals: { runtimeRequestRefused: 'REQUEST_REFUSED', runtimeRequestFailed: 'REQUEST_FAILED' } } },
      getRoot: () => active,
    };

    // SAFETY: extracted owned declarations return exactly these functions; fake ports never allocate native audio.
    const functions = runInNewContext('let activeProject = getRoot();\n' + declarations([
      'desktopAudioGeneration', 'invalidateDesktopAudio', 'runtimeRequest', 'projectRequest',
    ]) + '\n({runtimeRequest, projectRequest, changeRoot: () => {activeProject = getRoot();}})', context) as {
      runtimeRequest: (input: ChromeAuthorityRequest) => Promise<ChromeAuthorityReply>;
      projectRequest: (input: ChromeAuthorityRequest) => Promise<ChromeAuthorityReply>;
      changeRoot: () => void;
    };

    return { ...functions, events, shell, resolver: () => reply, reply: (value: ChromeAuthorityReply) => reply(value), rebind: () => { active = { root: '/other/project' }; functions.changeRoot(); } };
  }

  for (const profile of ['game', 'web', 'kids']) it('confirms only approved current '+profile+' replies after synchronous denial', async () => {
    const h = harness(); const promise = h.runtimeRequest({ action: 'profile', payload: { profile } });
    expect(h.events).toEqual([null]); h.reply({ ok: true, data: { profile } }); await promise;
    expect(h.events).toEqual([null, profile]);
  });
  it('denies refused, mismatching and cancelled project requests without restoration', async () => {
    for (const response of [{ ok: false }, { ok: true, data: { profile: 'web' } }]) {
      const h = harness(); const pending = h.runtimeRequest({ action: 'profile', payload: { profile: 'game' } });
      h.reply(response); await pending; expect(h.events).toEqual([null]);
    }

    for (const action of ['choose-new', 'choose-open', 'open-recent']) {
      const h = harness(); const pending = h.projectRequest({ action });
      h.reply({ ok: true, data: { outcome: 'cancelled' } }); await pending; expect(h.events).toEqual([null]);
    }
  });
  it('rejects stale root, profile and generation approvals', async () => {
    for (const fence of ['root', 'profile', 'generation']) {
      const h = harness(); const pending = h.runtimeRequest({ action: 'profile', payload: { profile: 'game' } });
      const firstReply = h.resolver();

      if (fence === 'root') h.rebind();

      if (fence === 'profile') h.shell.dataset.profile = 'kids';

      if (fence === 'generation') {
        const newer = h.runtimeRequest({ action: 'open-path' });
        firstReply({ ok: true, data: { profile: 'game' } });
        h.reply({ ok: true }); await newer;
      } else h.reply({ ok: true, data: { profile: 'game' } });
      expect(await pending).toMatchObject({ ok: false, reason: 'REQUEST_REFUSED' });
      expect(h.events.every((profile) => profile === null)).toBe(true);
    }
  });
});

type KeyboardFixtureBinding = { device: string; code: string; modifiers: string[] };

type KeyboardFixtureEvent = { code?: string; key?: string; ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean; shiftKey?: boolean };

type ChromeAuthorityRequest = { action: string; payload?: { profile: string } };

type ChromeAuthorityReply = { ok: boolean; data?: { profile?: string; outcome?: string } };
