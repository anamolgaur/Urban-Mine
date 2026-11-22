// Copies the ONNX Runtime engine (WebAssembly) into public/ort/<version>/ so the app serves it itself: no CDN, works offline once cached.
import { cpSync, mkdirSync, readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
const here = dirname(fileURLToPath(import.meta.url))
const dist = join(here, '..', 'node_modules', 'onnxruntime-web', 'dist')
const version = JSON.parse(readFileSync(join(dist, '..', 'package.json'), 'utf8')).version
const out = join(here, '..', 'public', 'ort', version)
if (!existsSync(join(out, 'ort-wasm-simd-threaded.wasm'))) {
  mkdirSync(out, { recursive: true })
  for (const f of ['ort-wasm-simd-threaded.wasm', 'ort-wasm-simd-threaded.mjs']) cpSync(join(dist, f), join(out, f))
  console.log('ONNX Runtime', version, 'copied to public/ort')
}
