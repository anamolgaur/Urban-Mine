import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../src/db.ts';
import { seed } from '../src/seed.ts';
import { loadModels, matchModel, normalise, MAX_CONFIDENCE, type ModelRef } from '../src/matcher.ts';
import { runScan, saveFeedback } from '../src/scan.ts';
import { StubClassifier, type Ocr } from '../src/vision.ts';

const db = openDb(':memory:');
seed(db);
const models = loadModels(db);

test('normalise cleans OCR noise', () => {
  assert.equal(normalise('  NOVA\n\nSlate|14 '), 'nova slate 14');
});

test('a clear label matches the right model, with two patterns raising confidence', () => {
  const r = matchModel('NOVA SLATE 14\nModel: SL14-X2', models);
  assert.equal(r.kind, 'model');
  if (r.kind === 'model') {
    assert.equal(r.best.model.id, 'lap-nova-14');
    assert.equal(r.best.matched.length, 2);
  }
});

test('OCR spacing noise still matches', () => {
  const r = matchModel('Nova   Slate14', models);
  assert.equal(r.kind === 'model' && r.best.model.id, 'lap-nova-14');
});

test('confidence is never certain', () => {
  const r = matchModel('NOVA SLATE 14 SL14-X2 SL14-A', models);
  assert.equal(r.kind, 'model');
  if (r.kind === 'model') assert.ok(r.best.confidence <= MAX_CONFIDENCE && r.best.confidence < 1);
});

test('unreadable or unrelated text falls back to type only', () => {
  const r = matchModel('hello world 12345', models);
  assert.deepEqual([r.kind, (r as any).reason], ['type_only', 'no_match']);
});

test('a known device type filters out models of other types', () => {
  assert.equal(matchModel('NOVA SLATE 14', models, { type: 'phone' }).kind, 'type_only');
  assert.equal(matchModel('NOVA SLATE 14', models, { type: 'laptop' }).kind, 'model');
});

test('two near-equal candidates are reported as ambiguous, not guessed', () => {
  const twins: ModelRef[] = [
    { id: 'a', type: 'phone', brand: 'X', model: 'A', label_patterns: ['zeta\\s*one'] },
    { id: 'b', type: 'phone', brand: 'X', model: 'B', label_patterns: ['zeta\\s*one'] },
  ];
  const r = matchModel('ZETA ONE', twins);
  assert.deepEqual([r.kind, (r as any).reason], ['type_only', 'ambiguous']);
});

test('runScan saves the scan, and feedback is logged', async () => {
  const ocr: Ocr = { read: async () => 'ARKA A1 AK-A1' };
  const res = await runScan(db, { classifier: new StubClassifier(), ocr }, { userId: 'u-worker-1', images: [Buffer.from('top'), Buffer.from('label')], hint: 'phone' });
  assert.equal(res.type, 'phone');
  assert.equal(res.match.kind, 'model');
  const row = db.prepare('SELECT model_id FROM scan WHERE id = ?').get(res.scanId) as any;
  assert.equal(row.model_id, 'ph-arka-a1');

  saveFeedback(db, res.scanId, 'model', 'ph-arka-a1', 'ph-arka-a3');
  const fb = db.prepare('SELECT * FROM feedback WHERE scan_id = ?').all(res.scanId) as any[];
  assert.equal(fb.length, 1);
  assert.equal(fb[0].corrected, 'ph-arka-a3');
});

test('runScan with no images is rejected', async () => {
  await assert.rejects(runScan(db, { classifier: new StubClassifier(), ocr: { read: async () => '' } }, { userId: 'u-worker-1', images: [] }), /image/);
});