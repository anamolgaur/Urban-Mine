import type { Db } from './db.ts';

export type ModelRef = { id: string; type: string; brand: string; model: string; label_patterns: string[] };
export type Candidate = { model: ModelRef; confidence: number; matched: string[] };
export type MatchResult =
  | { kind: 'model'; best: Candidate; candidates: Candidate[] }
  | { kind: 'type_only'; reason: 'no_match' | 'low_confidence' | 'ambiguous'; candidates: Candidate[] };

export const MIN_CONFIDENCE = 0.6;
export const MAX_CONFIDENCE = 0.9; // never present a guess as certain
const AMBIGUITY_GAP = 0.1;

export async function loadModels(db: Db): Promise<ModelRef[]> {
  return (await db.prepare('SELECT id, type, brand, model, label_patterns FROM device_model').all() as Record<string, any>[])
    .map((r) => ({ id: r.id, type: r.type, brand: r.brand, model: r.model, label_patterns: JSON.parse(r.label_patterns) }));
}

/** Lowercase, drop punctuation OCR tends to add, collapse whitespace (keeps letters, digits, hyphen). */
export function normalise(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\- ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export function matchModel(ocrText: string, models: ModelRef[], opts: { type?: string } = {}): MatchResult {
  const text = normalise(ocrText);
  const candidates: Candidate[] = [];
  for (const m of models) {
    if (opts.type && m.type !== opts.type) continue;
    const hits: string[] = [];
    for (const p of m.label_patterns) {
      const hit = new RegExp(p, 'i').exec(text);
      if (hit) hits.push(hit[0]);
    }
    if (!hits.length) continue;
    const first = 0.6 + Math.min(hits[0].length, 15) * 0.01;
    const confidence = Math.min(MAX_CONFIDENCE, first + 0.15 * (hits.length - 1));
    candidates.push({ model: m, confidence: Math.round(confidence * 100) / 100, matched: hits });
  }
  candidates.sort((a, b) => b.confidence - a.confidence);

  if (!candidates.length) return { kind: 'type_only', reason: 'no_match', candidates };
  const [best, second] = candidates;
  if (best.confidence < MIN_CONFIDENCE) return { kind: 'type_only', reason: 'low_confidence', candidates };
  if (second && best.confidence - second.confidence < AMBIGUITY_GAP) return { kind: 'type_only', reason: 'ambiguous', candidates };
  return { kind: 'model', best, candidates };
}