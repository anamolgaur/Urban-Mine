import { existsSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { openDb, getMeta, setMeta, type Db } from './db.ts';
import { seed } from './seed.ts';
import { seedDemo } from './demo.ts';
import { buildApp } from './app.ts';
import { supabaseVerifier } from './auth.ts';
import { LocalPhotoStore, SupabasePhotoStore, type PhotoStore } from './photostore.ts';
import Anthropic from '@anthropic-ai/sdk';
import { ClaudeAssessor, UnavailableAssessor, type ConditionAssessor } from './condition.ts';

/** Bump when seed data changes: an older LOCAL sample database is discarded and reseeded on start. A DATABASE_URL database is never wiped. */
const SEED_VERSION = 9;
const DATABASE_URL = process.env.DATABASE_URL;
const DATA_DIR = process.env.PGLITE_DIR ?? '.data/urban-mine';
const PORT = Number(process.env.PORT ?? 3000);

// Photos: a private Supabase Storage bucket when the service key is set, otherwise local disk (dev).
const photos: PhotoStore = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? new SupabasePhotoStore({ url: process.env.SUPABASE_URL, serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY, bucket: process.env.PHOTO_BUCKET || 'photos' })
  : new LocalPhotoStore(resolve('uploads'), process.env.PHOTO_URL_SECRET);
console.log(photos instanceof SupabasePhotoStore ? 'Photos: private Supabase Storage bucket' : 'Photos: local disk (uploads/)' + (process.env.DATABASE_URL ? '. WARNING: most hosts wipe local disk on deploy; set SUPABASE_SERVICE_ROLE_KEY.' : ''));

// Photo check (condition grade): needs ANTHROPIC_API_KEY. Without it the app says the photo check is not available. VISION_MODEL picks the model.
const assessor: ConditionAssessor = process.env.ANTHROPIC_API_KEY
  ? new ClaudeAssessor(new Anthropic(), { model: process.env.VISION_MODEL })
  : new UnavailableAssessor();
console.log(assessor.available ? `Photo check: ${assessor.id} (photos are sent to Anthropic only after the worker agrees)` : 'Photo check: off (set ANTHROPIC_API_KEY to turn it on)');

async function fill(db: Db) {
  await seed(db);
  await seedDemo(db, new Date(), photos);
  await setMeta(db, 'seed_version', String(SEED_VERSION));
}

let db: Db;
if (DATABASE_URL) {
  db = await openDb({ url: DATABASE_URL });
  // "Seeded" is recorded in the database itself, not guessed from whether any user exists: an auditor created by hand on a fresh database must not stop the sample data loading.
  if (!(await getMeta(db, 'seed_version'))) {
    if (process.env.SEED_DEMO === '1') { await fill(db); console.log('No sample data yet: loaded it (SEED_DEMO=1).'); }
    else console.log('This database has no sample data. Start once with SEED_DEMO=1 to load it.');
  }
} else {
  // The local sample database can be left damaged when the dev server is killed abruptly (for example by a file-watch restart on Windows). It only holds SAMPLE data, so recreate it.
  try {
    db = await openDb({ dataDir: DATA_DIR });
  } catch (e) {
    console.warn(`The local sample database could not be opened (${String((e as Error).message).slice(0, 80)}). Recreating it.`);
    rmSync(DATA_DIR, { recursive: true, force: true });
    db = await openDb({ dataDir: DATA_DIR });
  }
  // An older sample database is thrown away and reloaded. One with no seed marker (for example only a hand-made auditor) is kept and gets the sample data added.
  const seeded = await getMeta(db, 'seed_version');
  if (seeded && seeded !== String(SEED_VERSION)) {
    await db.close();
    if (existsSync(DATA_DIR)) rmSync(DATA_DIR, { recursive: true, force: true });
    db = await openDb({ dataDir: DATA_DIR });
  }
  if (!(await getMeta(db, 'seed_version'))) await fill(db);
}

// Sign-in: Supabase Auth (phone OTP). The demo X-User-Id header is only accepted when explicitly enabled, or when no Supabase auth is configured outside production.
const verifier = process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY ? supabaseVerifier(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY) : undefined;
const demoLogin = process.env.DEMO_LOGIN ? process.env.DEMO_LOGIN === '1' : !verifier && process.env.NODE_ENV !== 'production';
console.log(verifier ? `Sign-in: Supabase phone OTP${demoLogin ? ' + DEMO LOGIN ENABLED' : ''}` : demoLogin ? 'Sign-in: DEMO LOGIN ONLY (set SUPABASE_URL and SUPABASE_ANON_KEY for real sign-in)' : 'WARNING: no sign-in configured, every request will be refused');
if (process.env.NODE_ENV === 'production' && !process.env.CORS_ORIGIN) console.warn('WARNING: CORS_ORIGIN is not set, so ANY website can call this API from a browser. Set it to your web app address.');
const app = await buildApp(db, { webDir: process.env.WEB_DIR || resolve('web/dist'), photos, assessor, visionDailyLimit: Number(process.env.VISION_DAILY_LIMIT) || undefined, verifier, demoLogin, corsOrigin: process.env.CORS_ORIGIN?.split(',').map((s) => s.trim()).filter(Boolean) });
await app.listen({ port: PORT, host: '0.0.0.0' });
console.log(`Urban Mine API on http://localhost:${PORT} (ALL DATA IS SAMPLE, ${DATABASE_URL ? 'Postgres via DATABASE_URL' : 'local PGlite at ' + DATA_DIR})`);

const stop = async () => { await app.close(); await db.close(); process.exit(0); };
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
