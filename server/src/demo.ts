import type { Db } from './db.ts';
import { createLot } from './lots.ts';
import { recordFlags } from './fraud.ts';
import { listLot, placeBid } from './market.ts';
import { createJob, completeJob } from './repair.ts';
import { writeSamplePhotos } from './samplephoto.ts';
import type { PhotoStore } from './photostore.ts';

/** SAMPLE demo lots covering every fraud rule, plus open bids and verified repairs. Run once on a fresh database. */
export async function seedDemo(db: Db, now = new Date(), photos?: PhotoStore) {
  const used = new Set<string>();
  const ago = (min: number) => new Date(now.getTime() - min * 60000).toISOString();
  const near1 = { lat: 28.6695, lng: 77.2651 }; // near ws-1 (Delhi)
  const near2 = { lat: 22.5538, lng: 88.3909 }; // near ws-2 (Kolkata)
  const h = (s: string) => { const x = s.padEnd(64, '0'); used.add(x); return x; };

  // Worker 1: two clean lots (one listed with bids)
  const a = await createLot(db, { user_id: 'u-worker-1', items: [{ model_id: 'ph-arka-a1', type: 'phone', qty: 3 }], weight_kg: 0.6, steps_done: 3, steps_total: 3,
    photo_hashes: [h('a1'), h('a2')], gps: near1, created_at: ago(300) });
  await createLot(db, { user_id: 'u-worker-1', items: [{ model_id: 'chg-nova-65', type: 'charger', qty: 2 }], weight_kg: 0.6, steps_done: 0, steps_total: 0,
    photo_hashes: [h('a3')], gps: near1, created_at: ago(200) });
  await listLot(db, a.id, 'u-worker-1');
  await recordFlags(db, a.id);
  await placeBid(db, { lotId: a.id, recyclerId: 'u-recycler-1', amount: 195, pickupTerms: 'SAMPLE: pickup tomorrow 10am', minutes: 90, now });
  await placeBid(db, { lotId: a.id, recyclerId: 'u-recycler-2', amount: 170, pickupTerms: 'SAMPLE: pickup today 6pm', minutes: 45, now });

  // Worker 2: a lot reusing a photo from lot A (duplicate), listed
  const c = await createLot(db, { user_id: 'u-worker-2', items: [{ model_id: 'ph-arka-a1', type: 'phone', qty: 3 }], weight_kg: 0.6, steps_done: 3, steps_total: 3,
    photo_hashes: [h('a1'), h('c2')], gps: near2, created_at: ago(120) });
  await listLot(db, c.id, 'u-worker-2');
  // Worker 2: far GPS + low safety + weight outlier
  const d = await createLot(db, { user_id: 'u-worker-2', items: [{ model_id: 'lap-nova-14', type: 'laptop', qty: 2 }], weight_kg: 14, steps_done: 1, steps_total: 4,
    photo_hashes: [h('d1')], gps: near1, created_at: ago(25) });
  await listLot(db, d.id, 'u-worker-2');
  // Worker 2: rapid repeat (3 lots within 30 minutes: d above, plus these)
  await createLot(db, { user_id: 'u-worker-2', items: [{ type: 'charger', qty: 1 }], weight_kg: 0.1, steps_done: 0, steps_total: 0, photo_hashes: [h('e1')], gps: near2, created_at: ago(12) });
  const f = await createLot(db, { user_id: 'u-worker-2', items: [{ type: 'router', qty: 1 }], weight_kg: 0.25, steps_done: 0, steps_total: 0, photo_hashes: [h('f1')], gps: near2, created_at: ago(3) });

  for (const id of [c.id, d.id, f.id]) await recordFlags(db, id);
  await placeBid(db, { lotId: c.id, recyclerId: 'u-recycler-1', amount: 160, pickupTerms: 'SAMPLE: pickup in 2 days', minutes: 120, now });

  // Repairer: two verified repairs (both before and after photos)
  const day = 86400000;
  const jobs: [string, string, number][] = [['c1', 'Phone screen replaced', 3], ['c2', 'Charger cable swapped', 1]];
  for (const [n, note, daysAgo] of jobs) {
    const started = new Date(now.getTime() - daysAgo * day);
    const j = await createJob(db, 'rl-1', h(n + 'b'), note, started);
    await completeJob(db, j, h(n + 'a'), new Date(started.getTime() + 3600000));
  }
  await createJob(db, 'rl-1', h('c3b'), 'Laptop will not charge', new Date(now.getTime() - 3600000)); // still in progress
  if (photos) await writeSamplePhotos(photos, used);
}
