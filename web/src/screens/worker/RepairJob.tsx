import { useState } from 'react'
import { useLang } from '../../lib/i18n.tsx'
import { useApi } from '../../lib/useApi.ts'
import { api } from '../../lib/api.ts'
import { fileToDataUrl } from '../../lib/image.ts'
import { dateShort } from '../../lib/format.ts'
import { DEVICE_TYPES } from '../../lib/devices.ts'
import type { Diary, Gear, Guide, Job } from '../../lib/types.ts'
import { Btn, Banner, Tag, Field, inputCls } from '../../components/ui.tsx'
import Photo from '../../components/Photo.tsx'
import Icon from '../../components/Icon.tsx'

export async function uploadPhoto(f: File): Promise<string> {
  return (await api<{ hash: string }>('/api/photos', { body: { dataUrl: await fileToDataUrl(f) } })).hash
}

/** A big camera button: a hidden file input inside a label, so it opens the phone camera. */
function CameraButton({ label, onFile, disabled, tone = 'primary' }: { label: string; onFile: (f: File) => void; disabled?: boolean; tone?: 'primary' | 'secondary' }) {
  const cls = tone === 'primary' ? 'bg-brand text-onbrand' : 'border border-hair bg-white'
  return (
    <label className={`flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-2xl px-4 text-base font-semibold shadow-card focus-within:outline focus-within:outline-[3px] focus-within:outline-offset-2 focus-within:outline-brand ${cls} ${disabled ? 'pointer-events-none opacity-40' : ''}`}>
      <input type="file" accept="image/*" capture="environment" className="sr-only" disabled={disabled}
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onFile(f) }} />
      <Icon name="camera" size={22} />{label}
    </label>
  )
}

/** Before a job: what device, which guide to follow, the safety checklist, then the before photo. */
export function StartJob({ busy, run }: { busy: boolean; run: (fn: () => Promise<unknown>) => void }) {
  const { t, pick } = useLang()
  const gear = useApi<Gear[]>('/api/repair/gear')
  const guides = useApi<Guide[]>('/api/repair/guides')
  const [type, setType] = useState('phone')
  const [guideId, setGuideId] = useState('')
  const [note, setNote] = useState('')
  const [ticked, setTicked] = useState<string[]>([])
  const required = (gear.data ?? []).filter((g) => g.required)
  const ready = required.length > 0 && required.every((g) => ticked.includes(g.id))
  const forType = (guides.data ?? []).filter((g) => g.device_type === type)
  const toggle = (id: string) => setTicked((x) => (x.includes(id) ? x.filter((y) => y !== id) : [...x, id]))

  return (
    <section className="rounded-3xl bg-white p-4 shadow-card" aria-label={t('start_job')}>
      <Field label={t('job_device')}>
        <select className={inputCls} value={type} onChange={(e) => { setType(e.target.value); setGuideId('') }}>
          {DEVICE_TYPES.map((d) => <option key={d} value={d}>{t('type.' + d)}</option>)}
        </select>
      </Field>
      <Field label={t('job_guide')} hint={t('job_guide_hint')}>
        <select className={inputCls} value={guideId} onChange={(e) => setGuideId(e.target.value)}>
          <option value="">{t('job_no_guide')}</option>
          {forType.map((g) => <option key={g.id} value={g.id}>{pick(g.fault)}</option>)}
        </select>
      </Field>
      <Field label={t('job_note_label')}><input className={inputCls} value={note} maxLength={120} placeholder={t('job_note_ph')} onChange={(e) => setNote(e.target.value)} /></Field>

      <p className="mb-1 mt-2 flex items-center gap-2 text-lg font-bold"><Icon name="shield" size={22} />{t('gear_title')}</p>
      <p className="mb-3 text-base text-mute">{t('gear_sub')}</p>
      <ul className="space-y-2">
        {(gear.data ?? []).map((g) => (
          <li key={g.id}>
            <label className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border px-4 ${ticked.includes(g.id) ? 'border-brand bg-brand-soft' : 'border-hair'}`}>
              <input type="checkbox" className="h-6 w-6 accent-[var(--color-brand)]" checked={ticked.includes(g.id)} onChange={() => toggle(g.id)} />
              <span className="flex-1 text-base">{pick(g)}</span>
              {g.required && <Tag tone="amber">{t('gear_required')}</Tag>}
            </label>
          </li>
        ))}
      </ul>
      {!ready && <p className="mt-3 text-base text-mute">{t('gear_need_all')}</p>}

      <div className="mt-4">
        <CameraButton label={t('new_job_before')} disabled={busy || !ready} onFile={(f) => run(async () => {
          await api('/api/repair/jobs', { body: { before_photo: await uploadPhoto(f), note, device_type: type, guide_id: guideId || undefined, gear: ticked } })
          setNote(''); setTicked([]); setGuideId('')
        })} />
      </div>
    </section>
  )
}

const OUTCOMES = ['fixed', 'partly', 'not_fixed'] as const

/** An open job: photos (before, during, after), the guide's steps to tick off, and the job diary. */
export function OpenJob({ job, busy, run }: { job: Job; busy: boolean; run: (fn: () => Promise<unknown>) => void }) {
  const { t, pick } = useLang()
  const guides = useApi<Guide[]>(job.guide_id ? '/api/repair/guides' : null)
  const guide = guides.data?.find((g) => g.id === job.guide_id)
  const [d, setD] = useState<Diary>(job.diary)
  const [outcome, setOutcome] = useState<Diary['outcome']>(job.diary.outcome ?? 'fixed')
  const [saved, setSaved] = useState(false)
  const progress = (body: object) => api(`/api/repair/jobs/${job.id}/progress`, { body })
  const stepsTotal = guide?.steps.length ?? 0

  return (
    <li className="rounded-3xl bg-white p-4 shadow-card">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <p className="text-xl font-bold leading-tight">{job.note || (job.device_type ? t('type.' + job.device_type) : t('job_unnamed'))}</p>
          <p className="text-sm text-mute">{job.created_at ? t('started', { date: dateShort(job.created_at) }) : ''}{guide ? `, ${pick(guide.fault)}` : ''}</p>
        </div>
        <Tag tone="amber">{t('stat_in_progress')}</Tag>
      </div>

      {/* photos: before, during the work, after */}
      <p className="mb-2 text-base font-bold">{t('job_photos')}</p>
      <div className="flex gap-2 overflow-x-auto pb-1">
        <figure className="w-28 shrink-0"><Photo hash={job.before_photo} /><figcaption className="mt-1 text-sm font-semibold">{t('before_photo')}</figcaption></figure>
        {job.during_photos.map((h, i) => (
          <figure key={h} className="w-28 shrink-0"><Photo hash={h} /><figcaption className="mt-1 text-sm">{t('during_n', { n: i + 1 })}</figcaption></figure>
        ))}
      </div>
      <div className="mt-2">
        <CameraButton tone="secondary" label={t('add_during')} disabled={busy || job.during_photos.length >= 8}
          onFile={(f) => run(async () => progress({ during_photo: await uploadPhoto(f) }))} />
        <p className="mt-1 text-sm text-mute">{t('during_help')}</p>
      </div>

      {/* step by step */}
      {guide && (
        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-base font-bold">{t('job_steps')}</p>
            <span className="text-sm font-semibold text-mute">{t('steps_done_n', { n: job.steps_done.length, m: stepsTotal })}</span>
          </div>
          <div className="mb-3 h-2 overflow-hidden rounded-full bg-sunk"><div className="h-full rounded-full bg-brand transition-[width]" style={{ width: `${stepsTotal ? (job.steps_done.length / stepsTotal) * 100 : 0}%` }} /></div>
          {guide.tools.length > 0 && <p className="mb-2 text-sm text-mute"><span className="font-semibold text-ink">{t('tools')}:</span> {guide.tools.map(pick).join(', ')}</p>}
          <ol className="space-y-2">
            {guide.steps.map((s, i) => {
              const done = job.steps_done.includes(i)
              return (
                <li key={i}>
                  <button disabled={busy} onClick={() => run(() => progress({ step: i, done: !done }))} aria-pressed={done}
                    className={`flex min-h-14 w-full items-start gap-3 rounded-2xl border px-4 py-3 text-left ${done ? 'border-brand bg-brand-soft' : 'border-hair'}`}>
                    <span className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${done ? 'bg-brand text-onbrand' : 'bg-sunk'}`}>
                      {done ? <Icon name="check" size={16} /> : i + 1}
                    </span>
                    <span className={`text-base leading-snug ${done ? 'text-mute line-through' : ''}`}>{pick(s)}</span>
                  </button>
                </li>
              )
            })}
          </ol>
          <div className="mt-2"><Banner tone="amber" icon="alert">{t('guides_draft')}</Banner></div>
        </div>
      )}

      {/* job diary */}
      <div className="mt-5">
        <p className="mb-2 text-base font-bold">{t('diary_title')}</p>
        <Field label={t('diary_problems')}>
          <textarea className={`${inputCls} min-h-24 py-3`} maxLength={600} value={d.problems ?? ''} placeholder={t('diary_problems_ph')}
            onChange={(e) => { setD({ ...d, problems: e.target.value }); setSaved(false) }} />
        </Field>
        <div className="grid grid-cols-[minmax(0,1fr)_6.5rem] gap-2">
          <Field label={t('diary_parts')}><input className={inputCls} maxLength={300} value={d.parts ?? ''} placeholder={t('diary_parts_ph')} onChange={(e) => { setD({ ...d, parts: e.target.value }); setSaved(false) }} /></Field>
          <Field label={t('diary_minutes')}><input className={inputCls} inputMode="numeric" value={d.minutes ?? ''} onChange={(e) => { setD({ ...d, minutes: Number(e.target.value.replace(/\D/g, '')) || undefined }); setSaved(false) }} /></Field>
        </div>
        <Field label={t('diary_customer')}><input className={inputCls} maxLength={300} value={d.customer_note ?? ''} placeholder={t('diary_customer_ph')} onChange={(e) => { setD({ ...d, customer_note: e.target.value }); setSaved(false) }} /></Field>
        <Btn variant="secondary" disabled={busy} icon={saved ? 'check' : undefined} onClick={() => run(async () => { await progress({ diary: d }); setSaved(true) })}>{t(saved ? 'diary_saved' : 'diary_save')}</Btn>
      </div>

      {/* finish */}
      <div className="mt-5 rounded-2xl bg-sunk p-3">
        <p className="mb-2 text-base font-bold">{t('finish_title')}</p>
        <div className="mb-3 grid grid-cols-3 gap-2" role="radiogroup" aria-label={t('finish_title')}>
          {OUTCOMES.map((o) => (
            <button key={o} role="radio" aria-checked={outcome === o} onClick={() => setOutcome(o)}
              className={`min-h-12 rounded-xl border px-2 text-sm font-semibold leading-tight ${outcome === o ? 'border-brand bg-brand text-onbrand' : 'border-hair bg-white'}`}>{t('outcome_' + o)}</button>
          ))}
        </div>
        <CameraButton label={t('add_after')} disabled={busy}
          onFile={(f) => run(async () => api(`/api/repair/jobs/${job.id}/complete`, { body: { after_photo: await uploadPhoto(f), diary: { ...d, outcome } } }))} />
      </div>
    </li>
  )
}

/** A finished job in the history: photos, result and the diary in short. */
export function DoneJob({ job }: { job: Job }) {
  const { t } = useLang()
  const o = job.diary.outcome
  return (
    <li className="rounded-3xl bg-white p-4 shadow-card">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <p className="text-lg font-bold leading-tight">{job.note || (job.device_type ? t('type.' + job.device_type) : t('job_unnamed'))}</p>
          <p className="text-sm text-mute">{job.completed_at ? t('finished', { date: dateShort(job.completed_at) }) : ''}{job.diary.minutes ? `, ${t('minutes_n', { n: job.diary.minutes })}` : ''}</p>
        </div>
        <Tag tone={o === 'not_fixed' ? 'bad' : o === 'partly' ? 'amber' : 'ok'}>{t(o ? 'outcome_' + o : 'job_completed')}</Tag>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        <figure className="w-24 shrink-0"><Photo hash={job.before_photo} /><figcaption className="mt-1 text-sm">{t('before_photo')}</figcaption></figure>
        {job.during_photos.map((h, i) => <figure key={h} className="w-24 shrink-0"><Photo hash={h} /><figcaption className="mt-1 text-sm">{t('during_n', { n: i + 1 })}</figcaption></figure>)}
        {job.after_photo && <figure className="w-24 shrink-0"><Photo hash={job.after_photo} /><figcaption className="mt-1 text-sm">{t('after_photo')}</figcaption></figure>}
      </div>
      {(job.diary.problems || job.diary.parts) && (
        <dl className="mt-3 space-y-1 text-base">
          {job.diary.problems && <div><dt className="inline font-semibold">{t('diary_problems')}: </dt><dd className="inline text-mute">{job.diary.problems}</dd></div>}
          {job.diary.parts && <div><dt className="inline font-semibold">{t('diary_parts')}: </dt><dd className="inline text-mute">{job.diary.parts}</dd></div>}
        </dl>
      )}
    </li>
  )
}
