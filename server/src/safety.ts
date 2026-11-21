import type { Db } from './db.ts';

export type Lang = 'hi' | 'en';
export const isLang = (v: unknown): v is Lang => v === 'hi' || v === 'en';

export type SafetyStep = {
  id: string; title: string; drawing: string; instruction: string;
  do: string[]; dont: string[]; photo_required: boolean;
};
export type SafetyPack = {
  device_type: string; language: Lang; version: string;
  draft: boolean;               // true until a named reviewer signs off
  reviewed_by: string | null;
  draft_banner: string; emergency: string; gear: string[]; steps: SafetyStep[];
};

export async function getSafetyPack(db: Db, deviceType: string, lang: Lang): Promise<SafetyPack | null> {
  const r = await db.prepare('SELECT * FROM safety_pack WHERE device_type = ? AND language = ?').get(deviceType, lang) as Record<string, any> | undefined;
  if (!r) return null;
  const body = JSON.parse(r.steps_json);
  return { device_type: r.device_type, language: r.language, version: r.version, reviewed_by: r.reviewed_by, draft: r.reviewed_by === null, ...body };
}

export async function listSafetyTypes(db: Db): Promise<string[]> {
  return (await db.prepare('SELECT DISTINCT device_type FROM safety_pack ORDER BY device_type').all() as { device_type: string }[]).map((r) => r.device_type);
}

// ---- progress through a pack (immutable updates) ----
export type Progress = { done: Record<string, { photo_hash?: string }> };
export const newProgress = (): Progress => ({ done: {} });
export const stepsDone = (p: Progress) => Object.keys(p.done).length;

export function nextStep(pack: SafetyPack, p: Progress): SafetyStep | null {
  return pack.steps.find((s) => !(s.id in p.done)) ?? null;
}

export function completeStep(pack: SafetyPack, p: Progress, stepId: string, photoHash?: string): Progress {
  const step = pack.steps.find((s) => s.id === stepId);
  if (!step) throw new Error(`Unknown step: ${stepId}`);
  if (stepId in p.done) return p; // completing twice is harmless
  if (nextStep(pack, p)?.id !== stepId) throw new Error('Steps must be done in order');
  if (step.photo_required && !photoHash) throw new Error('This step needs a photo');
  return { done: { ...p.done, [stepId]: photoHash ? { photo_hash: photoHash } : {} } };
}