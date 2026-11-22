import type { Db } from './db.ts';
import { randomUUID } from 'node:crypto';

type Row = Record<string, any>;
const iso = (d: Date) => d.toISOString();

async function expireBids(db: Db, now: Date) {
  await db.prepare("UPDATE bid SET status = 'expired' WHERE status = 'open' AND expires_at <= ?").run(iso(now));
}

/** Worker puts an open lot up for sale. */
export async function listLot(db: Db, lotId: string, userId: string) {
  const lot = await db.prepare('SELECT * FROM lot WHERE id = ?').get(lotId) as Row | undefined;
  if (!lot || lot.user_id !== userId) throw new Error('Lot not found');
  if (lot.status !== 'open') throw new Error(`Lot is already ${lot.status}`);
  await db.prepare("UPDATE lot SET status = 'listed' WHERE id = ?").run(lotId);
}

export async function placeBid(db: Db, p: { lotId: string; recyclerId: string; amount: number; pickupTerms: string; minutes?: number; now?: Date }) {
  const now = p.now ?? new Date();
  const lot = await db.prepare('SELECT status FROM lot WHERE id = ?').get(p.lotId) as Row | undefined;
  if (!lot) throw new Error('Lot not found');
  if (lot.status !== 'listed') throw new Error('Lot is not open for bids');
  const user = await db.prepare('SELECT role FROM app_user WHERE id = ?').get(p.recyclerId) as Row | undefined;
  if (user?.role !== 'recycler') throw new Error('Only recyclers can bid');
  if (!(p.amount > 0)) throw new Error('Bid amount must be positive');
  if (p.amount > 10_000_000) throw new Error('Bid amount is too large');
  const id = randomUUID();
  const expires = new Date(now.getTime() + (p.minutes ?? 30) * 60000);
  await db.prepare('INSERT INTO bid VALUES (?,?,?,?,?,?,?)').run(id, p.lotId, p.recyclerId, p.amount, p.pickupTerms, iso(expires), 'open');
  return { id, expires_at: iso(expires) };
}

/** Open, unexpired bids for a lot, highest first, with a countdown in seconds. */
export async function offersFor(db: Db, lotId: string, now = new Date()): Promise<(Row & { seconds_left: number })[]> {
  await expireBids(db, now);
  return (await db.prepare("SELECT b.*, u.name AS recycler_name FROM bid b JOIN app_user u ON u.id = b.recycler_id WHERE b.lot_id = ? AND b.status = 'open' ORDER BY b.amount DESC").all(lotId) as Row[])
    .map((b) => ({ ...b, seconds_left: Math.max(0, Math.round((Date.parse(b.expires_at) - now.getTime()) / 1000)) }));
}

export async function acceptBid(db: Db, bidId: string, userId: string, now = new Date()) {
  await expireBids(db, now);
  const bid = await db.prepare('SELECT * FROM bid WHERE id = ?').get(bidId) as Row | undefined;
  if (!bid) throw new Error('Offer not found');
  const lot = await db.prepare('SELECT * FROM lot WHERE id = ?').get(bid.lot_id) as Row;
  if (lot.user_id !== userId) throw new Error('Not your lot');
  if (lot.status === 'held') throw new Error('Payout is on hold pending audit');
  if (lot.status !== 'listed') throw new Error(`Lot is ${lot.status}`);
  if (bid.status !== 'open') throw new Error(`Offer is ${bid.status}`);
  await db.tx(async (t) => {
    await t.prepare("UPDATE bid SET status = 'accepted' WHERE id = ?").run(bidId);
    await t.prepare("UPDATE bid SET status = 'rejected' WHERE lot_id = ? AND id != ? AND status = 'open'").run(bid.lot_id, bidId);
    await t.prepare("UPDATE lot SET status = 'sold' WHERE id = ?").run(bid.lot_id);
  });
  return { lot_id: bid.lot_id, bid_id: bidId, amount: bid.amount };
}

/** Worker turns down an offer. */
export async function rejectBid(db: Db, bidId: string, userId: string, now = new Date()) {
  await expireBids(db, now);
  const bid = await db.prepare('SELECT b.status, l.user_id FROM bid b JOIN lot l ON l.id = b.lot_id WHERE b.id = ?').get(bidId) as Row | undefined;
  if (!bid || bid.user_id !== userId) throw new Error('Offer not found');
  if (bid.status !== 'open') throw new Error('Offer is ' + bid.status);
  await db.prepare("UPDATE bid SET status = 'rejected' WHERE id = ?").run(bidId);
}

export async function holdLot(db: Db, lotId: string) {
  const lot = await db.prepare('SELECT status FROM lot WHERE id = ?').get(lotId) as Row | undefined;
  if (!lot) throw new Error('Lot not found');
  if (lot.status === 'held') return;
  await db.prepare("UPDATE lot SET status = 'held', held_from = status WHERE id = ?").run(lotId);
}

export async function releaseLot(db: Db, lotId: string) {
  const lot = await db.prepare('SELECT status, held_from FROM lot WHERE id = ?').get(lotId) as Row | undefined;
  if (!lot || lot.status !== 'held') throw new Error('Lot is not on hold');
  await db.prepare("UPDATE lot SET status = ?, held_from = NULL WHERE id = ?").run(lot.held_from ?? 'listed', lotId);
}

export async function requestRecheck(db: Db, lotId: string, note: string) {
  await db.prepare("INSERT INTO flag VALUES (?,?,?,?,?)").run(randomUUID(), lotId, 'recheck_requested', note || 'Auditor asked for a re-check', 'open');
}

/** All of one recycler's bids with a lot summary: powers "My offers" and "Purchases". */
export async function bidsFor(db: Db, recyclerId: string, now = new Date()) {
  await expireBids(db, now);
  const sql = `SELECT b.id, b.lot_id, b.amount, b.pickup_terms, b.expires_at, b.status, l.items, l.weight_kg, l.hash, l.status AS lot_status,
    u.name AS worker_name FROM bid b JOIN lot l ON l.id = b.lot_id LEFT JOIN app_user u ON u.id = l.user_id WHERE b.recycler_id = ? ORDER BY b.seq DESC`;
  return (await db.prepare(sql).all(recyclerId) as Row[]).map((r) => ({
    id: r.id, lot_id: r.lot_id, amount: r.amount, pickup_terms: r.pickup_terms, expires_at: r.expires_at, status: r.status,
    items: JSON.parse(r.items), weight_kg: r.weight_kg, short_hash: String(r.hash).slice(0, 8), lot_status: r.lot_status,
    worker_name: r.worker_name ?? 'Deleted user', seconds_left: Math.max(0, Math.round((Date.parse(r.expires_at) - now.getTime()) / 1000)),
  }));
}
