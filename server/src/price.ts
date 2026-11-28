import type { Db } from './db.ts';
import { applyCondition, type Grade } from './condition.ts';
import { PARTS_VALUE, PARTS_SOURCE, isTier } from './resale.ts';

type Row = Record<string, any>;
export type Composition = Record<string, number>; // material -> grams
export type RateInfo = { rate: number; prev: number | null; change: number | null; updated_at: string; source: string };
export type PriceLine = { material: string; grams: number; value: number };
export type Estimate = {
  lines: PriceLine[]; total: number; low: number; high: number;
  basis: 'model' | 'type' | 'parts'; sample: true; weight_kg: number;
  /** Dead phones and laptops: what they sell for per piece, for their parts. low/high above already include it. */
  parts?: { tier: string; low: number; high: number; metal_low: number; metal_high: number; source: string };
  /** Set when a photo-check grade scaled the range. The totals and material values above are not scaled. */
  condition?: { grade: Grade; factor: number };
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
export async function getRates(db: Db, city: string): Promise<Record<string, RateInfo>> {
  const out: Record<string, RateInfo> = {};
  for (const r of await db.prepare('SELECT * FROM rate WHERE city = ?').all(city) as Row[]) {
    const prev = await db.prepare('SELECT rate_per_kg FROM rate_history WHERE material=? AND city=? AND day < ? ORDER BY day DESC LIMIT 1')
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
export async function typeComposition(db: Db, type: string): Promise<Composition | null> {
  const rows = await db.prepare('SELECT composition_json FROM device_model WHERE type = ?').all(type) as Row[];
  if (!rows.length) return null;
  const sum: Composition = {};
  for (const r of rows) for (const [m, g] of Object.entries(JSON.parse(r.composition_json) as Composition)) sum[m] = (sum[m] ?? 0) + g;
  for (const m of Object.keys(sum)) sum[m] = Math.round(sum[m] / rows.length);
  return sum;
}

// Phone and tablet boards are high grade (gold, palladium); laptop and PC boards are not. Use the phone board rate when there is one.
const HIGH_GRADE_BOARD = new Set(['phone', 'tablet']);
const withBoardGrade = (rates: Record<string, RateInfo>, type?: string) =>
  type && HIGH_GRADE_BOARD.has(type) && rates.pcb_mobile ? { ...rates, pcb: rates.pcb_mobile } : rates;

// Dead phones and laptops sell per piece, for their parts; the metal value is only the floor.
const PARTS_TYPES: Record<string, string> = { phone: 'budget', laptop: 'basic' };
function withParts(e: Estimate, type: string | undefined, tier: unknown): Estimate {
  if (!type || !(type in PARTS_TYPES)) return e;
  const t = isTier(tier) && (type === 'laptop') === ['basic', 'business', 'premium'].includes(tier) ? tier : PARTS_TYPES[type];
  const band = PARTS_VALUE[t];
  const low = Math.max(e.low, band.low), high = Math.max(e.high, band.high);
  return { ...e, basis: 'parts', low, high, total: r2((low + high) / 2), parts: { tier: t, low: band.low, high: band.high, metal_low: e.low, metal_high: e.high, source: PARTS_SOURCE } };
}

/** Estimate by exact model if known, otherwise by device type. Returns null if neither is in the table. */
export async function estimate(db: Db, city: string, opts: { modelId?: string | null; type?: string; grade?: unknown; tier?: unknown }): Promise<Estimate | null> {
  const rates = await getRates(db, city);
  if (opts.modelId) {
    const m = await db.prepare('SELECT type, composition_json FROM device_model WHERE id = ?').get(opts.modelId) as Row | undefined;
    if (m) return applyCondition(withParts(priceComposition(JSON.parse(m.composition_json), withBoardGrade(rates, m.type), 'model'), m.type, opts.tier), opts.grade);
  }
  const comp = opts.type ? await typeComposition(db, opts.type) : null;
  return comp ? applyCondition(withParts(priceComposition(comp, withBoardGrade(rates, opts.type), 'type'), opts.type, opts.tier), opts.grade) : null;
}

/** Rows not updated within maxDays, for the auditor's stale-rate view. */
export async function staleRates(db: Db, now: Date, maxDays = 7): Promise<Row[]> {
  const cutoff = new Date(now.getTime() - maxDays * 86400000).toISOString();
  return await db.prepare('SELECT * FROM rate WHERE updated_at < ? ORDER BY updated_at').all(cutoff) as Row[];
}

/** Auditor edit: updates today's rate and records a history snapshot for that day. */
export async function setRate(db: Db, material: string, city: string, ratePerKg: number, source: string, now = new Date()) {
  if (!(ratePerKg > 0)) throw new Error('rate must be positive');
  const ts = now.toISOString();
  await db.prepare('INSERT INTO rate VALUES (?,?,?,?,?) ON CONFLICT(material,city) DO UPDATE SET rate_per_kg=excluded.rate_per_kg, updated_at=excluded.updated_at, source=excluded.source')
    .run(material, city, ratePerKg, ts, source);
  await db.prepare('INSERT INTO rate_history VALUES (?,?,?,?) ON CONFLICT(material,city,day) DO UPDATE SET rate_per_kg=excluded.rate_per_kg')
    .run(material, city, ts.slice(0, 10), ratePerKg);
}