import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../src/db.ts';
import { seed } from '../src/seed.ts';
import { seedDemo } from '../src/demo.ts';
import { offersFor, rejectBid, acceptBid } from '../src/market.ts';

function fresh() { const db = openDb(':memory:'); seed(db); seedDemo(db); return db; }
const lotId = (db: any) => db.prepare("SELECT id FROM lot WHERE user_id = 'u-worker-1' AND status = 'listed'").get().id as string;

test('a worker can reject an offer; it disappears and cannot be accepted', () => {
  const db = fresh();
  const id = lotId(db);
  const [top, other] = offersFor(db, id);
  rejectBid(db, top.id, 'u-worker-1');
  assert.deepEqual(offersFor(db, id).map((o) => o.id), [other.id]);
  assert.throws(() => acceptBid(db, top.id, 'u-worker-1'), /rejected/);
  assert.throws(() => rejectBid(db, top.id, 'u-worker-1'), /rejected/);
});

test("a worker cannot reject offers on someone else's lot", () => {
  const db = fresh();
  const [top] = offersFor(db, lotId(db));
  assert.throws(() => rejectBid(db, top.id, 'u-worker-2'), /not found/);
});
