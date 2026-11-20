import { createHash } from 'node:crypto';

export const GENESIS = '0'.repeat(64);

export type LotRecord = {
  user_id: string;
  items: unknown[];
  weight_kg: number;
  steps_done: number;
  steps_total: number;
  photo_hashes: string[];
  gps: { lat: number; lng: number } | null;
  created_at: string;
};

export type ChainedLot = LotRecord & { prev_hash: string; hash: string };

/** JSON with object keys sorted recursively, so equal data always serialises identically. */
export function canonicalJson(v: unknown): string {
  if (Array.isArray(v)) return '[' + v.map(canonicalJson).join(',') + ']';
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return '{' + Object.keys(o).sort().map((k) => JSON.stringify(k) + ':' + canonicalJson(o[k])).join(',') + '}';
  }
  return JSON.stringify(v) ?? 'null';
}

export function computeHash(prevHash: string, record: LotRecord): string {
  return createHash('sha256').update(prevHash + canonicalJson(record)).digest('hex');
}

/** Pull only the hashed fields out of a row, so extra columns (id, status) never affect the hash. */
export function recordOf(l: LotRecord): LotRecord {
  return {
    user_id: l.user_id, items: l.items, weight_kg: l.weight_kg, steps_done: l.steps_done,
    steps_total: l.steps_total, photo_hashes: l.photo_hashes, gps: l.gps, created_at: l.created_at,
  };
}

/** Lots must be one worker's, oldest first. Returns the index of the first bad lot, or -1 if the chain is intact. */
export function verifyChain(lots: ChainedLot[]): number {
  let prev = GENESIS;
  for (let i = 0; i < lots.length; i++) {
    if (lots[i].prev_hash !== prev || lots[i].hash !== computeHash(prev, recordOf(lots[i]))) return i;
    prev = lots[i].hash;
  }
  return -1;
}

export const shortHash = (h: string) => h.slice(0, 8);