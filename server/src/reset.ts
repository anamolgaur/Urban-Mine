// `npm run seed`: wipe all rows and reload the SAMPLE data. Local PGlite is reset freely; a DATABASE_URL database needs CONFIRM_RESET=yes.
import { resolve } from 'node:path';
import { LocalPhotoStore, SupabasePhotoStore } from './photostore.ts';
import { openDb, setMeta } from './db.ts';
import { seed } from './seed.ts';
import { seedDemo } from './demo.ts';

const url = process.env.DATABASE_URL;
if (url && process.env.CONFIRM_RESET !== 'yes') {
  console.error('Refusing to wipe the database behind DATABASE_URL. Set CONFIRM_RESET=yes to confirm this deletes ALL its data.');
  process.exit(1);
}
const db = await openDb(url ? { url } : { dataDir: process.env.PGLITE_DIR ?? '.data/urban-mine' });
const tables = (await db.prepare("SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'schema_migrations'").all()).map((r) => `"${r.tablename}"`);
await db.exec(`TRUNCATE ${tables.join(', ')} RESTART IDENTITY CASCADE`);
await seed(db);
await seedDemo(db, new Date(), process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? new SupabasePhotoStore({ url: process.env.SUPABASE_URL, serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY, bucket: process.env.PHOTO_BUCKET || 'photos' })
  : new LocalPhotoStore(resolve('uploads')));
await setMeta(db, 'seed_version', 'reset');
const count = async (t: string) => ((await db.prepare(`SELECT COUNT(*) c FROM ${t}`).get()) as { c: number }).c;
for (const t of ['rate', 'device_model', 'safety_pack', 'repair_guide', 'app_user', 'lot']) console.log(`${t}: ${await count(t)}`);
await db.close();
