import { useCallback, useEffect, useLayoutEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLang } from '../lib/i18n.tsx'
import { useSession } from '../lib/session.tsx'
import type { DemoRole } from '../lib/guest.ts'
import { Btn } from './ui.tsx'

/**
 * The guided Demo mode: one walkthrough that covers all four kinds of user (worker, buyer, repairer, auditor).
 *
 * How it works:
 * - Each step names the role it belongs to, the page to open and (optionally) the element to point at,
 *   using the same data-tour="..." markers as the first-run Tour.
 * - When the next step belongs to a different role, the guide asks the server for a guest pass for that
 *   role's demo account (session.startDemo) and the whole app switches, exactly as if that person signed in.
 * - Unlike the first-run Tour, the app stays usable underneath: the dimming layer ignores clicks
 *   (pointer-events: none), so "try it" steps let the panel actually tap the sample photos, bid, and so on.
 * - The card can be shrunk to a small pill so it does not cover the screen while someone tries a feature.
 *
 * Only the shared demo accounts are ever used, so nothing here can touch real data (the server enforces it).
 */
type Step = { role: DemoRole; path: string; target?: string; key: string }

// Order matters: it tells the story of one device, from the worker who finds it to the auditor who checks it.
const STEPS: Step[] = [
  { role: 'worker', path: '/', key: 'dg_intro' },
  { role: 'worker', path: '/', target: 'earnings', key: 'dg_home' },
  { role: 'worker', path: '/scan', target: 'samples', key: 'dg_scan' },
  { role: 'worker', path: '/lots', key: 'dg_lots' },
  { role: 'worker', path: '/repair', key: 'dg_wrepair' },
  { role: 'worker', path: '/profile', target: 'lang', key: 'dg_profile' },
  { role: 'recycler', path: '/recycler', key: 'dg_market' },
  { role: 'recycler', path: '/recycler', target: 'bid', key: 'dg_bid' },
  { role: 'repairer', path: '/repair', target: 'start-job', key: 'dg_jobs' },
  { role: 'repairer', path: '/repair/listing', key: 'dg_listing' },
  { role: 'auditor', path: '/auditor', target: 'kpis', key: 'dg_overview' },
  { role: 'auditor', path: '/auditor/workers', target: 'people', key: 'dg_people' },
  { role: 'auditor', path: '/auditor/rates', target: 'rates', key: 'dg_rates' },
  { role: 'auditor', path: '/auditor', key: 'dg_finish' },
]

const PAD = 8
const STEP_KEY = 'um_guide_step' // survives a reload, so a refresh mid-demo does not restart it

export default function DemoGuide() {
  const { t } = useLang()
  const { demoRole, startDemo, exitDemo, me } = useSession()
  const nav = useNavigate()
  const [i, setI] = useState(() => Number(sessionStorage.getItem(STEP_KEY) ?? 0) || 0)
  const [small, setSmall] = useState(false)
  const [busy, setBusy] = useState(false)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const step = STEPS[Math.min(i, STEPS.length - 1)]

  // Go to a step: switch account first if the step belongs to another role, then open its page.
  const go = useCallback(async (n: number) => {
    const s = STEPS[n]
    sessionStorage.setItem(STEP_KEY, String(n))
    setI(n)
    if (s.role !== demoRole) {
      setBusy(true)
      try { await startDemo(s.role) } finally { setBusy(false) }
    }
    nav(s.path)
  }, [demoRole, startDemo, nav])

  // On first mount, make sure we are on the page the saved step expects.
  useEffect(() => { if (step.role === demoRole) nav(step.path) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Find the element this step points at. The page may still be loading, so look again a few times.
  const measure = useCallback(() => {
    const el = step.target ? document.querySelector(`[data-tour="${step.target}"]`) : null
    setRect(el ? el.getBoundingClientRect() : null)
  }, [step])
  useLayoutEffect(() => {
    let tries = 0
    const id = setInterval(() => {
      const el = step.target ? document.querySelector(`[data-tour="${step.target}"]`) : null
      if (el && tries === 0) el.scrollIntoView({ block: 'center', behavior: 'smooth' })
      measure()
      if (++tries > 10 || (el && tries > 2)) clearInterval(id)
    }, 300)
    return () => clearInterval(id)
  }, [step, measure, me])
  useEffect(() => {
    window.addEventListener('resize', measure); window.addEventListener('scroll', measure, true)
    return () => { window.removeEventListener('resize', measure); window.removeEventListener('scroll', measure, true) }
  }, [measure])

  const leave = async () => { sessionStorage.removeItem(STEP_KEY); await exitDemo(); nav('/') }

  const last = i === STEPS.length - 1
  const roleName = t(`dg_role_${step.role}`)

  if (small) {
    // shrunk: a pill in the corner, so the panel can use the screen freely
    return (
      <button type="button" onClick={() => setSmall(false)}
        className="fixed bottom-24 right-4 z-50 min-h-11 rounded-full bg-ink px-4 font-semibold text-paper shadow-card">
        {t('dg_open', { n: i + 1, m: STEPS.length })}
      </button>
    )
  }

  const vh = window.innerHeight
  const below = rect ? rect.bottom + 260 < vh : false
  const cardStyle: React.CSSProperties = rect
    ? below ? { top: Math.min(rect.bottom + PAD + 12, vh - 270) } : { bottom: Math.max(vh - rect.top + PAD + 12, 16) }
    : { bottom: 96 }

  return (
    <div className="pointer-events-none fixed inset-0 z-50" aria-live="polite">
      {/* the spotlight: a clear window over the target; its big shadow dims everything else. Clicks pass through. */}
      {rect && (
        <div aria-hidden className="fixed rounded-2xl transition-all duration-300"
          style={{ left: rect.left - PAD, top: rect.top - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2, boxShadow: '0 0 0 9999px rgb(0 0 0 / 0.35)', outline: '3px solid var(--color-amber)' }} />
      )}
      <section role="dialog" aria-labelledby="dg-title"
        className="pointer-events-auto fixed left-1/2 w-[calc(100%-32px)] max-w-[460px] -translate-x-1/2 rounded-3xl bg-white p-5 shadow-card" style={cardStyle}>
        <p className="text-sm font-medium text-mute">{t('dg_step', { n: i + 1, m: STEPS.length, role: roleName })}</p>
        <h2 id="dg-title" className="mt-1 text-2xl font-bold leading-tight">{t(`${step.key}_t`)}</h2>
        <p className="mt-2 text-lg leading-snug">{t(`${step.key}_b`)}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {i > 0 && <Btn variant="secondary" full={false} disabled={busy} onClick={() => go(i - 1)}>{t('back')}</Btn>}
          <Btn full={false} disabled={busy} icon={last ? 'check' : 'chevR'}
            onClick={() => (last ? leave() : go(i + 1))}>{busy ? t('loading') : t(last ? 'dg_end' : 'next')}</Btn>
          <Btn variant="ghost" full={false} onClick={() => setSmall(true)}>{t('dg_hide')}</Btn>
          <Btn variant="ghost" full={false} onClick={leave}>{t('dg_exit')}</Btn>
        </div>
      </section>
    </div>
  )
}
