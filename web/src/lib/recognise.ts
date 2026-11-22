/**
 * Free, on-device device-type recognition. Nothing is sent anywhere and nothing is paid for.
 *
 * 1. MobileCLIP-S0 (Apple, fp16, about 23 MB, served by this app) turns a photo into 512 numbers that describe what is in it.
 * 2. A small classifier trained for Urban Mine (models/device_head.v1.json, 37 KB) turns those numbers into one of our types.
 *    It was trained on ImageNet device photos, real scrapyard photos (GIZ e-waste dataset) and shop photos. On scrapyard photos
 *    it had never seen it picked the right type 90% of the time, and the right type was in its top two 98% of the time.
 *
 * Screens come back as 'screen': whether it is a deep tube (CRT) or flat (LCD) is asked, because the worker can see it at once.
 * The model and engine download once (when the scan screen opens) and are cached for offline use.
 */
import type * as Ort from 'onnxruntime-web'
// the engine files, bundled by Vite as hashed assets (served compressed, cached for a year, available offline)
import ortWasm from 'onnxruntime-web/ort-wasm-simd-threaded.wasm?url'
import ortMjs from 'onnxruntime-web/ort-wasm-simd-threaded.mjs?url'

export type Kind = 'phone' | 'laptop' | 'tablet' | 'charger' | 'screen' | 'router' | 'set_top_box' | 'other'
export type Look = { id: string; brand: string; p: number }
export type Guess = { best: Kind; confidence: number; ranked: { kind: Kind; p: number }[]; photos: number; looks: Look[] }

const MODEL_URL = '/models/mobileclip_s0/vision_fp16.onnx'
const HEAD_URL = '/models/device_head.v1.json'
// Phone model from looks: brand right ~93%, exact model in the top 3 ~68% (leave-one-out on Wikimedia Commons photos).
// Only a suggestion: text read from the label or the About-phone screen always wins.
const PHONE_HEAD_URL = '/models/phone_model_head.v1.json'
const SIZE = 256

type Head = { classes: Kind[]; W: number[][]; b: number[] }
type PhoneHead = { classes: string[]; W: number[][]; b: number[]; brand: Record<string, string> }
let ready: Promise<{ ort: typeof Ort; session: Ort.InferenceSession; head: Head; phone: PhoneHead | null }> | null = null

async function load() {
  ready ??= (async () => {
    const ort = await import('onnxruntime-web/wasm')
    ort.env.wasm.wasmPaths = { wasm: ortWasm, mjs: ortMjs }
    ort.env.wasm.numThreads = 1 // threads need special server headers; one thread is fast enough for a few photos
    const [session, head, phone] = await Promise.all([
      ort.InferenceSession.create(MODEL_URL, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' }),
      fetch(HEAD_URL).then((r) => { if (!r.ok) throw new Error('model'); return r.json() as Promise<Head> }),
      fetch(PHONE_HEAD_URL).then((r) => (r.ok ? (r.json() as Promise<PhoneHead>) : null)).catch(() => null),
    ])
    return { ort, session, head, phone }
  })()
  try { return await ready } catch (e) { ready = null; throw e }
}

/** Start downloading early (when the scan screen opens) so the first answer is quick. */
export function warmUp() { void load().catch(() => {}) }

function toImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not read the photo'))
    img.src = src
  })
}

/** Two views of the photo, as the model was trained: the centre square, and the whole photo shrunk onto grey. */
function views(img: HTMLImageElement): Float32Array {
  const c = document.createElement('canvas'); c.width = SIZE; c.height = SIZE
  const g = c.getContext('2d', { willReadFrequently: true })!
  g.imageSmoothingQuality = 'high'
  const w = img.naturalWidth, h = img.naturalHeight
  const out = new Float32Array(2 * 3 * SIZE * SIZE)
  const put = (k: number) => {
    const d = g.getImageData(0, 0, SIZE, SIZE).data, base = k * 3 * SIZE * SIZE, n = SIZE * SIZE
    for (let i = 0; i < n; i++) { out[base + i] = d[i * 4] / 255; out[base + n + i] = d[i * 4 + 1] / 255; out[base + 2 * n + i] = d[i * 4 + 2] / 255 }
  }
  const s = Math.min(w, h) // centre crop
  g.drawImage(img, (w - s) / 2, (h - s) / 2, s, s, 0, 0, SIZE, SIZE); put(0)
  const f = SIZE / Math.max(w, h), dw = w * f, dh = h * f // whole photo
  g.fillStyle = 'rgb(128,128,128)'; g.fillRect(0, 0, SIZE, SIZE)
  g.drawImage(img, (SIZE - dw) / 2, (SIZE - dh) / 2, dw, dh); put(1)
  return out
}

const unit = (v: Float32Array | number[]) => { let s = 0; for (const x of v) s += x * x; s = Math.sqrt(s) || 1; return Array.from(v, (x) => x / s) }

const softmax = (W: number[][], bias: number[], x: number[]) => {
  const z = W.map((row, k) => row.reduce((s, w, i) => s + w * x[i], bias[k]))
  const m = Math.max(...z), ex = z.map((v) => Math.exp(v - m)), sum = ex.reduce((s, v) => s + v, 0)
  return ex.map((v) => v / sum)
}

/** The photo as 512 numbers (both views combined). */
async function embed(dataUrl: string): Promise<number[]> {
  const { ort, session } = await load()
  const input = new ort.Tensor('float32', views(await toImage(dataUrl)), [2, 3, SIZE, SIZE])
  const res = await session.run({ [session.inputNames[0]]: input })
  const e = res[session.outputNames[0]].data as Float32Array
  const a = unit(e.subarray(0, 512)), b = unit(e.subarray(512, 1024))
  return unit(a.map((v, i) => v + b[i]))
}

const cache = new Map<string, Promise<number[]>>() // photo -> embedding

/** Best guess from every photo taken so far (averaged: more photos, steadier answer). Null if no photo could be read. */
export async function recognise(dataUrls: string[]): Promise<Guess | null> {
  const { head, phone } = await load()
  const xs = (await Promise.all(dataUrls.map((u) => {
    if (!cache.has(u)) cache.set(u, embed(u).catch(() => { cache.delete(u); return [] }))
    return cache.get(u)!
  }))).filter((x) => x.length)
  if (!xs.length) return null
  const mean = (ps: number[][]) => ps[0].map((_, k) => ps.reduce((s, p) => s + p[k], 0) / ps.length)
  const avg = mean(xs.map((x) => softmax(head.W, head.b, x)))
  const ranked = head.classes.map((kind, k) => ({ kind, p: avg[k] })).sort((x, y) => y.p - x.p)
  let looks: Look[] = []
  if (phone && (ranked[0].kind === 'phone' || ranked.find((r) => r.kind === 'phone')!.p > 0.2)) {
    const pm = mean(xs.map((x) => softmax(phone.W, phone.b, x)))
    looks = phone.classes.map((id, k) => ({ id, brand: phone.brand[id], p: pm[k] })).sort((x, y) => y.p - x.p).slice(0, 5)
  }
  return { best: ranked[0].kind, confidence: ranked[0].p, ranked, photos: xs.length, looks }
}
