import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDb } from '../src/db.ts';
import { seed } from '../src/seed.ts';
import { seedDemo } from '../src/demo.ts';
import { buildApp } from '../src/app.ts';

async function setup() {
  const db = openDb(':memory:');
  seed(db);
  const dir = mkdtempSync(join(tmpdir(), 'um-'));
  seedDemo(db, new Date(), dir);
  const app = await buildApp(db, { uploadsDir: dir, ocr: { read: async () => '' } });
  return { app, h: { 'x-user-id': 'u-repairer-1' } };
}

test('repairer dashboard data: history with dates and notes, one job still in progress', async () => {
  const { app, h } = await setup();
  const mine = (await app.inject({ url: '/api/repair/mine', headers: h })).json();
  assert.equal(mine.listing.verified_count, 2);
  const done = mine.jobs.filter((j: any) => j.status === 'completed');
  const open = mine.jobs.filter((j: any) => j.status === 'in_progress');
  assert.equal(done.length, 2);
  assert.equal(open.length, 1);
  assert.ok(done.every((j: any) => j.note && j.created_at && j.completed_at && j.after_photo));
  assert.equal(open[0].after_photo, null);
  await app.close();
});

test('a new job keeps its note; completing it needs an after photo and raises the count once', async () => {
  const { app, h } = await setup();
  const job = (await app.inject({ method: 'POST', url: '/api/repair/jobs', headers: h, payload: { before_photo: 'b1', note: '  Router reset  ' } })).json();
  let mine = (await app.inject({ url: '/api/repair/mine', headers: h })).json();
  assert.equal(mine.jobs.find((j: any) => j.id === job.id).note, 'Router reset');
  assert.equal((await app.inject({ method: 'POST', url: `/api/repair/jobs/${job.id}/complete`, headers: h, payload: {} })).statusCode, 400);
  assert.equal((await app.inject({ method: 'POST', url: `/api/repair/jobs/${job.id}/complete`, headers: h, payload: { after_photo: 'a1' } })).statusCode, 200);
  mine = (await app.inject({ url: '/api/repair/mine', headers: h })).json();
  assert.equal(mine.listing.verified_count, 3);
  await app.close();
});
