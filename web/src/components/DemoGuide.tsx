import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useLang } from '../lib/i18n.tsx'
import { useSession } from '../lib/session.tsx'
import { useFlow } from '../lib/flow.tsx'
import { fetchGuest, type DemoRole, type Guest } from '../lib/guest.ts'
import { warmUp } from '../lib/recognise.ts'
import { Btn } from './ui.tsx'
import Icon from './Icon.tsx'

/**
 * The guided Demo mode: one story told in four chapters, one per kind of user (worker, buyer, repairer, auditor).
 *
 * - Each step names its role, the page to open and (optionally) the element to point at, using the same
 *   data-tour="..." markers as the first-run Tour. Some steps carry a small task that ticks itself off.
 * - Moving into the next role shows a chapter screen. While it shows, the app switches to that role's demo
 *   account in the background (switchDemo), using a guest pass fetched when the demo started, so there is no
 *   blank "Loading" screen and no wait on the server.
 * - The app stays usable underneath: the dimming ignores taps. "Minimise" shrinks the guide to a small pill
 *   with no dimming at all, so the panel can use the screen freely.
 *
 * Only the shared demo accounts are ever used, so nothing here can touch real data (the server enforces it).
 */
type Task = { key: string; done: boolean }
type Step = { role: DemoRole; path: string; target?: string; key: string }

const CHAPTERS: DemoRole[] = ['worker', 'recycler', 'repairer', 'auditor']
const ICON: Record<DemoRole, string> = { worker: 'camera', recycler: 'box', repairer: 'repair', auditor: 'shield' }
// mid tones that read on both the light and the pitch-black theme
const TINT: Record<DemoRole, string> = { worker: '#3E9B66', recycler: '#D4930F', repairer: '#4C8BD6', auditor: '#A86CC8' }

// Order matters: it tells the story of old devices, from the worker who finds them to the auditor who checks them.
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
const COUNT = (r: DemoRole) => STEPS.filter((s) => s.role === r).length

const PAD = 8
const STEP_KEY = 'um_guide_step' // survives a reload, so a refresh mid-demo does not restart it
const SMALL_KEY = 'um_guide_small'

type Rect = { left: number; top: number; width: number; height: number }
const same = (a: Rect | null, b: Rect | null) => !!a && !!b && Math.abs(a.left - b.left) < 1 && Math.abs(a.top - b.top) < 1 && Math.abs(a.width - b.width) < 1 && Math.abs(a.height - b.height) < 1

export default function DemoGuide() {
  const { t } = useLang()
  const { demoRole, switchDemo, exitDemo, me } = useSession()
  const { flow } = useFlow()
  const nav = useNavigate()
  const loc = useLocation()
  const [i, setI] = useState(() => Math.min(Number(sessionStorage.getItem(STEP_KEY) ?? 0) || 0, STEPS.length - 1))
  const [small, setSmallState] = useState(() => sessionStorage.getItem(SMALL_KEY) === '1')
  const [chapter, setChapter] = useState<{ to: number; ready: boolean; err: string | null } | null>(null)
  const [rect, setRect] = useState<Rect | null>(null)
  const passes = useRef(new Map<DemoRole, Promise<Guest | null>>())
  const step = STEPS[i]
  const setSmall = (v: boolean) => { setSmallState(v); try { sessionStorage.setItem(SMALL_KEY, v ? '1' : '0') } catch { /* ignore */ } }

  // Fetch the other roles' guest passes now, so switching later needs no wait. Start loading the
  // on-device photo model too, in the background, before the panel reaches the Scan step.
  useEffect(() => {
    for (const r of CHAPTERS) if (r !== demoRole && !passes.current.has(r)) passes.current.set(r, fetchGuest(r).catch(() => null))
    const id = setTimeout(() => warmUp(), 1500)
    return () => clearTimeout(id)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // On first mount, make sure we are on the page the saved step expects.
  useEffect(() => { if (step.role === demoRole && loc.pathname !== step.path) nav(step.path) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const go = useCallback((n: number) => {
    const s = STEPS[n]
    sessionStorage.setItem(STEP_KEY, String(n))
    if (s.role === demoRole) { setI(n); nav(s.path); return }
    // a new role: show its chapter screen and switch accounts behind it
    setChapter({ to: n, ready: false, err: null })
    const pre = passes.current.get(s.role)
    passes.current.delete(s.role)
    ;(async () => {
      try {
        await switchDemo(s.role, pre ? await pre : null)
        setI(n); nav(s.path)
        setChapter({ to: n, ready: true, err: null })
      } catch (e) { setChapter({ to: n, ready: false, err: (e as Error).message }) }
    })()
  }, [demoRole, switchDemo, nav])

  // Point at this step's element. The page may still be loading, so look for it for up to 3 seconds;
  // after that only scrolling or resizing moves it, and those are measured at most once a frame.
  const measure = useCallback(() => {
    const el = step.target ? document.querySelector(`[data-tour="${step.target}"]`) : null
    const r = el ? el.getBoundingClientRect() : null
    const next = r ? { left: r.left, top: r.top, width: r.width, height: r.height } : null
    setRect((prev) => (same(prev, next) || (!prev && !next) ? prev : next))
    return !!el
  }, [step])
  useLayoutEffect(() => {
    setRect(null)
    if (!step.target || small || chapter) return
    let tries = 0, scrolled = false
    const id = setInterval(() => {
      const el = document.querySelector(`[data-tour="${step.target}"]`)
      if (el && !scrolled) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); scrolled = true }
      const found = measure()
      if (++tries > 10 || (found && tries > 2)) clearInterval(id)
    }, 300)
    return () => clearInterval(id)
  }, [step, measure, small, chapter, me])
  useEffect(() => {
    if (!step.target || small) return
    let frame = 0
    const onMove = () => { if (!frame) frame = requestAnimationFrame(() => { frame = 0; measure() }) }
    window.addEventListener('resize', onMove); window.addEventListener('scroll', onMove, true)
    return () => { cancelAnimationFrame(frame); window.removeEventListener('resize', onMove); window.removeEventListener('scroll', onMove, true) }
  }, [step, small, measure])

  const leave = async () => { sessionStorage.removeItem(STEP_KEY); sessionStorage.removeItem(SMALL_KEY); await exitDemo(); nav('/') }

  // tasks that tick themselves off as the panel does them
  const tasks: Task[] = step.key === 'dg_scan'
    ? [
        { key: t('dg_task_pick'), done: flow.images.some(Boolean) },
        { key: t('dg_task_check', { btn: t('check_device') }), done: loc.pathname.startsWith('/scan/') },
      ]
    : []
  const allDone = tasks.length > 0 && tasks.every((x) => x.done)
  const nextTask = tasks.find((x) => !x.done)

  const last = i === STEPS.length - 1
  const ch = CHAPTERS.indexOf(step.role)
  const inCh = STEPS.slice(0, i).filter((s) => s.role === step.role).length // steps already done in this chapter
  const name = me?.user?.name ?? ''
  const tint = TINT[step.role]

  // chapter progress bar: one segment per chapter, the current one split into its steps
  const Progress = ({ upTo, at }: { upTo: number; at: number }) => (
    <div className="flex gap-1.5" aria-label={t('dg_chapter', { n: upTo + 1, m: CHAPTERS.length })}>
      {CHAPTERS.map((r, k) => (
        <span key={r} className="flex gap-0.5" style={{ flex: COUNT(r) }}>
          {k === upTo && at >= 0
            ? Array.from({ length: COUNT(r) }, (_, j) => <span key={j} className="h-1.5 flex-1 rounded-full" style={{ background: j <= at ? TINT[r] : 'var(--color-hair)' }} />)
            : <span className="h-1.5 flex-1 rounded-full" style={{ background: k < upTo ? TINT[r] : 'var(--color-hair)' }} />}
        </span>
      ))}
    </div>
  )

  // ---- the chapter screen between roles ----
  if (chapter) {
    const r = STEPS[chapter.to].role
    const k = CHAPTERS.indexOf(r)
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-paper" role="dialog" aria-modal="true" aria-labelledby="dg-ch-title">
        <div className="mx-auto flex min-h-full max-w-[480px] flex-col gap-6 px-6 pb-8 pt-8">
          <Progress upTo={k} at={-1} />
          <div className="mt-8 flex flex-col gap-3">
            <p className="text-base font-semibold text-mute">{t('dg_chapter', { n: k + 1, m: CHAPTERS.length })}</p>
            <span className="flex h-18 w-18 items-center justify-center rounded-3xl bg-sunk" style={{ color: TINT[r], width: 72, height: 72 }}><Icon name={ICON[r]} size={38} /></span>
            <h2 id="dg-ch-title" className="text-4xl font-bold leading-tight">{t('dg_now_you', { role: t(`dg_role_${r}`) })}</h2>
            <p className="text-lg leading-snug text-mute">{t(`dg_chintro_${r}`)}</p>
          </div>
          <div className="mt-auto flex flex-col gap-3">
            {chapter.err && <p className="text-base text-bad" role="alert">{chapter.err}</p>}
            {chapter.err
              ? <Btn onClick={() => go(chapter.to)}>{t('retry')}</Btn>
              : <Btn disabled={!chapter.ready} onClick={() => setChapter(null)} icon={chapter.ready ? 'chevR' : undefined}>
                  {chapter.ready ? t('dg_continue_as', { name: me?.user?.name ?? t(`dg_rt_${r}`) }) : t('dg_switching', { role: t(`dg_rt_${r}`) })}
                </Btn>}
            {chapter.ready && <Btn variant="secondary" onClick={() => { setChapter(null); setSmall(true) }}>{t('dg_look_around')}</Btn>}
            <button type="button" onClick={leave} className="min-h-11 text-base font-semibold text-mute underline underline-offset-4">{t('dg_exit')}</button>
          </div>
        </div>
      </div>
    )
  }

  // ---- minimised: a pill, no dimming, the whole screen usable ----
  if (small) {
    const total = STEPS.length
    const C = 2 * Math.PI * 15
    return (
      <button type="button" onClick={() => setSmall(false)} aria-label={t('dg_open', { n: i + 1, m: total })}
        className="fixed bottom-24 right-4 z-50 flex min-h-13 items-center gap-2.5 rounded-full border border-hair bg-white py-1.5 pl-1.5 pr-4 text-left shadow-card">
        <svg width="40" height="40" viewBox="0 0 38 38" aria-hidden="true">
          <circle cx="19" cy="19" r="15" fill="none" stroke="var(--color-hair)" strokeWidth="4" />
          <circle cx="19" cy="19" r="15" fill="none" stroke={tint} strokeWidth="4" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - (i + 1) / total)} transform="rotate(-90 19 19)" />
          <text x="19" y="23" textAnchor="middle" fontSize="11" fontWeight="700" fill="currentColor">{i + 1}/{total}</text>
        </svg>
        <span className="flex flex-col leading-tight">
          <span className="text-xs text-mute">{allDone ? t('dg_task_done') : t(`dg_rt_${step.role}`)}</span>
          <span className="max-w-[160px] truncate text-base font-semibold">{nextTask ? nextTask.key : t(`${step.key}_t`)}</span>
        </span>
      </button>
    )
  }

  // ---- the guide sheet ----
  const vh = window.innerHeight
  return (
    <div className="pointer-events-none fixed inset-0 z-50" aria-live="polite">
      {/* dimming: four plain panels around the target (cheap to draw, unlike one huge shadow). Taps pass through. */}
      {rect && (
        <>
          <div aria-hidden className="fixed left-0 right-0 top-0 bg-black/45" style={{ height: Math.max(0, rect.top - PAD) }} />
          <div aria-hidden className="fixed left-0 right-0 bottom-0 bg-black/45" style={{ top: rect.top + rect.height + PAD }} />
          <div aria-hidden className="fixed left-0 bg-black/45" style={{ top: rect.top - PAD, height: rect.height + PAD * 2, width: Math.max(0, rect.left - PAD) }} />
          <div aria-hidden className="fixed right-0 bg-black/45" style={{ top: rect.top - PAD, height: rect.height + PAD * 2, left: rect.left + rect.width + PAD }} />
          <div aria-hidden className="fixed rounded-2xl" style={{ left: rect.left - PAD, top: rect.top - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2, outline: '3px solid var(--color-amber)' }} />
        </>
      )}
      <section role="dialog" aria-labelledby="dg-title"
        className="pointer-events-auto fixed bottom-0 left-1/2 flex max-h-[min(70vh,560px)] w-full max-w-[480px] -translate-x-1/2 flex-col gap-3 overflow-y-auto rounded-t-3xl border border-b-0 border-hair bg-white px-5 pb-6 pt-4 shadow-card"
        style={rect && rect.top + rect.height > vh * 0.45 ? { top: 16, bottom: 'auto', borderRadius: 24, maxHeight: '50vh' } : undefined}>
        <Progress upTo={ch} at={inCh} />
        <div className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-2 text-sm font-semibold" style={{ color: tint }}>
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sunk"><Icon name={ICON[step.role]} size={16} /></span>
            <span className="truncate">{name ? t('dg_you_are', { name, role: t(`dg_role_${step.role}`) }) : t(`dg_rt_${step.role}`)}</span>
          </span>
          <button type="button" onClick={() => setSmall(true)}
            className="flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border border-hair px-3 text-sm font-semibold">
            <Icon name="chevD" size={16} />{t('dg_minimise')}
          </button>
        </div>

        {last ? (
          <>
            <h2 id="dg-title" className="text-2xl font-bold leading-tight">{t('dg_recap_t')}</h2>
            <ol className="flex flex-col">
              {CHAPTERS.map((r) => (
                <li key={r} className="flex items-center gap-3 border-b border-hair py-2.5 last:border-b-0">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sunk" style={{ color: TINT[r] }}><Icon name="check" size={16} /></span>
                  <span className="text-base">{t(`dg_recap_${r}`)}</span>
                </li>
              ))}
            </ol>
            <p className="text-sm text-mute">{t('dg_finish_b')}</p>
            <Btn onClick={leave}>{t('dg_real_account')}</Btn>
            <Btn variant="secondary" onClick={() => go(0)}>{t('dg_replay')}</Btn>
          </>
        ) : (
          <>
            <div>
              <h2 id="dg-title" className="text-2xl font-bold leading-tight">{t(`${step.key}_t`)}</h2>
              <p className="mt-1.5 text-lg leading-snug">{t(`${step.key}_b`)}</p>
            </div>
            {tasks.length > 0 && (
              <div className="rounded-2xl bg-sunk px-4 py-3">
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-gold-ink">{t('dg_try_it')}</p>
                <ul className="flex flex-col gap-2">
                  {tasks.map((x) => (
                    <li key={x.key} className="flex items-center gap-2.5 text-base">
                      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md ${x.done ? 'bg-ok text-paper' : 'border-2 border-mute'}`}>{x.done && <Icon name="check" size={14} />}</span>
                      <span className={x.done ? 'text-mute line-through' : ''}>{x.key}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex items-center gap-2">
              {i > 0 && (
                <button type="button" onClick={() => go(i - 1)} aria-label={t('back')}
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-hair"><Icon name="chevL" size={20} /></button>
              )}
              <Btn icon="chevR" onClick={() => go(i + 1)}>{t('next')}</Btn>
            </div>
            <div className="flex items-center justify-between text-sm text-mute">
              <span className="num">{i + 1} / {STEPS.length}</span>
              <button type="button" onClick={leave} className="min-h-11 font-semibold underline underline-offset-4">{t('dg_exit')}</button>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
