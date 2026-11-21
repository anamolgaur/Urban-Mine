import { openDb, type Db } from '../src/db.ts';
import { seed } from '../src/seed.ts';
import { seedDemo } from '../src/demo.ts';

let shared: Db | undefined;

/**
 * A database holding SAMPLE data. One PGlite instance is kept per test file and wiped between calls,
 * because starting a new instance is slow. Tests in one file run one after another, so this is safe.
 */
export async function freshDb(opts: { demo?: boolean; seeded?: boolean } = {}): Promise<Db> {
  const { demo = true, seeded = true } = opts;
  shared ??= await openDb();
  const tables = (await shared.prepare("SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'schema_migrations'").all()).map((r) => `"${r.tablename}"`);
  await shared.exec(`TRUNCATE ${tables.join(', ')} RESTART IDENTITY CASCADE`);
  if (seeded) await seed(shared);
  if (seeded && demo) await seedDemo(shared);
  return shared;
}

/** A separate, private database for a test file that sets up once at module level (it must not share the wiped one above). */
export async function ownDb(opts: { demo?: boolean } = {}): Promise<Db> {
  const db = await openDb();
  await seed(db);
  if (opts.demo) await seedDemo(db);
  return db;
}
