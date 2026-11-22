import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from './api.ts'
import type { Lot } from './types.ts'

const KEY = 'um_seen_offers'
const EVERY_MS = 30_000

const readSeen = () => { try { return Number(localStorage.getItem(KEY) ?? 'NaN') } catch { return NaN } }
const writeSeen = (n: number) => { try { localStorage.setItem(KEY, String(n)) } catch { /* ignore */ } }

/** A short two-note chime made in the browser (no sound file to download). Silently skipped where audio is blocked. */
function chime() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    ;[660, 880].forEach((f, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain()
      o.frequency.value = f; o.type = 'sine'
      g.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.18)
      g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + i * 0.18 + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.18 + 0.25)
      o.connect(g).connect(ctx.destination); o.start(ctx.currentTime + i * 0.18); o.stop(ctx.currentTime + i * 0.18 + 0.3)
    })
    setTimeout(() => ctx.close().catch(() => {}), 1000)
  } catch { /* ignore */ }
}

/**
 * For workers: checks for new offers on their lots every 30 seconds while the app is open.
 * Returns how many offers are new since the worker last looked, and a function to mark them as seen.
 */
export function useOfferAlerts(enabled: boolean) {
  const [total, setTotal] = useState(0)
  const [fresh, setFresh] = useState(0)
  const [toast, setToast] = useState<number | null>(null)
  const first = useRef(true)

  const check = useCallback(async () => {
    if (document.visibilityState === 'hidden') return
    try {
      const lots = await api<Lot[]>('/api/lots')
      const n = lots.reduce((s, l) => s + (l.status === 'listed' ? l.open_offers ?? 0 : 0), 0)
      setTotal(n)
      let seen = readSeen()
      if (Number.isNaN(seen)) { seen = n; writeSeen(n) } // first run: nothing is "new"
      if (n < seen) { seen = n; writeSeen(n) } // offers expired or were accepted
      const diff = n - seen
      setFresh(diff)
      if (diff > 0 && !first.current) {
        setToast(diff); chime()
        try { navigator.vibrate?.([120, 80, 120]) } catch { /* ignore */ }
      }
      first.current = false
    } catch { /* offline or signed out: try again next time */ }
  }, [])

  useEffect(() => {
    if (!enabled) return
    void check()
    const id = setInterval(() => void check(), EVERY_MS)
    const onVis = () => { if (document.visibilityState === 'visible') void check() }
    document.addEventListener('visibilitychange', onVis)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVis) }
  }, [enabled, check])

  const markSeen = useCallback(() => { writeSeen(total); setFresh(0); setToast(null) }, [total])
  return { fresh, toast, dismiss: () => setToast(null), markSeen }
}
