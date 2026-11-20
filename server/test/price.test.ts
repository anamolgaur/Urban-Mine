import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../src/db.ts';
import { seed } from '../src/seed.ts';
import { priceComposition, getRates, estimate, typeComposition, staleRates, setRate } from '../src/price.ts';

const db = openDb(':memory:');
seed(db);

test('grams x rate per kg, summed', () => {
  // 1000 g copper at 640/kg = 640; 500 g plastic at 12/kg = 6
  const e = priceComposition({ copper: 1000, plastic: 500 }, { copper: { rate: 640 }, plastic: { rate: 12 } }, 'model');
  assert.equal(e.total, 646);
  assert.deepEqual(e.lines.map((l) => l.value), [640, 6]);
  assert.equal(e.weight_kg, 1.5);
  assert.equal(e.sample, true);
});

test('range: +-12% for a known model, +-25% for type only', () => {
  const r = { copper: { rate: 100 } };
  const m = priceComposition({ copper: 1000 }, r, 'model');
  assert.equal(m.low, 88);
  assert.equal(m.high, 112);
  const t = priceComposition({ copper: 1000 }, r, 'type');
  assert.equal(t.low, 75);
  assert.equal(t.high, 125);
});

test('a material with no rate throws instead of being valued at zero', () => {
  assert.throws(() => priceComposition({ gold: 1 }, {}, 'model'), /No rate/);
});

test('rates show change versus yesterday', () => {
  const rates = getRates(db, 'Delhi');
  assert.equal(rates.copper.rate, 640);
  assert.equal(rates.copper.change, -6);
  assert.equal(rates.aluminium.change, 2);
  assert.equal(rates.steel.change, 0);
});

test('type-only estimate averages models of that type', () => {
  const comp = typeComposition(db, 'phone')!;
  assert.equal(comp.copper, Math.round((12 + 13 + 11) / 3));
  assert.equal(typeComposition(db, 'spaceship'), null);
});

test('estimate prefers the model, falls back to type, returns null for unknown', () => {
  assert.equal(estimate(db, 'Delhi', { modelId: 'ph-arka-a1', type: 'phone' })!.basis, 'model');
  assert.equal(estimate(db, 'Delhi', { modelId: 'nope', type: 'phone' })!.basis, 'type');
  assert.equal(estimate(db, 'Delhi', { type: 'spaceship' }), null);
});

test('the same device is cheaper in Kolkata (sample city factor)', () => {
  const d = estimate(db, 'Delhi', { modelId: 'lap-nova-14' })!.total;
  const k = estimate(db, 'Kolkata', { modelId: 'lap-nova-14' })!.total;
  assert.ok(k < d);
});

test('stale rows are found by age', () => {
  const stale = staleRates(db, new Date('2026-11-20T12:00:00Z'), 7);
  assert.equal(stale.length, 1);
  assert.equal(stale[0].material, 'glass');
  assert.equal(stale[0].city, 'Kolkata');
});

test('auditor edit updates the rate and today history, and the change shows', () => {
  setRate(db, 'copper', 'Delhi', 700, 'SAMPLE: auditor edit', new Date('2026-11-21T08:00:00Z'));
  const r = getRates(db, 'Delhi').copper;
  assert.equal(r.rate, 700);
  assert.equal(r.change, 60); // vs 640 on 2026-11-20
  assert.throws(() => setRate(db, 'copper', 'Delhi', 0, 'x'), /positive/);
});