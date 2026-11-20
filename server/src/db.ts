import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';

const schema = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');

/** Open a database ('' or ':memory:' for in-memory). Creates the tables only if they don't exist yet. */
export function openDb(path = 'urban-mine.db'): DatabaseSync {
  const db = new DatabaseSync(path || ':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  const exists = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='user'").get();
  if (!exists) db.exec(schema);
  // migration: older databases lack lot.held_from
  const cols = db.prepare('PRAGMA table_info(lot)').all() as { name: string }[];
  if (!cols.some((c) => c.name === 'held_from')) db.exec('ALTER TABLE lot ADD COLUMN held_from TEXT');
  return db;
}