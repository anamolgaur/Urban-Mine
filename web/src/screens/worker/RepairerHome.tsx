import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLang } from '../../lib/i18n.tsx'
import { useApi } from '../../lib/useApi.ts'
import { inr } from '../../lib/format.ts'
import type { Job, Listing } from '../../lib/types.ts'
import { Screen, H2, Btn, Banner, SampleTag, ErrorNote } from '../../components/ui.tsx'
import { Stat, EmptyState, Skeleton } from '../../components/kit.tsx'
import OfferServices from './OfferServices.tsx'
import { StartJob, OpenJob, DoneJob } from './RepairJob.tsx'
import { Fix, Nearby } from './Repair.tsx'

type Mine = { listing: Listing | null; jobs: Job[] }

/** Jobs tab: statistics, start a job with a before photo, finish it with an after photo, and the repair history. */
export function RepairerJobs() {
  const { t } = useLang()
  const mine = useApi<Mine>('/api/repair/mine')
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
          <section className="rounded-3xl bg-white shadow-card p-3" aria-label={t('stats_title')}>
            <div className="mb-2 flex items-center justify-between"><p className="text-sm font-medium text-mute">{t('stats_title')}</p><SampleTag /></div>
            <div className="grid grid-cols-2 gap-4">
              <Stat label={t('verified_repairs')} value={l.verified_count} size="lg" />
              <Stat label={t('stat_price')} value={inr(l.start_price)} size="lg" />
              <Stat label={t('stat_in_progress')} value={open.length} />
              <Stat label={t('stat_completed')} value={done.length} />
            </div>
          </section>
          <div className="mt-3"><Banner icon="info">{t('repairer_note')}</Banner></div>

          <H2>{t('start_job')}</H2>
          <div data-tour="start-job"><StartJob busy={busy} run={run} /></div>
          {err && <ErrorNote message={err} />}

          <H2>{t('in_progress_title')}</H2>
          {open.length === 0 ? <p className="py-3 text-base text-mute">{t('no_jobs')}</p> : (
            <ul className="space-y-4">{open.map((j) => <OpenJob key={j.id} job={j} busy={busy} run={run} />)}</ul>
          )}

          <H2>{t('history_title')}</H2>
          {done.length === 0 ? <p className="py-3 text-base text-mute">{t('no_history')}</p> : (
            <ul className="space-y-3">{done.map((j) => <DoneJob key={j.id} job={j} />)}</ul>
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
      <div role="tablist" aria-label={t('tab_browse')} className="grid grid-cols-2 border border-hair">
        {([['fix', 'tab_fix'], ['nearby', 'tab_nearby']] as const).map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={`min-h-12 border-r border-hair px-1 text-base font-bold last:border-r-0 ${tab === k ? 'bg-brand text-onbrand' : 'bg-white'}`}>{t(label)}</button>
        ))}
      </div>
      {tab === 'fix' ? <Fix /> : <Nearby />}
    </Screen>
  )
}
