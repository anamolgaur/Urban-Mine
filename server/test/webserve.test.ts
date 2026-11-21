import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { freshDb } from './helpers.ts';
import { buildApp } from '../src/app.ts';

async function setup(withWeb: boolean) {
  const db = await freshDb({ demo: false });
  const webDir = mkdtempSync(join(tmpdir(), 'um-web-'));
  if (withWeb) {
    mkdirSync(join(webDir, 'assets'));
    writeFileSync(join(webDir, 'index.html'), '<!doctype html><title>Urban Mine</title><div id="root"></div>');
    writeFileSync(join(webDir, 'assets', 'app-abc123.js'), 'console.log(1)');
    writeFileSync(join(webDir, 'sw.js'), '// service worker');
  }
  return buildApp(db, { webDir, ocr: { read: async () => '' } });
}
const page = { accept: 'text/html,application/xhtml+xml' };

test('when the web app is built, the same server serves it, with page addresses falling back to the app', async () => {
  const app = await setup(true);
  const root = await app.inject({ url: '/', headers: page });
  assert.equal(root.statusCode, 200);
  assert.match(root.body, /<div id="root">/);
  // a client-side address such as /lots or /auditor/recyclers still opens the app
  for (const url of ['/lots', '/auditor/recyclers', '/offers/abc']) {
    const r = await app.inject({ url, headers: page });
    assert.equal(r.statusCode, 200, url);
    assert.match(r.body, /<div id="root">/);
  }
  // the API is untouched
  assert.deepEqual((await app.inject({ url: '/api/health' })).json(), { ok: true });
  assert.equal((await app.inject({ url: '/api/lots' })).statusCode, 401);
});

test('an unknown API address is a JSON 404, never the app page', async () => {
  const app = await setup(true);
  const r = await app.inject({ url: '/api/nope', headers: page });
  assert.equal(r.statusCode, 404);
  assert.equal(r.json().error, 'Not found');
  const asset = await app.inject({ url: '/assets/missing.js' });
  assert.equal(asset.statusCode, 404, 'a missing file is a 404, not the app page');
  assert.equal((await app.inject({ method: 'POST', url: '/lots', headers: page })).statusCode, 404);
});

test('hashed assets are cached for good; the page shell and service worker are always re-checked', async () => {
  const app = await setup(true);
  assert.match(String((await app.inject({ url: '/assets/app-abc123.js' })).headers['cache-control']), /immutable/);
  assert.equal((await app.inject({ url: '/sw.js' })).headers['cache-control'], 'no-cache');
  assert.equal((await app.inject({ url: '/', headers: page })).headers['cache-control'], 'no-cache');
});

test('without a built web app the server is just the API, as before', async () => {
  const app = await setup(false);
  assert.equal((await app.inject({ url: '/' })).json().name, 'Urban Mine API');
  assert.equal((await app.inject({ url: '/lots', headers: page })).statusCode, 404);
  assert.deepEqual((await app.inject({ url: '/api/health' })).json(), { ok: true });
});
