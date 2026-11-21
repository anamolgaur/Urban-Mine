import type { Db } from './db.ts';
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

export async function listLots(db: Db, userId: string) {
  // seq keeps insertion order even if two lots share a timestamp
  return (await db.prepare('SELECT * FROM lot WHERE user_id = ? ORDER BY seq').all(userId) as Row[]).map(fromRow);
}

export async function createLot(db: Db, input: Omit<LotRecord, 'created_at'> & { created_at?: string }) {
  const rec: LotRecord = { ...input, created_at: input.created_at ?? new Date().toISOString() };
  // One transaction per worker at a time: the advisory lock stops two simultaneous lots from both linking to the same previous hash.
  return await db.tx(async (t) => {
  await t.prepare('SELECT pg_advisory_xact_lock(hashtext(?))').get(rec.user_id);
  const last = await t.prepare('SELECT hash FROM lot WHERE user_id = ? ORDER BY seq DESC LIMIT 1').get(rec.user_id) as Row | undefined;
  const prev_hash = last?.hash ?? GENESIS;
  const hash = computeHash(prev_hash, recordOf(rec));
  const id = randomUUID();
  await t.prepare('INSERT INTO lot (id,user_id,items,weight_kg,steps_done,steps_total,photo_hashes,gps,prev_hash,hash,status,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
    .run(id, rec.user_id, JSON.stringify(rec.items), rec.weight_kg, rec.steps_done, rec.steps_total,
      JSON.stringify(rec.photo_hashes), rec.gps ? JSON.stringify(rec.gps) : null, prev_hash, hash, 'open', rec.created_at);
  return { id, prev_hash, hash };
  });
}

/** -1 means the stored chain is intact; otherwise the index of the first altered lot. */
export async function verifyWorker(db: Db, userId: string): Promise<number> {
  return verifyChain(await listLots(db, userId));
}