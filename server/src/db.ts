import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import type { PGlite } from '@electric-sql/pglite';

// PGlite is a dev/test dependency: it is only imported when no DATABASE_URL is set, so a production install can leave it out.
const loadPglite = () => import('@electric-sql/pglite');

/** A loosely typed result row. Callers cast to the shape they expect. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Row = Record<string, any>;

export interface Stmt {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get(...params: any[]): Promise<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  all(...params: any[]): Promise<any[]>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  run(...params: any[]): Promise<{ changes: number }>;
}

/**
 * The only database interface the rest of the server uses. It is async and keeps the small
 * `prepare(sql).get/all/run(...params)` shape, with `?` placeholders (converted to $1, $2 ...).
 * Two engines sit behind it: PGlite (Postgres inside Node: tests and local dev) and `pg` (Supabase Postgres).
 */
export interface Db {
  prepare(sql: string): Stmt;
  /** Run one or more statements with no parameters (DDL, scripts). */
  exec(sql: string): Promise<void>;
  /** Run fn in a transaction: committed if it resolves, rolled back if it throws. Nested calls join the outer transaction. */
  tx<T>(fn: (db: Db) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

/** Turn `?` placeholders into $1, $2 ... and skip over quoted string literals. */
export function toPg(sql: string): string {
  let out = '';
  let n = 0;
  let quote = false;
  for (const ch of sql) {
    if (ch === "'") quote = !quote;
    out += ch === '?' && !quote ? `$${++n}` : ch;
  }
  return out;
}

type Runner = (sql: string, params: unknown[]) => Promise<{ rows: Row[]; changes: number }>;

function makeDb(run: Runner, exec: (sql: string) => Promise<void>, tx: <T>(fn: (db: Db) => Promise<T>) => Promise<T>, close: () => Promise<void>): Db {
  const clean = (p: unknown[]) => p.map((v) => (v === undefined ? null : v));
  return {
    prepare(sql) {
      const text = toPg(sql);
      return {
        get: async (...p) => (await run(text, clean(p))).rows[0],
        all: async (...p) => (await run(text, clean(p))).rows,
        run: async (...p) => ({ changes: (await run(text, clean(p))).changes }),
      };
    },
    exec,
    tx,
    close,
  };
}

// COUNT / SUM come back as bigint / numeric strings by default: turn them into JS numbers.
const INT8 = 20;
const NUMERIC = 1700;
pg.types.setTypeParser(INT8, (v) => Number(v));
pg.types.setTypeParser(NUMERIC, (v) => parseFloat(v));

function wrapPg(pool: pg.Pool): Db {
  const over = (c: pg.PoolClient | pg.Pool): Runner => async (sql, params) => {
    const r = await c.query(sql, params as unknown[]);
    return { rows: r.rows, changes: r.rowCount ?? 0 };
  };
  const inTx = (c: pg.PoolClient): Db => {
    const self: Db = makeDb(over(c), async (s) => { await c.query(s); }, (fn) => fn(self), async () => {});
    return self;
  };
  return makeDb(
    over(pool),
    async (s) => { await pool.query(s); },
    async (fn) => {
      const c = await pool.connect();
      try {
        await c.query('BEGIN');
        const out = await fn(inTx(c));
        await c.query('COMMIT');
        return out;
      } catch (e) {
        await c.query('ROLLBACK').catch(() => {});
        throw e;
      } finally {
        c.release();
      }
    },
    () => pool.end(),
  );
}

function wrapPglite(lite: PGlite): Db {
  type Q = { query: PGlite['query']; exec: PGlite['exec'] };
  const over = (q: Q): Runner => async (sql, params) => {
    const r = await q.query(sql, params);
    return { rows: r.rows as Row[], changes: r.affectedRows ?? 0 };
  };
  const inTx = (q: Q): Db => {
    const self: Db = makeDb(over(q), async (s) => { await q.exec(s); }, (fn) => fn(self), async () => {});
    return self;
  };
  return makeDb(
    over(lite),
    async (s) => { await lite.exec(s); },
    (fn) => lite.transaction((t) => fn(inTx(t as unknown as Q))),
    () => lite.close(),
  );
}

export type OpenOptions = {
  /** Postgres connection string (Supabase). When set, PGlite is not used. */
  url?: string;
  /** PGlite data directory. Omit, or pass '' or ':memory:', for an in-memory database. */
  dataDir?: string;
};

/** Open a database and apply any migrations that have not run yet. */
export async function openDb(opts: OpenOptions = {}): Promise<Db> {
  let db: Db;
  if (opts.url) {
    const local = /@(localhost|127\.0\.0\.1)[:/]/.test(opts.url);
    const ca = process.env.DATABASE_CA ? readFileSync(process.env.DATABASE_CA, 'utf8') : undefined;
    // Supabase needs TLS. Without DATABASE_CA we cannot verify the server certificate: set it for production.
    const ssl = local ? undefined : ca ? { ca, rejectUnauthorized: true } : { rejectUnauthorized: false };
    db = wrapPg(new pg.Pool({ connectionString: opts.url, ssl, max: Number(process.env.DATABASE_POOL_MAX ?? 10) }));
  } else {
    const mem = !opts.dataDir || opts.dataDir === ':memory:';
    // initdb takes ~15 s on a cold start, so a new database is cloned from a cached, already-migrated template (~2 s).
    const isNew = mem || !existsSync(opts.dataDir!);
    if (!mem) mkdirSync(dirname(opts.dataDir!), { recursive: true });
    const { PGlite, types: pgliteTypes } = await loadPglite();
    const lite = new PGlite(mem ? undefined : opts.dataDir, {
      loadDataDir: isNew ? await getTemplate() : undefined,
      parsers: { [pgliteTypes.INT8]: (v: string) => Number(v), [pgliteTypes.NUMERIC]: (v: string) => parseFloat(v) },
    });
    await lite.waitReady;
    db = wrapPglite(lite);
  }
  await migrate(db);
  return db;
}

const MIGRATIONS_DIR = fileURLToPath(new URL('../migrations/', import.meta.url));

/** Apply server/migrations/*.sql in name order, once each. Add a new numbered file for every schema change. */
export async function migrate(db: Db): Promise<string[]> {
  await db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)');
  const done = new Set((await db.prepare('SELECT name FROM schema_migrations').all()).map((r) => r.name as string));
  const applied: string[] = [];
  for (const file of readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort()) {
    if (done.has(file)) continue;
    const sql = readFileSync(MIGRATIONS_DIR + file, 'utf8');
    await db.tx(async (t) => {
      await t.exec(sql);
      await t.prepare('INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)').run(file, new Date().toISOString());
    });
    applied.push(file);
  }
  return applied;
}

export async function getMeta(db: Db, key: string): Promise<string | undefined> {
  return (await db.prepare('SELECT value FROM meta WHERE key = ?').get(key))?.value;
}

export async function setMeta(db: Db, key: string, value: string): Promise<void> {
  await db.prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value').run(key, value);
}

const TEMPLATE_DIR = process.env.PGLITE_TEMPLATE_DIR ?? '.data';

/** A PGlite data directory with every migration applied, cached on disk and rebuilt when a migration changes. */
export async function getTemplate(): Promise<Blob> {
  const h = createHash('sha1');
  for (const f of readdirSync(MIGRATIONS_DIR).filter((x) => x.endsWith('.sql')).sort()) h.update(f).update(readFileSync(MIGRATIONS_DIR + f));
  const file = `${TEMPLATE_DIR}/pglite-template-${h.digest('hex').slice(0, 12)}.tar`;
  if (existsSync(file)) return new Blob([readFileSync(file)]);
  const { PGlite } = await loadPglite();
  const lite = new PGlite();
  await lite.waitReady;
  const db = wrapPglite(lite);
  await migrate(db);
  const blob = (await lite.dumpDataDir('none')) as Blob;
  await lite.close();
  mkdirSync(TEMPLATE_DIR, { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, Buffer.from(await blob.arrayBuffer()));
  renameSync(tmp, file);
  return blob;
}
