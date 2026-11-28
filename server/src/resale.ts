// Second-hand (buyback) values for WORKING devices, in INR, for a device in good condition.
// Checked against Indian buyback sites and resale price guides (Cashify, Cashkr, Edify, Budli), mid-2026.
// "good" is roughly what an online buyback service would pay. Prices move every month: an auditor should refresh them.
// fair = visible wear or weak battery; poor = cracked screen or major fault that still powers on.

export type ResaleCondition = 'good' | 'fair' | 'poor';
export const CONDITION_SHARE: Record<ResaleCondition, number> = { good: 1, fair: 0.75, poor: 0.45 };
/** When the prices in this file were last checked. Shown on the price screen. */
export const PRICES_CHECKED = '2026-11';
export type Tier = 'keypad' | 'budget' | 'mid' | 'flagship';
export type LaptopTier = 'basic' | 'business' | 'premium';
export type Age = 'new' | 'mid' | 'old'; // under 1 year, 1 to 3 years, over 3 years

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
  { id: 'rs-latitude', type: 'laptop', brand: 'Dell', model: 'Latitude (Core i5, 8th–10th gen)', codes: ['latitude'], good: 14000, source: 'Edify refurbished price index, 2026' },
  { id: 'rs-thinkpad', type: 'laptop', brand: 'Lenovo', model: 'ThinkPad T / E series (Core i5)', codes: ['thinkpad'], good: 12000, source: 'Edify refurbished price index, 2026' },
  { id: 'rs-elitebook', type: 'laptop', brand: 'HP', model: 'EliteBook / ProBook (Core i5)', codes: ['elitebook', 'probook'], good: 15000, source: 'Edify second-hand guide, 2026' },
  { id: 'rs-mba-m1', type: 'laptop', brand: 'Apple', model: 'MacBook Air M1', codes: ['macbook air', 'a2337'], good: 28000, source: 'TechEnclave used listings, 2026' },
  // Everyday laptops: Cashify / Cashkr top buyback ("up to") quotes, 2026. "good" sits just under the top quote.
  { id: 'rs-ideapad', type: 'laptop', brand: 'Lenovo', model: 'IdeaPad (Slim 3 / 5)', codes: ['ideapad'], good: 12000, source: 'Cashify buyback: IdeaPad Slim 3i up to Rs 17,330, IdeaPad 5 up to Rs 12,500, 2026' },
  { id: 'rs-aspire', type: 'laptop', brand: 'Acer', model: 'Aspire (3 / 5)', codes: ['aspire'], good: 11000, source: 'Cashify buyback: Aspire 5 up to Rs 13,740, 2026' },
  { id: 'rs-vivobook', type: 'laptop', brand: 'Asus', model: 'VivoBook (14 / 15)', codes: ['vivobook', 'x51[3-5]'], good: 8500, source: 'Cashify up to Rs 9,250; Cashkr up to Rs 10,000, 2026' },
  { id: 'rs-pavilion', type: 'laptop', brand: 'HP', model: 'Pavilion (Core i3 / i5)', codes: ['pavilion'], good: 9000, source: 'Consumer tier: keeps 30-40% of new price (Edify, 2026); in line with VivoBook / Aspire buyback' },
  { id: 'rs-inspiron', type: 'laptop', brand: 'Dell', model: 'Inspiron (Core i3 / i5)', codes: ['inspiron'], good: 9000, source: 'Consumer tier: keeps 30-40% of new price (Edify, 2026); in line with VivoBook / Aspire buyback' },
  { id: 'rs-laptop-basic', type: 'laptop', brand: 'Any', model: 'Basic home laptop (Core i3 / older)', good: 7000, source: 'Edify / TechEnclave lower band, 2026' },
  // India's best-selling brands, added Nov 2026. Cashify "Get upto" quote for the base variant, checked 28 Nov 2026.
  { id: 'rs-vivo-v60', type: 'phone', brand: 'Vivo', model: 'V60', good: 23330, source: 'Cashify buyback, Nov 2026' },
  { id: 'rs-vivo-v50', type: 'phone', brand: 'Vivo', model: 'V50', good: 21010, source: 'Cashify buyback, Nov 2026' },
  { id: 'rs-vivo-v29', type: 'phone', brand: 'Vivo', model: 'V29', good: 18720, source: 'Cashify buyback, Nov 2026' },
  { id: 'rs-vivo-v25', type: 'phone', brand: 'Vivo', model: 'V25 5G', good: 9730, source: 'Cashify buyback, Nov 2026' },
  { id: 'rs-vivo-v17', type: 'phone', brand: 'Vivo', model: 'V17', good: 5380, source: 'Cashify buyback, Nov 2026' },
  { id: 'rs-vivo-x100', type: 'phone', brand: 'Vivo', model: 'X100', good: 27150, source: 'Cashify buyback, Nov 2026' },
  { id: 'rs-vivo-y51a', type: 'phone', brand: 'Vivo', model: 'Y51A', good: 4650, source: 'Cashify buyback, Nov 2026' },
  { id: 'rs-vivo-y50', type: 'phone', brand: 'Vivo', model: 'Y50', good: 5240, source: 'Cashify buyback, Nov 2026' },
  { id: 'rs-vivo-y91i', type: 'phone', brand: 'Vivo', model: 'Y91i', good: 1570, source: 'Cashify buyback, Nov 2026' },
  { id: 'rs-vivo-s1', type: 'phone', brand: 'Vivo', model: 'S1', good: 4060, source: 'Cashify buyback, Nov 2026' },
  { id: 'rs-iqoo-12', type: 'phone', brand: 'iQOO', model: 'iQOO 12', good: 25480, source: 'Cashify buyback, Nov 2026' },
  { id: 'rs-iqoo-z7-pro', type: 'phone', brand: 'iQOO', model: 'Z7 Pro', good: 12960, source: 'Cashify buyback, Nov 2026' },
  { id: 'rs-iqoo-z7', type: 'phone', brand: 'iQOO', model: 'Z7', good: 8520, source: 'Cashify buyback, Nov 2026' },
  { id: 'rs-moto-g85', type: 'phone', brand: 'Motorola', model: 'Moto G85', good: 12400, source: 'Cashify buyback, Nov 2026' },
  { id: 'rs-moto-g52', type: 'phone', brand: 'Motorola', model: 'Moto G52', good: 4890, source: 'Cashify buyback, Nov 2026' },
  { id: 'rs-moto-g5g', type: 'phone', brand: 'Motorola', model: 'Moto G 5G', good: 4960, source: 'Cashify buyback, Nov 2026' },
  { id: 'rs-moto-g30', type: 'phone', brand: 'Motorola', model: 'Moto G30', good: 3180, source: 'Cashify buyback, Nov 2026' },
  { id: 'rs-moto-g7-power', type: 'phone', brand: 'Motorola', model: 'Moto G7 Power', good: 1970, source: 'Cashify buyback, Nov 2026' },
  { id: 'rs-moto-g6', type: 'phone', brand: 'Motorola', model: 'Moto G6', good: 1210, source: 'Cashify buyback, Nov 2026' },
  { id: 'rs-oppo-reno12-pro', type: 'phone', brand: 'OPPO', model: 'Reno12 Pro', good: 19260, source: 'Cashify buyback, Nov 2026' },
  { id: 'rs-oppo-reno11', type: 'phone', brand: 'OPPO', model: 'Reno11', good: 15410, source: 'Cashify buyback, Nov 2026' },
  { id: 'rs-oppo-reno8t', type: 'phone', brand: 'OPPO', model: 'Reno8T', good: 11560, source: 'Cashify buyback, Nov 2026' },
  { id: 'rs-oppo-reno7', type: 'phone', brand: 'OPPO', model: 'Reno7 5G', good: 8910, source: 'Cashify buyback, Nov 2026' },
  { id: 'rs-oppo-reno6', type: 'phone', brand: 'OPPO', model: 'Reno6 5G', good: 8180, source: 'Cashify buyback, Nov 2026' },
  { id: 'rs-oppo-f17', type: 'phone', brand: 'OPPO', model: 'F17', good: 5110, source: 'Cashify buyback, Nov 2026' },
  { id: 'rs-oppo-a17', type: 'phone', brand: 'OPPO', model: 'A17', good: 3980, source: 'Cashify buyback, Nov 2026' },
  { id: 'rs-a55', type: 'phone', brand: 'Samsung', model: 'Galaxy A55', codes: ['sm-a556'], good: 15990, source: 'Cashify buyback, Nov 2026' },
  { id: 'rs-a35', type: 'phone', brand: 'Samsung', model: 'Galaxy A35', codes: ['sm-a356'], good: 13230, source: 'Cashify buyback, Nov 2026' },
  { id: 'rs-a34', type: 'phone', brand: 'Samsung', model: 'Galaxy A34', codes: ['sm-a346'], good: 10090, source: 'Cashify buyback, Nov 2026' },
  { id: 'rs-note12-pro-plus', type: 'phone', brand: 'Xiaomi', model: 'Redmi Note 12 Pro+', codes: ['redmi note 12 pro\\s*(\\+|plus)'], good: 12650, source: 'Cashify buyback, Nov 2026' },
  { id: 'rs-note12-5g', type: 'phone', brand: 'Xiaomi', model: 'Redmi Note 12 5G', good: 8740, source: 'Cashify buyback, Nov 2026' },
  { id: 'rs-redmi12-5g', type: 'phone', brand: 'Xiaomi', model: 'Redmi 12 5G', good: 8480, source: 'Cashify buyback, Nov 2026' },
];

/** Tier of a listed model, from its top buyback quote (used to pick the parts value when it is dead). */
export const tierOf = (m: ResaleModel): Tier | LaptopTier =>
  m.type === 'laptop' ? (m.good >= 25000 ? 'premium' : m.good >= 11000 ? 'business' : 'basic')
    : m.good >= 25000 ? 'flagship' : m.good >= 9000 ? 'mid' : 'budget';

/**
 * Rough value of a WORKING phone or laptop that is not in the list, from its price tier when new and its age.
 * Fitted to the Cashify quotes above: e.g. mid-range phones 1-3 years old fetch Rs 9,000-19,000 (Galaxy A35, Vivo V29),
 * budget phones 3+ years old Rs 1,500-4,000 (Moto G30, OPPO A17). iPhones keep more of their value (Cashkr 2026: a 2-year-old
 * iPhone keeps 40-60% of its price, Android flagships 20-35%), so Apple gets x1.3. A wide band, never an exact price.
 */
export const BAND_VALUE: Record<string, Record<Age, number>> = {
  keypad: { new: 600, mid: 400, old: 250 },
  budget: { new: 7500, mid: 5000, old: 2500 },
  mid: { new: 17000, mid: 12000, old: 6000 },
  flagship: { new: 50000, mid: 30000, old: 12000 },
  basic: { new: 14000, mid: 9000, old: 5000 },
  business: { new: 18000, mid: 12000, old: 7000 },
  premium: { new: 45000, mid: 30000, old: 15000 },
};
export const BAND_SOURCE = 'Rough band from Cashify / Cashkr buyback quotes, Nov 2026';
export type Band = { tier: string; age: Age; brand?: string };
export function parseBand(v: unknown): Band | null {
  if (!v || typeof v !== 'string') return null;
  const [tier, age, brand] = v.split(':');
  if (!(tier in BAND_VALUE) || !['new', 'mid', 'old'].includes(age)) return null;
  return { tier, age: age as Age, brand: brand ? brand.slice(0, 20) : undefined };
}

export const isResaleCondition = (c: unknown): c is ResaleCondition => c === 'good' || c === 'fair' || c === 'poor';

/** Value range for a working device. `custom` is the worker's own price for a model that is not listed. */
export function resaleRange(opts: { resaleId?: string | null; condition?: unknown; custom?: number | null; band?: unknown }) {
  const cond: ResaleCondition = isResaleCondition(opts.condition) ? opts.condition : 'good';
  const m = opts.resaleId ? RESALE.find((r) => r.id === opts.resaleId) : undefined;
  const band = m ? null : parseBand(opts.band);
  let base: number | null = null
  if (m) base = m.good * CONDITION_SHARE[cond];
  else if (band) base = BAND_VALUE[band.tier][band.age] * (band.brand?.toLowerCase() === 'apple' ? 1.3 : 1) * CONDITION_SHARE[cond];
  else if (opts.custom && opts.custom > 0 && opts.custom <= 1_000_000) base = opts.custom;
  if (base === null) return null;
  const spread = m ? 0.15 : band ? 0.3 : 0.25;
  const r = (n: number) => Math.round(n);
  return { model: m ?? null, band, condition: cond, total: r(base), low: r(base * (1 - spread)), high: r(base * (1 + spread)), source: m ? m.source : band ? BAND_SOURCE : null };
}

/**
 * What a DEAD device sells for per piece, for its parts (screen, battery, camera, port, chips are reused by repair shops).
 * From IndiaMART trader listings, Nov 2026: keypad / China phones Rs 40-80 a piece, branded smartphones Rs 100-300,
 * Android / 4G phones bought for parts up to Rs 950-1,200; laptop scrap Rs 200-1,000 per kg (about 2 kg a laptop).
 * Prices vary a lot by city and buyer: a band, never an exact price. The metal value is the floor.
 */
export const PARTS_VALUE: Record<string, { low: number; high: number }> = {
  keypad: { low: 40, high: 80 },
  budget: { low: 100, high: 300 },
  mid: { low: 300, high: 700 },
  flagship: { low: 700, high: 1500 },
  basic: { low: 400, high: 900 },
  business: { low: 600, high: 1300 },
  premium: { low: 900, high: 2000 },
};
export const PARTS_SOURCE = 'Market estimate from IndiaMART trader listings, Nov 2026';
export const isTier = (t: unknown): t is string => typeof t === 'string' && t in PARTS_VALUE;

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
