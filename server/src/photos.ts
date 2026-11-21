import { createHash } from 'node:crypto';
import { sniffImage, type PhotoStore } from './photostore.ts';

const MAX_BYTES = 6 * 1024 * 1024;

/** Decode an image data URL. The bytes must really be a jpeg, png or webp: the type in the URL is not trusted. */
export function parseDataUrl(dataUrl: string): { bytes: Buffer; type: NonNullable<ReturnType<typeof sniffImage>> } {
  const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl ?? ''));
  if (!m) throw new Error('Photo must be a jpeg, png or webp data URL');
  const bytes = Buffer.from(m[2], 'base64');
  if (bytes.length > MAX_BYTES) throw new Error('Photo is too large');
  const type = sniffImage(bytes);
  if (!type) throw new Error('That file is not a jpeg, png or webp image');
  return { bytes, type };
}

export const sha256 = (b: Buffer) => createHash('sha256').update(b).digest('hex');

/** Store a photo under its own SHA-256 (so identical photos share a hash) and return the hash. */
export async function savePhoto(store: PhotoStore, dataUrl: string): Promise<string> {
  const { bytes, type } = parseDataUrl(dataUrl);
  const hash = sha256(bytes);
  await store.put(hash, bytes, type);
  return hash;
}
