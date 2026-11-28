import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { freshDb } from './helpers.ts';
import { buildApp } from '../src/app.ts';
import { LocalPhotoStore } from '../src/photostore.ts';
import { RESALE, resaleRange } from '../src/resale.ts';

const as = (id: string) => ({ 'x-user-id': id });
const setup = async () => buildApp(await freshDb(), { photos: new LocalPhotoStore(mkdtempSync(join(tmpdir(), 'um-r-')), 's'), ocr: { read: async () => '' } });

test('a working flagship is priced by resale value, not scrap', async () => {
  const app = await setup();
  const scrap = (await app.inject({ url: '/api/estimate?city=Delhi&type=phone' })).json();
  const used = (await app.inject({ url: '/api/estimate?city=Delhi&type=phone&works=true&resaleId=rs-s25-ultra&condition=good' })).json();
  assert.equal(used.basis, 'resale');
  assert.equal(used.total, 70000);
  assert.ok(used.total > scrap.total * 20, 'resale is far above the dead value');
  assert.ok(used.checked, 'the price screen can show when prices were checked');
  assert.equal(resaleRange({ resaleId: 'rs-s25-ultra', condition: 'poor' })!.total, Math.round(70000 * 0.45));
  assert.equal(resaleRange({ custom: 9000 })!.total, 9000);
  assert.equal(resaleRange({}), null);
});

test('a lowball offer on a working phone is refused, a fair one is accepted', async () => {
  const app = await setup();
  const lot = (await app.inject({ method: 'POST', url: '/api/lots', headers: as('u-worker-1'), payload: {
    items: [{ type: 'phone', qty: 1, works: true, resale_id: 'rs-s25-ultra', condition: 'good' }], weight_kg: 0.22, steps_done: 0, steps_total: 0, photo_hashes: [], gps: null } })).json();
  assert.equal(lot.items[0].resale_id, 'rs-s25-ultra');
  await app.inject({ method: 'POST', url: `/api/lots/${lot.id}/list`, headers: as('u-worker-1') });
  const bid = (amount: number) => app.inject({ method: 'POST', url: `/api/lots/${lot.id}/bids`, headers: as('u-recycler-1'), payload: { amount, pickup_terms: 'x' } });
  assert.equal((await bid(75)).statusCode, 400);
  assert.equal((await bid(65000)).statusCode, 200);
  const mine = (await app.inject({ url: '/api/lots', headers: as('u-worker-1') })).json().find((l: { id: string }) => l.id === lot.id);
  assert.deepEqual([mine.open_offers, mine.top_offer], [1, 65000]);
});

test('the exact model is read from text in the photos: labels, codes and the About-phone screen', async () => {
  const { matchResale } = await import('../src/resale.ts');
  assert.equal(matchResale('Settings About phone Model name Galaxy S25 Ultra Model number SM-S938B/DS')?.model.id, 'rs-s25-ultra');
  assert.equal(matchResale('SAMSUNG SM-S928B')?.model.id, 'rs-s24-ultra');
  assert.equal(matchResale('iPhone 12 64 GB')?.model.id, 'rs-ip12', 'not mistaken for the Pro Max');
  assert.equal(matchResale('iPhone 12 Pro Max 256GB')?.model.id, 'rs-ip12-pm');
  assert.equal(matchResale('charger output 5V 2A'), null);
});

test('a working phone that is not listed gets a rough band from its kind and age; iPhones keep more value', async () => {
  const mid = resaleRange({ band: 'mid:mid:Vivo' })!;
  assert.equal(mid.total, 12000);
  assert.ok(mid.low < mid.total && mid.high > mid.total);
  assert.equal(resaleRange({ band: 'mid:mid:Apple' })!.total, Math.round(12000 * 1.3));
  assert.ok(resaleRange({ band: 'flagship:new' })!.total > resaleRange({ band: 'flagship:old' })!.total, 'older is worth less');
  assert.equal(resaleRange({ band: 'budget:old', condition: 'poor' })!.total, Math.round(2500 * 0.45));
  assert.equal(resaleRange({ band: 'spaceship:new' }), null);
  assert.equal(resaleRange({ band: 'mid:ancient' }), null);
  // a listed model always wins over a band
  assert.equal(resaleRange({ resaleId: 'rs-a35', band: 'flagship:new' })!.model!.id, 'rs-a35');
});

test('India\'s best-selling brands are in the price list, each with a source', async () => {
  for (const brand of ['Vivo', 'Motorola', 'OPPO', 'iQOO', 'Samsung', 'Xiaomi']) assert.ok(RESALE.some((m) => m.brand === brand), brand);
  assert.ok(RESALE.every((m) => m.source && m.good > 0));
  assert.equal(new Set(RESALE.map((m) => m.id)).size, RESALE.length, 'ids are unique');
});

test('a lot keeps the band of an unlisted working phone and the tier of a dead one', async () => {
  const app = await setup();
  const lot = (await app.inject({ method: 'POST', url: '/api/lots', headers: as('u-worker-1'), payload: {
    items: [{ type: 'phone', qty: 1, works: true, band: 'mid:mid:Vivo', condition: 'good' }, { type: 'phone', qty: 1, tier: 'flagship' }, { type: 'phone', qty: 1, tier: 'rocket' }],
    weight_kg: 0.6, steps_done: 0, steps_total: 0, photo_hashes: [], gps: null } })).json();
  assert.equal(lot.items[0].band, 'mid:mid:Vivo');
  assert.equal(lot.items[1].tier, 'flagship');
  assert.equal(lot.items[2].tier, undefined, 'an unknown tier is dropped');
});
