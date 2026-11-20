import type { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { GENESIS, computeHash, verifyChain, recordOf, type LotRecord, type ChainedLot } from './hashchain.ts';

type Row = Record<string, any>;

function fromRow(r: Row): ChainedLot & { id: string; status: string } {
  return {
    id: r.id, status: r.status, user_id: r.user_id, items: JSON.parse(r.items), weight_kg: r.weight_kg,
    steps_done: r.steps_done, steps_total: r.steps_total, photo_hashes: JSON.parse(r.photo_hashes),
    gps: r.gps ? JSON.parse(r.gps) : null, created_at: r.created_at, prev_hash: r.prev_hash, hash: r.hash,
  };
}

export function listLots(db: DatabaseSync, userId: string) {
  // rowid keeps insertion order even if two lots share a timestamp
  return (db.prepare('SELECT * FROM lot WHERE user_id = ? ORDER BY rowid').all(userId) as Row[]).map(fromRow);
}

export function createLot(db: DatabaseSync, input: Omit<LotRecord, 'created_at'> & { created_at?: string }) {
  const rec: LotRecord = { ...input, created_at: input.created_at ?? new Date().toISOString() };
  const last = db.prepare('SELECT hash FROM lot WHERE user_id = ? ORDER BY rowid DESC LIMIT 1').get(rec.user_id) as Row | undefined;
  const prev_hash = last?.hash ?? GENESIS;
  const hash = computeHash(prev_hash, recordOf(rec));
  const id = randomUUID();
  db.prepare('INSERT INTO lot (id,user_id,items,weight_kg,steps_done,steps_total,photo_hashes,gps,prev_hash,hash,status,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
    .run(id, rec.user_id, JSON.stringify(rec.items), rec.weight_kg, rec.steps_done, rec.steps_total,
      JSON.stringify(rec.photo_hashes), rec.gps ? JSON.stringify(rec.gps) : null, prev_hash, hash, 'open', rec.created_at);
  return { id, prev_hash, hash };
}

/** -1 means the stored chain is intact; otherwise the index of the first altered lot. */
export function verifyWorker(db: DatabaseSync, userId: string): number {
  return verifyChain(listLots(db, userId));
}