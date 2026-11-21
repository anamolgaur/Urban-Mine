import { deflateSync } from 'node:zlib';
import type { PhotoStore } from './photostore.ts';

const table = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (buf: Buffer) => { let c = 0xffffffff; for (const b of buf) c = table[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type: string, data: Buffer) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const sum = Buffer.alloc(4); sum.writeUInt32BE(crc(body));
  return Buffer.concat([len, body, sum]);
};

/**
 * A deterministic placeholder picture for a SAMPLE lot: a coloured backdrop with diagonal stripes and a dark device shape.
 * It is obviously synthetic. The same hash always gives the same picture, so a "duplicate photo" looks identical.
 */
export function samplePhotoPng(hash: string, w = 240, h = 180): Buffer {
  const n = (i: number) => parseInt(hash.slice(i, i + 2).padEnd(2, '0'), 16) || 0;
  const base = [90 + (n(0) % 110), 90 + (n(2) % 110), 90 + (n(4) % 110)];
  const row = w * 4 + 1;
  const raw = Buffer.alloc(row * h);
  const dx0 = 70 + (n(6) % 30), dy0 = 45 + (n(8) % 20), dw = 90, dh = 62;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let c = ((x + y) >> 4) % 2 === 0 ? base : base.map((v) => Math.min(255, v + 18));
      if (x >= dx0 && x < dx0 + dw && y >= dy0 && y < dy0 + dh) c = x > dx0 + 6 && x < dx0 + dw - 6 && y > dy0 + 6 && y < dy0 + dh - 14 ? [226, 232, 236] : [20, 23, 26];
      const i = y * row + 1 + x * 4;
      raw[i] = c[0]; raw[i + 1] = c[1]; raw[i + 2] = c[2]; raw[i + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

/** Store sample pictures under their hashes (PNG bytes; browsers display them fine). */
export async function writeSamplePhotos(store: PhotoStore, hashes: Iterable<string>) {
  for (const h of hashes) await store.put(h, samplePhotoPng(h), 'image/png');
}
