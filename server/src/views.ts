import type { Db } from './db.ts';
import { GENESIS, computeHash, recordOf, shortHash } from './hashchain.ts';

type Row = Record<string, any>;

/** For one worker: lot id -> is this stored lot untouched? (checks its own hash and its link to the previous lot) */
export async function chainStatus(db: Db, userId: string): Promise<Map<string, boolean>> {
  const out = new Map<string, boolean>();
  let prev = GENESIS;
  for (const r of await db.prepare('SELECT * FROM lot WHERE user_id = ? ORDER BY seq').all(userId) as Row[]) {
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
export async function chainDetail(db: Db, userId: string): Promise<Map<string, { hash_ok: boolean; link_ok: boolean }>> {
  const out = new Map<string, { hash_ok: boolean; link_ok: boolean }>();
  let prev = GENESIS;
  for (const r of await db.prepare('SELECT * FROM lot WHERE user_id = ? ORDER BY seq').all(userId) as Row[]) {
    const rec = recordOf({
      user_id: r.user_id, items: JSON.parse(r.items), weight_kg: r.weight_kg, steps_done: r.steps_done, steps_total: r.steps_total,
      photo_hashes: JSON.parse(r.photo_hashes), gps: r.gps ? JSON.parse(r.gps) : null, created_at: r.created_at,
    });
    out.set(r.id, { link_ok: r.prev_hash === prev, hash_ok: r.hash === computeHash(r.prev_hash, rec) });
    prev = r.hash;
  }
  return out;
}

export async function lotView(db: Db, r: Row, chainOk?: boolean) {
  const flags = await db.prepare('SELECT kind, detail, status FROM flag WHERE lot_id = ? ORDER BY seq').all(r.id) as Row[];
  const worker = await db.prepare('SELECT name FROM app_user WHERE id = ?').get(r.user_id) as Row | undefined;
  const sale = await db.prepare("SELECT amount FROM bid WHERE lot_id = ? AND status = 'accepted'").get(r.id) as Row | undefined;
  return {
    id: r.id, user_id: r.user_id, worker_name: worker?.name ?? 'Deleted user',
    items: JSON.parse(r.items), weight_kg: r.weight_kg, steps_done: r.steps_done, steps_total: r.steps_total,
    photo_hashes: JSON.parse(r.photo_hashes), gps: r.gps ? JSON.parse(r.gps) : null,
    prev_hash: r.prev_hash, hash: r.hash, short_hash: shortHash(r.hash), status: r.status, created_at: r.created_at,
    flags: flags.map((f) => ({ kind: f.kind, detail: f.detail, status: f.status })),
    sale_amount: (sale?.amount as number | undefined) ?? null,
    chain_ok: chainOk ?? (await chainStatus(db, r.user_id)).get(r.id) ?? false,
  };
}

export async function lotsFor(db: Db, userId: string) {
  const ok = await chainStatus(db, userId);
  return await Promise.all((await db.prepare('SELECT * FROM lot WHERE user_id = ? ORDER BY seq DESC').all(userId) as Row[]).map((r) => lotView(db, r, ok.get(r.id))));
}
