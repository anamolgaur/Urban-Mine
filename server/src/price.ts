import type { DatabaseSync } from 'node:sqlite';

type Row = Record<string, any>;
export type Composition = Record<string, number>; // material -> grams
export type RateInfo = { rate: number; prev: number | null; change: number | null; updated_at: string; source: string };
export type PriceLine = { material: string; grams: number; value: number };
export type Estimate = {
  lines: PriceLine[]; total: number; low: number; high: number;
  basis: 'model' | 'type'; sample: true; weight_kg: number;
};

const SPREAD = { model: 0.12, type: 0.25 };
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Pure: grams x rate per kg. Throws if a material has no rate, so a missing rate is never silently valued at zero. */
export function priceComposition(comp: Composition, rates: Record<string, { rate: number }>, basis: 'model' | 'type'): Estimate {
  const lines: PriceLine[] = Object.entries(comp).map(([material, grams]) => {
    const rate = rates[material]?.rate;
    if (rate === undefined) throw new Error(`No rate for material: ${material}`);
    return { material, grams, value: r2((grams / 1000) * rate) };
  });
  const total = r2(lines.reduce((s, l) => s + l.value, 0));
  const weight_kg = r2(lines.reduce((s, l) => s + l.grams, 0) / 1000);
  return { lines, total, low: r2(total * (1 - SPREAD[basis])), high: r2(total * (1 + SPREAD[basis])), basis, sample: true, weight_kg };
}

/** Today's rate per material for a city, plus change versus the previous day in rate_history. */
export function getRates(db: DatabaseSync, city: string): Record<string, RateInfo> {
  const out: Record<string, RateInfo> = {};
  for (const r of db.prepare('SELECT * FROM rate WHERE city = ?').all(city) as Row[]) {
    const prev = db.prepare('SELECT rate_per_kg FROM rate_history WHERE material=? AND city=? AND day < ? ORDER BY day DESC LIMIT 1')
      .get(r.material, city, r.updated_at.slice(0, 10)) as Row | undefined;
    out[r.material] = {
      rate: r.rate_per_kg, prev: prev?.rate_per_kg ?? null,
      change: prev ? r2(r.rate_per_kg - prev.rate_per_kg) : null,
      updated_at: r.updated_at, source: r.source,
    };
  }
  return out;
}

/** Average composition across all seeded models of a device type (used when the exact model is unknown). */
export function typeComposition(db: DatabaseSync, type: string): Composition | null {
  const rows = db.prepare('SELECT composition_json FROM device_model WHERE type = ?').all(type) as Row[];
  if (!rows.length) return null;
  const sum: Composition = {};
  for (const r of rows) for (const [m, g] of Object.entries(JSON.parse(r.composition_json) as Composition)) sum[m] = (sum[m] ?? 0) + g;
  for (const m of Object.keys(sum)) sum[m] = Math.round(sum[m] / rows.length);
  return sum;
}

/** Estimate by exact model if known, otherwise by device type. Returns null if neither is in the table. */
export function estimate(db: DatabaseSync, city: string, opts: { modelId?: string | null; type?: string }): Estimate | null {
  const rates = getRates(db, city);
  if (opts.modelId) {
    const m = db.prepare('SELECT composition_json FROM device_model WHERE id = ?').get(opts.modelId) as Row | undefined;
    if (m) return priceComposition(JSON.parse(m.composition_json), rates, 'model');
  }
  const comp = opts.type ? typeComposition(db, opts.type) : null;
  return comp ? priceComposition(comp, rates, 'type') : null;
}

/** Rows not updated within maxDays, for the auditor's stale-rate view. */
export function staleRates(db: DatabaseSync, now: Date, maxDays = 7): Row[] {
  const cutoff = new Date(now.getTime() - maxDays * 86400000).toISOString();
  return db.prepare('SELECT * FROM rate WHERE updated_at < ? ORDER BY updated_at').all(cutoff) as Row[];
}

/** Auditor edit: updates today's rate and records a history snapshot for that day. */
export function setRate(db: DatabaseSync, material: string, city: string, ratePerKg: number, source: string, now = new Date()) {
  if (!(ratePerKg > 0)) throw new Error('rate must be positive');
  const ts = now.toISOString();
  db.prepare('INSERT INTO rate VALUES (?,?,?,?,?) ON CONFLICT(material,city) DO UPDATE SET rate_per_kg=excluded.rate_per_kg, updated_at=excluded.updated_at, source=excluded.source')
    .run(material, city, ratePerKg, ts, source);
  db.prepare('INSERT INTO rate_history VALUES (?,?,?,?) ON CONFLICT(material,city,day) DO UPDATE SET rate_per_kg=excluded.rate_per_kg')
    .run(material, city, ts.slice(0, 10), ratePerKg);
}