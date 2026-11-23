import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { freshDb } from './helpers.ts';
import { buildApp } from '../src/app.ts';
import { offensive } from '../src/moderation.ts';
import type { TokenVerifier } from '../src/auth.ts';

test('offensive words are caught, including disguised ones, and real names are not', () => {
  for (const bad of ['dildo sex shop', 'Hunta Sexy', 'Srijitbhosdamon', 'ngga', 'F.U.C.K', 'sh1t shop', 'b h o s d a', 'red light area, Kolkata', 'Chutiya Kabadi', 'मादरचोद', 'shiiiit']) {
    assert.equal(offensive(bad), true, bad);
  }
  for (const ok of ['Asha Devi', 'Ravi Kumar', 'Sanjay Chodankar', 'Hancock Traders', 'Sussex Road', 'Dickson Repairs', 'Grape Market', 'Randhir Singh', 'Salma Begum', 'लक्ष्मी देवी', 'Lane 4, Seelampur, Delhi', '', null, undefined]) {
    assert.equal(offensive(ok), false, String(ok));
  }
});

const people: Record<string, { sub: string; phone: string | null; email?: string | null }> = {
  'tok-troll': { sub: 'auth-t', phone: '+919811111111' },
  'tok-troll-again': { sub: 'auth-t2', phone: '+919811111111' },
  'tok-nice': { sub: 'auth-n', phone: '+919822222222' },
};
const verifier: TokenVerifier = { async verify(t) { const p = people[t]; if (!p) throw Object.assign(new Error('bad'), { statusCode: 401 }); return p; } };
const bearer = (t: string) => ({ authorization: `Bearer ${t}` });
const auditor = { 'x-user-id': 'u-auditor-1' };

async function setup() {
  const db = await freshDb();
  const deleted: string[] = [];
  const app = await buildApp(db, { verifier, demoLogin: true, uploadsDir: mkdtempSync(join(tmpdir(), 'um-')), ocr: { read: async () => '' }, authAdmin: { deleteUser: async (id) => { deleted.push(id); } } });
  return { db, app, deleted };
}
const body = (over: Record<string, unknown> = {}) => ({ role: 'worker', name: 'Asha', language: 'hi', consent: true, address: 'Lane 4', city: 'Delhi', workshop_name: 'Asha Scrap', ...over });

test('sign-up refuses offensive names, workshop names and addresses', async () => {
  const { app } = await setup();
  for (const over of [{ name: 'Hunta Sexy' }, { workshop_name: 'dildo sex shop' }, { address: 'red light area' }]) {
    const r = await app.inject({ method: 'POST', url: '/api/onboarding', headers: bearer('tok-troll'), payload: body(over) });
    assert.equal(r.statusCode, 400);
    assert.equal(r.json().code, 'offensive_name');
  }
  assert.equal((await app.inject({ method: 'POST', url: '/api/onboarding', headers: bearer('tok-nice'), payload: body() })).statusCode, 200);
});

test('an auditor removes an account: data gone, name blanked, sign-in deleted, phone blocked from signing up again', async () => {
  const { app, db, deleted } = await setup();
  const made = (await app.inject({ method: 'POST', url: '/api/onboarding', headers: bearer('tok-troll'), payload: body({ name: 'Troll Account' }) })).json();
  const flagged = (await app.inject({ url: '/api/auditor/workers', headers: auditor })).json();
  assert.ok(flagged.find((w: { id: string }) => w.id === made.id));
  // only auditors may remove
  assert.equal((await app.inject({ method: 'POST', url: `/api/auditor/users/${made.id}/remove`, headers: { 'x-user-id': 'u-worker-1' } })).statusCode, 403);
  const r = await app.inject({ method: 'POST', url: `/api/auditor/users/${made.id}/remove`, headers: auditor, payload: { reason: 'fake' } });
  assert.equal(r.statusCode, 200);
  const u = await db.prepare('SELECT name, phone, auth_id, approval FROM app_user WHERE id = ?').get(made.id);
  assert.deepEqual(u, { name: 'Removed account', phone: null, auth_id: null, approval: 'rejected' });
  assert.deepEqual(deleted, ['auth-t']);
  const list = (await app.inject({ url: '/api/auditor/workers', headers: auditor })).json();
  assert.equal(list.find((w: { id: string }) => w.id === made.id), undefined);
  // the same phone cannot make a new account
  const again = await app.inject({ method: 'POST', url: '/api/onboarding', headers: bearer('tok-troll-again'), payload: body({ name: 'Another Name' }) });
  assert.equal(again.statusCode, 403);
  assert.equal(again.json().code, 'banned');
  // auditors themselves cannot be removed this way
  assert.equal((await app.inject({ method: 'POST', url: '/api/auditor/users/u-auditor-1/remove', headers: auditor })).statusCode, 404);
});

test('the auditor lists mark offensive names', async () => {
  const { app, db } = await setup();
  await db.prepare("UPDATE app_user SET name = 'Srijitbhosdamon' WHERE id = 'u-recycler-2'").run();
  const recyclers = (await app.inject({ url: '/api/auditor/recyclers', headers: auditor })).json() as { id: string; name_flagged: boolean }[];
  assert.equal(recyclers.find((r) => r.id === 'u-recycler-2')?.name_flagged, true);
  assert.equal(recyclers.find((r) => r.id === 'u-recycler-1')?.name_flagged, false);
});

test('a lot weight over 1000 kg is refused', async () => {
  const { app } = await setup();
  const r = await app.inject({ method: 'POST', url: '/api/lots', headers: { 'x-user-id': 'u-worker-1' }, payload: { items: [{ type: 'phone' }], weight_kg: 99999, steps_done: 0, steps_total: 0, photo_hashes: [] } });
  assert.equal(r.statusCode, 400);
  assert.equal(r.json().code, 'bad_weight');
});
