// `npm run storage:setup`  creates the private photo bucket (or tightens an existing one).
// `npm run storage:check`  uploads a tiny test image, fetches it through a signed link, checks the bucket is private, then deletes it.
// Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (server only, never in the web app).
import { SupabasePhotoStore } from './photostore.ts';
import { samplePhotoPng } from './samplephoto.ts';
import { sha256 } from './photos.ts';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bucket = process.env.PHOTO_BUCKET || 'photos';
if (!url || !key) { console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in server/.env first.'); process.exit(1); }
const store = new SupabasePhotoStore({ url, serviceKey: key, bucket });
const cmd = process.argv[2];

if (cmd === 'setup') {
  await store.ensureBucket();
  console.log(`Bucket "${bucket}" is ready: private, 6 MB per file, jpeg/png/webp only.`);
} else if (cmd === 'check') {
  const bytes = samplePhotoPng('c0ffee'.padEnd(64, '0'));
  const hash = sha256(bytes);
  await store.put(hash, bytes, 'image/png');
  console.log('upload: ok');
  const link = await store.signedUrl(hash, 60);
  const viaLink = await fetch(link);
  console.log(`signed link: ${viaLink.status === 200 ? 'ok (200, ' + (await viaLink.arrayBuffer()).byteLength + ' bytes)' : 'FAILED ' + viaLink.status}`);
  const direct = await fetch(`${url.replace(/\/$/, '')}/storage/v1/object/public/${bucket}/${hash}`);
  console.log(`public URL without a link: ${direct.status === 200 ? 'WARNING: BUCKET IS PUBLIC' : 'refused (' + direct.status + '), private as intended'}`);
  await store.remove(hash);
  console.log('cleanup: ok');
  if (viaLink.status !== 200 || direct.status === 200) process.exit(1);
} else {
  console.error('Usage: npm run storage:setup | npm run storage:check');
  process.exit(1);
}
