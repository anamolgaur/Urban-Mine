import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freshDb } from './helpers.ts';
import { offersFor, rejectBid, acceptBid } from '../src/market.ts';

async function fresh() { const db = await freshDb(); return db; }
const lotId = async (db: any) => (await db.prepare("SELECT id FROM lot WHERE user_id = 'u-worker-1' AND status = 'listed'").get()).id as string;

test('a worker can reject an offer; it disappears and cannot be accepted', async () => {
  const db = await fresh();
  const id = await lotId(db);
  const [top, other] = await offersFor(db, id);
  await rejectBid(db, top.id, 'u-worker-1');
  assert.deepEqual((await offersFor(db, id)).map((o) => o.id), [other.id]);
  await assert.rejects(() => acceptBid(db, top.id, 'u-worker-1'), /rejected/);
  await assert.rejects(() => rejectBid(db, top.id, 'u-worker-1'), /rejected/);
});

test("a worker cannot reject offers on someone else's lot", async () => {
  const db = await fresh();
  const [top] = await offersFor(db, await lotId(db));
  await assert.rejects(() => rejectBid(db, top.id, 'u-worker-2'), /not found/);
});
