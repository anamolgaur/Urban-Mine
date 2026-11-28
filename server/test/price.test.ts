import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ownDb } from './helpers.ts';
import { priceComposition, getRates, estimate, typeComposition, staleRates, setRate } from '../src/price.ts';

const db = await ownDb({ demo: false });

test('grams x rate per kg, summed', async () => {
  // 1000 g copper at 640/kg = 640; 500 g plastic at 12/kg = 6
  const e = priceComposition({ copper: 1000, plastic: 500 }, { copper: { rate: 640 }, plastic: { rate: 12 } }, 'model');
  assert.equal(e.total, 646);
  assert.deepEqual(e.lines.map((l) => l.value), [640, 6]);
  assert.equal(e.weight_kg, 1.5);
  assert.equal(e.sample, true);
});

test('range: +-12% for a known model, +-25% for type only', async () => {
  const r = { copper: { rate: 100 } };
  const m = priceComposition({ copper: 1000 }, r, 'model');
  assert.equal(m.low, 88);
  assert.equal(m.high, 112);
  const t = priceComposition({ copper: 1000 }, r, 'type');
  assert.equal(t.low, 75);
  assert.equal(t.high, 125);
});

test('a material with no rate throws instead of being valued at zero', async () => {
  assert.throws(() => priceComposition({ gold: 1 }, {}, 'model'), /No rate/);
});

test('rates show change versus yesterday', async () => {
  const rates = await getRates(db, 'Delhi');
  assert.equal(rates.copper.rate, 610);
  assert.equal(rates.copper.change, -6);
  assert.equal(rates.aluminium.change, 2);
  assert.equal(rates.steel.change, 0);
});

test('type-only estimate averages models of that type', async () => {
  const comp = (await typeComposition(db, 'phone'))!;
  assert.equal(comp.copper, Math.round((12 + 13 + 11 + 15 * 10) / 13));
  assert.equal(await typeComposition(db, 'spaceship'), null);
});

test('estimate prefers the model, falls back to type, returns null for unknown', async () => {
  // chargers have no parts value: the plain metal estimate shows which composition was used
  assert.equal((await estimate(db, 'Delhi', { modelId: 'chg-volt-20', type: 'charger' }))!.basis, 'model');
  assert.equal((await estimate(db, 'Delhi', { modelId: 'nope', type: 'charger' }))!.basis, 'type');
  // a dead phone uses its own model's metals as the floor under the parts value
  const m = (await estimate(db, 'Delhi', { modelId: 'ph-arka-a1', type: 'phone' }))!;
  const t = (await estimate(db, 'Delhi', { modelId: 'nope', type: 'phone' }))!;
  assert.equal(m.basis, 'parts');
  assert.notDeepEqual(m.lines, t.lines);
  assert.equal(await estimate(db, 'Delhi', { type: 'spaceship' }), null);
});

test('the same device is cheaper in Kolkata (sample city factor)', async () => {
  const d = (await estimate(db, 'Delhi', { modelId: 'lap-nova-14' }))!;
  const k = (await estimate(db, 'Kolkata', { modelId: 'lap-nova-14' }))!;
  assert.ok(k.parts!.metal_low < d.parts!.metal_low, 'the metal value follows the city rate');
});

test('a dead phone is priced by its parts, with the metal value as the floor; better phones fetch more', async () => {
  const budget = (await estimate(db, 'Delhi', { type: 'phone' }))!;
  assert.equal(budget.parts!.tier, 'budget');
  assert.ok(budget.low >= 100 && budget.high >= 300, 'at least the budget parts band');
  assert.ok(budget.low >= budget.parts!.metal_low);
  const flagship = (await estimate(db, 'Delhi', { type: 'phone', tier: 'flagship' }))!;
  assert.ok(flagship.low > budget.high, 'a dead flagship is worth more than a dead budget phone');
  const keypad = (await estimate(db, 'Delhi', { type: 'phone', tier: 'keypad' }))!;
  assert.ok(keypad.high < budget.high);
  // a laptop tier on a phone is ignored
  assert.equal((await estimate(db, 'Delhi', { type: 'phone', tier: 'premium' }))!.parts!.tier, 'budget');
  // types without a parts market keep the plain metal estimate
  assert.equal((await estimate(db, 'Delhi', { type: 'charger' }))!.parts, undefined);
});

test('phone circuit boards are valued at the high-grade board rate, laptop boards are not', async () => {
  const rates = await getRates(db, 'Delhi');
  assert.ok(rates.pcb_mobile.rate > rates.pcb.rate * 3);
  const phone = (await estimate(db, 'Delhi', { type: 'phone' }))!;
  const board = phone.lines.find((l) => l.material === 'pcb')!;
  assert.equal(board.value, Math.round((board.grams / 1000) * rates.pcb_mobile.rate * 100) / 100);
  const laptop = (await estimate(db, 'Delhi', { type: 'laptop' }))!;
  const lb = laptop.lines.find((l) => l.material === 'pcb')!;
  assert.equal(lb.value, Math.round((lb.grams / 1000) * rates.pcb.rate * 100) / 100);
});

test('stale rows are found by age', async () => {
  const stale = await staleRates(db, new Date('2026-11-20T12:00:00Z'), 7);
  assert.equal(stale.length, 1);
  assert.equal(stale[0].material, 'glass');
  assert.equal(stale[0].city, 'Kolkata');
});

test('auditor edit updates the rate and today history, and the change shows', async () => {
  await setRate(db, 'copper', 'Delhi', 670, 'SAMPLE: auditor edit', new Date('2026-11-21T08:00:00Z'));
  const r = (await getRates(db, 'Delhi')).copper;
  assert.equal(r.rate, 670);
  assert.equal(r.change, 60); // vs 610 on 2026-11-20
  await assert.rejects(() => setRate(db, 'copper', 'Delhi', 0, 'x'), /positive/);
});