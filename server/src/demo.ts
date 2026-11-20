import type { DatabaseSync } from 'node:sqlite';
import { createLot } from './lots.ts';
import { recordFlags } from './fraud.ts';
import { listLot, placeBid } from './market.ts';
import { createJob, completeJob } from './repair.ts';
import { writeSamplePhotos } from './samplephoto.ts';

/** SAMPLE demo lots covering every fraud rule, plus open bids and verified repairs. Run once on a fresh database. */
export function seedDemo(db: DatabaseSync, now = new Date(), uploadsDir?: string) {
  const used = new Set<string>();
  const ago = (min: number) => new Date(now.getTime() - min * 60000).toISOString();
  const near1 = { lat: 28.6695, lng: 77.2651 }; // near ws-1 (Delhi)
  const near2 = { lat: 22.5538, lng: 88.3909 }; // near ws-2 (Kolkata)
  const h = (s: string) => { const x = s.padEnd(64, '0'); used.add(x); return x; };

  // Worker 1: two clean lots (one listed with bids)
  const a = createLot(db, { user_id: 'u-worker-1', items: [{ model_id: 'ph-arka-a1', type: 'phone', qty: 3 }], weight_kg: 0.6, steps_done: 3, steps_total: 3,
    photo_hashes: [h('a1'), h('a2')], gps: near1, created_at: ago(300) });
  createLot(db, { user_id: 'u-worker-1', items: [{ model_id: 'chg-nova-65', type: 'charger', qty: 2 }], weight_kg: 0.6, steps_done: 0, steps_total: 0,
    photo_hashes: [h('a3')], gps: near1, created_at: ago(200) });
  listLot(db, a.id, 'u-worker-1');
  recordFlags(db, a.id);
  placeBid(db, { lotId: a.id, recyclerId: 'u-recycler-1', amount: 195, pickupTerms: 'SAMPLE: pickup tomorrow 10am', minutes: 90, now });
  placeBid(db, { lotId: a.id, recyclerId: 'u-recycler-2', amount: 170, pickupTerms: 'SAMPLE: pickup today 6pm', minutes: 45, now });

  // Worker 2: a lot reusing a photo from lot A (duplicate), listed
  const c = createLot(db, { user_id: 'u-worker-2', items: [{ model_id: 'ph-arka-a1', type: 'phone', qty: 3 }], weight_kg: 0.6, steps_done: 3, steps_total: 3,
    photo_hashes: [h('a1'), h('c2')], gps: near2, created_at: ago(120) });
  listLot(db, c.id, 'u-worker-2');
  // Worker 2: far GPS + low safety + weight outlier
  const d = createLot(db, { user_id: 'u-worker-2', items: [{ model_id: 'lap-nova-14', type: 'laptop', qty: 2 }], weight_kg: 14, steps_done: 1, steps_total: 4,
    photo_hashes: [h('d1')], gps: near1, created_at: ago(25) });
  listLot(db, d.id, 'u-worker-2');
  // Worker 2: rapid repeat (3 lots within 30 minutes: d above, plus these)
  createLot(db, { user_id: 'u-worker-2', items: [{ type: 'charger', qty: 1 }], weight_kg: 0.1, steps_done: 0, steps_total: 0, photo_hashes: [h('e1')], gps: near2, created_at: ago(12) });
  const f = createLot(db, { user_id: 'u-worker-2', items: [{ type: 'router', qty: 1 }], weight_kg: 0.25, steps_done: 0, steps_total: 0, photo_hashes: [h('f1')], gps: near2, created_at: ago(3) });

  for (const id of [c.id, d.id, f.id]) recordFlags(db, id);
  placeBid(db, { lotId: c.id, recyclerId: 'u-recycler-1', amount: 160, pickupTerms: 'SAMPLE: pickup in 2 days', minutes: 120, now });

  // Repairer: two verified repairs (both before and after photos)
  const day = 86400000;
  const jobs: [string, string, number][] = [['r1', 'Phone screen replaced', 3], ['r2', 'Charger cable swapped', 1]];
  for (const [n, note, daysAgo] of jobs) {
    const started = new Date(now.getTime() - daysAgo * day);
    const j = createJob(db, 'rl-1', h(n + 'b'), note, started);
    completeJob(db, j, h(n + 'a'), new Date(started.getTime() + 3600000));
  }
  createJob(db, 'rl-1', h('r3b'), 'Laptop will not charge', new Date(now.getTime() - 3600000)); // still in progress
  if (uploadsDir) writeSamplePhotos(uploadsDir, used);
}
