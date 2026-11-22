import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useLang } from '../../lib/i18n.tsx'
import { useFlow } from '../../lib/flow.tsx'
import { useApi } from '../../lib/useApi.ts'
import { api } from '../../lib/api.ts'
import { packFor } from '../../lib/devices.ts'
import { fileToDataUrl } from '../../lib/image.ts'
import { speak, stopSpeaking, useVoiceAvailable } from '../../lib/speech.ts'
import type { SafetyPack } from '../../lib/types.ts'
import { Btn, Banner, EmergencyLine, Tag, ErrorNote, H2, Header } from '../../components/ui.tsx'
import { Rail, Meter, DraftRibbon, Skeleton } from '../../components/kit.tsx'
import Illustration from '../../components/Illustration.tsx'
import Icon from '../../components/Icon.tsx'
import StepDrawing from '../../components/StepDrawing.tsx'

function useDraftPack() {
  const { contentLang: lang } = useLang()
  const { flow } = useFlow()
  const pack = flow.type ? packFor(flow.type) : null
  return useApi<SafetyPack>(pack ? `/api/safety/${pack}?lang=${lang}` : null)
}

function ListenButton({ text }: { text: string }) {
  const { t, contentLang: lang } = useLang()
  const [on, setOn] = useState(false)
  const hasVoice = useVoiceAvailable(lang)
  useEffect(() => () => stopSpeaking(), [])
  return (
    <div>
      <button onClick={() => { if (on) { stopSpeaking(); setOn(false) } else { setOn(true); speak(text, lang, () => setOn(false)) } }}
        aria-pressed={on} className={`flex min-h-14 w-full items-center justify-center gap-2 border-2 border-brand px-3 text-base font-bold ${on ? 'bg-brand text-onbrand' : 'bg-white'}`}>
        <Icon name="volume" size={24} />{on ? t('stop_audio') : t('listen')}
      </button>
      {!hasVoice && <p className="mt-1 text-sm text-mute">{t('no_voice')}</p>}
    </div>
  )
}

function BottomBar({ children }: { children: React.ReactNode }) {
  return <div className="fixed bottom-0 left-1/2 z-30 w-full max-w-[480px] -translate-x-1/2 border-t border-hair bg-paper p-3">{children}</div>
}

export function Briefing() {
  const { t, lang } = useLang()
  const nav = useNavigate()
  const { flow } = useFlow()
  const { data: pack, error, loading } = useDraftPack()
  const [checked, setChecked] = useState<Record<number, boolean>>({})
  if (!flow.type || !packFor(flow.type)) return <Navigate to="/scan" replace />
  const count = pack ? pack.gear.filter((_, i) => checked[i]).length : 0
  const all = pack ? count === pack.gear.length : false

  return (
    <div className="pb-28">
      <Header title={t('safety_title')} />
      {pack && <div className="sticky top-14 z-10"><DraftRibbon text={pack.draft_banner} /></div>}
      <main id="main" className="screen-enter px-4 pt-4">
        <Rail items={['rail_brief', 'rail_steps', 'rail_lot'].map((k, i) => ({ label: t(k), state: i === 0 ? 'now' : 'todo' }))} />
        {error && <ErrorNote message={error} />}
        {loading && <Skeleton rows={4} />}
        {pack && (
          <>
            {lang !== 'hi' && lang !== 'en' && <div className="mt-4"><Banner icon="info">{t('content_fallback')}</Banner></div>}
            <div className="mt-4"><EmergencyLine text={pack.emergency} /></div>
            <div className="mt-4 flex items-center gap-3 rounded-2xl border border-hair bg-white p-3">
              <Illustration art="shield" className="h-16 w-24 shrink-0" />
              <p className="text-base leading-snug">{t('brief_intro')}</p>
            </div>

            <H2 right={<span className="num text-base font-semibold">{count}/{pack.gear.length}</span>}>{t('gear_title')}</H2>
            <Meter value={pack.gear.length ? count / pack.gear.length : 0} label={t('gear_title')} valueText={`${count}/${pack.gear.length}`} tone="ok" />
            <p className="mb-2 mt-2 text-base text-mute">{t('gear_help')}</p>
            <ul className="divide-y divide-hair border-y border-hair">
              {pack.gear.map((g, i) => (
                <li key={g}>
                  <label className="flex min-h-16 cursor-pointer items-center gap-3 py-2">
                    <input type="checkbox" checked={!!checked[i]} onChange={(e) => setChecked({ ...checked, [i]: e.target.checked })} className="h-7 w-7 shrink-0 accent-ink" />
                    <Icon name="shield" size={22} className="shrink-0" />
                    <span className="flex-1 text-lg font-semibold leading-snug">{g}</span>
                    {checked[i] && <Icon name="check" size={22} className="shrink-0 text-ok" />}
                  </label>
                </li>
              ))}
            </ul>
            <div className="mt-4"><ListenButton text={`${pack.emergency}. ${pack.gear.join('. ')}`} /></div>
            <p className="mt-3 flex items-center gap-2 text-sm text-mute">{t('steps_count', { n: pack.steps.length })}</p>
          </>
        )}
      </main>
      <BottomBar>
        <Btn onClick={() => nav('/safety/step')} disabled={!all} icon="chevR">{all ? t('start_steps') : t('tick_all')}</Btn>
      </BottomBar>
    </div>
  )
}

export function Step() {
  const { t } = useLang()
  const nav = useNavigate()
  const { flow, patch } = useFlow()
  const { data: pack, error, loading } = useDraftPack()
  const [photo, setPhoto] = useState<{ url: string; hash: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  if (!flow.type || !packFor(flow.type)) return <Navigate to="/scan" replace />
  const stepIdx = pack ? pack.steps.findIndex((s) => !(s.id in flow.done)) : -1
  const step = pack && stepIdx >= 0 ? pack.steps[stepIdx] : null
  if (pack && !step) return <Navigate to="/sell" replace />

  async function takePhoto(f: File | undefined) {
    if (!f) return
    setBusy(true); setErr(null)
    try {
      const url = await fileToDataUrl(f)
      const { hash } = await api<{ hash: string }>('/api/photos', { body: { dataUrl: url } })
      setPhoto({ url, hash })
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }

  function done() {
    if (!step) return
    stopSpeaking()
    patch({ done: { ...flow.done, [step.id]: photo?.hash ?? true }, extraHashes: photo ? [...flow.extraHashes, photo.hash] : flow.extraHashes })
    setPhoto(null)
    if (pack && stepIdx === pack.steps.length - 1) nav('/sell')
    else window.scrollTo(0, 0)
  }

  const speech = step ? `${step.title}. ${step.instruction}. ${t('do')}: ${step.do.join('. ')}. ${t('dont')}: ${step.dont.join('. ')}.` : ''
  const last = pack ? stepIdx === pack.steps.length - 1 : false

  return (
    <div className="pb-28">
      <Header title={t('step_of', { n: stepIdx + 1 > 0 ? stepIdx + 1 : 1, m: pack?.steps.length ?? '-' })} />
      {pack && (
        <div className="sticky top-14 z-10">
          <EmergencyLine text={pack.emergency} />
          <DraftRibbon text={pack.draft_banner} />
        </div>
      )}
      <main id="main" className="screen-enter px-4 pt-4">
        {error && <ErrorNote message={error} />}
        {loading && <Skeleton rows={4} />}
        {pack && step && (
          <>
            <ol className="mb-4 flex gap-1.5" aria-label={t('step_of', { n: stepIdx + 1, m: pack.steps.length })}>
              {pack.steps.map((s, i) => (
                <li key={s.id} aria-current={i === stepIdx ? 'step' : undefined}
                  className={`num flex h-9 flex-1 items-center justify-center border-2 border-brand text-base font-bold ${i < stepIdx ? 'bg-brand text-onbrand' : i === stepIdx ? 'bg-amber' : 'bg-white text-mute'}`}>
                  {i < stepIdx ? <Icon name="check" size={18} /> : i + 1}
                </li>
              ))}
            </ol>

            <StepDrawing id={step.drawing} />
            <h2 className="mt-4 text-2xl font-bold leading-snug">{step.title}</h2>
            <p className="mt-1 text-lg leading-snug">{step.instruction}</p>
            {step.photo_required && <p className="mt-2"><Tag tone="bad">{t('photo_required')}</Tag></p>}

            <div className="mt-4"><ListenButton text={speech} /></div>

            <div className="mt-4 grid gap-3">
              <section className="border-2 border-ok bg-white" aria-label={t('do')}>
                <h3 className="flex items-center gap-2 bg-ok px-3 py-1.5 text-base font-bold text-onbrand"><Icon name="check" size={20} />{t('do')}</h3>
                <ul className="space-y-2 p-3">{step.do.map((d) => <li key={d} className="flex gap-2 text-lg leading-snug"><Icon name="check" size={22} className="mt-0.5 shrink-0 text-ok" />{d}</li>)}</ul>
              </section>
              <section className="border-2 border-bad bg-white" aria-label={t('dont')}>
                <h3 className="flex items-center gap-2 bg-bad px-3 py-1.5 text-base font-bold text-onbrand"><Icon name="x" size={20} />{t('dont')}</h3>
                <ul className="space-y-2 p-3">{step.dont.map((d) => <li key={d} className="flex gap-2 text-lg leading-snug"><Icon name="x" size={22} className="mt-0.5 shrink-0 text-bad" />{d}</li>)}</ul>
              </section>
            </div>

            {step.photo_required && (
              <div className="mt-4">
                <label className="relative flex min-h-40 w-full cursor-pointer flex-col items-center justify-center gap-1 overflow-hidden border-2 border-dashed border-hair bg-white text-base font-bold focus-within:outline focus-within:outline-[3px] focus-within:outline-offset-2 focus-within:outline-ink">
                  <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => { void takePhoto(e.target.files?.[0]); e.target.value = '' }} />
                  {photo ? <img src={photo.url} alt="" className="absolute inset-0 h-full w-full object-cover" /> : <Icon name="camera" size={36} />}
                  <span className={photo ? 'absolute bottom-0 flex w-full items-center justify-center gap-1 bg-ink py-1.5 text-paper' : ''}>
                    {photo && <Icon name="check" size={18} />}{busy ? t('saving') : photo ? t('photo_taken') : t('take_proof')}
                  </span>
                </label>
                {err && <ErrorNote message={err} />}
              </div>
            )}
          </>
        )}
      </main>
      {pack && step && (
        <BottomBar>
          <Btn onClick={done} disabled={busy || (step.photo_required && !photo)} icon="check">{last ? t('finish_steps') : t('step_done')}</Btn>
          {step.photo_required && !photo && <p className="mt-1 text-center text-sm text-mute">{t('photo_first')}</p>}
        </BottomBar>
      )}
    </div>
  )
}
