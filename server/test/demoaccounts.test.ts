import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { freshDb } from './helpers.ts';
import { buildApp } from '../src/app.ts';
import { ensureDemo, resetDemo, DEMO_ACCOUNTS } from '../src/demoaccounts.ts';

const setup = async () => {
  const db = await freshDb();
  await ensureDemo(db);
  const app = await buildApp(db, { demoLogin: true, uploadsDir: mkdtempSync(join(tmpdir(), 'um-')), ocr: { read: async () => '' }, authAdmin: { deleteUser: async () => { throw new Error('demo sign-ins must never be deleted'); } } });
  return { db, app };
};
const as = (id: string) => ({ 'x-user-id': id });

test('every demo account exists, with the right role and approval, and /api/me says it is a demo', async () => {
  const { db, app } = await setup();
  for (const a of DEMO_ACCOUNTS) {
    const u = await db.prepare('SELECT role, approval, email FROM app_user WHERE id = ?').get(a.id);
    assert.deepEqual(u, { role: a.role, approval: a.approval, email: a.email }, a.id);
  }
  assert.equal((await app.inject({ url: '/api/me', headers: as('u-worker-3') })).json().demo, true);
  await db.prepare("INSERT INTO app_user (id, role, name, language, approval, created_at) VALUES ('u-real', 'worker', 'Real Person', 'hi', 'approved', '2026-01-01')").run();
  assert.equal((await app.inject({ url: '/api/me', headers: as('u-real') })).json().demo, false);
});

test('a demo auditor resets the demo: extra lots go, removed demo accounts come back, real accounts are untouched', async () => {
  const { db, app } = await setup();
  const before = (await db.prepare("SELECT COUNT(*)::int AS n FROM lot WHERE user_id = 'u-worker-1'").get()).n;
  const realLots = (await db.prepare("SELECT COUNT(*)::int AS n FROM lot WHERE user_id NOT LIKE 'u-%'").get()).n;
  await app.inject({ method: 'POST', url: '/api/lots', headers: as('u-worker-1'), payload: { items: [{ type: 'phone' }], weight_kg: 1, steps_done: 0, steps_total: 0, photo_hashes: [] } });
  // a panel member removes a demo buyer: it is blanked, but its sign-in is not deleted and nothing is blocked
  assert.equal((await app.inject({ method: 'POST', url: '/api/auditor/users/u-recycler-2/remove', headers: as('u-auditor-1') })).statusCode, 200);
  assert.equal((await db.prepare('SELECT COUNT(*)::int AS n FROM banned_identity').get()).n, 0);
  // only a demo auditor may reset
  assert.equal((await app.inject({ method: 'POST', url: '/api/demo/reset', headers: as('u-worker-1') })).statusCode, 403);
  assert.equal((await app.inject({ method: 'POST', url: '/api/demo/reset', headers: as('u-auditor-1') })).statusCode, 200);
  assert.equal((await db.prepare("SELECT COUNT(*)::int AS n FROM lot WHERE user_id = 'u-worker-1'").get()).n, before);
  assert.equal((await db.prepare("SELECT name, approval FROM app_user WHERE id = 'u-recycler-2'").get()).name, 'Eastern E-Waste Co. (demo)');
  assert.equal((await db.prepare("SELECT COUNT(*)::int AS n FROM lot WHERE user_id NOT LIKE 'u-%'").get()).n, realLots);
  await resetDemo(db); // twice in a row is fine
});
