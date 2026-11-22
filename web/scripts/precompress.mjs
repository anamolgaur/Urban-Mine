// Writes .br and .gz copies of big files in dist so the server can send them compressed (the AI engine shrinks from 15 MB to about 4 MB).
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { brotliCompressSync, gzipSync, constants } from 'node:zlib'
const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist')
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p] })
let saved = 0
for (const p of walk(root)) {
  if (!/\.(js|mjs|css|html|json|svg|wasm|onnx|webmanifest)$/.test(p) || statSync(p).size < 4096) continue
  const buf = readFileSync(p)
  const br = brotliCompressSync(buf, { params: { [constants.BROTLI_PARAM_QUALITY]: buf.length > 5e6 ? 9 : 11, [constants.BROTLI_PARAM_SIZE_HINT]: buf.length } })
  if (br.length > buf.length * 0.9) continue // already compressed, not worth it
  writeFileSync(p + '.br', br); writeFileSync(p + '.gz', gzipSync(buf, { level: 9 })); saved += buf.length - br.length
}
console.log(`Pre-compressed web files: ${(saved / 1e6).toFixed(1)} MB smaller to download`)
