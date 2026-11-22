// Second-hand (buyback) values for WORKING devices, in INR, for a device in good condition.
// Checked against Indian buyback sites and resale price guides (Cashify, Cashkr, Edify, Budli), mid-2026.
// "good" is roughly what an online buyback service would pay. Prices move every month: an auditor should refresh them.
// fair = visible wear or weak battery; poor = cracked screen or major fault that still powers on.

export type ResaleCondition = 'good' | 'fair' | 'poor';
export const CONDITION_SHARE: Record<ResaleCondition, number> = { good: 1, fair: 0.75, poor: 0.45 };

export type ResaleModel = { id: string; type: string; brand: string; model: string; good: number; source: string; /** extra text to recognise it by, e.g. Samsung model codes */ codes?: string[] };

export const RESALE: ResaleModel[] = [
  // Phones: Samsung
  { id: 'rs-s25-ultra', type: 'phone', brand: 'Samsung', model: 'Galaxy S25 Ultra', codes: ['sm-s938'], good: 70000, source: 'Cashkr / Cashify buyback, 2026' },
  { id: 'rs-s25-plus', type: 'phone', brand: 'Samsung', model: 'Galaxy S25+', codes: ['sm-s936', 'galaxy s25\\s*(\\+|plus)'], good: 49000, source: 'Cashify buyback, 2026' },
  { id: 'rs-s25-fe', type: 'phone', brand: 'Samsung', model: 'Galaxy S25 FE', good: 41000, source: 'Cashify resale guide, 2026' },
  { id: 'rs-s24-ultra', type: 'phone', brand: 'Samsung', model: 'Galaxy S24 Ultra', codes: ['sm-s928'], good: 55000, source: 'Cashify resale guide, 2026' },
  { id: 'rs-a13', type: 'phone', brand: 'Samsung', model: 'Galaxy A13', codes: ['sm-a135', 'sm-a137'], good: 4600, source: 'Cashify buyback, 2026' },
  // Phones: Apple
  { id: 'rs-ip15-pm', type: 'phone', brand: 'Apple', model: 'iPhone 15 Pro Max', good: 60000, source: 'Cashkr used-price guide, 2026' },
  { id: 'rs-ip15-pro', type: 'phone', brand: 'Apple', model: 'iPhone 15 Pro', good: 52000, source: 'Cashkr resale guide, 2026' },
  { id: 'rs-ip15', type: 'phone', brand: 'Apple', model: 'iPhone 15', good: 32000, source: 'Cashkr used-price guide, 2026' },
  { id: 'rs-ip14-pm', type: 'phone', brand: 'Apple', model: 'iPhone 14 Pro Max', good: 52000, source: 'Cashkr resale guide, 2026' },
  { id: 'rs-ip14-pro', type: 'phone', brand: 'Apple', model: 'iPhone 14 Pro', good: 38000, source: 'Cashkr used-price guide, 2026' },
  { id: 'rs-ip14', type: 'phone', brand: 'Apple', model: 'iPhone 14', good: 28000, source: 'Cashkr resale guide, 2026' },
  { id: 'rs-ip13-pro', type: 'phone', brand: 'Apple', model: 'iPhone 13 Pro', good: 32000, source: 'Cashkr resale guide, 2026' },
  { id: 'rs-ip13', type: 'phone', brand: 'Apple', model: 'iPhone 13', good: 22000, source: 'Cashkr resale guide, 2026' },
  // Phones: others
  { id: 'rs-note13', type: 'phone', brand: 'Xiaomi', model: 'Redmi Note 13 5G', good: 10500, source: 'Cashify buyback, 2026' },
  // More common models in India (Cashify / Cashkr buyback "get up to" prices, 2026)
  { id: 'rs-s23-ultra', type: 'phone', brand: 'Samsung', model: 'Galaxy S23 Ultra', codes: ['sm-s918'], good: 40000, source: 'Estimated from Cashify refurbished price, 2026' },
  { id: 'rs-a14-5g', type: 'phone', brand: 'Samsung', model: 'Galaxy A14 5G', codes: ['sm-a146'], good: 8500, source: 'Cashify buyback, 2026' },
  { id: 'rs-m14', type: 'phone', brand: 'Samsung', model: 'Galaxy M14', codes: ['sm-m146'], good: 5700, source: 'Cashkr buyback, 2026' },
  { id: 'rs-ip12-pm', type: 'phone', brand: 'Apple', model: 'iPhone 12 Pro Max', good: 28000, source: 'Cashkr resale guide, 2026' },
  { id: 'rs-ip12', type: 'phone', brand: 'Apple', model: 'iPhone 12', good: 16000, source: 'Cashkr resale guide, 2026' },
  { id: 'rs-ip11', type: 'phone', brand: 'Apple', model: 'iPhone 11', good: 13000, source: 'Grest / Cashkr used prices, 2026' },
  { id: 'rs-redmi13-5g', type: 'phone', brand: 'Xiaomi', model: 'Redmi 13 5G', good: 8800, source: 'Cashify buyback, 2026' },
  { id: 'rs-nordce3lite', type: 'phone', brand: 'OnePlus', model: 'Nord CE 3 Lite', good: 11900, source: 'Cashify buyback, 2026' },
  { id: 'rs-nordce3', type: 'phone', brand: 'OnePlus', model: 'Nord CE 3', good: 13700, source: 'Cashify buyback, 2026' },
  { id: 'rs-realme13pro-plus', type: 'phone', brand: 'Realme', model: '13 Pro+', codes: ['realme 13 pro\\s*(\\+|plus)'], good: 17000, source: 'Cashify buyback, 2026' },
  { id: 'rs-realme13pro', type: 'phone', brand: 'Realme', model: '13 Pro', good: 14100, source: 'Cashify buyback, 2026' },
  { id: 'rs-realme-c25', type: 'phone', brand: 'Realme', model: 'C25', good: 3600, source: 'Cashify buyback, 2026' },
  { id: 'rs-realme-c3', type: 'phone', brand: 'Realme', model: 'C3', good: 3600, source: 'Cashify buyback, 2026' },
  { id: 'rs-realme-c21y', type: 'phone', brand: 'Realme', model: 'C21Y', good: 3000, source: 'Cashify buyback, 2026' },
  { id: 'rs-oppo-a15s', type: 'phone', brand: 'OPPO', model: 'A15s', good: 4000, source: 'Cashify buyback, 2026' },
  { id: 'rs-oppo-a15', type: 'phone', brand: 'OPPO', model: 'A15', good: 3300, source: 'Cashify buyback, 2026' },
  // Laptops (used business laptops sell for about half the certified-refurbished retail price)
  { id: 'rs-latitude', type: 'laptop', brand: 'Dell', model: 'Latitude (Core i5, 8th–10th gen)', good: 14000, source: 'Edify refurbished price index, 2026' },
  { id: 'rs-thinkpad', type: 'laptop', brand: 'Lenovo', model: 'ThinkPad T / E series (Core i5)', good: 12000, source: 'Edify refurbished price index, 2026' },
  { id: 'rs-elitebook', type: 'laptop', brand: 'HP', model: 'EliteBook / ProBook (Core i5)', good: 15000, source: 'Edify second-hand guide, 2026' },
  { id: 'rs-mba-m1', type: 'laptop', brand: 'Apple', model: 'MacBook Air M1', good: 28000, source: 'TechEnclave used listings, 2026' },
  { id: 'rs-laptop-basic', type: 'laptop', brand: 'Any', model: 'Basic home laptop (Core i3 / older)', good: 7000, source: 'Edify / TechEnclave lower band, 2026' },
];

export const isResaleCondition = (c: unknown): c is ResaleCondition => c === 'good' || c === 'fair' || c === 'poor';

/** Value range for a working device. `custom` is the worker's own price for a model that is not listed. */
export function resaleRange(opts: { resaleId?: string | null; condition?: unknown; custom?: number | null }) {
  const cond: ResaleCondition = isResaleCondition(opts.condition) ? opts.condition : 'good';
  const m = opts.resaleId ? RESALE.find((r) => r.id === opts.resaleId) : undefined;
  const base = m ? m.good * CONDITION_SHARE[cond] : opts.custom && opts.custom > 0 && opts.custom <= 1_000_000 ? opts.custom : null;
  if (base === null) return null;
  const spread = m ? 0.15 : 0.25;
  const r = (n: number) => Math.round(n);
  return { model: m ?? null, condition: cond, total: r(base), low: r(base * (1 - spread)), high: r(base * (1 + spread)) };
}

/** Words of a model name as a tolerant regex: "Galaxy S25 Ultra" matches "galaxy s25ultra", "GALAXY S25 ULTRA". */
const nameRegex = (m: ResaleModel, withBrand: boolean) => {
  const words = `${withBrand && m.brand !== 'Any' ? m.brand : ''} ${m.model}`.toLowerCase().replace(/[()+]/g, ' ').split(/\s+/).filter(Boolean)
    .filter((w) => !['apple', 'xiaomi', 'core', 'i5', 'gen', 'series'].includes(w)) // brand words often missing from labels
  return words.map((w) => w.replace(/[.*?^${}|[\]\\]/g, '\\$&')).join('\\s*')
}

export type ResaleMatch = { model: ResaleModel; confidence: number; matched: string }

/**
 * Find the exact model from text read off the photos (label, box, or a photo of Settings > About phone).
 * The longest match wins, so "Galaxy S25 Ultra" beats "Galaxy S25". Returns null if nothing in the list is named.
 */
export function matchResale(text: string, type?: string | null): ResaleMatch | null {
  const t = ' ' + text.toLowerCase().replace(/[^a-z0-9+\- ]+/g, ' ').replace(/\s+/g, ' ') + ' '
  let best: ResaleMatch | null = null
  for (const m of RESALE) {
    if (type && m.type !== type) continue
    if (m.brand === 'Any') continue
    const pats: [string, boolean][] = [[nameRegex(m, true), true], [nameRegex(m, false), true], ...(m.codes ?? []).map((c): [string, boolean] => [c, false])]
    for (const [p, whole] of pats) {
      // names must end at a word boundary (so "iPhone 12" does not match "iPhone 12 Pro"); codes may carry a suffix (SM-S938B)
      const hit = new RegExp(`(?:^|[^a-z0-9])(${p})${whole ? '(?![a-z0-9])' : ''}`, 'i').exec(t)
      if (!hit) continue
      const len = hit[1].replace(/\s/g, '').length
      if (!best || len > best.matched.replace(/\s/g, '').length) best = { model: m, confidence: Math.min(0.9, 0.55 + len * 0.02), matched: hit[1] }
    }
  }
  return best
}
