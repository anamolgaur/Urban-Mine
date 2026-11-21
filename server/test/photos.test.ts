import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { freshDb } from './helpers.ts';
import { buildApp } from '../src/app.ts';
import { seedDemo } from '../src/demo.ts';
import { LocalPhotoStore, SupabasePhotoStore, sniffImage } from '../src/photostore.ts';
import { parseDataUrl, sha256 } from '../src/photos.ts';
import { samplePhotoPng } from '../src/samplephoto.ts';

const png = (seed: string) => samplePhotoPng(seed.padEnd(64, '0'));
const dataUrl = (b: Buffer, type = 'png') => `data:image/${type};base64,${b.toString('base64')}`;
const as = (id: string) => ({ 'x-user-id': id });

async function setup() {
  const db = await freshDb({ demo: false });
  const store = new LocalPhotoStore(mkdtempSync(join(tmpdir(), 'um-ph-')), 'test-secret');
  await seedDemo(db, new Date(), store);
  const app = await buildApp(db, { photos: store, ocr: { read: async () => '' } });
  const upload = async (user: string, bytes: Buffer) => (await app.inject({ method: 'POST', url: '/api/photos', headers: as(user), payload: { dataUrl: dataUrl(bytes) } })).json().hash as string;
  const urls = async (user: string, hashes: string[]) => (await app.inject({ method: 'POST', url: '/api/photos/urls', headers: as(user), payload: { hashes } })).json() as Record<string, string | null>;
  return { db, store, app, upload, urls };
}

test('only real jpeg, png and webp bytes are accepted, whatever the data URL claims', () => {
  assert.equal(sniffImage(png('aa')), 'image/png');
  assert.equal(sniffImage(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0])), 'image/jpeg');
  assert.equal(sniffImage(Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP')])), 'image/webp');
  assert.equal(sniffImage(Buffer.from('<script>alert(1)</script>')), null);
  assert.throws(() => parseDataUrl(dataUrl(Buffer.from('hello, not an image'))), /not a jpeg, png or webp/);
  assert.throws(() => parseDataUrl('data:text/html;base64,PGI+'), /jpeg, png or webp data URL/);
  assert.throws(() => parseDataUrl(dataUrl(Buffer.concat([png('aa'), Buffer.alloc(7 * 1024 * 1024)]))), /too large/);
  assert.equal(parseDataUrl(dataUrl(png('aa'))).type, 'image/png');
});

test('local signed links: valid works; tampered, expired and malformed ones do not', async () => {
  const store = new LocalPhotoStore(mkdtempSync(join(tmpdir(), 'um-ph-')), 's3cret');
  const hash = sha256(png('bb'));
  await store.put(hash, png('bb'), 'image/png');
  const link = new URL(await store.signedUrl(hash, 60), 'http://x');
  const exp = Number(link.searchParams.get('exp'));
  const sig = link.searchParams.get('sig')!;
  assert.equal(store.verify(hash, exp, sig), true);
  assert.equal(store.verify(hash, exp + 1, sig), false, 'a longer expiry cannot be forged');
  assert.equal(store.verify(hash, exp, sig.replace(/.$/, (c) => (c === '0' ? '1' : '0'))), false);
  assert.equal(store.verify('f'.repeat(64), exp, sig), false, 'a link is for one photo only');
  const past = Math.floor(Date.now() / 1000) - 5;
  const expired = new URL(await new LocalPhotoStore(mkdtempSync(join(tmpdir(), 'um-ph-')), 's3cret').signedUrl(hash, -5), 'http://x');
  assert.equal(store.verify(hash, Number(expired.searchParams.get('exp')), expired.searchParams.get('sig')!), false);
  assert.ok(past > 0);
  assert.equal(new LocalPhotoStore(mkdtempSync(join(tmpdir(), 'um-ph-')), 'other-secret').verify(hash, exp, sig), false, 'another server secret does not match');
  await assert.rejects(() => store.put('../../etc/passwd', png('bb'), 'image/png'), /Invalid photo id/);
  await assert.rejects(() => store.signedUrl('nothex', 60), /Invalid photo id/);
});

test('the uploader sees their photo through a signed link; nobody else does', async () => {
  const { app, upload, urls } = await setup();
  const hash = await upload('u-worker-1', png('d0'));
  assert.equal(hash, sha256(png('d0')));
  const mine = (await urls('u-worker-1', [hash]))[hash];
  assert.ok(mine && mine.startsWith('/api/photos/'));
  const file = await app.inject({ url: mine });
  assert.equal(file.statusCode, 200);
  assert.equal(file.headers['content-type'], 'image/png');
  assert.deepEqual(file.rawPayload, png('d0'));
  assert.equal(file.headers['x-content-type-options'], 'nosniff');
  // other workers, recyclers (the photo is on no lot), and repairers get nothing
  assert.equal((await urls('u-worker-2', [hash]))[hash], null);
  assert.equal((await urls('u-recycler-1', [hash]))[hash], null);
  assert.equal((await urls('u-repairer-1', [hash]))[hash], null);
  // auditors can see everything
  assert.ok((await urls('u-auditor-1', [hash]))[hash]);
  // not signed in at all
  assert.equal((await app.inject({ method: 'POST', url: '/api/photos/urls', payload: { hashes: [hash] } })).statusCode, 401);
});

test('a photo link cannot be used without its signature, and the old public /uploads route is gone', async () => {
  const { app, upload } = await setup();
  const hash = await upload('u-worker-1', png('d1'));
  assert.equal((await app.inject({ url: `/api/photos/${hash}/file` })).statusCode, 403);
  assert.equal((await app.inject({ url: `/api/photos/${hash}/file?exp=9999999999&sig=abc` })).statusCode, 403);
  assert.equal((await app.inject({ url: `/uploads/${hash}.jpg` })).statusCode, 404);
  assert.equal((await app.inject({ url: `/uploads/${hash}.img` })).statusCode, 404);
});

test('recyclers see photos of lots that are on sale or sold, but not of open lots', async () => {
  const { urls } = await setup();
  const listed = 'a1'.padEnd(64, '0'); // lot A: listed
  const open = 'a3'.padEnd(64, '0'); // worker 1's second lot: still open
  const r = await urls('u-recycler-1', [listed, open]);
  assert.ok(r[listed]);
  assert.equal(r[open], null);
  const owner = await urls('u-worker-1', [listed, open]);
  assert.ok(owner[listed] && owner[open], 'the owner sees both');
  const other = await urls('u-worker-2', [open]);
  assert.equal(other[open], null);
});

test('requests for links are validated', async () => {
  const { app } = await setup();
  const post = async (payload: unknown) => (await app.inject({ method: 'POST', url: '/api/photos/urls', headers: as('u-worker-1'), payload: payload as object })).statusCode;
  assert.equal(await post({}), 400);
  assert.equal(await post({ hashes: 'x' }), 400);
  assert.equal(await post({ hashes: [1, 2] }), 400);
  assert.equal(await post({ hashes: Array.from({ length: 51 }, (_, i) => String(i)) }), 400);
  const bad = await app.inject({ method: 'POST', url: '/api/photos/urls', headers: as('u-worker-1'), payload: { hashes: ['not-a-hash', '../x'] } });
  assert.deepEqual(bad.json(), { 'not-a-hash': null, '../x': null });
});

test('uploading something that is not an image is refused', async () => {
  const { app } = await setup();
  const res = await app.inject({ method: 'POST', url: '/api/photos', headers: as('u-worker-1'), payload: { dataUrl: dataUrl(Buffer.from('MZ not an image')) } });
  assert.equal(res.statusCode, 400);
  assert.match(res.json().error, /not a jpeg, png or webp/);
});

test('deleting my data removes my photos from storage, but keeps ones another person also uploaded', async () => {
  const { app, store, upload, urls } = await setup();
  const mine = await upload('u-worker-1', png('e1'));
  const shared = await upload('u-worker-1', png('e2'));
  assert.equal(await upload('u-worker-2', png('e2')), shared, 'identical bytes are one object');
  assert.ok(await store.read(mine));
  assert.equal((await app.inject({ method: 'DELETE', url: '/api/me/data', headers: as('u-worker-1') })).statusCode, 200);
  assert.equal(await store.read(mine), null, 'my own photo is deleted from storage');
  assert.ok(await store.read(shared), 'the shared photo stays for the other person');
  assert.ok((await urls('u-worker-2', [shared]))[shared]);
  assert.equal((await urls('u-worker-1', [mine]))[mine], null, 'and the link rule no longer lets me see it');
  assert.equal((await app.inject({ method: 'DELETE', url: '/api/me/data', headers: as('u-worker-2') })).statusCode, 200);
  assert.equal(await store.read(shared), null, 'once nobody uses it, it goes');
});

test('the Supabase store sends the key as a header, never in a URL, and maps failures', async () => {
  const calls: { url: string; method: string; headers: Record<string, string>; body?: unknown }[] = [];
  const mk = (respond: (url: string, init: RequestInit) => Response | Promise<Response>) => new SupabasePhotoStore({
    url: 'https://x.supabase.co/', serviceKey: 'SECRET-KEY', bucket: 'photos',
    fetchFn: (async (url: string, init: RequestInit) => {
      calls.push({ url, method: String(init.method), headers: init.headers as Record<string, string>, body: init.body });
      return respond(url, init);
    }) as unknown as typeof fetch,
  });
  const hash = sha256(png('f0'));
  const s = mk((url) => (url.includes('/object/sign/') ? new Response(JSON.stringify({ signedURL: `/object/sign/photos/${hash}?token=T0K` }), { status: 200 }) : new Response('{}', { status: 200 })));
  await s.put(hash, png('f0'), 'image/png');
  assert.equal(calls[0].url, `https://x.supabase.co/storage/v1/object/photos/${hash}`);
  assert.equal(calls[0].method, 'POST');
  assert.equal(calls[0].headers.authorization, 'Bearer SECRET-KEY');
  assert.equal(calls[0].headers['x-upsert'], 'true');
  assert.equal(calls[0].headers['content-type'], 'image/png');
  const link = await s.signedUrl(hash, 600);
  assert.equal(link, `https://x.supabase.co/storage/v1/object/sign/photos/${hash}?token=T0K`);
  assert.deepEqual(JSON.parse(String(calls[1].body)), { expiresIn: 600 });
  await s.remove(hash);
  assert.equal(calls[2].method, 'DELETE');
  assert.ok(calls.every((c) => !c.url.includes('SECRET-KEY')), 'the service key is never put in a URL');
  // invalid ids never reach the network
  const before = calls.length;
  await assert.rejects(() => s.put('../x', png('f0'), 'image/png'), /Invalid photo id/);
  assert.equal(calls.length, before);
  // failures
  await assert.rejects(() => mk(() => new Response('', { status: 500 })).put(hash, png('f0'), 'image/png'), (e: { statusCode: number }) => e.statusCode === 502);
  await assert.rejects(() => mk(() => { throw new Error('offline'); }).signedUrl(hash, 60), (e: { statusCode: number }) => e.statusCode === 503);
  await mk(() => new Response('', { status: 404 })).remove(hash); // deleting something already gone is fine
});

test('creating the bucket makes it private and tightens an existing one', async () => {
  const calls: { url: string; method: string; body: Record<string, unknown> }[] = [];
  const mk = (first: number) => new SupabasePhotoStore({
    url: 'https://x.supabase.co', serviceKey: 'k', bucket: 'photos',
    fetchFn: (async (url: string, init: RequestInit) => {
      calls.push({ url, method: String(init.method), body: JSON.parse(String(init.body)) });
      return new Response('{}', { status: calls.length === 1 ? first : 200 });
    }) as unknown as typeof fetch,
  });
  await mk(200).ensureBucket();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].body.public, false);
  assert.equal(calls[0].body.file_size_limit, 6 * 1024 * 1024);
  assert.deepEqual(calls[0].body.allowed_mime_types, ['image/jpeg', 'image/png', 'image/webp']);
  calls.length = 0;
  await mk(409).ensureBucket();
  assert.equal(calls.length, 2, 'an existing bucket is updated');
  assert.equal(calls[1].method, 'PUT');
  assert.equal(calls[1].body.public, false);
});
