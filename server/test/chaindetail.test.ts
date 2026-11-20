import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDb } from '../src/db.ts';
import { seed } from '../src/seed.ts';
import { seedDemo } from '../src/demo.ts';
import { buildApp } from '../src/app.ts';

async function setup() {
  const db = openDb(':memory:');
  seed(db);
  const dir = mkdtempSync(join(tmpdir(), 'um-'));
  seedDemo(db, new Date(), dir);
  const app = await buildApp(db, { uploadsDir: dir, ocr: { read: async () => '' } });
  return { db, app, a: { 'x-user-id': 'u-auditor-1' } };
}

test('auditor detail reports hash and link checks, and shows tampering as a failed hash', async () => {
  const { db, app, a } = await setup();
  const id = (db.prepare("SELECT id FROM lot WHERE user_id = 'u-worker-1' ORDER BY rowid LIMIT 1").get() as any).id;
  let d = (await app.inject({ url: `/api/auditor/lots/${id}`, headers: a })).json();
  assert.deepEqual(d.chain, { hash_ok: true, link_ok: true });
  assert.equal(d.lot.chain_ok, true);

  db.prepare('UPDATE lot SET weight_kg = 99 WHERE id = ?').run(id);
  d = (await app.inject({ url: `/api/auditor/lots/${id}`, headers: a })).json();
  assert.equal(d.chain.hash_ok, false);
  assert.equal(d.lot.chain_ok, false);
  await app.close();
});
