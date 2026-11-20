import type { DatabaseSync } from 'node:sqlite';
import type { Buffer } from 'node:buffer';
import { randomUUID } from 'node:crypto';
import type { Classifier, Ocr } from './vision.ts';
import { loadModels, matchModel, type MatchResult } from './matcher.ts';

export type ScanInput = { userId: string; images: Buffer[]; photoRefs?: string[]; hint?: string };
export type ScanResult = { scanId: string; type: string; typeConfidence: number; ocrText: string; match: MatchResult };

export async function runScan(db: DatabaseSync, deps: { classifier: Classifier; ocr: Ocr }, input: ScanInput): Promise<ScanResult> {
  if (!input.images.length) throw new Error('at least one image is required');
  const [guess] = await deps.classifier.classify(input.images[0], input.hint);
  const ocrText = await deps.ocr.read(input.images[input.images.length - 1]);
  const known = guess.type === 'unknown' ? undefined : guess.type;
  const match = matchModel(ocrText, loadModels(db), { type: known });

  // A model match only sets the device type if the classifier had no better idea.
  const type = known ?? (match.kind === 'model' ? match.best.model.type : 'unknown');
  const scanId = randomUUID();
  db.prepare('INSERT INTO scan (id,user_id,type_pred,type_conf,model_id,model_conf,photos,ocr_text,created_at) VALUES (?,?,?,?,?,?,?,?,?)').run(
    scanId, input.userId, type, guess.confidence,
    match.kind === 'model' ? match.best.model.id : null, match.kind === 'model' ? match.best.confidence : null,
    JSON.stringify(input.photoRefs ?? []), ocrText, new Date().toISOString());
  return { scanId, type, typeConfidence: guess.confidence, ocrText, match };
}

/** Log a worker correction (e.g. field 'type' or 'model', predicted vs corrected). */
export function saveFeedback(db: DatabaseSync, scanId: string, field: 'type' | 'model', predicted: string | null, corrected: string | null) {
  const id = randomUUID();
  db.prepare('INSERT INTO feedback VALUES (?,?,?,?,?)').run(id, scanId, field, predicted, corrected);
  return id;
}