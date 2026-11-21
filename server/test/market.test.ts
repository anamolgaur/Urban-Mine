import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freshDb } from './helpers.ts';
import { offersFor, acceptBid, placeBid, holdLot, releaseLot, listLot } from '../src/market.ts';
import { receiptData, renderReceiptPdf } from '../src/receipt.ts';
import { repairComparison, completeJob, createJob } from '../src/repair.ts';

async function fresh() { const db = await freshDb(); return db; }
const listedLot = async (db: any, user: string) => (await db.prepare("SELECT id FROM lot WHERE user_id = ? AND status = 'listed' ORDER BY seq").get(user)).id as string;

test('offers come highest first with a countdown; expired offers vanish', async () => {
  const db = await fresh();
  const id = await listedLot(db, 'u-worker-1');
  const offers = await offersFor(db, id);
  assert.deepEqual(offers.map((o) => o.amount), [195, 170]);
  assert.ok(offers[0].seconds_left > 0);
  assert.equal((await offersFor(db, id, new Date(Date.now() + 3 * 3600 * 1000))).length, 0);
});

test('accepting a bid sells the lot and rejects the others; second accept fails', async () => {
  const db = await fresh();
  const id = await listedLot(db, 'u-worker-1');
  const [top, other] = await offersFor(db, id);
  await acceptBid(db, top.id, 'u-worker-1');
  assert.equal((await db.prepare('SELECT status FROM lot WHERE id = ?').get(id) as any).status, 'sold');
  assert.equal((await db.prepare('SELECT status FROM bid WHERE id = ?').get(other.id) as any).status, 'rejected');
  await assert.rejects(() => acceptBid(db, top.id, 'u-worker-1'), /Lot is sold|Offer is/);
});

test("a worker cannot accept an offer on someone else's lot", async () => {
  const db = await fresh();
  const [top] = await offersFor(db, await listedLot(db, 'u-worker-1'));
  await assert.rejects(() => acceptBid(db, top.id, 'u-worker-2'), /Not your lot/);
});

test('held lots cannot be accepted until released', async () => {
  const db = await fresh();
  const id = await listedLot(db, 'u-worker-1');
  const [top] = await offersFor(db, id);
  await holdLot(db, id);
  await assert.rejects(() => acceptBid(db, top.id, 'u-worker-1'), /hold/);
  await releaseLot(db, id);
  assert.equal((await acceptBid(db, top.id, 'u-worker-1')).amount, 195);
});

test('only recyclers bid, only on listed lots, only positive amounts', async () => {
  const db = await fresh();
  const id = await listedLot(db, 'u-worker-1');
  await assert.rejects(() => placeBid(db, { lotId: id, recyclerId: 'u-worker-2', amount: 100, pickupTerms: '' }), /recyclers/);
  await assert.rejects(() => placeBid(db, { lotId: id, recyclerId: 'u-recycler-1', amount: 0, pickupTerms: '' }), /positive/);
  const openLot = await db.prepare("SELECT id FROM lot WHERE status = 'open'").get() as any;
  await assert.rejects(() => placeBid(db, { lotId: openLot.id, recyclerId: 'u-recycler-1', amount: 100, pickupTerms: '' }), /not open/);
  await listLot(db, openLot.id, 'u-worker-1');
  assert.ok((await placeBid(db, { lotId: openLot.id, recyclerId: 'u-recycler-1', amount: 100, pickupTerms: 'x' })).id);
});

test('receipt exists only after sale, carries the hash, and renders a PDF', async () => {
  const db = await fresh();
  const id = await listedLot(db, 'u-worker-1');
  await assert.rejects(() => receiptData(db, id), /sold/);
  await acceptBid(db, (await offersFor(db, id))[0].id, 'u-worker-1');
  const d = await receiptData(db, id);
  assert.equal(d.amount, 195);
  assert.equal(d.hash.length, 64);
  assert.match(d.seller.phone, /^x+\d{4}$/);
  const pdf = await renderReceiptPdf(d);
  assert.equal(pdf.subarray(0, 4).toString(), '%PDF');
});

test('repair vs recycle: repair only when it works and clearly beats recycling', async () => {
  const db = await fresh();
  assert.equal((await repairComparison(db, 'Delhi', { type: 'phone', works: true }))!.recommend, 'repair');
  assert.equal((await repairComparison(db, 'Delhi', { type: 'phone', works: false }))!.recommend, 'recycle');
  assert.equal((await repairComparison(db, 'Delhi', { type: 'crt_monitor', works: true }))!.recommend, 'recycle');
  assert.equal(await repairComparison(db, 'Delhi', { type: 'toaster', works: true }), null);
});

test('repair count rises only with before and after photos, once per job', async () => {
  const db = await fresh();
  const count = async () => (await db.prepare("SELECT verified_count v FROM repairer_listing WHERE id = 'rl-1'").get() as any).v;
  assert.equal(await count(), 2); // from demo data
  const job = await createJob(db, 'rl-1', 'before-hash');
  await assert.rejects(() => completeJob(db, job, ''), /photos/);
  assert.equal(await count(), 2);
  await completeJob(db, job, 'after-hash');
  assert.equal(await count(), 3);
  await assert.rejects(() => completeJob(db, job, 'after-hash'), /already/);
  await assert.rejects(() => createJob(db, 'rl-1', ''), /before photo/);
});
