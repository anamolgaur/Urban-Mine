import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLang } from '../../lib/i18n.tsx'
import { useApi } from '../../lib/useApi.ts'
import { api } from '../../lib/api.ts'
import { fileToDataUrl } from '../../lib/image.ts'
import { inr, dateShort } from '../../lib/format.ts'
import type { Job, Listing } from '../../lib/types.ts'
import { Screen, H2, Btn, Banner, Tag, SampleTag, ErrorNote, Field, inputCls } from '../../components/ui.tsx'
import { Stat, EmptyState, Skeleton } from '../../components/kit.tsx'
import Photo from '../../components/Photo.tsx'
import Icon from '../../components/Icon.tsx'
import OfferServices from './OfferServices.tsx'
import { Fix, Nearby } from './Repair.tsx'

type Mine = { listing: Listing | null; jobs: Job[] }

async function uploadPhoto(f: File): Promise<string> {
  return (await api<{ hash: string }>('/api/photos', { body: { dataUrl: await fileToDataUrl(f) } })).hash
}

function PhotoPair({ job }: { job: Job }) {
  const { t } = useLang()
  return (
    <div className="grid grid-cols-2 gap-2">
      <figure><Photo hash={job.before_photo} /><figcaption className="mt-1 text-sm font-semibold">{t('before_photo')}</figcaption></figure>
      <figure>
        {job.after_photo ? <Photo hash={job.after_photo} /> : <div className="flex aspect-[4/3] items-center justify-center border border-dashed border-ink bg-sunk p-2 text-center text-sm font-semibold">{t('after_needed')}</div>}
        <figcaption className="mt-1 text-sm font-semibold">{t('add_after')}</figcaption>
      </figure>
    </div>
  )
}

/** Jobs tab: statistics, start a job with a before photo, finish it with an after photo, and the repair history. */
export function RepairerJobs() {
  const { t } = useLang()
  const mine = useApi<Mine>('/api/repair/mine')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const l = mine.data?.listing
  const jobs = mine.data?.jobs ?? []
  const open = jobs.filter((j) => j.status === 'in_progress')
  const done = jobs.filter((j) => j.status === 'completed')

  async function run(fn: () => Promise<unknown>) {
    setBusy(true); setErr(null)
    try { await fn(); mine.reload() } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }

  return (
    <Screen title={t('tab_jobs')} back={false}>
      {mine.loading && <Skeleton rows={4} />}
      {mine.error && <ErrorNote message={mine.error} />}
      {mine.data && !l && (
        <EmptyState art="tools" title={t('need_listing_t')} body={t('need_listing_b')} action={<Link to="/repair/listing"><Btn icon="chevR">{t('go_listing')}</Btn></Link>} />
      )}
      {l && (
        <>
          <section className="border-2 border-ink bg-white p-3" aria-label={t('stats_title')}>
            <div className="mb-2 flex items-center justify-between"><p className="text-sm font-semibold uppercase tracking-wide text-mute">{t('stats_title')}</p><SampleTag /></div>
            <div className="grid grid-cols-2 gap-4">
              <Stat label={t('verified_repairs')} value={l.verified_count} size="lg" />
              <Stat label={t('stat_price')} value={inr(l.start_price)} size="lg" />
              <Stat label={t('stat_in_progress')} value={open.length} />
              <Stat label={t('stat_completed')} value={done.length} />
            </div>
          </section>
          <div className="mt-3"><Banner icon="info">{t('repairer_note')}</Banner></div>

          <H2>{t('start_job')}</H2>
          <Field label={t('job_note_label')}><input className={inputCls} value={note} maxLength={120} placeholder={t('job_note_ph')} onChange={(e) => setNote(e.target.value)} /></Field>
          <label className="flex min-h-14 cursor-pointer items-center justify-center gap-2 border-2 border-ink bg-amber px-4 text-base font-bold focus-within:outline focus-within:outline-[3px] focus-within:outline-offset-2 focus-within:outline-ink">
            <input type="file" accept="image/*" capture="environment" className="sr-only" disabled={busy}
              onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void run(async () => { await api('/api/repair/jobs', { body: { before_photo: await uploadPhoto(f), note } }); setNote('') }) }} />
            <Icon name="camera" size={22} />{t('new_job_before')}
          </label>
          {err && <ErrorNote message={err} />}

          <H2>{t('in_progress_title')}</H2>
          {open.length === 0 ? <p className="py-3 text-base text-mute">{t('no_jobs')}</p> : (
            <ul className="space-y-3">
              {open.map((j) => (
                <li key={j.id} className="border-2 border-ink bg-white p-3">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div><p className="text-lg font-bold leading-tight">{j.note || t('job_unnamed')}</p><p className="num text-sm text-mute">#{j.id.slice(0, 6)} · {j.created_at ? t('started', { date: dateShort(j.created_at) }) : ''}</p></div>
                    <Tag tone="amber">{t('stat_in_progress')}</Tag>
                  </div>
                  <PhotoPair job={j} />
                  <label className="mt-3 flex min-h-12 cursor-pointer items-center justify-center gap-2 border border-ink bg-ink px-4 text-base font-bold text-paper focus-within:outline focus-within:outline-[3px] focus-within:outline-offset-2 focus-within:outline-ink">
                    <input type="file" accept="image/*" capture="environment" className="sr-only" disabled={busy}
                      onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void run(async () => api(`/api/repair/jobs/${j.id}/complete`, { body: { after_photo: await uploadPhoto(f) } })) }} />
                    <Icon name="camera" size={20} />{t('add_after')}
                  </label>
                </li>
              ))}
            </ul>
          )}

          <H2>{t('history_title')}</H2>
          {done.length === 0 ? <p className="py-3 text-base text-mute">{t('no_history')}</p> : (
            <ul className="space-y-3">
              {done.map((j) => (
                <li key={j.id} className="border border-hair bg-white p-3">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div><p className="text-base font-bold leading-tight">{j.note || t('job_unnamed')}</p><p className="num text-sm text-mute">{j.completed_at ? t('finished', { date: dateShort(j.completed_at) }) : ''}</p></div>
                    <Tag tone="ok">✓ {t('job_completed')}</Tag>
                  </div>
                  <PhotoPair job={j} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Screen>
  )
}

export function RepairerListing() {
  const { t } = useLang()
  return <Screen title={t('tab_listing')} back={false}><OfferServices /></Screen>
}

export function RepairerBrowse() {
  const { t } = useLang()
  const [tab, setTab] = useState<'fix' | 'nearby'>('fix')
  return (
    <Screen title={t('tab_browse')} back={false}>
      <div role="tablist" aria-label={t('tab_browse')} className="grid grid-cols-2 border border-ink">
        {([['fix', 'tab_fix'], ['nearby', 'tab_nearby']] as const).map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={`min-h-12 border-r border-ink px-1 text-base font-bold last:border-r-0 ${tab === k ? 'bg-ink text-paper' : 'bg-white'}`}>{t(label)}</button>
        ))}
      </div>
      {tab === 'fix' ? <Fix /> : <Nearby />}
    </Screen>
  )
}
