import type { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';

type Row = Record<string, any>;
export type FlagDraft = { kind: string; detail: string };
export type Gps = { lat: number; lng: number };

/** Rule thresholds. Rule-based on purpose: every flag can be explained to a worker. */
export const T = { WEIGHT_HIGH: 2, WEIGHT_LOW: 0.4, GPS_KM: 2, SAFETY_MIN: 0.7, RAPID_COUNT: 3, RAPID_MINUTES: 30 };

export function haversineKm(a: Gps, b: Gps): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

export function weightFlag(expectedKg: number | null, actualKg: number): FlagDraft | null {
  if (!expectedKg || expectedKg <= 0) return null;
  const ratio = actualKg / expectedKg;
  if (ratio > T.WEIGHT_HIGH || ratio < T.WEIGHT_LOW)
    return { kind: 'weight_outlier', detail: `Declared ${actualKg} kg, expected about ${expectedKg.toFixed(1)} kg for the declared items` };
  return null;
}

export function safetyFlag(done: number, total: number): FlagDraft | null {
  if (total > 0 && done / total < T.SAFETY_MIN)
    return { kind: 'low_safety', detail: `Only ${done} of ${total} safety steps completed` };
  return null;
}

export function gpsFlag(gps: Gps | null, workshop: Gps | null): FlagDraft | null {
  if (!gps || !workshop) return null;
  const km = haversineKm(gps, workshop);
  return km > T.GPS_KM ? { kind: 'gps_far', detail: `Lot recorded ${km.toFixed(0)} km from the registered workshop` } : null;
}

/** Expected weight from declared items (exact model weight, else average for the type). null if anything is unknown. */
export function expectedWeightKg(db: DatabaseSync, items: { model_id?: string | null; type: string; qty?: number }[]): number | null {
  let total = 0;
  for (const it of items) {
    let w: number | undefined;
    if (it.model_id) w = (db.prepare('SELECT weight_kg w FROM device_model WHERE id = ?').get(it.model_id) as Row | undefined)?.w;
    if (w === undefined) w = (db.prepare('SELECT AVG(weight_kg) w FROM device_model WHERE type = ?').get(it.type) as Row | undefined)?.w ?? undefined;
    if (w === undefined || w === null) return null;
    total += w * (it.qty ?? 1);
  }
  return total;
}

export function evaluateLot(db: DatabaseSync, lotId: string): FlagDraft[] {
  const lot = db.prepare('SELECT * FROM lot WHERE id = ?').get(lotId) as Row | undefined;
  if (!lot) throw new Error('Unknown lot');
  const flags: FlagDraft[] = [];

  // 1. duplicate photo hash in any other lot
  const hashes: string[] = JSON.parse(lot.photo_hashes);
  const dupIds = new Set<string>();
  for (const h of hashes) {
    for (const o of db.prepare('SELECT id FROM lot WHERE id != ? AND photo_hashes LIKE ?').all(lotId, `%"${h}"%`) as Row[]) dupIds.add(o.id);
  }
  if (dupIds.size) flags.push({ kind: 'duplicate_photo', detail: `A photo in this lot also appears in lot ${[...dupIds].map((i) => i.slice(0, 8)).join(', ')}` });

  // 2. weight far from expected
  const w = weightFlag(expectedWeightKg(db, JSON.parse(lot.items)), lot.weight_kg);
  if (w) flags.push(w);

  // 3. GPS far from registered workshop
  const ws = db.prepare('SELECT w.lat, w.lng FROM user u JOIN workshop w ON w.id = u.workshop_id WHERE u.id = ?').get(lot.user_id) as Gps | undefined;
  const g = gpsFlag(lot.gps ? JSON.parse(lot.gps) : null, ws ?? null);
  if (g) flags.push(g);

  // 4. low safety-step completion
  const s = safetyFlag(lot.steps_done, lot.steps_total);
  if (s) flags.push(s);

  // 5. rapid repeat lots by the same worker
  const end = Date.parse(lot.created_at);
  const recent = (db.prepare('SELECT created_at FROM lot WHERE user_id = ?').all(lot.user_id) as Row[])
    .filter((r) => { const t = Date.parse(r.created_at); return t <= end && end - t <= T.RAPID_MINUTES * 60000; });
  if (recent.length >= T.RAPID_COUNT) flags.push({ kind: 'rapid_repeat', detail: `${recent.length} lots from one worker within ${T.RAPID_MINUTES} minutes` });

  return flags;
}

/** Evaluate and store any flags not already recorded for this lot. */
export function recordFlags(db: DatabaseSync, lotId: string): FlagDraft[] {
  const found = evaluateLot(db, lotId);
  for (const f of found) {
    const exists = db.prepare('SELECT 1 FROM flag WHERE lot_id = ? AND kind = ?').get(lotId, f.kind);
    if (!exists) db.prepare('INSERT INTO flag VALUES (?,?,?,?,?)').run(randomUUID(), lotId, f.kind, f.detail, 'open');
  }
  return found;
}
