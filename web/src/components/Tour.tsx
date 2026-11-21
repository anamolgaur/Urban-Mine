import { useCallback, useEffect, useLayoutEffect, useState } from 'react'
import { useLang } from '../lib/i18n.tsx'
import { Btn } from './ui.tsx'

/** One stop on the tour: an element marked with data-tour="<target>", or none for a centred card. */
type Stop = { target?: string; title: string; body: string }

const STOPS: Record<string, Stop[]> = {
  worker: [
    { title: 'tour_hello_t', body: 'tour_hello_b' },
    { target: 'scan', title: 'tour_scan_t', body: 'tour_scan_b' },
    { target: 'earnings', title: 'tour_earn_t', body: 'tour_earn_b' },
    { target: 'lots', title: 'tour_lots_t', body: 'tour_lots_b' },
    { target: 'nav-tab_lots', title: 'tour_navlots_t', body: 'tour_navlots_b' },
    { target: 'nav-tab_repair', title: 'tour_repair_t', body: 'tour_repair_b' },
    { target: 'nav-tab_profile', title: 'tour_profile_t', body: 'tour_profile_b' },
    { target: 'lang', title: 'tour_lang_t', body: 'tour_lang_b' },
    { title: 'tour_done_t', body: 'tour_done_b' },
  ],
  repairer: [
    { title: 'tour_hello_t', body: 'tour_hello_b' },
    { target: 'nav-tab_jobs', title: 'tour_jobs_t', body: 'tour_jobs_b' },
    { target: 'nav-tab_listing', title: 'tour_listing_t', body: 'tour_listing_b' },
    { target: 'nav-tab_profile', title: 'tour_profile_t', body: 'tour_profile_b' },
    { target: 'lang', title: 'tour_lang_t', body: 'tour_lang_b' },
    { title: 'tour_done_t', body: 'tour_done_b' },
  ],
  other: [
    { title: 'tour_hello_t', body: 'tour_hello_b' },
    { target: 'lang', title: 'tour_lang_t', body: 'tour_lang_b' },
    { title: 'tour_done_t', body: 'tour_done_b' },
  ],
}

const PAD = 8

/**
 * Guided tour over the live app. Everything except the part being explained is slightly darkened:
 * a clear "window" sits over the target and its huge shadow dims the rest of the screen.
 */
export default function Tour({ role, onDone }: { role: string; onDone: () => void }) {
  const { t } = useLang()
  const all = STOPS[role] ?? STOPS.other
  // wait (up to 3 s) for the screen to load its parts, then keep only stops whose target is on screen
  const [stops, setStops] = useState<Stop[] | null>(null)
  useEffect(() => {
    const found = (s: Stop) => !s.target || !!document.querySelector(`[data-tour="${s.target}"]`)
    const started = Date.now()
    const id = setInterval(() => {
      if (all.every(found) || Date.now() - started > 3000) { clearInterval(id); setStops(all.filter(found)) }
    }, 200)
    return () => clearInterval(id)
  }, [all])
  const [i, setI] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const stop = stops?.[i]

  const measure = useCallback(() => {
    const el = stop?.target ? document.querySelector(`[data-tour="${stop.target}"]`) : null
    setRect(el ? el.getBoundingClientRect() : null)
  }, [stop])

  useLayoutEffect(() => {
    const el = stop?.target ? document.querySelector(`[data-tour="${stop.target}"]`) : null
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    measure()
    const id = setTimeout(measure, 400) // after the scroll settles
    return () => clearTimeout(id)
  }, [stop, measure])

  useEffect(() => {
    window.addEventListener('resize', measure); window.addEventListener('scroll', measure, true)
    return () => { window.removeEventListener('resize', measure); window.removeEventListener('scroll', measure, true) }
  }, [measure])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onDone() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onDone])

  if (!stops || !stop) return null
  const last = i === stops.length - 1
  const vh = window.innerHeight
  // put the card below the target when there is room, otherwise above it
  const below = rect ? rect.bottom + 220 < vh : true
  const cardStyle: React.CSSProperties = rect
    ? below ? { top: Math.min(rect.bottom + PAD + 12, vh - 230) } : { bottom: Math.max(vh - rect.top + PAD + 12, 16) }
    : { top: '50%', transform: 'translateY(-50%)' }

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      {rect ? (
        <div aria-hidden className="pointer-events-none fixed rounded-2xl transition-all duration-300"
          style={{ left: rect.left - PAD, top: rect.top - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2, boxShadow: '0 0 0 9999px rgb(0 0 0 / 0.5)', outline: '3px solid var(--color-amber)' }} />
      ) : (
        <div aria-hidden className="fixed inset-0 bg-black/50" />
      )}
      {/* clicks outside the card do nothing, so the app underneath is not changed by accident */}
      <div className="fixed inset-0" />
      <div className="fixed left-1/2 w-[calc(100%-32px)] max-w-[440px] -translate-x-1/2 rounded-3xl bg-white p-5 shadow-card" style={cardStyle}>
        <p className="text-sm font-medium text-mute">{t('tour_step', { n: i + 1, m: stops.length })}</p>
        <h2 id="tour-title" className="mt-1 text-2xl font-bold leading-tight">{t(stop.title)}</h2>
        <p className="mt-2 text-lg leading-snug">{t(stop.body)}</p>
        <div className="mt-4 grid grid-cols-[auto_1fr] gap-2">
          {i > 0
            ? <Btn variant="secondary" full={false} onClick={() => setI(i - 1)}>{t('back')}</Btn>
            : <Btn variant="ghost" full={false} onClick={onDone}>{t('tour_skip')}</Btn>}
          <Btn autoFocus onClick={() => (last ? onDone() : setI(i + 1))} icon={last ? 'check' : 'chevR'}>{t(last ? 'tour_finish' : 'next')}</Btn>
        </div>
      </div>
    </div>
  )
}
