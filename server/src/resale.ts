// Second-hand (buyback) values for WORKING devices, in INR, for a device in good condition.
// Checked against Indian buyback sites and resale price guides (Cashify, Cashkr, Edify, Budli), mid-2026.
// "good" is roughly what an online buyback service would pay. Prices move every month: an auditor should refresh them.
// fair = visible wear or weak battery; poor = cracked screen or major fault that still powers on.

export type ResaleCondition = 'good' | 'fair' | 'poor';
export const CONDITION_SHARE: Record<ResaleCondition, number> = { good: 1, fair: 0.75, poor: 0.45 };

export type ResaleModel = { id: string; type: string; brand: string; model: string; good: number; source: string };

export const RESALE: ResaleModel[] = [
  // Phones: Samsung
  { id: 'rs-s25-ultra', type: 'phone', brand: 'Samsung', model: 'Galaxy S25 Ultra', good: 70000, source: 'Cashkr / Cashify buyback, 2026' },
  { id: 'rs-s25-plus', type: 'phone', brand: 'Samsung', model: 'Galaxy S25+', good: 49000, source: 'Cashify buyback, 2026' },
  { id: 'rs-s25-fe', type: 'phone', brand: 'Samsung', model: 'Galaxy S25 FE', good: 41000, source: 'Cashify resale guide, 2026' },
  { id: 'rs-s24-ultra', type: 'phone', brand: 'Samsung', model: 'Galaxy S24 Ultra', good: 55000, source: 'Cashify resale guide, 2026' },
  { id: 'rs-a13', type: 'phone', brand: 'Samsung', model: 'Galaxy A13', good: 4600, source: 'Cashify buyback, 2026' },
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
  const base = m ? m.good * CONDITION_SHARE[cond] : opts.custom && opts.custom > 0 ? opts.custom : null;
  if (base === null) return null;
  const spread = m ? 0.15 : 0.25;
  const r = (n: number) => Math.round(n);
  return { model: m ?? null, condition: cond, total: r(base), low: r(base * (1 - spread)), high: r(base * (1 + spread)) };
}
