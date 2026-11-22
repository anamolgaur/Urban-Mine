import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { freshDb } from './helpers.ts';
import { buildApp } from '../src/app.ts';
import { supabaseVerifier, e164, type TokenVerifier } from '../src/auth.ts';

/** Tokens are made up here: a real deployment verifies them with Supabase. */
const people: Record<string, { sub: string; phone: string | null; email?: string | null }> = {
  'tok-new-worker': { sub: 'auth-1', phone: '+919811111111' },
  'tok-new-recycler': { sub: 'auth-2', phone: '+919822222222' },
  'tok-new-repairer': { sub: 'auth-3', phone: '+919833333333' },
  'tok-auditor': { sub: 'auth-9', phone: '+919899999999' },
};
const verifier: TokenVerifier = {
  async verify(token) {
    const p = people[token];
    if (!p) throw Object.assign(new Error('bad token'), { statusCode: 401, appCode: 'unauthenticated' });
    return p;
  },
};
const bearer = (t: string) => ({ authorization: `Bearer ${t}` });

async function setup(opts: { demoLogin?: boolean } = {}) {
  const db = await freshDb();
  const app = await buildApp(db, { verifier, demoLogin: opts.demoLogin, uploadsDir: mkdtempSync(join(tmpdir(), 'um-')), ocr: { read: async () => '' } });
  return { db, app };
}
const workerBody = { role: 'worker', name: 'Test Worker', language: 'ta', consent: true, address: '12 Main Road', city: 'Delhi', workshop_name: 'Test shop' };

test('no token, or a bad token, is refused', async () => {
  const { app } = await setup();
  assert.equal((await app.inject({ url: '/api/me' })).statusCode, 401);
  assert.equal((await app.inject({ url: '/api/me', headers: bearer('nope') })).statusCode, 401);
  assert.equal((await app.inject({ url: '/api/lots', headers: bearer('nope') })).statusCode, 401);
});

test('a signed-in phone with no account is told to onboard, and cannot use the app yet', async () => {
  const { app } = await setup();
  const me = await app.inject({ url: '/api/me', headers: bearer('tok-new-worker') });
  assert.equal(me.statusCode, 200);
  assert.deepEqual(me.json(), { user: null, needs_onboarding: true, phone: '+919811111111', email: null });
  const lots = await app.inject({ url: '/api/lots', headers: bearer('tok-new-worker') });
  assert.equal(lots.statusCode, 403);
  assert.equal(lots.json().code, 'needs_onboarding');
});

test('onboarding a worker creates an approved account with a workshop, once', async () => {
  const { app, db } = await setup();
  const h = bearer('tok-new-worker');
  const r = await app.inject({ method: 'POST', url: '/api/onboarding', headers: h, payload: workerBody });
  assert.equal(r.statusCode, 200);
  assert.equal(r.json().approval, 'approved');
  const me = (await app.inject({ url: '/api/me', headers: h })).json();
  assert.equal(me.user.role, 'worker');
  assert.equal(me.user.name, 'Test Worker');
  assert.equal(me.user.phone, '+919811111111');
  assert.equal(me.user.kyc_status, 'simulated');
  assert.ok(me.user.consented_at);
  assert.equal(me.user.auth_id, undefined, 'the auth id is never sent to the app');
  assert.equal(me.city, 'Delhi');
  assert.match(me.workshop.address, /12 Main Road, Delhi/);
  assert.equal(me.workshop.lat, null);
  assert.equal((await app.inject({ url: '/api/lots', headers: h })).statusCode, 200);
  // the role is fixed: a second onboarding, even asking for another role, is refused
  const again = await app.inject({ method: 'POST', url: '/api/onboarding', headers: h, payload: { ...workerBody, role: 'recycler' } });
  assert.equal(again.statusCode, 409);
  assert.equal(((await db.prepare("SELECT role FROM app_user WHERE auth_id = 'auth-1'").get()) as { role: string }).role, 'worker');
});

test('onboarding validates its input', async () => {
  const { app } = await setup();
  const h = bearer('tok-new-worker');
  const post = async (payload: object) => (await app.inject({ method: 'POST', url: '/api/onboarding', headers: h, payload })).statusCode;
  assert.equal(await post({ ...workerBody, role: 'auditor' }), 400, 'nobody can sign up as an auditor');
  assert.equal(await post({ ...workerBody, role: 'admin' }), 400);
  assert.equal(await post({ ...workerBody, consent: false }), 400);
  assert.equal(await post({ ...workerBody, consent: undefined }), 400);
  assert.equal(await post({ ...workerBody, name: ' a ' }), 400);
  assert.equal(await post({ ...workerBody, address: '' }), 400);
  assert.equal(await post({ ...workerBody, city: 'Atlantis' }), 400);
  assert.equal((await app.inject({ url: '/api/me', headers: h })).json().needs_onboarding, true, 'nothing was created by the failed attempts');
});

test('recyclers and repairers wait for an auditor; approval unlocks them, rejection keeps them out', async () => {
  const { app, db } = await setup();
  const rec = bearer('tok-new-recycler');
  const r = await app.inject({ method: 'POST', url: '/api/onboarding', headers: rec, payload: { role: 'recycler', name: 'Green Recyclers', language: 'en', consent: true } });
  assert.equal(r.json().approval, 'pending');
  const me = (await app.inject({ url: '/api/me', headers: rec })).json();
  assert.equal(me.user.approval, 'pending');
  assert.equal(me.workshop, null);
  const blocked = await app.inject({ url: '/api/market/lots', headers: rec });
  assert.equal(blocked.statusCode, 403);
  assert.equal(blocked.json().code, 'pending_approval');
  assert.equal((await app.inject({ method: 'POST', url: '/api/lots/x/bids', headers: rec, payload: { amount: 5 } })).statusCode, 403);

  // an auditor (the sample auditor, signed in by phone) sees the request
  await db.prepare("UPDATE app_user SET auth_id = 'auth-9' WHERE id = 'u-auditor-1'").run();
  const aud = bearer('tok-auditor');
  const pending = (await app.inject({ url: '/api/auditor/approvals', headers: aud })).json();
  assert.equal(pending.length, 1);
  assert.equal(pending[0].name, 'Green Recyclers');
  const uid = pending[0].id as string;
  assert.equal((await app.inject({ method: 'POST', url: `/api/auditor/users/${uid}/approval`, headers: aud, payload: { decision: 'maybe' } })).statusCode, 400);
  assert.equal((await app.inject({ method: 'POST', url: `/api/auditor/users/${uid}/approval`, headers: aud, payload: { decision: 'rejected' } })).statusCode, 200);
  const rej = await app.inject({ url: '/api/market/lots', headers: rec });
  assert.equal(rej.statusCode, 403);
  assert.equal(rej.json().code, 'rejected');
  assert.equal((await app.inject({ method: 'POST', url: `/api/auditor/users/${uid}/approval`, headers: aud, payload: { decision: 'approved' } })).statusCode, 200);
  assert.equal((await app.inject({ url: '/api/market/lots', headers: rec })).statusCode, 200);
  assert.equal((await app.inject({ url: '/api/auditor/approvals', headers: aud })).json().length, 0);
});

test('only auditors can approve; a worker cannot approve themselves or anyone', async () => {
  const { app } = await setup();
  const rec = bearer('tok-new-recycler');
  const id = (await app.inject({ method: 'POST', url: '/api/onboarding', headers: rec, payload: { role: 'recycler', name: 'Green Recyclers', language: 'en', consent: true } })).json().id;
  const w = bearer('tok-new-worker');
  await app.inject({ method: 'POST', url: '/api/onboarding', headers: w, payload: workerBody });
  assert.equal((await app.inject({ method: 'POST', url: `/api/auditor/users/${id}/approval`, headers: w, payload: { decision: 'approved' } })).statusCode, 403);
  assert.equal((await app.inject({ method: 'POST', url: `/api/auditor/users/${id}/approval`, headers: rec, payload: { decision: 'approved' } })).statusCode, 403);
  assert.equal((await app.inject({ url: '/api/me', headers: rec })).json().user.approval, 'pending');
});

test('a pre-provisioned auditor attaches to their phone number at first sign-in; sample accounts cannot be claimed', async () => {
  const { app, db } = await setup();
  await db.prepare("INSERT INTO app_user (id, role, name, phone, language, approval) VALUES ('u-auditor-x', 'auditor', 'Real Auditor', '+919899999999', 'en', 'approved')").run();
  const me = (await app.inject({ url: '/api/me', headers: bearer('tok-auditor') })).json();
  assert.equal(me.user.role, 'auditor');
  assert.equal(me.user.id, 'u-auditor-x');
  assert.equal(((await db.prepare("SELECT auth_id FROM app_user WHERE id = 'u-auditor-x'").get()) as { auth_id: string }).auth_id, 'auth-9');
  assert.equal((await app.inject({ url: '/api/auditor/overview', headers: bearer('tok-auditor') })).statusCode, 200);
  // a stranger whose number is the 10 digit sample number does not become the sample worker
  people['tok-stranger'] = { sub: 'auth-77', phone: '+919000000001' };
  assert.equal((await app.inject({ url: '/api/me', headers: bearer('tok-stranger') })).json().needs_onboarding, true);
});

test('the demo header only works when demo login is on', async () => {
  const off = await setup({ demoLogin: false });
  assert.equal((await off.app.inject({ url: '/api/lots', headers: { 'x-user-id': 'u-worker-1' } })).statusCode, 401);
  assert.deepEqual((await off.app.inject({ url: '/api/users' })).json(), [], 'the list of sample users is hidden');
  const on = await setup({ demoLogin: true });
  assert.equal((await on.app.inject({ url: '/api/lots', headers: { 'x-user-id': 'u-worker-1' } })).statusCode, 200);
  assert.ok((await on.app.inject({ url: '/api/users' })).json().length >= 6);
});

test('fake offers are a demo feature and are refused when demo login is off', async () => {
  const { app } = await setup();
  const w = bearer('tok-new-worker');
  await app.inject({ method: 'POST', url: '/api/onboarding', headers: w, payload: workerBody });
  const res = await app.inject({ method: 'POST', url: '/api/demo/offers/anything', headers: w });
  assert.equal(res.statusCode, 404);
});

test('deleting my data detaches the sign-in, so the same phone can start fresh', async () => {
  const { app, db } = await setup();
  const w = bearer('tok-new-worker');
  await app.inject({ method: 'POST', url: '/api/onboarding', headers: w, payload: workerBody });
  assert.equal((await app.inject({ method: 'DELETE', url: '/api/me/data', headers: w })).statusCode, 200);
  const row = (await db.prepare("SELECT name, phone, auth_id FROM app_user WHERE name = 'Deleted user' AND id LIKE 'u-%' ORDER BY created_at DESC LIMIT 1").get()) as Record<string, unknown>;
  assert.equal(row.phone, null);
  assert.equal(row.auth_id, null);
  assert.equal((await app.inject({ url: '/api/me', headers: w })).json().needs_onboarding, true);
  assert.equal((await app.inject({ method: 'POST', url: '/api/onboarding', headers: w, payload: workerBody })).statusCode, 200);
});

test('phone numbers become E.164', () => {
  assert.equal(e164('919876543210'), '+919876543210');
  assert.equal(e164('+91 98765-43210'), '+919876543210');
  assert.equal(e164(''), null);
  assert.equal(e164(undefined), null);
});

test('the Supabase verifier asks Supabase who the token is, caches, and maps failures', async () => {
  let calls = 0;
  const mk = (status: number, body: unknown = {}) => supabaseVerifier('https://x.supabase.co/', 'anon', {
    fetchFn: (async (url: string, init: RequestInit) => {
      calls++;
      assert.equal(url, 'https://x.supabase.co/auth/v1/user');
      assert.equal((init.headers as Record<string, string>).apikey, 'anon');
      return new Response(JSON.stringify(body), { status });
    }) as unknown as typeof fetch,
  });
  const ok = mk(200, { id: 'abc', phone: '919876543210' });
  assert.deepEqual(await ok.verify('t1'), { sub: 'abc', phone: '+919876543210', email: null });
  await ok.verify('t1');
  assert.equal(calls, 1, 'second call is served from the cache');
  await assert.rejects(() => mk(401).verify('t2'), (e: { statusCode: number }) => e.statusCode === 401);
  await assert.rejects(() => mk(500).verify('t3'), (e: { statusCode: number }) => e.statusCode === 503);
  await assert.rejects(() => mk(200, {}).verify('t4'), (e: { statusCode: number }) => e.statusCode === 401);
});

test('an email sign-in onboards, and a pre-made auditor attaches by email', async () => {
  const { app, db } = await setup();
  people['tok-email'] = { sub: 'auth-e1', phone: null, email: 'asha@example.com' };
  const me = (await app.inject({ url: '/api/me', headers: bearer('tok-email') })).json();
  assert.deepEqual([me.needs_onboarding, me.email], [true, 'asha@example.com']);
  const r = await app.inject({ method: 'POST', url: '/api/onboarding', headers: bearer('tok-email'), payload: workerBody });
  assert.equal(r.statusCode, 200, r.body);
  assert.equal(((await db.prepare("SELECT email FROM app_user WHERE auth_id = 'auth-e1'").get()) as { email: string }).email, 'asha@example.com');
  await db.prepare("INSERT INTO app_user (id, role, name, email, language, approval, kyc_status) VALUES ('u-aud-e','auditor','Aud','boss@example.com','en','approved','simulated')").run();
  people['tok-boss'] = { sub: 'auth-e2', phone: null, email: 'boss@example.com' };
  assert.equal((await app.inject({ url: '/api/me', headers: bearer('tok-boss') })).json().user.role, 'auditor');
});

test('nobody can take over a demo account by signing up with its phone number', async () => {
  const { app } = await setup();
  people['tok-thief'] = { sub: 'auth-thief', phone: '+919000000031', email: null }; // the demo auditor's number
  const me = (await app.inject({ url: '/api/me', headers: bearer('tok-thief') })).json();
  assert.equal(me.user, null, 'gets a fresh account to set up, not the demo auditor');
});
