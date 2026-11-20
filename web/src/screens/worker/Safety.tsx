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
import { Screen, Btn, Banner, EmergencyLine, Tag, Loading, ErrorNote, H2, Header } from '../../components/ui.tsx'
import Icon from '../../components/Icon.tsx'
import StepDrawing from '../../components/StepDrawing.tsx'

function useDraftPack() {
  const { lang } = useLang()
  const { flow } = useFlow()
  const pack = flow.type ? packFor(flow.type) : null
  return useApi<SafetyPack>(pack ? `/api/safety/${pack}?lang=${lang}` : null)
}

function ListenButton({ text }: { text: string }) {
  const { t, lang } = useLang()
  const [on, setOn] = useState(false)
  const hasVoice = useVoiceAvailable(lang)
  useEffect(() => () => stopSpeaking(), [])
  return (
    <div>
      <button onClick={() => { if (on) { stopSpeaking(); setOn(false) } else { setOn(true); speak(text, lang, () => setOn(false)) } }}
        aria-pressed={on} className={`flex min-h-12 w-full items-center justify-center gap-2 border border-ink px-3 font-semibold ${on ? 'bg-ink text-paper' : 'bg-white'}`}>
        <Icon name="volume" size={22} />{on ? t('stop_audio') : t('listen')}
      </button>
      {!hasVoice && <p className="mt-1 text-sm text-mute">{t('no_voice')}</p>}
    </div>
  )
}

export function Briefing() {
  const { t } = useLang()
  const nav = useNavigate()
  const { flow } = useFlow()
  const { data: pack, error, loading } = useDraftPack()
  const [checked, setChecked] = useState<Record<number, boolean>>({})
  if (!flow.type || !packFor(flow.type)) return <Navigate to="/scan" replace />
  const all = pack ? pack.gear.every((_, i) => checked[i]) : false

  return (
    <Screen title={t('safety_title')} tabs={false}>
      {error && <ErrorNote message={error} />}
      {loading && <Loading />}
      {pack && (
        <>
          {pack.draft && <Banner tone="bad" icon="alert">{pack.draft_banner}</Banner>}
          <div className="mt-3"><EmergencyLine text={pack.emergency} /></div>
          <H2>{t('gear_title')}</H2>
          <p className="mb-2 text-sm text-mute">{t('gear_help')}</p>
          <ul className="divide-y divide-hair border-y border-hair">
            {pack.gear.map((g, i) => (
              <li key={g}>
                <label className="flex min-h-12 cursor-pointer items-center gap-3 py-2">
                  <input type="checkbox" checked={!!checked[i]} onChange={(e) => setChecked({ ...checked, [i]: e.target.checked })} className="h-6 w-6 shrink-0 accent-ink" />
                  <span className="font-medium">{g}</span>
                </label>
              </li>
            ))}
          </ul>
          <div className="mt-3"><ListenButton text={`${pack.emergency}. ${pack.gear.join('. ')}`} /></div>
          <p className="mt-3 flex items-center gap-2 text-sm text-mute"><Tag>{pack.version}</Tag>{t('steps_count', { n: pack.steps.length })}</p>
          <div className="mt-4"><Btn onClick={() => nav('/safety/step')} disabled={!all} icon="chevR">{all ? t('start_steps') : t('tick_all')}</Btn></div>
        </>
      )}
    </Screen>
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

  return (
    <div className="pb-8" key={step?.id ?? 'loading'}>
      <Header title={t('step_of', { n: stepIdx + 1 > 0 ? stepIdx + 1 : 1, m: pack?.steps.length ?? '-' })} />
      {pack && <div className="sticky top-14 z-10"><EmergencyLine text={pack.emergency} /></div>}
      <main className="px-4 pt-4">
        {error && <ErrorNote message={error} />}
        {loading && <Loading />}
        {pack && step && (
          <>
            <div className="mb-3 flex gap-1" aria-hidden>
              {pack.steps.map((s, i) => <span key={s.id} className={`h-2 flex-1 border border-ink ${i < stepIdx ? 'bg-ink' : i === stepIdx ? 'bg-amber' : 'bg-white'}`} />)}
            </div>
            <StepDrawing id={step.drawing} />
            <h2 className="mt-4 text-2xl font-bold leading-snug">{step.title}</h2>
            <p className="mt-1 text-lg leading-snug">{step.instruction}</p>
            {step.photo_required && <p className="mt-2"><Tag tone="bad">{t('photo_required')}</Tag></p>}

            <div className="mt-4"><ListenButton text={speech} /></div>

            <div className="mt-4 grid gap-3">
              <section className="border border-ok p-3" aria-label={t('do')}>
                <h3 className="mb-1 flex items-center gap-1 font-mono text-sm font-bold uppercase text-ok"><Icon name="check" size={18} />{t('do')}</h3>
                <ul className="space-y-1">{step.do.map((d) => <li key={d} className="flex gap-2"><Icon name="check" size={18} className="mt-1 shrink-0 text-ok" />{d}</li>)}</ul>
              </section>
              <section className="border border-bad p-3" aria-label={t('dont')}>
                <h3 className="mb-1 flex items-center gap-1 font-mono text-sm font-bold uppercase text-bad"><Icon name="x" size={18} />{t('dont')}</h3>
                <ul className="space-y-1">{step.dont.map((d) => <li key={d} className="flex gap-2"><Icon name="x" size={18} className="mt-1 shrink-0 text-bad" />{d}</li>)}</ul>
              </section>
            </div>

            {step.photo_required && (
              <div className="mt-4">
                <label className="relative flex min-h-32 w-full cursor-pointer flex-col items-center justify-center gap-1 overflow-hidden border-2 border-dashed border-ink bg-white font-semibold">
                  <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => { void takePhoto(e.target.files?.[0]); e.target.value = '' }} />
                  {photo ? <img src={photo.url} alt="" className="absolute inset-0 h-full w-full object-cover" /> : <Icon name="camera" size={32} />}
                  <span className={photo ? 'absolute bottom-0 flex w-full items-center justify-center gap-1 bg-ink py-1 text-paper' : ''}>
                    {photo && <Icon name="check" size={16} />}{busy ? t('saving') : photo ? t('photo_taken') : t('take_proof')}
                  </span>
                </label>
                {err && <ErrorNote message={err} />}
              </div>
            )}

            <div className="mt-5">
              <Btn onClick={done} disabled={busy || (step.photo_required && !photo)} icon="check">{stepIdx === pack.steps.length - 1 ? t('finish_steps') : t('step_done')}</Btn>
              {step.photo_required && !photo && <p className="mt-1 text-center text-sm text-mute">{t('photo_first')}</p>}
            </div>
            <p className="mt-4 text-center text-sm text-bad">{pack.draft ? pack.draft_banner : ''}</p>
          </>
        )}
      </main>
    </div>
  )
}
