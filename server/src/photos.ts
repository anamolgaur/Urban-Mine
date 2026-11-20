import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const MAX_BYTES = 6 * 1024 * 1024;

export function parseDataUrl(dataUrl: string): Buffer {
  const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) throw new Error('Photo must be a jpeg, png or webp data URL');
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > MAX_BYTES) throw new Error('Photo is too large');
  return buf;
}

export const sha256 = (b: Buffer) => createHash('sha256').update(b).digest('hex');

/** Store a photo under its own SHA-256 (so identical photos share a hash) and return the hash. */
export function savePhoto(dir: string, dataUrl: string): string {
  const buf = parseDataUrl(dataUrl);
  const hash = sha256(buf);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, hash + '.jpg'), buf);
  return hash;
}
