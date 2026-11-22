import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLang } from '../../lib/i18n.tsx'
import { useFlow } from '../../lib/flow.tsx'
import { api } from '../../lib/api.ts'
import { DEVICE_TYPES } from '../../lib/devices.ts'
import { fileToDataUrl } from '../../lib/image.ts'
import { recognise, warmUp, type Guess, type Kind } from '../../lib/recognise.ts'
import type { ScanResult } from '../../lib/types.ts'
import { Screen, H2, Btn, ErrorNote, inputCls } from '../../components/ui.tsx'
import { Rail } from '../../components/kit.tsx'
import Illustration from '../../components/Illustration.tsx'
import Icon from '../../components/Icon.tsx'

const SHOTS = ['shot_top', 'shot_under', 'shot_back', 'shot_label']

export function TypeGrid({ value, onPick, allowUnsure = false }: { value: string | null; onPick: (t: string | null) => void; allowUnsure?: boolean }) {
  const { t } = useLang()
  const items = allowUnsure ? [...DEVICE_TYPES, '__unsure'] : DEVICE_TYPES
  return (
    <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t('what_is_it')}>
      {items.map((ty) => {
        const sel = ty === '__unsure' ? value === null : value === ty
        return (
          <button key={ty} role="radio" aria-checked={sel} onClick={() => onPick(ty === '__unsure' ? null : ty)}
            className={`flex min-h-14 items-center gap-2 border px-3 text-left text-base font-semibold ${sel ? 'border-brand bg-brand text-onbrand' : 'border-hair bg-white'}`}>
            <Icon name={ty === '__unsure' ? 'info' : ty} size={22} />
            <span className="flex-1">{ty === '__unsure' ? t('not_sure') : t('type.' + ty)}</span>
            {sel && <Icon name="check" size={18} />}
          </button>
        )
      })}
    </div>
  )
}

export default function Scan() {
  const { t } = useLang()
  const nav = useNavigate()
  const { flow, patch, setImage } = useFlow()
  const [busy, setBusy] = useState(false)
  const [stage, setStage] = useState(0)
  const [err, setErr] = useState<string | null>(null)
  const firstEmpty = flow.images.findIndex((x) => !x)
  const [active, setActive] = useState(firstEmpty === -1 ? 0 : firstEmpty)
  const taken = flow.images.filter(Boolean).length
  const img = flow.images[active]
  // On-device photo recognition: looks at every photo, suggests a type; the worker always has the final say.
  const [guess, setGuess] = useState<Guess | null>(null)
  const [looking, setLooking] = useState(false)
  const [picked, setPicked] = useState(false) // the worker chose a type themselves: never overwrite it
  useEffect(() => { warmUp() }, [])
  const photos = flow.images.filter(Boolean) as string[]
  const photoKey = photos.map((p) => p.length + p.slice(-24)).join('|')
  useEffect(() => {
    if (!photos.length) { setGuess(null); return }
    let gone = false
    setLooking(true)
    recognise(photos).then((g) => {
      if (gone || !g) return
      setGuess(g)
      patch({ looks: g.looks })
      // sure enough, and not a screen (flat or tube is asked): pre-select it
      if (!picked && g.confidence >= 0.6 && g.best !== 'other' && g.best !== 'screen') patch({ hint: g.best })
    }).catch(() => {}).finally(() => { if (!gone) setLooking(false) })
    return () => { gone = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photoKey])
  const pick = (hint: string | null) => { setPicked(true); patch({ hint }) }
  const sure = guess && guess.confidence >= 0.6
  // the two likeliest of our types, for "Is it a … or a …?"
  const options = guess ? guess.ranked.filter((r) => r.kind !== 'other' && r.p >= 0.08).slice(0, 2).map((r) => r.kind) : []
  const isScreen = guess?.best === 'screen' || (!sure && options.includes('screen'))
  const kindLabel = (k: Kind) => (k === 'screen' ? t('type_screen') : t('type.' + k))

  // The three stages are real work on the server (upload, OCR, matching); the timer only paces the display.
  useEffect(() => {
    if (!busy) { setStage(0); return }
    const i = setInterval(() => setStage((s) => Math.min(2, s + 1)), 1500)
    return () => clearInterval(i)
  }, [busy])

  async function onFile(f: File | undefined) {
    if (!f) return
    try {
      const url = await fileToDataUrl(f)
      setImage(active, url)
      const nextEmpty = flow.images.findIndex((x, j) => !x && j !== active)
      if (nextEmpty !== -1) setActive(nextEmpty)
    } catch (e) { setErr((e as Error).message) }
  }

  async function submit() {
    setBusy(true); setErr(null)
    try {
      const res = await api<ScanResult>('/api/scan', { body: { images: flow.images.filter(Boolean), hint: flow.hint ?? undefined, ocrText: flow.labelText || undefined } })
      patch({ scan: res, type: res.type === 'unknown' ? null : res.type, modelId: null, estimate: null, done: {}, extraHashes: [], lot: null, works: null, resaleId: null, wear: 'good', customPrice: null, qty: 1, condition: null })
      nav('/scan/confirm')
    } catch (e) { setErr((e as Error).message); setBusy(false) }
  }

  if (busy) {
    return (
      <Screen title={t('scan_title')} back={false} tabs={false}>
        <div className="mt-6 rounded-3xl bg-white shadow-card p-5" role="status" aria-live="polite">
          <Illustration art="scan" className="mx-auto h-28 w-44" />
          <p className="mt-2 text-center text-xl font-bold">{t('checking')}</p>
          <p className="mb-5 mt-1 text-center text-base text-mute">{t('reading_label')}</p>
          <Rail items={['scan_stage_upload', 'scan_stage_read', 'scan_stage_match'].map((k, i) => ({ label: t(k), state: i < stage ? 'done' : i === stage ? 'now' : 'todo' }))} />
        </div>
      </Screen>
    )
  }

  return (
    <Screen title={t('scan_title')} back="/" tabs={false}>
      <div className="pb-44">
        <Rail items={['rail_photos', 'rail_check', 'rail_confirm', 'rail_price'].map((k, i) => ({ label: t(k), state: i === 0 ? 'now' : 'todo' }))} />

        <H2>{t('take_photos')}</H2>
        <p className="mb-3 text-base text-mute">{t('photos_help')}</p>

        <div className="rounded-3xl bg-white shadow-card">
          <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-sunk">
            {img ? <img src={img} alt={t(SHOTS[active])} className="h-full w-full object-cover" /> : <Illustration art="scan" className="h-32 w-48" />}
            <span className="num absolute left-0 top-0 bg-ink px-2 py-1 text-sm font-semibold text-paper">{t('photo_n_of', { n: active + 1, m: 4 })}</span>
          </div>
          <div className="p-3">
            <p className="text-lg font-bold">{t(SHOTS[active])}</p>
            <p className="text-base leading-snug text-mute">{t(SHOTS[active] + '_help')}</p>
            <label className="mt-3 flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 border border-hair bg-amber px-4 font-semibold focus-within:outline focus-within:outline-[3px] focus-within:outline-offset-2 focus-within:outline-ink">
              <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = '' }} />
              <Icon name="camera" size={22} />{img ? t('retake') : t('take_photo')}
            </label>
          </div>
        </div>

        <ul className="mt-2 grid grid-cols-4 gap-2" aria-label={t('take_photos')}>
          {SHOTS.map((k, i) => (
            <li key={k}>
              <button onClick={() => setActive(i)} aria-label={`${t(k)}${flow.images[i] ? ' ✓' : ''}`} aria-current={i === active}
                className={`relative flex aspect-square w-full items-center justify-center overflow-hidden border-2 ${i === active ? 'border-hair bg-amber' : 'border-hair bg-white'}`}>
                {flow.images[i] ? <img src={flow.images[i]!} alt="" className="absolute inset-0 h-full w-full object-cover" /> : <span className="num text-lg font-bold">{i + 1}</span>}
                {flow.images[i] && <span className="absolute bottom-0 right-0 bg-ink p-0.5 text-paper"><Icon name="check" size={14} /></span>}
              </button>
            </li>
          ))}
        </ul>

        <H2>{t('what_is_it')}</H2>
        <div aria-live="polite">
          {looking && !guess && <p className="mb-2 text-base text-mute" role="status">{t('ai_looking')}</p>}
          {guess && !picked && (
            <div className="mb-3 rounded-2xl border border-hair bg-white p-3">
              {guess.best === 'other' && !options.length ? (
                <p className="text-base">{t('ai_not_ours')}</p>
              ) : isScreen ? (
                <>
                  <p className="mb-2 text-base font-semibold">{t('ai_screen_q')}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Btn variant="secondary" onClick={() => pick('lcd_monitor')}>{t('screen_flat')}</Btn>
                    <Btn variant="secondary" onClick={() => pick('crt_monitor')}>{t('screen_tube')}</Btn>
                  </div>
                </>
              ) : sure ? (
                <p className="text-base">{t('ai_sure', { type: kindLabel(guess.best) })}</p>
              ) : (
                <>
                  <p className="mb-2 text-base font-semibold">{options.length > 1 ? t('ai_which', { a: kindLabel(options[0]), b: kindLabel(options[1]) }) : t('ai_maybe', { type: kindLabel(options[0]) })}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {options.map((k) => <Btn key={k} variant="secondary" icon={k} onClick={() => pick(k)}>{kindLabel(k)}</Btn>)}
                  </div>
                </>
              )}
              {guess.photos < 2 && photos.length < 4 && <p className="mt-2 text-sm text-mute">{t('ai_more_photos')}</p>}
            </div>
          )}
        </div>
        <TypeGrid value={flow.hint} onPick={pick} allowUnsure />

        <H2>{t('label_text')}</H2>
        <input className={inputCls} value={flow.labelText} onChange={(e) => patch({ labelText: e.target.value })} placeholder={t('label_placeholder')} aria-label={t('label_text')} />
        <p className="mt-1 text-sm text-mute">{t('label_help')}</p>

        {err && <ErrorNote message={err} />}
      </div>

      <div className="fixed bottom-0 left-1/2 z-30 w-full max-w-[480px] -translate-x-1/2 border-t border-hair bg-paper p-3">
        <Btn onClick={submit} disabled={taken === 0} icon="scan">{t('check_device')}{taken > 0 ? ` · ${t('photos_added', { n: taken })}` : ''}</Btn>
        {taken === 0 && <p className="mt-1 text-center text-sm text-mute">{t('need_one_photo')}</p>}
      </div>
    </Screen>
  )
}
