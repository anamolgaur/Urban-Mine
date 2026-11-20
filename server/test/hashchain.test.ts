import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../src/db.ts';
import { seed } from '../src/seed.ts';
import { canonicalJson, computeHash, GENESIS } from '../src/hashchain.ts';
import { createLot, verifyWorker, listLots } from '../src/lots.ts';

const base = { user_id: 'u-worker-1', items: [{ model_id: 'ph-arka-a1' }], weight_kg: 0.19, steps_done: 3, steps_total: 3, photo_hashes: ['p1'], gps: { lat: 28.66, lng: 77.26 } };
function freshDb() {
  const db = openDb(':memory:');
  seed(db);
  for (let i = 0; i < 3; i++) createLot(db, { ...base, weight_kg: 0.19 + i, created_at: `2026-11-2${i}T10:00:00Z` });
  return db;
}

test('canonical JSON ignores key order', () => {
  assert.equal(canonicalJson({ b: 1, a: { d: 2, c: 3 } }), canonicalJson({ a: { c: 3, d: 2 }, b: 1 }));
});

test('hash is deterministic and depends on prev_hash', () => {
  const rec = { ...base, created_at: 't' };
  assert.equal(computeHash(GENESIS, rec), computeHash(GENESIS, rec));
  assert.notEqual(computeHash(GENESIS, rec), computeHash('a'.repeat(64), rec));
});

test('first lot links to genesis, later lots link to the previous hash', () => {
  const lots = listLots(freshDb(), 'u-worker-1');
  assert.equal(lots[0].prev_hash, GENESIS);
  assert.equal(lots[1].prev_hash, lots[0].hash);
  assert.equal(lots[2].prev_hash, lots[1].hash);
});

test('intact chain verifies', () => assert.equal(verifyWorker(freshDb(), 'u-worker-1'), -1));

test('editing any stored lot breaks verification at that lot', () => {
  const db = freshDb();
  const id = listLots(db, 'u-worker-1')[1].id;
  db.prepare('UPDATE lot SET weight_kg = 99 WHERE id = ?').run(id);
  assert.equal(verifyWorker(db, 'u-worker-1'), 1);
});

test('deleting a middle lot breaks the chain', () => {
  const db = freshDb();
  db.prepare('DELETE FROM lot WHERE id = ?').run(listLots(db, 'u-worker-1')[1].id);
  assert.equal(verifyWorker(db, 'u-worker-1'), 1);
});

test('status changes do not break the chain', () => {
  const db = freshDb();
  db.prepare("UPDATE lot SET status = 'sold'").run();
  assert.equal(verifyWorker(db, 'u-worker-1'), -1);
});

test('chains are per worker', () => {
  const db = freshDb();
  createLot(db, { ...base, user_id: 'u-worker-2' });
  assert.equal(listLots(db, 'u-worker-2')[0].prev_hash, GENESIS);
});