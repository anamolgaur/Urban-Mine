import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDb } from '../src/db.ts';
import { seed } from '../src/seed.ts';
import { seedDemo } from '../src/demo.ts';
import { buildApp } from '../src/app.ts';

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==';

async function setup() {
  const db = openDb(':memory:');
  seed(db);
  seedDemo(db);
  const app = await buildApp(db, { uploadsDir: mkdtempSync(join(tmpdir(), 'um-')), ocr: { read: async () => '' } });
  const as = (id: string) => ({ 'x-user-id': id });
  return { db, app, as };
}

test('auth: no user is 401, wrong role is 403', async () => {
  const { app, as } = await setup();
  assert.equal((await app.inject({ url: '/api/lots' })).statusCode, 401);
  assert.equal((await app.inject({ url: '/api/lots', headers: as('u-recycler-1') })).statusCode, 403);
  assert.equal((await app.inject({ method: 'PUT', url: '/api/auditor/rates', headers: as('u-worker-1'), payload: {} })).statusCode, 403);
  await app.close();
});

test('full worker journey: scan, lot, list, offer, accept, receipt', async () => {
  const { app, as } = await setup();
  const w = as('u-worker-1');

  const scan = (await app.inject({ method: 'POST', url: '/api/scan', headers: w, payload: { images: [PNG, PNG], hint: 'phone', ocrText: 'ARKA A1' } })).json();
  assert.equal(scan.type, 'phone');
  assert.equal(scan.match.kind, 'model');
  assert.equal(scan.match.best.model.id, 'ph-arka-a1');
  assert.ok(scan.match.best.confidence < 1);

  const fb = await app.inject({ method: 'POST', url: `/api/scan/${scan.scanId}/feedback`, headers: w, payload: { field: 'model', predicted: 'ph-arka-a1', corrected: 'ph-arka-a3' } });
  assert.equal(fb.statusCode, 200);

  const est = (await app.inject({ url: '/api/estimate?city=Delhi&modelId=ph-arka-a1', headers: w })).json();
  assert.equal(est.sample, true);
  assert.ok(est.total > 0 && est.low < est.total && est.high > est.total);

  const lot = (await app.inject({ method: 'POST', url: '/api/lots', headers: w, payload: {
    items: [{ model_id: 'ph-arka-a1', type: 'phone', qty: 1 }], weight_kg: 0.2, steps_done: 3, steps_total: 3, photo_hashes: scan.photoHashes, gps: { lat: 28.6693, lng: 77.2652 } } })).json();
  assert.equal(lot.status, 'open');
  assert.equal(lot.chain_ok, true);
  assert.equal(lot.flags.length, 0);

  assert.equal((await app.inject({ method: 'POST', url: `/api/lots/${lot.id}/list`, headers: w })).statusCode, 200);
  const bid = (await app.inject({ method: 'POST', url: `/api/lots/${lot.id}/bids`, headers: as('u-recycler-1'), payload: { amount: 120, pickup_terms: 'SAMPLE', minutes: 30 } })).json();
  assert.ok(bid.id);

  const offers = (await app.inject({ url: `/api/lots/${lot.id}/offers`, headers: w })).json();
  assert.equal(offers.length, 1);
  const acc = (await app.inject({ method: 'POST', url: `/api/bids/${offers[0].id}/accept`, headers: w })).json();
  assert.match(acc.payout.method, /SIMULATED/);

  const pdf = await app.inject({ url: `/api/lots/${lot.id}/receipt.pdf`, headers: w });
  assert.equal(pdf.statusCode, 200);
  assert.equal(pdf.headers['content-type'], 'application/pdf');
  assert.equal(pdf.rawPayload.subarray(0, 4).toString(), '%PDF');
  await app.close();
});

test('creating a lot validates input', async () => {
  const { app, as } = await setup();
  const post = (payload: any) => app.inject({ method: 'POST', url: '/api/lots', headers: as('u-worker-1'), payload });
  const ok = { items: [{ type: 'phone' }], weight_kg: 1, steps_done: 1, steps_total: 2, photo_hashes: [] };
  assert.equal((await post({ ...ok, items: [] })).statusCode, 400);
  assert.equal((await post({ ...ok, weight_kg: -1 })).statusCode, 400);
  assert.equal((await post({ ...ok, steps_done: 5 })).statusCode, 400);
  assert.equal((await post({ ...ok, photo_hashes: ['nothash'] })).statusCode, 400);
  assert.equal((await post(ok)).statusCode, 200);
  await app.close();
});

test('auditor: overview shows flags, hold blocks accept, rate edit works', async () => {
  const { app, as } = await setup();
  const a = as('u-auditor-1');
  const ov = (await app.inject({ url: '/api/auditor/overview', headers: a })).json();
  assert.ok(ov.kpis.flagged >= 3);
  const dup = ov.lots.find((l: any) => l.flags.some((f: any) => f.kind === 'duplicate_photo'));
  assert.ok(dup);

  const detail = (await app.inject({ url: `/api/auditor/lots/${dup.id}`, headers: a })).json();
  assert.ok(detail.related.length >= 1);

  assert.equal((await app.inject({ method: 'POST', url: `/api/auditor/lots/${dup.id}/hold`, headers: a })).statusCode, 200);
  const offers = (await app.inject({ url: `/api/lots/${dup.id}/offers`, headers: as(dup.user_id) })).json();
  const blocked = await app.inject({ method: 'POST', url: `/api/bids/${offers[0].id}/accept`, headers: as(dup.user_id) });
  assert.equal(blocked.statusCode, 400);
  assert.match(blocked.json().error, /hold/);

  assert.equal((await app.inject({ method: 'PUT', url: '/api/auditor/rates', headers: a, payload: { material: 'copper', city: 'Delhi', rate_per_kg: 700 } })).statusCode, 200);
  assert.equal((await app.inject({ url: '/api/rates?city=Delhi' })).json().copper.rate, 700);
  await app.close();
});

test('safety editor bumps the version and a named reviewer clears the draft flag', async () => {
  const { app, as } = await setup();
  const a = as('u-auditor-1');
  const r = (await app.inject({ method: 'PUT', url: '/api/safety/phone/en', headers: a, payload: { steps: [{ id: 'ph-1', instruction: 'Switch off the phone.' }], reviewed_by: 'SAMPLE Reviewer' } })).json();
  assert.equal(r.steps[0].instruction, 'Switch off the phone.');
  assert.equal(r.version, 'draft-0.2');
  assert.equal(r.draft, false);
  await app.close();
});

test('delete my data removes lots and anonymises the account', async () => {
  const { app, db, as } = await setup();
  assert.equal((await app.inject({ method: 'DELETE', url: '/api/me/data', headers: as('u-worker-2') })).statusCode, 200);
  assert.equal((db.prepare("SELECT COUNT(*) c FROM lot WHERE user_id = 'u-worker-2'").get() as any).c, 0);
  assert.equal((db.prepare("SELECT name FROM user WHERE id = 'u-worker-2'").get() as any).name, 'Deleted user');
  await app.close();
});

test('repair listing flow for a repairer', async () => {
  const { app, as } = await setup();
  const r = as('u-repairer-1');
  assert.equal((await app.inject({ method: 'POST', url: '/api/repair/listings', headers: r, payload: { skills: [], area: '', start_price: 0, hours: '' } })).statusCode, 400);
  assert.equal((await app.inject({ method: 'POST', url: '/api/repair/listings', headers: r, payload: { skills: ['laptop'], area: 'SAMPLE', start_price: 200, hours: '9-5' } })).statusCode, 200);
  const job = (await app.inject({ method: 'POST', url: '/api/repair/jobs', headers: r, payload: { before_photo: 'b' } })).json();
  assert.equal((await app.inject({ method: 'POST', url: `/api/repair/jobs/${job.id}/complete`, headers: r, payload: { after_photo: 'a' } })).statusCode, 200);
  const list = (await app.inject({ url: '/api/repair/listings' })).json();
  assert.equal(list[0].verified_count, 3);
  await app.close();
});
