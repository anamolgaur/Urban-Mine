/**
 * Free, on-device device-type recognition. A MobileNet image model runs inside the browser (TensorFlow.js);
 * the photo never leaves the phone for this step and nothing is paid for. The weights are served by this app
 * (web/public/models), about 14 MB, downloaded once and then cached by the browser.
 *
 * MobileNet knows 1,000 everyday objects, not phone models: it can say "this is a phone" but not "Galaxy S25 Ultra".
 * The exact model is picked by the worker from a list.
 */
type Guess = { type: string; confidence: number; label: string }

// ImageNet class names (lower case) -> our device types
const MAP: [RegExp, string][] = [
  [/cellular telephone|cellphone|mobile phone|ipod|dial telephone|pay-phone/, 'phone'],
  [/hand-held computer|hand-held|pda/, 'phone'],
  [/laptop|notebook computer|notebook/, 'laptop'],
  [/television|tv\b/, 'crt_monitor'],
  [/monitor|screen|crt screen|desktop computer/, 'lcd_monitor'],
  [/modem|router/, 'router'],
  [/remote control|cassette player|tape player|cd player|radio/, 'set_top_box'],
  [/power drill|switch|electric plug|plug/, 'charger'],
  [/ipad|tablet|web site/, 'tablet'],
]

let modelPromise: Promise<{ classify: (img: HTMLImageElement, k?: number) => Promise<{ className: string; probability: number }[]> }> | null = null

async function load() {
  modelPromise ??= (async () => {
    const tf = await import('@tensorflow/tfjs')
    await tf.ready()
    const mobilenet = await import('@tensorflow-models/mobilenet')
    return mobilenet.load({ version: 2, alpha: 1.0, modelUrl: '/models/mobilenet_v2/model.json' })
  })()
  try { return await modelPromise } catch (e) { modelPromise = null; throw e }
}

/** Start downloading the model early (e.g. when the scan screen opens) so the first guess is quick. */
export function warmUp() { void load().catch(() => {}) }

function toImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not read the photo'))
    img.src = src
  })
}

/** Best device-type guess for a photo, or null if the model sees nothing it recognises as a device. */
export async function recogniseType(dataUrl: string): Promise<Guess | null> {
  const model = await load()
  const preds = await model.classify(await toImage(dataUrl), 10)
  const scores: Record<string, { p: number; label: string }> = {}
  for (const p of preds) {
    const name = p.className.toLowerCase()
    const hit = MAP.find(([re]) => re.test(name))
    if (!hit) continue
    const s = scores[hit[1]] ?? { p: 0, label: p.className.split(',')[0] }
    s.p += p.probability
    scores[hit[1]] = s
  }
  const best = Object.entries(scores).sort((a, b) => b[1].p - a[1].p)[0]
  if (!best || best[1].p < 0.15) return null
  return { type: best[0], confidence: Math.min(0.9, best[1].p), label: best[1].label }
}
