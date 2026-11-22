import type { Db } from './db.ts';
import type { Buffer } from 'node:buffer';
import { randomUUID } from 'node:crypto';
import type { Classifier, Ocr } from './vision.ts';
import { loadModels, matchModel, type MatchResult } from './matcher.ts';
import { matchResale, type ResaleMatch } from './resale.ts';

export type ScanInput = { userId: string; images: Buffer[]; photoRefs?: string[]; hint?: string };
export type ScanResult = { scanId: string; type: string; typeConfidence: number; ocrText: string; match: MatchResult;
  /** The exact model, read from text in the photos (label, box, or Settings > About phone), if it is in the price list. */
  resale: { id: string; brand: string; model: string; confidence: number; matched: string } | null };

export async function runScan(db: Db, deps: { classifier: Classifier; ocr: Ocr }, input: ScanInput): Promise<ScanResult> {
  if (!input.images.length) throw new Error('at least one image is required');
  const [guess] = await deps.classifier.classify(input.images[0], input.hint);
  // Read text from every photo, label photo first, and stop as soon as an exact model is found.
  const order = [input.images.length - 1, ...input.images.map((_, i) => i).slice(0, -1)];
  const texts: string[] = [];
  let found: ResaleMatch | null = null;
  for (const i of order) {
    const txt = await deps.ocr.read(input.images[i]);
    if (txt.trim()) texts.push(txt);
    found = matchResale(texts.join('\n'), input.hint && input.hint !== 'unknown' ? input.hint : null);
    if (found) break;
  }
  const ocrText = texts.join('\n');
  const known = guess.type === 'unknown' ? undefined : guess.type;
  const match = matchModel(ocrText, await loadModels(db), { type: known });

  // A model match only sets the device type if the classifier had no better idea.
  const type = known ?? (match.kind === 'model' ? match.best.model.type : match.candidates[0]?.model.type ?? 'unknown');
  const scanId = randomUUID();
  await db.prepare('INSERT INTO scan (id,user_id,type_pred,type_conf,model_id,model_conf,photos,ocr_text,created_at) VALUES (?,?,?,?,?,?,?,?,?)').run(
    scanId, input.userId, type, guess.confidence,
    match.kind === 'model' ? match.best.model.id : null, match.kind === 'model' ? match.best.confidence : null,
    JSON.stringify(input.photoRefs ?? []), ocrText, new Date().toISOString());
  const resale = found ? { id: found.model.id, brand: found.model.brand, model: found.model.model, confidence: found.confidence, matched: found.matched } : null;
  return { scanId, type: type === 'unknown' && found ? found.model.type : type, typeConfidence: guess.confidence, ocrText, match, resale };
}

/** Log a worker correction (field 'type', 'model' or 'condition', predicted vs corrected). */
export async function saveFeedback(db: Db, scanId: string, field: 'type' | 'model' | 'condition', predicted: string | null, corrected: string | null) {
  const id = randomUUID();
  await db.prepare('INSERT INTO feedback VALUES (?,?,?,?,?)').run(id, scanId, field, predicted, corrected);
  return id;
}