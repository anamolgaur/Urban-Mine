import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { freshDb } from './helpers.ts';
import { buildApp } from '../src/app.ts';

const make = async (extra: Record<string, unknown> = {}) => {
  const db = await freshDb();
  const app = await buildApp(db, { demoLogin: true, uploadsDir: mkdtempSync(join(tmpdir(), 'um-')), ocr: { read: async () => '' }, ...extra });
  return { db, app };
};

test('buyers never receive the GPS point or full address of a lot, only the city', async () => {
  const { db, app } = await make();
  await db.prepare("UPDATE lot SET gps = ? WHERE status = 'listed'").run(JSON.stringify({ lat: 28.6692, lng: 77.2655 }));
  const lots = (await app.inject({ url: '/api/market/lots', headers: { 'x-user-id': 'u-recycler-1' } })).json() as Record<string, unknown>[];
  assert.ok(lots.length > 0);
  for (const l of lots) {
    assert.equal('gps' in l, false, 'no gps');
    assert.equal('user_id' in l, false, 'no worker id');
    assert.equal(l.gps_recorded, true);
    assert.ok(!String(l.workshop_address ?? '').includes(','), `city only, got ${l.workshop_address}`);
  }
  // the worker still sees their own GPS
  const mine = (await app.inject({ url: '/api/lots', headers: { 'x-user-id': 'u-worker-1' } })).json() as { gps: unknown; status: string }[];
  assert.ok(mine.some((l) => l.status === 'listed' && l.gps));
});

test('requests that change data are limited per visitor, using the real address behind the proxy', async () => {
  const { app } = await make({ writeLimit: 3 });
  const post = (ip: string) => app.inject({ method: 'POST', url: '/api/onboarding', headers: { 'cf-connecting-ip': ip }, payload: {} });
  for (let i = 0; i < 3; i++) assert.notEqual((await post('1.1.1.1')).statusCode, 429);
  const blocked = await post('1.1.1.1');
  assert.equal(blocked.statusCode, 429);
  assert.equal(blocked.json().code, 'too_many_writes');
  // a different visitor is not affected, and reading still works for the blocked one
  assert.notEqual((await post('2.2.2.2')).statusCode, 429);
  assert.equal((await app.inject({ url: '/api/health', headers: { 'cf-connecting-ip': '1.1.1.1' } })).statusCode, 200);
});
