import type { DatabaseSync } from 'node:sqlite';
import { openDb } from './db.ts';
import { seedRates } from './seed/rates.ts';
import { MODELS } from './seed/models.ts';
import { WORKSHOPS, USERS, REPAIRER_LISTINGS } from './seed/users.ts';
import { PACKS, SAFETY_VERSION, EMERGENCY, DRAFT_BANNER } from './seed/safety.ts';
import { GUIDES } from './seed/repair.ts';

type Lang = 'en' | 'hi';
const LANGS: Lang[] = ['hi', 'en'];
const j = JSON.stringify;
// Recursively pick one language out of {en, hi} leaves.
function localise(v: unknown, lang: Lang): unknown {
  if (Array.isArray(v)) return v.map((x) => localise(x, lang));
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if (typeof o.en === 'string' && typeof o.hi === 'string') return o[lang];
    return Object.fromEntries(Object.entries(o).map(([k, x]) => [k, localise(x, lang)]));
  }
  return v;
}

/** Fill an empty database with SAMPLE data. Safe to call once per fresh db. */
export function seed(db: DatabaseSync): void {
  db.exec('BEGIN');
  try {
    for (const w of WORKSHOPS) db.prepare('INSERT INTO workshop VALUES (?,?,?,?,?)').run(w.id, w.name, w.address, w.lat, w.lng);
    for (const u of USERS) db.prepare('INSERT INTO user VALUES (?,?,?,?,?,?)').run(u.id, u.role, u.name, u.phone, u.language, u.workshop_id);
    for (const m of MODELS)
      db.prepare('INSERT INTO device_model VALUES (?,?,?,?,?,?,?,?)').run(m.id, m.type, m.brand, m.model, j(m.label_patterns), m.weight_kg, j(m.composition), m.repair_notes);
    const { rates, history } = seedRates();
    for (const r of rates) db.prepare('INSERT INTO rate VALUES (?,?,?,?,?)').run(r.material, r.city, r.rate_per_kg, r.updated_at, r.source);
    for (const h of history) db.prepare('INSERT INTO rate_history VALUES (?,?,?,?)').run(h.material, h.city, h.day, h.rate_per_kg);
    for (const p of PACKS)
      for (const lang of LANGS)
        db.prepare('INSERT INTO safety_pack VALUES (?,?,?,?,?)').run(
          p.device_type, lang, j(localise({ gear: p.gear, steps: p.steps, emergency: EMERGENCY, draft_banner: DRAFT_BANNER }, lang)), SAFETY_VERSION, null);
    for (const g of GUIDES)
      db.prepare('INSERT INTO repair_guide VALUES (?,?,?,?,?,?)').run(
        g.id, j(g.fault), g.device_type, g.difficulty, j(g.tools), j(g.steps));
    for (const l of REPAIRER_LISTINGS)
      db.prepare('INSERT INTO repairer_listing VALUES (?,?,?,?,?,?,?)').run(l.id, l.user_id, j(l.skills), l.area, l.start_price, l.hours, l.verified_count);
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

// CLI: `npm run seed` creates a fresh urban-mine.db.
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop()!)) {
  const { rmSync } = await import('node:fs');
  rmSync('urban-mine.db', { force: true });
  const db = openDb('urban-mine.db');
  seed(db);
  const count = (t: string) => (db.prepare(`SELECT COUNT(*) c FROM ${t}`).get() as { c: number }).c;
  console.log(['rate', 'device_model', 'safety_pack', 'repair_guide', 'user'].map((t) => `${t}: ${count(t)}`).join('\n'));
}
