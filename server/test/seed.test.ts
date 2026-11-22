import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ownDb } from './helpers.ts';

const db = await ownDb({ demo: false });
const rows = async (sql: string) => (await db.prepare(sql).all()) as Record<string, any>[];

test('seed counts match the build plan', async () => {
  assert.equal((await rows('SELECT * FROM device_model')).length, 37);
  assert.equal((await rows('SELECT DISTINCT device_type FROM safety_pack')).length, 3);
  assert.equal((await rows('SELECT * FROM safety_pack')).length, 6); // 3 types x hi/en
  assert.equal((await rows('SELECT * FROM repair_guide')).length, 6);
  assert.ok((await rows('SELECT * FROM app_user')).length >= 6);
});

test('every material in every model composition has a rate in every city', async () => {
  const cities = (await rows('SELECT DISTINCT city FROM rate')).map((r) => r.city);
  for (const m of (await rows('SELECT id, composition_json FROM device_model')))
    for (const mat of Object.keys(JSON.parse(m.composition_json)))
      for (const city of cities)
        assert.ok((await rows(`SELECT 1 FROM rate WHERE material='${mat}' AND city='${city}'`)).length, `${m.id}: no ${mat} rate in ${city}`);
});

test('model composition roughly adds up to model weight (within 25%)', async () => {
  for (const m of (await rows('SELECT id, weight_kg, composition_json FROM device_model'))) {
    const kg = Object.values(JSON.parse(m.composition_json) as Record<string, number>).reduce((a, b) => a + b, 0) / 1000;
    assert.ok(Math.abs(kg - m.weight_kg) / m.weight_kg < 0.25, `${m.id}: composition ${kg}kg vs weight ${m.weight_kg}kg`);
  }
});

test('label patterns are valid regexes', async () => {
  for (const m of (await rows('SELECT id, label_patterns FROM device_model')))
    for (const p of JSON.parse(m.label_patterns)) assert.doesNotThrow(() => new RegExp(p, 'i'), m.id);
});

test('safety packs: Hindi and English, battery step needs photo, unreviewed, draft labelled', async () => {
  for (const p of (await rows('SELECT * FROM safety_pack'))) {
    const pack = JSON.parse(p.steps_json);
    assert.equal(p.reviewed_by, null);
    assert.match(pack.draft_banner, /DRAFT|ड्राफ़्ट/);
    assert.match(pack.emergency, /112/);
    assert.ok(pack.steps.length >= 3);
    for (const s of pack.steps) assert.equal(typeof s.title, 'string'); // localised to a single language
    if (p.device_type !== 'crt_monitor') assert.ok(pack.steps.some((s: any) => s.photo_required), 'battery step needs photo');
  }
  const hi = (await rows("SELECT steps_json FROM safety_pack WHERE language='hi'")).map((r) => r.steps_json).join();
  assert.match(hi, /[ऀ-ॿ]/);
});

test('all sample names and sources carry the SAMPLE label', async () => {
  for (const u of (await rows('SELECT name FROM app_user'))) assert.match(u.name, /\(demo\)/);
  for (const r of (await rows('SELECT source FROM rate'))) assert.match(r.source, /SAMPLE/);
  for (const m of (await rows('SELECT model FROM device_model'))) assert.match(m.model, /SAMPLE/);
});

test('rate history gives 30 days, including yesterday, for every current rate', async () => {
  assert.equal((await rows('SELECT * FROM rate_history')).length, (await rows('SELECT * FROM rate')).length * 30);
  assert.equal((await rows("SELECT * FROM rate_history WHERE day = '2026-11-19'")).length, (await rows('SELECT * FROM rate')).length);
});

test('a real-use database gets prices, devices and guides, but no demo people', async () => {
  const { openDb } = await import('../src/db.ts');
  const { seed } = await import('../src/seed.ts');
  const db = await openDb();
  await seed(db, { reference: true });
  assert.equal((await db.prepare('SELECT COUNT(*)::int AS n FROM app_user').get() as { n: number }).n, 0);
  assert.ok((await db.prepare('SELECT COUNT(*)::int AS n FROM rate').get() as { n: number }).n > 0);
  assert.ok((await db.prepare('SELECT COUNT(*)::int AS n FROM device_model').get() as { n: number }).n > 0);
  assert.ok((await db.prepare('SELECT COUNT(*)::int AS n FROM safety_pack').get() as { n: number }).n > 0);
  await db.close();
});
