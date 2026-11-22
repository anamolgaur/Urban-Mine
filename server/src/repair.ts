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

/** Safety gear checked before a repair starts. `required` items must be ticked to start the job. DRAFT: needs expert review. */
export const GEAR = [
  { id: 'glasses', required: true, en: 'Safety glasses', hi: 'सुरक्षा चश्मा' },
  { id: 'gloves', required: true, en: 'Cut-resistant gloves', hi: 'कट से बचाने वाले दस्ताने' },
  { id: 'unplugged', required: true, en: 'Device unplugged and switched off', hi: 'सामान का प्लग निकाला और बंद किया' },
  { id: 'battery_tray', required: true, en: 'Metal tray or sand nearby for batteries', hi: 'बैटरी के लिए पास में धातु की ट्रे या रेत' },
  { id: 'ventilation', required: false, en: 'Window open or fan on (soldering, glue)', hi: 'खिड़की खुली या पंखा चालू (सोल्डरिंग, गोंद)' },
  { id: 'esd', required: false, en: 'Anti-static wrist strap (laptops, boards)', hi: 'एंटी-स्टैटिक रिस्ट स्ट्रैप (लैपटॉप, बोर्ड)' },
  { id: 'mask', required: false, en: 'Dust mask', hi: 'धूल से बचाने वाला मास्क' },
] as const;
const REQUIRED_GEAR = GEAR.filter((g) => g.required).map((g) => g.id) as string[];
const DURING_MAX = 8;

export type Diary = { problems?: string; parts?: string; minutes?: number; outcome?: 'fixed' | 'partly' | 'not_fixed'; customer_note?: string };
const clean = (s: unknown, n: number) => String(s ?? '').trim().slice(0, n);
export function cleanDiary(d: Record<string, unknown> = {}): Diary {
  const out: Diary = {};
  if (d.problems !== undefined) out.problems = clean(d.problems, 600);
  if (d.parts !== undefined) out.parts = clean(d.parts, 300);
  if (d.customer_note !== undefined) out.customer_note = clean(d.customer_note, 300);
  if (d.minutes !== undefined && Number(d.minutes) >= 0) out.minutes = Math.min(Math.round(Number(d.minutes)), 60 * 24 * 7);
  if (d.outcome === 'fixed' || d.outcome === 'partly' || d.outcome === 'not_fixed') out.outcome = d.outcome;
  return out;
}

export async function createJob(db: Db, listingId: string, beforePhoto: string, note = '', now = new Date(),
  opts: { device_type?: string; guide_id?: string; gear?: string[]; requireGear?: boolean } = {}) {
  if (!beforePhoto) throw new Error('A before photo is required');
  const gear = (opts.gear ?? []).filter((g) => GEAR.some((x) => x.id === g))
  if (opts.requireGear && !REQUIRED_GEAR.every((g) => gear.includes(g))) throw new Error('Tick all the required safety items before starting');
  const id = randomUUID();
  await db.prepare('INSERT INTO repair_job (id, listing_id, before_photo, after_photo, status, note, created_at, device_type, guide_id, gear_checked) VALUES (?,?,?,?,?,?,?,?,?,?)')
    .run(id, listingId, beforePhoto, null, 'in_progress', note.trim().slice(0, 120), now.toISOString(), opts.device_type ?? null, opts.guide_id ?? null, JSON.stringify(gear));
  return id;
}

/** While a job is open: add a "during" photo, tick or untick a guide step, or update the diary. */
export async function updateJob(db: Db, jobId: string, p: { during_photo?: string; step?: number; done?: boolean; diary?: Record<string, unknown> }) {
  const job = await db.prepare('SELECT * FROM repair_job WHERE id = ?').get(jobId) as Row | undefined;
  if (!job) throw new Error('Job not found');
  if (p.during_photo) {
    if (job.status !== 'in_progress') throw new Error('Photos can only be added while the job is open');
    const list: string[] = JSON.parse(job.during_photos);
    if (list.length >= DURING_MAX) throw new Error(`Up to ${DURING_MAX} photos during a job`);
    if (!list.includes(p.during_photo)) list.push(p.during_photo);
    await db.prepare('UPDATE repair_job SET during_photos = ? WHERE id = ?').run(JSON.stringify(list), jobId);
  }
  if (p.step !== undefined) {
    if (!Number.isInteger(p.step) || p.step < 0 || p.step > 50) throw new Error('Invalid step');
    const set = new Set<number>(JSON.parse(job.steps_done));
    if (p.done === false) set.delete(p.step); else set.add(p.step);
    await db.prepare('UPDATE repair_job SET steps_done = ? WHERE id = ?').run(JSON.stringify([...set].sort((a, b) => a - b)), jobId);
  }
  if (p.diary) {
    const merged = { ...JSON.parse(job.diary), ...cleanDiary(p.diary) };
    await db.prepare('UPDATE repair_job SET diary = ? WHERE id = ?').run(JSON.stringify(merged), jobId);
  }
}

export const jobView = (j: Row) => ({
  ...j, gear_checked: JSON.parse(j.gear_checked ?? '[]'), steps_done: JSON.parse(j.steps_done ?? '[]'),
  during_photos: JSON.parse(j.during_photos ?? '[]'), diary: JSON.parse(j.diary ?? '{}'),
});

/** The repair count only goes up when a job has BOTH before and after photos. */
export async function completeJob(db: Db, jobId: string, afterPhoto: string, now = new Date(), diary?: Record<string, unknown>) {
  const job = await db.prepare('SELECT * FROM repair_job WHERE id = ?').get(jobId) as Row | undefined;
  if (!job) throw new Error('Job not found');
  if (job.status === 'completed') throw new Error('Job already completed');
  if (!job.before_photo || !afterPhoto) throw new Error('Before and after photos are required');
  await db.tx(async (t) => {
    await t.prepare("UPDATE repair_job SET after_photo = ?, status = 'completed', completed_at = ?, diary = ? WHERE id = ?")
      .run(afterPhoto, now.toISOString(), JSON.stringify({ ...JSON.parse(job.diary ?? '{}'), ...cleanDiary(diary) }), jobId);
    await t.prepare('UPDATE repairer_listing SET verified_count = verified_count + 1 WHERE id = ?').run(job.listing_id);
  });
}
