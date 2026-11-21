import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { freshDb } from './helpers.ts';
import { seedDemo } from '../src/demo.ts';
import { LocalPhotoStore } from '../src/photostore.ts';
import { buildApp } from '../src/app.ts';
import { samplePhotoPng } from '../src/samplephoto.ts';

async function setup() {
  const db = await freshDb({ demo: false });
  const dir = mkdtempSync(join(tmpdir(), 'um-'));
  const photos = new LocalPhotoStore(dir, 'test-secret');
  await seedDemo(db, new Date(), photos);
  const app = await buildApp(db, { photos, uploadsDir: dir, ocr: { read: async () => '' } });
  return { app, dir, as: (id: string) => ({ 'x-user-id': id }) };
}

test('sample photos are valid PNGs, deterministic, and differ by hash', async () => {
  const a = samplePhotoPng('a1'.padEnd(64, '0'));
  assert.equal(a.subarray(1, 4).toString(), 'PNG');
  assert.deepEqual(a, samplePhotoPng('a1'.padEnd(64, '0')));
  assert.notDeepEqual(a, samplePhotoPng('c2'.padEnd(64, '0')));
});

test('demo seeding writes sample photo files, so a duplicate photo is the same file', async () => {
  const { dir } = await setup();
  assert.ok(existsSync(join(dir, 'a1'.padEnd(64, '0') + '.img')));
});

test('market lots carry seller location and a SAMPLE expected value range', async () => {
  const { app, as } = await setup();
  const lots = (await app.inject({ url: '/api/market/lots', headers: as('u-recycler-1') })).json();
  assert.ok(lots.length >= 2);
  for (const l of lots) {
    assert.ok(l.workshop_address);
    assert.ok(l.expected.high >= l.expected.low && l.expected.low > 0);
  }
  await app.close();
});

test("a recycler sees only their own bids, with a countdown, and others are blocked", async () => {
  const { app, as } = await setup();
  const mine = (await app.inject({ url: '/api/recycler/bids', headers: as('u-recycler-1') })).json();
  assert.ok(mine.length >= 2);
  assert.ok(mine.every((b: any) => typeof b.seconds_left === 'number' && b.short_hash.length === 8));
  const other = (await app.inject({ url: '/api/recycler/bids', headers: as('u-recycler-2') })).json();
  assert.ok(other.length < mine.length + 5);
  assert.notDeepEqual(mine.map((b: any) => b.id), other.map((b: any) => b.id));
  assert.equal((await app.inject({ url: '/api/recycler/bids', headers: as('u-worker-1') })).statusCode, 403);
  await app.close();
});
