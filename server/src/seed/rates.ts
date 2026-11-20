// SAMPLE rates, INR per kg. Not market data. source labels follow the rate-table spec.
export type RateRow = { material: string; city: string; rate_per_kg: number; updated_at: string; source: string };

export const MATERIALS = ['copper', 'aluminium', 'steel', 'plastic', 'glass', 'pcb', 'battery_li'] as const;

const base: Record<string, number> = { copper: 640, aluminium: 150, steel: 28, plastic: 12, glass: 4, pcb: 1800, battery_li: 90 };
const cityFactor: Record<string, number> = { Delhi: 1, Kolkata: 0.94 };
const yesterdayDelta: Record<string, number> = { copper: -6, aluminium: 2, steel: 0, plastic: 0, glass: 0, pcb: 40, battery_li: -3 };

export const TODAY = '2026-11-20';
export const YESTERDAY = '2026-11-19';

export function seedRates(): { rates: RateRow[]; history: { material: string; city: string; day: string; rate_per_kg: number }[] } {
  const rates: RateRow[] = [];
  const history: { material: string; city: string; day: string; rate_per_kg: number }[] = [];
  for (const city of Object.keys(cityFactor)) {
    for (const m of MATERIALS) {
      const today = Math.round(base[m] * cityFactor[city]);
      rates.push({ material: m, city, rate_per_kg: today, updated_at: `${TODAY}T06:00:00Z`, source: 'SAMPLE: recycler-published' });
      history.push({ material: m, city, day: TODAY, rate_per_kg: today });
      history.push({ material: m, city, day: YESTERDAY, rate_per_kg: today - yesterdayDelta[m] });
    }
  }
  // One deliberately stale row so the auditor "stale rows" view has something to show.
  const stale = rates.find((r) => r.material === 'glass' && r.city === 'Kolkata')!;
  stale.updated_at = '2026-10-01T06:00:00Z';
  return { rates, history };
}
