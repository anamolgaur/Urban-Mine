import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ownDb } from './helpers.ts';
import { weightFlag, safetyFlag, gpsFlag, haversineKm, expectedWeightKg } from '../src/fraud.ts';
import { chainStatus } from '../src/views.ts';

const db = await ownDb({ demo: true });
const kinds = async (userId: string) => {
  const rows = await db.prepare('SELECT DISTINCT f.kind FROM flag f JOIN lot l ON l.id = f.lot_id WHERE l.user_id = ?').all(userId) as { kind: string }[];
  return rows.map((r) => r.kind).sort();
};

test('weight rule: flags far above or far below expected, ignores unknown', async () => {
  assert.equal(weightFlag(2, 2.4), null);
  assert.equal(weightFlag(2, 5)?.kind, 'weight_outlier');
  assert.equal(weightFlag(2, 0.5)?.kind, 'weight_outlier');
  assert.equal(weightFlag(null, 50), null);
});

test('safety rule: flags under 70% completion, skips lots with no steps', async () => {
  assert.equal(safetyFlag(3, 3), null);
  assert.equal(safetyFlag(2, 4)?.kind, 'low_safety');
  assert.equal(safetyFlag(0, 0), null);
});

test('gps rule uses distance from the registered workshop', async () => {
  const delhi = { lat: 28.6692, lng: 77.2655 };
  assert.ok(Math.abs(haversineKm(delhi, { lat: 22.5535, lng: 88.3913 }) - 1300) < 60);
  assert.equal(gpsFlag({ lat: 28.67, lng: 77.27 }, delhi), null);
  assert.equal(gpsFlag({ lat: 22.55, lng: 88.39 }, delhi)?.kind, 'gps_far');
  assert.equal(gpsFlag(null, delhi), null);
});

test('expected weight sums models, falls back to type average', async () => {
  assert.equal(await expectedWeightKg(db, [{ model_id: 'ph-arka-a1', type: 'phone', qty: 3 }]), 0.19 * 3);
  assert.ok((await expectedWeightKg(db, [{ type: 'phone' }]) ?? 0) > 0.15);
  assert.equal(await expectedWeightKg(db, [{ type: 'spaceship' }]), null);
});

test('demo data: the clean worker has no flags, the other worker trips every rule', async () => {
  assert.deepEqual(await kinds('u-worker-1'), []);
  assert.deepEqual(await kinds('u-worker-2'), ['duplicate_photo', 'gps_far', 'low_safety', 'rapid_repeat', 'weight_outlier']);
});

test('a duplicate photo across two lots is flagged on the later lot and names the other', async () => {
  const f = await db.prepare("SELECT detail FROM flag WHERE kind = 'duplicate_photo'").get() as { detail: string };
  assert.match(f.detail, /also appears in lot/);
});

test('chain status marks an edited lot as not ok', async () => {
  const lot = await db.prepare("SELECT id FROM lot WHERE user_id = 'u-worker-1' ORDER BY seq LIMIT 1").get() as { id: string };
  assert.equal((await chainStatus(db, 'u-worker-1')).get(lot.id), true);
  await db.prepare('UPDATE lot SET weight_kg = 50 WHERE id = ?').run(lot.id);
  assert.equal((await chainStatus(db, 'u-worker-1')).get(lot.id), false);
});
