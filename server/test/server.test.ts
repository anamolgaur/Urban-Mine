import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../src/db.ts';
import { seed } from '../src/seed.ts';
import { getSafetyPack, listSafetyTypes, newProgress, completeStep, stepsDone, nextStep } from '../src/safety.ts';
import { buildApp } from '../src/app.ts';

const db = openDb(':memory:');
seed(db);

test('pack loads in Hindi and English, flagged as draft', () => {
  const hi = getSafetyPack(db, 'phone', 'hi')!;
  const en = getSafetyPack(db, 'phone', 'en')!;
  assert.match(hi.steps[0].title, /[\u0900-\u097F]/);
  assert.doesNotMatch(en.steps[0].title, /[\u0900-\u097F]/);
  assert.equal(hi.draft, true);
  assert.match(hi.emergency, /112/);
  assert.equal(getSafetyPack(db, 'toaster', 'hi'), null);
  assert.deepEqual(listSafetyTypes(db), ['crt_monitor', 'laptop', 'phone']);
});

test('steps must be completed in order', () => {
  const pack = getSafetyPack(db, 'phone', 'en')!;
  assert.throws(() => completeStep(pack, newProgress(), 'ph-2', 'h'), /in order/);
});

test('the battery step cannot be completed without a photo', () => {
  const pack = getSafetyPack(db, 'phone', 'en')!;
  const p1 = completeStep(pack, newProgress(), 'ph-1');
  assert.throws(() => completeStep(pack, p1, 'ph-2'), /photo/);
  const p2 = completeStep(pack, p1, 'ph-2', 'abc123');
  assert.equal(p2.done['ph-2'].photo_hash, 'abc123');
});

test('progress counts steps, never mutates, and finishes', () => {
  const pack = getSafetyPack(db, 'phone', 'en')!;
  const p0 = newProgress();
  const p1 = completeStep(pack, p0, 'ph-1');
  assert.equal(stepsDone(p0), 0);
  assert.equal(stepsDone(p1), 1);
  assert.equal(completeStep(pack, p1, 'ph-1'), p1);
  let p = p1;
  p = completeStep(pack, p, 'ph-2', 'h');
  p = completeStep(pack, p, 'ph-3');
  assert.equal(stepsDone(p), pack.steps.length);
  assert.equal(nextStep(pack, p), null);
  assert.throws(() => completeStep(pack, p, 'nope'), /Unknown/);
});

test('API: serves the pack, validates lang, 404s unknown types', async () => {
  const app = await buildApp(db);
  const ok = await app.inject({ url: '/api/safety/laptop?lang=hi' });
  assert.equal(ok.statusCode, 200);
  assert.equal(ok.json().draft, true);
  assert.equal((await app.inject({ url: '/api/safety/laptop?lang=fr' })).statusCode, 400);
  assert.equal((await app.inject({ url: '/api/safety/toaster' })).statusCode, 404);
  assert.deepEqual((await app.inject({ url: '/api/safety' })).json().types, ['crt_monitor', 'laptop', 'phone']);
  await app.close();
});