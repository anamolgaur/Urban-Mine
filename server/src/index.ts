import { existsSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { openDb } from './db.ts';
import { seed } from './seed.ts';
import { seedDemo } from './demo.ts';
import { buildApp } from './app.ts';

const DB_FILE = 'urban-mine.db';
/** Bump when seed data changes: an older sample database is discarded and reseeded on start. */
const SEED_VERSION = 8;

if (existsSync(DB_FILE)) {
  const probe = new DatabaseSync(DB_FILE);
  const v = (probe.prepare('PRAGMA user_version').get() as { user_version: number }).user_version;
  probe.close();
  if (v !== SEED_VERSION) rmSync(DB_FILE, { force: true });
}

const db = openDb(DB_FILE);
if (!db.prepare('SELECT 1 FROM user LIMIT 1').get()) {
  seed(db);
  seedDemo(db, new Date(), resolve('uploads'));
  db.exec(`PRAGMA user_version = ${SEED_VERSION}`);
}

const app = await buildApp(db);
await app.listen({ port: 3000, host: '0.0.0.0' });
console.log('Urban Mine API on http://localhost:3000 (ALL DATA IS SAMPLE)');
