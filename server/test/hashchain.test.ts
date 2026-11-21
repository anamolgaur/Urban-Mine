import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freshDb } from './helpers.ts';
import { canonicalJson, computeHash, GENESIS } from '../src/hashchain.ts';
import { createLot, verifyWorker, listLots } from '../src/lots.ts';

const base = { user_id: 'u-worker-1', items: [{ model_id: 'ph-arka-a1' }], weight_kg: 0.19, steps_done: 3, steps_total: 3, photo_hashes: ['p1'], gps: { lat: 28.66, lng: 77.26 } };
async function chainDb() {
  const db = await freshDb({ demo: false });
  for (let i = 0; i < 3; i++) await createLot(db, { ...base, weight_kg: 0.19 + i, created_at: `2026-11-2${i}T10:00:00Z` });
  return db;
}

test('canonical JSON ignores key order', async () => {
  assert.equal(canonicalJson({ b: 1, a: { d: 2, c: 3 } }), canonicalJson({ a: { c: 3, d: 2 }, b: 1 }));
});

test('hash is deterministic and depends on prev_hash', async () => {
  const rec = { ...base, created_at: 't' };
  assert.equal(computeHash(GENESIS, rec), computeHash(GENESIS, rec));
  assert.notEqual(computeHash(GENESIS, rec), computeHash('a'.repeat(64), rec));
});

test('first lot links to genesis, later lots link to the previous hash', async () => {
  const lots = await listLots(await chainDb(), 'u-worker-1');
  assert.equal(lots[0].prev_hash, GENESIS);
  assert.equal(lots[1].prev_hash, lots[0].hash);
  assert.equal(lots[2].prev_hash, lots[1].hash);
});

test('intact chain verifies', async () => assert.equal(await verifyWorker(await chainDb(), 'u-worker-1'), -1));

test('editing any stored lot breaks verification at that lot', async () => {
  const db = await chainDb();
  const id = (await listLots(db, 'u-worker-1'))[1].id;
  await db.prepare('UPDATE lot SET weight_kg = 99 WHERE id = ?').run(id);
  assert.equal(await verifyWorker(db, 'u-worker-1'), 1);
});

test('deleting a middle lot breaks the chain', async () => {
  const db = await chainDb();
  await db.prepare('DELETE FROM lot WHERE id = ?').run((await listLots(db, 'u-worker-1'))[1].id);
  assert.equal(await verifyWorker(db, 'u-worker-1'), 1);
});

test('status changes do not break the chain', async () => {
  const db = await chainDb();
  await db.prepare("UPDATE lot SET status = 'sold'").run();
  assert.equal(await verifyWorker(db, 'u-worker-1'), -1);
});

test('chains are per worker', async () => {
  const db = await chainDb();
  await createLot(db, { ...base, user_id: 'u-worker-2' });
  assert.equal((await listLots(db, 'u-worker-2'))[0].prev_hash, GENESIS);
});