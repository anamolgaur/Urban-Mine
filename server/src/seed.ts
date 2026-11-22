import type { Db } from './db.ts';
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

/** Fill an empty database: reference data always, plus the demo people unless `reference: true`. Safe to call once per fresh db. */
export async function seed(db: Db, opts: { reference?: boolean } = {}): Promise<void> {
  await db.tx(async (t) => {
    if (!opts.reference) {
      for (const w of WORKSHOPS) await t.prepare('INSERT INTO workshop VALUES (?,?,?,?,?)').run(w.id, w.name, w.address, w.lat, w.lng);
      for (const u of USERS) await t.prepare('INSERT INTO app_user VALUES (?,?,?,?,?,?)').run(u.id, u.role, u.name, u.phone, u.language, u.workshop_id);
    }
    for (const m of MODELS)
      await t.prepare('INSERT INTO device_model VALUES (?,?,?,?,?,?,?,?)').run(m.id, m.type, m.brand, m.model, j(m.label_patterns), m.weight_kg, j(m.composition), m.repair_notes);
    const { rates, history } = seedRates();
    for (const r of rates) await t.prepare('INSERT INTO rate VALUES (?,?,?,?,?)').run(r.material, r.city, r.rate_per_kg, r.updated_at, r.source);
    for (const h of history) await t.prepare('INSERT INTO rate_history VALUES (?,?,?,?)').run(h.material, h.city, h.day, h.rate_per_kg);
    for (const p of PACKS)
      for (const lang of LANGS)
        await t.prepare('INSERT INTO safety_pack VALUES (?,?,?,?,?)').run(
          p.device_type, lang, j(localise({ gear: p.gear, steps: p.steps, emergency: EMERGENCY, draft_banner: DRAFT_BANNER }, lang)), SAFETY_VERSION, null);
    for (const g of GUIDES)
      await t.prepare('INSERT INTO repair_guide VALUES (?,?,?,?,?,?)').run(
        g.id, j(g.fault), g.device_type, g.difficulty, j(g.tools), j(g.steps));
    if (!opts.reference) for (const l of REPAIRER_LISTINGS)
      await t.prepare('INSERT INTO repairer_listing VALUES (?,?,?,?,?,?,?)').run(l.id, l.user_id, j(l.skills), l.area, l.start_price, l.hours, l.verified_count);
  });
}
