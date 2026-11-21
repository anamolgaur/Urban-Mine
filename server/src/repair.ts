import type { Db } from './db.ts';
import { randomUUID } from 'node:crypto';
import { estimate } from './price.ts';

type Row = Record<string, any>;

/** SAMPLE numbers (INR): typical repair cost and resale value once repaired, per device type. */
const REPAIR_SAMPLE: Record<string, { cost: number; resale: number }> = {
  phone: { cost: 400, resale: 2500 }, tablet: { cost: 600, resale: 3000 }, laptop: { cost: 1500, resale: 9000 },
  charger: { cost: 150, resale: 350 }, lcd_monitor: { cost: 800, resale: 2200 }, router: { cost: 250, resale: 600 },
  set_top_box: { cost: 300, resale: 500 }, crt_monitor: { cost: 0, resale: 0 },
};

export type RepairComparison = {
  recommend: 'repair' | 'recycle'; repair_cost: number; resale_if_repaired: number; recycle_value: number; net_if_repaired: number; sample: true;
};

/** Suggest repair only if the device still works AND repairing beats recycling by a clear margin (1.5x). */
export async function repairComparison(db: Db, city: string, o: { type: string; modelId?: string | null; works: boolean }): Promise<RepairComparison | null> {
  const r = REPAIR_SAMPLE[o.type];
  const est = await estimate(db, city, { type: o.type, modelId: o.modelId });
  if (!r || !est) return null;
  const net = r.resale - r.cost;
  const recommend = o.works && r.resale > 0 && net > est.total * 1.5 ? 'repair' : 'recycle';
  return { recommend, repair_cost: r.cost, resale_if_repaired: r.resale, recycle_value: est.total, net_if_repaired: net, sample: true };
}

export async function listGuides(db: Db) {
  return (await db.prepare('SELECT * FROM repair_guide').all() as Row[]).map((g) => ({
    id: g.id, fault: JSON.parse(g.fault), device_type: g.device_type, difficulty: g.difficulty, tools: JSON.parse(g.tools), steps: JSON.parse(g.steps_json),
  }));
}

export async function listListings(db: Db) {
  return (await db.prepare('SELECT l.*, u.name FROM repairer_listing l JOIN app_user u ON u.id = l.user_id ORDER BY l.verified_count DESC').all() as Row[])
    .map((l) => ({ ...l, skills: JSON.parse(l.skills), sample: true }));
}

export async function upsertListing(db: Db, userId: string, p: { skills: string[]; area: string; start_price: number; hours: string }) {
  if (!p.skills?.length || !p.area?.trim() || !(p.start_price > 0)) throw new Error('Skills, area and a positive starting price are required');
  const existing = await db.prepare('SELECT id FROM repairer_listing WHERE user_id = ?').get(userId) as Row | undefined;
  if (existing) {
    await db.prepare('UPDATE repairer_listing SET skills=?, area=?, start_price=?, hours=? WHERE id=?').run(JSON.stringify(p.skills), p.area, p.start_price, p.hours ?? '', existing.id);
    return existing.id as string;
  }
  const id = randomUUID();
  await db.prepare('INSERT INTO repairer_listing VALUES (?,?,?,?,?,?,?)').run(id, userId, JSON.stringify(p.skills), p.area, p.start_price, p.hours ?? '', 0);
  return id;
}

export async function createJob(db: Db, listingId: string, beforePhoto: string, note = '', now = new Date()) {
  if (!beforePhoto) throw new Error('A before photo is required');
  const id = randomUUID();
  await db.prepare('INSERT INTO repair_job (id, listing_id, before_photo, after_photo, status, note, created_at) VALUES (?,?,?,?,?,?,?)').run(id, listingId, beforePhoto, null, 'in_progress', note.trim().slice(0, 120), now.toISOString());
  return id;
}

/** The repair count only goes up when a job has BOTH before and after photos. */
export async function completeJob(db: Db, jobId: string, afterPhoto: string, now = new Date()) {
  const job = await db.prepare('SELECT * FROM repair_job WHERE id = ?').get(jobId) as Row | undefined;
  if (!job) throw new Error('Job not found');
  if (job.status === 'completed') throw new Error('Job already completed');
  if (!job.before_photo || !afterPhoto) throw new Error('Before and after photos are required');
  await db.tx(async (t) => {
    await t.prepare("UPDATE repair_job SET after_photo = ?, status = 'completed', completed_at = ? WHERE id = ?").run(afterPhoto, now.toISOString(), jobId);
    await t.prepare('UPDATE repairer_listing SET verified_count = verified_count + 1 WHERE id = ?').run(job.listing_id);
  });
}
