// SAMPLE rates, INR per kg. Not market data. source labels follow the rate-table spec.
export type RateRow = { material: string; city: string; rate_per_kg: number; updated_at: string; source: string };

export const MATERIALS = ['copper', 'aluminium', 'steel', 'plastic', 'glass', 'pcb', 'pcb_mobile', 'battery_li'] as const;

// Checked against Indian scrap-rate trackers, mid-2026 (scraprates.in national averages, IndiaMart listings): copper ~610, iron ~33,
// plastic ~13, mixed circuit boards ~150-400. Aluminium is household-grade scrap. Glass has little or no buyer value.
// Updated Nov 2026 from IndiaMART listings: phone boards are high grade (Rs 550-5,000/kg, ~1,500 typical), so they get their own rate
// (pcb_mobile); laptop and PC boards stay ~300. Phone / laptop Li-ion battery scrap trades at Rs 250-350/kg.
const base: Record<string, number> = { copper: 610, aluminium: 150, steel: 33, plastic: 13, glass: 4, pcb: 300, pcb_mobile: 1500, battery_li: 250 };
const cityFactor: Record<string, number> = { Delhi: 1, Kolkata: 0.94 };
const yesterdayDelta: Record<string, number> = { copper: -6, aluminium: 2, steel: 0, plastic: 0, glass: 0, pcb: 40, pcb_mobile: 60, battery_li: -5 };

export const TODAY = '2026-11-20';
export const YESTERDAY = '2026-11-19';
const shiftDay = (day: string, n: number) => new Date(Date.parse(day + 'T00:00:00Z') + n * 86400_000).toISOString().slice(0, 10);

export function seedRates(): { rates: RateRow[]; history: { material: string; city: string; day: string; rate_per_kg: number }[] } {
  const rates: RateRow[] = [];
  const history: { material: string; city: string; day: string; rate_per_kg: number }[] = [];
  for (const city of Object.keys(cityFactor)) {
    for (const m of MATERIALS) {
      const today = Math.round(base[m] * cityFactor[city]);
      rates.push({ material: m, city, rate_per_kg: today, updated_at: `${TODAY}T06:00:00Z`, source: 'SAMPLE: recycler-published' });
      history.push({ material: m, city, day: TODAY, rate_per_kg: today });
      history.push({ material: m, city, day: YESTERDAY, rate_per_kg: today - yesterdayDelta[m] });
      // 28 earlier days of SAMPLE history: small, repeatable daily moves (no randomness, so tests stay stable)
      let v = today - yesterdayDelta[m];
      for (let d = 2; d < 30; d++) {
        const step = Math.round(Math.sin((d + m.length * 3) * 1.7) * base[m] * 0.012);
        v = Math.max(1, v - step);
        history.push({ material: m, city, day: shiftDay(TODAY, -d), rate_per_kg: v });
      }
    }
  }
  // One deliberately stale row so the auditor "stale rows" view has something to show.
  const stale = rates.find((r) => r.material === 'glass' && r.city === 'Kolkata')!;
  stale.updated_at = '2026-10-01T06:00:00Z';
  return { rates, history };
}
