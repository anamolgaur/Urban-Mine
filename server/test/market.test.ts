import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../src/db.ts';
import { seed } from '../src/seed.ts';
import { seedDemo } from '../src/demo.ts';
import { offersFor, acceptBid, placeBid, holdLot, releaseLot, listLot } from '../src/market.ts';
import { receiptData, renderReceiptPdf } from '../src/receipt.ts';
import { repairComparison, completeJob, createJob } from '../src/repair.ts';

function fresh() { const db = openDb(':memory:'); seed(db); seedDemo(db); return db; }
const listedLot = (db: any, user: string) => db.prepare("SELECT id FROM lot WHERE user_id = ? AND status = 'listed' ORDER BY rowid").get(user).id as string;

test('offers come highest first with a countdown; expired offers vanish', () => {
  const db = fresh();
  const id = listedLot(db, 'u-worker-1');
  const offers = offersFor(db, id);
  assert.deepEqual(offers.map((o) => o.amount), [195, 170]);
  assert.ok(offers[0].seconds_left > 0);
  assert.equal(offersFor(db, id, new Date(Date.now() + 3 * 3600 * 1000)).length, 0);
});

test('accepting a bid sells the lot and rejects the others; second accept fails', () => {
  const db = fresh();
  const id = listedLot(db, 'u-worker-1');
  const [top, other] = offersFor(db, id);
  acceptBid(db, top.id, 'u-worker-1');
  assert.equal((db.prepare('SELECT status FROM lot WHERE id = ?').get(id) as any).status, 'sold');
  assert.equal((db.prepare('SELECT status FROM bid WHERE id = ?').get(other.id) as any).status, 'rejected');
  assert.throws(() => acceptBid(db, top.id, 'u-worker-1'), /Lot is sold|Offer is/);
});

test("a worker cannot accept an offer on someone else's lot", () => {
  const db = fresh();
  const [top] = offersFor(db, listedLot(db, 'u-worker-1'));
  assert.throws(() => acceptBid(db, top.id, 'u-worker-2'), /Not your lot/);
});

test('held lots cannot be accepted until released', () => {
  const db = fresh();
  const id = listedLot(db, 'u-worker-1');
  const [top] = offersFor(db, id);
  holdLot(db, id);
  assert.throws(() => acceptBid(db, top.id, 'u-worker-1'), /hold/);
  releaseLot(db, id);
  assert.equal(acceptBid(db, top.id, 'u-worker-1').amount, 195);
});

test('only recyclers bid, only on listed lots, only positive amounts', () => {
  const db = fresh();
  const id = listedLot(db, 'u-worker-1');
  assert.throws(() => placeBid(db, { lotId: id, recyclerId: 'u-worker-2', amount: 100, pickupTerms: '' }), /recyclers/);
  assert.throws(() => placeBid(db, { lotId: id, recyclerId: 'u-recycler-1', amount: 0, pickupTerms: '' }), /positive/);
  const openLot = db.prepare("SELECT id FROM lot WHERE status = 'open'").get() as any;
  assert.throws(() => placeBid(db, { lotId: openLot.id, recyclerId: 'u-recycler-1', amount: 100, pickupTerms: '' }), /not open/);
  listLot(db, openLot.id, 'u-worker-1');
  assert.ok(placeBid(db, { lotId: openLot.id, recyclerId: 'u-recycler-1', amount: 100, pickupTerms: 'x' }).id);
});

test('receipt exists only after sale, carries the hash, and renders a PDF', async () => {
  const db = fresh();
  const id = listedLot(db, 'u-worker-1');
  assert.throws(() => receiptData(db, id), /sold/);
  acceptBid(db, offersFor(db, id)[0].id, 'u-worker-1');
  const d = receiptData(db, id);
  assert.equal(d.amount, 195);
  assert.equal(d.hash.length, 64);
  assert.match(d.seller.phone, /^x+\d{4}$/);
  const pdf = await renderReceiptPdf(d);
  assert.equal(pdf.subarray(0, 4).toString(), '%PDF');
});

test('repair vs recycle: repair only when it works and clearly beats recycling', () => {
  const db = fresh();
  assert.equal(repairComparison(db, 'Delhi', { type: 'phone', works: true })!.recommend, 'repair');
  assert.equal(repairComparison(db, 'Delhi', { type: 'phone', works: false })!.recommend, 'recycle');
  assert.equal(repairComparison(db, 'Delhi', { type: 'crt_monitor', works: true })!.recommend, 'recycle');
  assert.equal(repairComparison(db, 'Delhi', { type: 'toaster', works: true }), null);
});

test('repair count rises only with before and after photos, once per job', () => {
  const db = fresh();
  const count = () => (db.prepare("SELECT verified_count v FROM repairer_listing WHERE id = 'rl-1'").get() as any).v;
  assert.equal(count(), 2); // from demo data
  const job = createJob(db, 'rl-1', 'before-hash');
  assert.throws(() => completeJob(db, job, ''), /photos/);
  assert.equal(count(), 2);
  completeJob(db, job, 'after-hash');
  assert.equal(count(), 3);
  assert.throws(() => completeJob(db, job, 'after-hash'), /already/);
  assert.throws(() => createJob(db, 'rl-1', ''), /before photo/);
});
