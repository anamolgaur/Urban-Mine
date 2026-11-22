// `npm run db:check`: confirms the database behind DATABASE_URL is reachable, migrated, and behaves (writes inside a transaction that is rolled back).
import { openDb } from './db.ts';

const url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL is not set (put it in server/.env).'); process.exit(1); }
const t0 = Date.now();
const db = await openDb({ url });
console.log(`connected and migrated in ${Date.now() - t0} ms`);
const v = await db.prepare('SELECT version() AS v').get();
console.log(String(v.v).split(',')[0]);
const tables = (await db.prepare("SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename").all());
console.log(`${tables.length} tables, row level security on for ${tables.filter((t) => t.rowsecurity).length}`);
const off = tables.filter((t) => !t.rowsecurity).map((t) => t.tablename);
if (off.length) console.log('WARNING: RLS is OFF for', off.join(', '));
class Undo extends Error {}
try {
  await db.tx(async (t) => {
    await t.prepare('INSERT INTO workshop VALUES (?,?,?,?,?)').run('check-ws', 'check', 'check', 1.5, 2.5);
    const r = await t.prepare('SELECT COUNT(*) c, MAX(lat) m FROM workshop WHERE id = ?').get('check-ws');
    if (r.c !== 1 || r.m !== 1.5 || typeof r.c !== 'number') throw new Error('unexpected types back from the database: ' + JSON.stringify(r));
    throw new Undo();
  });
} catch (e) { if (!(e instanceof Undo)) throw e; }
const left = await db.prepare("SELECT COUNT(*) c FROM workshop WHERE id = 'check-ws'").get();
console.log(left.c === 0 ? 'transaction write + rollback: OK' : 'ROLLBACK FAILED');
const users = await db.prepare('SELECT COUNT(*) c FROM app_user').get();
console.log(`app_user rows: ${users.c}${users.c === 0 ? ' (no accounts yet, which is fine: prices and guides load on the first start)' : ''}`);
await db.close();
