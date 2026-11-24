import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { freshDb } from './helpers.ts';
import { buildApp } from '../src/app.ts';
import { ensureDemo } from '../src/demoaccounts.ts';

/** The live set-up: no X-User-Id shortcut, only real sign-ins and guest passes. */
async function setup(guestDemo = true) {
  const db = await freshDb();
  await ensureDemo(db);
  // a real worker with a lot on sale, and a real buyer: neither may meet the demo world
  await db.prepare("INSERT INTO app_user (id, role, name, language, approval, created_at) VALUES ('real-w', 'worker', 'Real Worker', 'hi', 'approved', '2026-01-01'), ('real-r', 'recycler', 'Real Buyer', 'en', 'approved', '2026-01-01')").run();
  await db.prepare("UPDATE lot SET user_id = 'real-w' WHERE id = (SELECT id FROM lot WHERE user_id = 'u-worker-2' AND status = 'listed' LIMIT 1)").run();
  const realLot = (await db.prepare("SELECT id FROM lot WHERE user_id = 'real-w'").get())?.id as string;
  const app = await buildApp(db, { demoLogin: false, guestDemo, guestSecret: 'test-secret', uploadsDir: mkdtempSync(join(tmpdir(), 'um-')), ocr: { read: async () => '' } });
  const pass = async (role: string) => (await app.inject({ method: 'POST', url: '/api/demo/guest', payload: { role } })).json().token as string;
  return { db, app, realLot, pass };
}
const as = (token: string) => ({ 'x-demo-guest': token });

test('anyone can start the demo as each role, without an account', async () => {
  const { app, pass } = await setup();
  for (const [role, home] of [['worker', 'u-worker-1'], ['recycler', 'u-recycler-1'], ['repairer', 'u-repairer-1'], ['auditor', 'u-auditor-1']]) {
    const me = (await app.inject({ url: '/api/me', headers: as(await pass(role)) })).json();
    assert.equal(me.user.id, home); assert.equal(me.demo, true);
  }
  assert.equal((await app.inject({ method: 'POST', url: '/api/demo/guest', payload: { role: 'admin' } })).statusCode, 400);
});

test('guest passes cannot be forged, reused after expiry, or pointed at a real account', async () => {
  const { app, pass } = await setup();
  const good = await pass('auditor');
  const [id, exp, sig] = good.split('.');
  const tries = [`real-w.${exp}.${sig}`, `u-auditor-75c01faf.${exp}.${sig}`, `${id}.${Number(exp) + 1}.${sig}`, `${id}.${exp}.${sig.slice(0, -2)}xx`, `${id}.1000000000000.${sig}`, 'garbage'];
  for (const t of tries) assert.equal((await app.inject({ url: '/api/me', headers: as(t) })).statusCode, 401, t);
});

test('the demo is off when guestDemo is off', async () => {
  const { app } = await setup(false);
  assert.equal((await app.inject({ method: 'POST', url: '/api/demo/guest', payload: { role: 'worker' } })).statusCode, 404);
});

test('demo and real worlds never mix', async () => {
  const { app, realLot, pass } = await setup();
  const buyer = as(await pass('recycler'));
  const market = (await app.inject({ url: '/api/market/lots', headers: buyer })).json() as { id: string }[];
  assert.ok(market.length > 0);
  assert.equal(market.some((l) => l.id === realLot), false, 'demo buyer does not see real lots');
  assert.equal((await app.inject({ method: 'POST', url: `/api/lots/${realLot}/bids`, headers: buyer, payload: { amount: 99999 } })).statusCode, 404);

  const aud = as(await pass('auditor'));
  const overview = (await app.inject({ url: '/api/auditor/overview', headers: aud })).json() as { lots: { id: string; user_id: string }[] };
  assert.equal(overview.lots.some((l) => l.id === realLot), false);
  assert.equal((await app.inject({ url: `/api/auditor/lots/${realLot}`, headers: aud })).statusCode, 404);
  assert.equal((await app.inject({ method: 'POST', url: `/api/auditor/lots/${realLot}/hold`, headers: aud })).statusCode, 404);
  const workers = (await app.inject({ url: '/api/auditor/workers', headers: aud })).json() as { id: string }[];
  assert.equal(workers.some((w) => w.id === 'real-w'), false);
  assert.equal((await app.inject({ method: 'POST', url: '/api/auditor/users/real-w/remove', headers: aud })).statusCode, 404);
  assert.equal((await app.inject({ method: 'POST', url: '/api/auditor/users/real-r/approval', headers: aud, payload: { decision: 'rejected' } })).statusCode, 404);
  assert.ok(!(await app.inject({ url: '/api/auditor/export.csv', headers: aud })).body.includes('Real Worker'));
  // shared settings are read-only for the demo auditor
  const rates = await app.inject({ method: 'PUT', url: '/api/auditor/rates', headers: aud, payload: { material: 'copper', city: 'Delhi', rate_per_kg: 1 } });
  assert.equal(rates.statusCode, 403); assert.equal(rates.json().code, 'demo_readonly');
  // the demo repairer is only shown to demo workers
  const demoList = (await app.inject({ url: '/api/repair/listings', headers: as(await pass('worker')) })).json() as { user_id: string }[];
  assert.ok(demoList.length > 0 && demoList.every((l) => l.user_id === 'u-repairer-1'));
  const publicList = (await app.inject({ url: '/api/repair/listings' })).json() as { user_id: string }[];
  assert.equal(publicList.some((l) => l.user_id === 'u-repairer-1'), false);
});

test('starting the demo repairs it if someone removed a demo account', async () => {
  const { app, db, pass } = await setup();
  await db.prepare("UPDATE app_user SET approval = 'rejected', name = 'Removed account' WHERE id = 'u-worker-1'").run();
  const me = (await app.inject({ url: '/api/me', headers: as(await pass('worker')) })).json();
  assert.equal(me.user.name, 'Asha Devi (demo)');
});
