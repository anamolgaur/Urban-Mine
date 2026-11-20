// Generates the PWA icons (plain PNG, no dependencies). Run: node scripts/make-icons.mjs
import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'

const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0 })
const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type), data])
  const sum = Buffer.alloc(4); sum.writeUInt32BE(crc(body))
  return Buffer.concat([len, body, sum])
}

function png(size) {
  const ink = [0x14, 0x17, 0x1a], paper = [0xf4, 0xf3, 0xef], amber = [0xf2, 0xa2, 0x0c]
  const row = size * 4 + 1
  const raw = Buffer.alloc(row * size)
  // mountain triangle (paper) and sun (amber), in unit coordinates
  const tri = [[0.18, 0.72], [0.45, 0.28], [0.82, 0.72]]
  const inTri = (x, y) => {
    const s = (a, b, c) => (a[0] - c[0]) * (b[1] - c[1]) - (b[0] - c[0]) * (a[1] - c[1])
    const p = [x, y], d1 = s(p, tri[0], tri[1]), d2 = s(p, tri[1], tri[2]), d3 = s(p, tri[2], tri[0])
    return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0))
  }
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size
      const c = (u - 0.72) ** 2 + (v - 0.26) ** 2 < 0.07 ** 2 ? amber : inTri(u, v) ? paper : ink
      const i = y * row + 1 + x * 4
      raw[i] = c[0]; raw[i + 1] = c[1]; raw[i + 2] = c[2]; raw[i + 3] = 255
    }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}

for (const s of [192, 512]) writeFileSync(new URL(`../web/public/icon-${s}.png`, import.meta.url), png(s))
console.log('wrote icon-192.png and icon-512.png')
