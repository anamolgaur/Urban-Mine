import type { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';

type Row = Record<string, any>;
const iso = (d: Date) => d.toISOString();

function expireBids(db: DatabaseSync, now: Date) {
  db.prepare("UPDATE bid SET status = 'expired' WHERE status = 'open' AND expires_at <= ?").run(iso(now));
}

/** Worker puts an open lot up for sale. */
export function listLot(db: DatabaseSync, lotId: string, userId: string) {
  const lot = db.prepare('SELECT * FROM lot WHERE id = ?').get(lotId) as Row | undefined;
  if (!lot || lot.user_id !== userId) throw new Error('Lot not found');
  if (lot.status !== 'open') throw new Error(`Lot is already ${lot.status}`);
  db.prepare("UPDATE lot SET status = 'listed' WHERE id = ?").run(lotId);
}

export function placeBid(db: DatabaseSync, p: { lotId: string; recyclerId: string; amount: number; pickupTerms: string; minutes?: number; now?: Date }) {
  const now = p.now ?? new Date();
  const lot = db.prepare('SELECT status FROM lot WHERE id = ?').get(p.lotId) as Row | undefined;
  if (!lot) throw new Error('Lot not found');
  if (lot.status !== 'listed') throw new Error('Lot is not open for bids');
  const user = db.prepare('SELECT role FROM user WHERE id = ?').get(p.recyclerId) as Row | undefined;
  if (user?.role !== 'recycler') throw new Error('Only recyclers can bid');
  if (!(p.amount > 0)) throw new Error('Bid amount must be positive');
  const id = randomUUID();
  const expires = new Date(now.getTime() + (p.minutes ?? 30) * 60000);
  db.prepare('INSERT INTO bid VALUES (?,?,?,?,?,?,?)').run(id, p.lotId, p.recyclerId, p.amount, p.pickupTerms, iso(expires), 'open');
  return { id, expires_at: iso(expires) };
}

/** Open, unexpired bids for a lot, highest first, with a countdown in seconds. */
export function offersFor(db: DatabaseSync, lotId: string, now = new Date()) {
  expireBids(db, now);
  return (db.prepare("SELECT b.*, u.name AS recycler_name FROM bid b JOIN user u ON u.id = b.recycler_id WHERE b.lot_id = ? AND b.status = 'open' ORDER BY b.amount DESC").all(lotId) as Row[])
    .map((b) => ({ ...b, seconds_left: Math.max(0, Math.round((Date.parse(b.expires_at) - now.getTime()) / 1000)) }));
}

export function acceptBid(db: DatabaseSync, bidId: string, userId: string, now = new Date()) {
  expireBids(db, now);
  const bid = db.prepare('SELECT * FROM bid WHERE id = ?').get(bidId) as Row | undefined;
  if (!bid) throw new Error('Offer not found');
  const lot = db.prepare('SELECT * FROM lot WHERE id = ?').get(bid.lot_id) as Row;
  if (lot.user_id !== userId) throw new Error('Not your lot');
  if (lot.status === 'held') throw new Error('Payout is on hold pending audit');
  if (lot.status !== 'listed') throw new Error(`Lot is ${lot.status}`);
  if (bid.status !== 'open') throw new Error(`Offer is ${bid.status}`);
  db.exec('BEGIN');
  try {
    db.prepare("UPDATE bid SET status = 'accepted' WHERE id = ?").run(bidId);
    db.prepare("UPDATE bid SET status = 'rejected' WHERE lot_id = ? AND id != ? AND status = 'open'").run(bid.lot_id, bidId);
    db.prepare("UPDATE lot SET status = 'sold' WHERE id = ?").run(bid.lot_id);
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
  return { lot_id: bid.lot_id, bid_id: bidId, amount: bid.amount };
}

export function holdLot(db: DatabaseSync, lotId: string) {
  const lot = db.prepare('SELECT status FROM lot WHERE id = ?').get(lotId) as Row | undefined;
  if (!lot) throw new Error('Lot not found');
  if (lot.status === 'held') return;
  db.prepare("UPDATE lot SET status = 'held', held_from = status WHERE id = ?").run(lotId);
}

export function releaseLot(db: DatabaseSync, lotId: string) {
  const lot = db.prepare('SELECT status, held_from FROM lot WHERE id = ?').get(lotId) as Row | undefined;
  if (!lot || lot.status !== 'held') throw new Error('Lot is not on hold');
  db.prepare("UPDATE lot SET status = ?, held_from = NULL WHERE id = ?").run(lot.held_from ?? 'listed', lotId);
}

export function requestRecheck(db: DatabaseSync, lotId: string, note: string) {
  db.prepare("INSERT INTO flag VALUES (?,?,?,?,?)").run(randomUUID(), lotId, 'recheck_requested', note || 'Auditor asked for a re-check', 'open');
}
