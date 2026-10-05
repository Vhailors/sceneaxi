/** Real source-component SSR assertions; not a claim of injected production failures. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const require = createRequire(join(root, 'sites/catalog-game/package.json'));
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const ts = createRequire(join(root, 'package.json'))('typescript');

function renderSource(path, props = {}) {
  const source = readFileSync(join(root, path), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  new Function('exports', 'React', output)(exports, React);
  return renderToStaticMarkup(React.createElement(exports.default, props));
}

test('mirrored real catalog loading components announce busy without fictional listings or commerce', () => {
  const game = 'sites/catalog-game/src/app/loading.tsx';
  const web = 'sites/catalog-web/src/app/loading.tsx';
  assert.equal(readFileSync(join(root, game), 'utf8'), readFileSync(join(root, web), 'utf8'));
  for (const path of [game, web]) {
    const html = renderSource(path);
    assert.match(html, /role="status"/); assert.match(html, /aria-live="polite"/); assert.match(html, /aria-busy="true"/);
    assert.match(html, /<h1>Loading catalogue<\/h1>/); assert.match(html, /No purchase is being made/);
    assert.doesNotMatch(html, /<input|<form|<button|https?:|\b(?:balance|credits|price|purchased)\b/i);
  }
});

test('actual branded catalog error components redact hostile message and stack and expose only reference', () => {
  for (const site of ['catalog-game', 'catalog-web']) {
    const error = Object.assign(new Error('PRIVATE_DATABASE_CONNECTION_STRING'), { digest: 'public-reference' });
    const html = renderSource(`sites/${site}/src/app/error.tsx`, { error });
    assert.match(html, /This page could not be rendered/); assert.match(html, /public-reference/); assert.match(html, /href="\/"/);
    assert.doesNotMatch(html, /PRIVATE_DATABASE_CONNECTION_STRING|Error:|at renderSource/);
    const withoutReference = renderSource(`sites/${site}/src/app/error.tsx`, { error: new Error('PRIVATE_MESSAGE') });
    assert.doesNotMatch(withoutReference, /Reference|PRIVATE_MESSAGE/);
  }
});


test('real editor/docs/Kids fallback components remain local, named and busy', () => {
  for (const path of ['sites/umbrella/src/app/editor/loading.tsx', 'sites/umbrella/src/app/docs/loading.tsx', 'sites/kids/src/app/loading.tsx']) {
    const html = renderSource(path);
    assert.match(html, /role="status"/); assert.match(html, /aria-busy="true"/); assert.match(html, /<h1>[^<]+<\/h1>/);
    assert.doesNotMatch(html, /<input|<form|<button|https?:|<canvas/);
  }
  const editor = renderSource('sites/umbrella/src/app/editor/loading.tsx');
  assert.match(editor, /only after its access decision succeeds/);
  const kids = readFileSync(join(root, 'sites/kids/src/app/loading.tsx'), 'utf8');
  assert.doesNotMatch(kids, /import|process|fetch|XMLHttpRequest|WebSocket|EventSource|account|billing|catalog|provider|session|environment/);
});


test('real root-layout error fallbacks provide a complete named document and never echo errors', () => {
  for (const site of ['catalog-game', 'catalog-web', 'kids']) {
    const html = renderSource('sites/' + site + '/src/app/global-error.tsx', { error: new Error('PRIVATE_LAYOUT_EXCEPTION') });
    assert.match(html, /<html lang="en">/); assert.match(html, /<body>/); assert.match(html, /role="alert"/); assert.match(html, /<h1>/);
    assert.doesNotMatch(html, /PRIVATE_LAYOUT_EXCEPTION|https?:|<button|<form|<input/);
    if (site === 'kids') assert.doesNotMatch(html, /<a\b|catalog|purchase|provider|account|credit|billing/i);
  }
});
