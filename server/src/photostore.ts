import { createHmac, timingSafeEqual, randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

/** A photo is stored under the SHA-256 of its bytes: 64 lowercase hex characters. Nothing else is ever used as a storage key. */
export const HASH = /^[0-9a-f]{64}$/;

export type ImageType = 'image/jpeg' | 'image/png' | 'image/webp';

/** The real type of an image from its first bytes, or null if it is not a jpeg, png or webp. We never trust the type a client claims. */
export function sniffImage(b: Buffer): ImageType | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (b.length >= 12 && b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp';
  return null;
}

export interface PhotoStore {
  put(hash: string, bytes: Buffer, contentType: string): Promise<void>;
  remove(hash: string): Promise<void>;
  /** A time-limited link that works directly in an <img src>. Relative links (starting with /) are served by this API. */
  signedUrl(hash: string, ttlSeconds: number): Promise<string>;
  /** Raw bytes, for the server itself (for example the condition check). Browsers never get these directly: they get signed links. */
  read?(hash: string): Promise<Buffer | null>;
  /** Check a local signed link. Remote stores do not use it. */
  verify?(hash: string, exp: number, sig: string): boolean;
}

const need = (hash: string) => { if (!HASH.test(hash)) throw new Error('Invalid photo id'); };

/** Photos on local disk (dev and tests). Links are signed with an HMAC so a path alone is never enough. */
export class LocalPhotoStore implements PhotoStore {
  private dir: string;
  private secret: string;
  constructor(dir: string, secret?: string) {
    this.dir = dir;
    // Without a configured secret, links stop working when the server restarts. That is fine: they only live minutes.
    this.secret = secret || randomBytes(32).toString('hex');
    mkdirSync(dir, { recursive: true });
  }
  private path(hash: string) { need(hash); return join(this.dir, hash + '.img'); }
  private sign(hash: string, exp: number) { return createHmac('sha256', this.secret).update(`${hash}.${exp}`).digest('hex'); }
  async put(hash: string, bytes: Buffer, _contentType?: string) { writeFileSync(this.path(hash), bytes); }
  async remove(hash: string) { rmSync(this.path(hash), { force: true }); }
  async read(hash: string) { try { return readFileSync(this.path(hash)); } catch { return null; } }
  async signedUrl(hash: string, ttlSeconds: number) {
    need(hash);
    const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
    return `/api/photos/${hash}/file?exp=${exp}&sig=${this.sign(hash, exp)}`;
  }
  verify(hash: string, exp: number, sig: string) {
    if (!HASH.test(hash) || !Number.isFinite(exp) || exp < Date.now() / 1000) return false;
    const want = Buffer.from(this.sign(hash, exp));
    const got = Buffer.from(String(sig));
    return want.length === got.length && timingSafeEqual(want, got);
  }
}

export type SupabaseStoreOptions = { url: string; serviceKey: string; bucket?: string; fetchFn?: typeof fetch };

/**
 * Photos in a PRIVATE Supabase Storage bucket, over its REST API. The service key bypasses every database rule:
 * it lives only on the API server and must never reach the web app.
 */
export class SupabasePhotoStore implements PhotoStore {
  private base: string;
  private key: string;
  private bucket: string;
  private f: typeof fetch;
  constructor(o: SupabaseStoreOptions) {
    this.base = o.url.replace(/\/$/, '') + '/storage/v1';
    this.key = o.serviceKey;
    this.bucket = o.bucket ?? 'photos';
    this.f = o.fetchFn ?? fetch;
  }
  private headers(extra: Record<string, string> = {}) { return { authorization: `Bearer ${this.key}`, apikey: this.key, ...extra }; }
  private async call(path: string, init: RequestInit, ok: number[] = [200]) {
    let res: Response;
    try { res = await this.f(this.base + path, { ...init, signal: AbortSignal.timeout(20000) }); } catch { throw Object.assign(new Error('Photo storage is not reachable'), { statusCode: 503 }); }
    if (!ok.includes(res.status)) throw Object.assign(new Error(`Photo storage error (${res.status})`), { statusCode: 502 });
    return res;
  }
  async put(hash: string, bytes: Buffer, contentType: string) {
    need(hash);
    // upsert: the same bytes uploaded twice are the same object
    await this.call(`/object/${this.bucket}/${hash}`, { method: 'POST', headers: this.headers({ 'content-type': contentType, 'x-upsert': 'true' }), body: new Uint8Array(bytes) });
  }
  async read(hash: string): Promise<Buffer | null> {
    need(hash);
    const res = await this.call(`/object/${this.bucket}/${hash}`, { method: 'GET', headers: this.headers() }, [200, 400, 404]);
    return res.status === 200 ? Buffer.from(await res.arrayBuffer()) : null;
  }
  async remove(hash: string) {
    need(hash);
    await this.call(`/object/${this.bucket}/${hash}`, { method: 'DELETE', headers: this.headers() }, [200, 400, 404]);
  }
  async signedUrl(hash: string, ttlSeconds: number) {
    need(hash);
    const res = await this.call(`/object/sign/${this.bucket}/${hash}`, { method: 'POST', headers: this.headers({ 'content-type': 'application/json' }), body: JSON.stringify({ expiresIn: ttlSeconds }) });
    const j = (await res.json()) as { signedURL?: string };
    if (!j.signedURL) throw Object.assign(new Error('Photo storage returned no link'), { statusCode: 502 });
    return this.base + j.signedURL;
  }
  /** Create the private bucket (or tighten an existing one): 6 MB per file, images only. Safe to run again. */
  async ensureBucket() {
    const settings = { public: false, file_size_limit: 6 * 1024 * 1024, allowed_mime_types: ['image/jpeg', 'image/png', 'image/webp'] };
    const made = await this.call('/bucket', { method: 'POST', headers: this.headers({ 'content-type': 'application/json' }), body: JSON.stringify({ id: this.bucket, name: this.bucket, ...settings }) }, [200, 400, 409]);
    if (made.status !== 200) await this.call(`/bucket/${this.bucket}`, { method: 'PUT', headers: this.headers({ 'content-type': 'application/json' }), body: JSON.stringify(settings) });
  }
}
