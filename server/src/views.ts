import type { DatabaseSync } from 'node:sqlite';
import { GENESIS, computeHash, recordOf, shortHash } from './hashchain.ts';

type Row = Record<string, any>;

/** For one worker: lot id -> is this stored lot untouched? (checks its own hash and its link to the previous lot) */
export function chainStatus(db: DatabaseSync, userId: string): Map<string, boolean> {
  const out = new Map<string, boolean>();
  let prev = GENESIS;
  for (const r of db.prepare('SELECT * FROM lot WHERE user_id = ? ORDER BY rowid').all(userId) as Row[]) {
    const rec = recordOf({
      user_id: r.user_id, items: JSON.parse(r.items), weight_kg: r.weight_kg, steps_done: r.steps_done, steps_total: r.steps_total,
      photo_hashes: JSON.parse(r.photo_hashes), gps: r.gps ? JSON.parse(r.gps) : null, created_at: r.created_at,
    });
    out.set(r.id, r.prev_hash === prev && r.hash === computeHash(prev, rec));
    prev = r.hash;
  }
  return out;
}

/** Per lot: does the stored hash match its contents, and does it link to the worker's previous lot? */
export function chainDetail(db: DatabaseSync, userId: string): Map<string, { hash_ok: boolean; link_ok: boolean }> {
  const out = new Map<string, { hash_ok: boolean; link_ok: boolean }>();
  let prev = GENESIS;
  for (const r of db.prepare('SELECT * FROM lot WHERE user_id = ? ORDER BY rowid').all(userId) as Row[]) {
    const rec = recordOf({
      user_id: r.user_id, items: JSON.parse(r.items), weight_kg: r.weight_kg, steps_done: r.steps_done, steps_total: r.steps_total,
      photo_hashes: JSON.parse(r.photo_hashes), gps: r.gps ? JSON.parse(r.gps) : null, created_at: r.created_at,
    });
    out.set(r.id, { link_ok: r.prev_hash === prev, hash_ok: r.hash === computeHash(r.prev_hash, rec) });
    prev = r.hash;
  }
  return out;
}

export function lotView(db: DatabaseSync, r: Row, chainOk?: boolean) {
  const flags = db.prepare('SELECT kind, detail, status FROM flag WHERE lot_id = ? ORDER BY rowid').all(r.id) as Row[];
  const worker = db.prepare('SELECT name FROM user WHERE id = ?').get(r.user_id) as Row | undefined;
  const sale = db.prepare("SELECT amount FROM bid WHERE lot_id = ? AND status = 'accepted'").get(r.id) as Row | undefined;
  return {
    id: r.id, user_id: r.user_id, worker_name: worker?.name ?? 'Deleted user',
    items: JSON.parse(r.items), weight_kg: r.weight_kg, steps_done: r.steps_done, steps_total: r.steps_total,
    photo_hashes: JSON.parse(r.photo_hashes), gps: r.gps ? JSON.parse(r.gps) : null,
    prev_hash: r.prev_hash, hash: r.hash, short_hash: shortHash(r.hash), status: r.status, created_at: r.created_at,
    flags: flags.map((f) => ({ kind: f.kind, detail: f.detail, status: f.status })),
    sale_amount: (sale?.amount as number | undefined) ?? null,
    chain_ok: chainOk ?? chainStatus(db, r.user_id).get(r.id) ?? false,
  };
}

export function lotsFor(db: DatabaseSync, userId: string) {
  const ok = chainStatus(db, userId);
  return (db.prepare('SELECT * FROM lot WHERE user_id = ? ORDER BY rowid DESC').all(userId) as Row[]).map((r) => lotView(db, r, ok.get(r.id)));
}
