import { api, apiUrl } from './api.ts'

/**
 * Photos are private. To show one, the app asks the API for a short-lived signed link, and the API only hands one out
 * if this person may see that photo. Requests made in the same moment are sent as one batch, and links are reused for a while.
 */
const TTL_MS = 8 * 60 * 1000 // the server's links last 10 minutes
type Entry = { url: string | null; until: number }
const cache = new Map<string, Entry>()
const waiting = new Map<string, ((url: string | null) => void)[]>()
let timer: ReturnType<typeof setTimeout> | null = null

async function flush() {
  timer = null
  const all = [...waiting.keys()]
  for (let i = 0; i < all.length; i += 50) {
    const batch = all.slice(i, i + 50)
    let out: Record<string, string | null> = {}
    try { out = await api<Record<string, string | null>>('/api/photos/urls', { body: { hashes: batch } }) } catch { /* every photo in the batch falls back to the placeholder */ }
    for (const h of batch) {
      const raw = out[h] ?? null
      const url = raw ? (raw.startsWith('/') ? apiUrl(raw) : raw) : null
      cache.set(h, { url, until: Date.now() + (url ? TTL_MS : 30_000) })
      for (const done of waiting.get(h) ?? []) done(url)
      waiting.delete(h)
    }
  }
}

/** A usable image address for this photo, or null when there is none for this person. */
export function photoUrl(hash: string): Promise<string | null> {
  const hit = cache.get(hash)
  if (hit && hit.until > Date.now()) return Promise.resolve(hit.url)
  return new Promise((resolve) => {
    waiting.set(hash, [...(waiting.get(hash) ?? []), resolve])
    if (!timer) timer = setTimeout(flush, 20)
  })
}

/** Forget a link (it expired, or the image failed to load) so the next request fetches a fresh one. */
export function forgetPhotoUrl(hash: string) { cache.delete(hash) }

/** Forget every link, for example after signing out, so the next person on this phone never sees a cached one. */
export function clearPhotoUrls() { cache.clear() }
