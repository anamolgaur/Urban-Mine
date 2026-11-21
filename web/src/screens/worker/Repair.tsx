import { useState } from 'react'
import { useLang } from '../../lib/i18n.tsx'
import { useApi } from '../../lib/useApi.ts'
import { useSession } from '../../lib/session.tsx'
import { inr } from '../../lib/format.ts'
import type { Guide, Listing } from '../../lib/types.ts'
import { Screen, H2, Tag, SampleTag, Banner, Loading, ErrorNote, Btn } from '../../components/ui.tsx'
import Icon from '../../components/Icon.tsx'
import OfferServices from './OfferServices.tsx'

type Tab = 'fix' | 'nearby' | 'offer'
const DIFF = { easy: 'ok', medium: 'amber', hard: 'bad' } as const

function GuideCard({ g }: { g: Guide }) {
  const { t, pick } = useLang()
  const [open, setOpen] = useState(false)
  return (
    <li className="border-b border-hair">
      <button onClick={() => setOpen(!open)} aria-expanded={open} className="flex min-h-16 w-full items-center gap-3 py-3 text-left">
        <Icon name={g.device_type} size={26} />
        <span className="flex-1">
          <span className="block font-semibold">{pick(g.fault)}</span>
          <span className="mt-1 flex gap-1"><Tag tone={DIFF[g.difficulty]}>{t('diff.' + g.difficulty)}</Tag><Tag>{t('type.' + g.device_type)}</Tag></span>
        </span>
        <Icon name={open ? 'chevD' : 'chevR'} size={20} />
      </button>
      {open && (
        <div className="pb-4 pl-9">
          <p className="text-sm font-bold uppercase text-mute">{t('tools_needed')}</p>
          <ul className="mb-3 list-disc pl-5 text-sm">{g.tools.map((x, i) => <li key={i}>{pick(x)}</li>)}</ul>
          <p className="text-sm font-bold uppercase text-mute">{t('guide_steps')}</p>
          <ol className="list-decimal pl-5 text-sm">{g.steps.map((x, i) => <li key={i} className="mb-1">{pick(x)}</li>)}</ol>
        </div>
      )}
    </li>
  )
}

export function Fix() {
  const { t, lang } = useLang()
  const { data, error, loading } = useApi<Guide[]>('/api/repair/guides')
  return (
    <>
      <div className="mt-3"><Banner tone="amber" icon="info">{t('guides_draft')}</Banner></div>
      {lang !== 'hi' && lang !== 'en' && <div className="mt-2"><Banner icon="info">{t('content_fallback')}</Banner></div>}
      {error && <ErrorNote message={error} />}
      {loading && <Loading />}
      {data && <ul className="mt-3 border-t border-hair">{data.map((g) => <GuideCard key={g.id} g={g} />)}</ul>}
    </>
  )
}

export function Nearby() {
  const { t } = useLang()
  const { data, error, loading } = useApi<Listing[]>('/api/repair/listings')
  return (
    <>
      <div className="mt-3 flex items-center gap-2"><SampleTag /><span className="text-sm text-mute">{t('listings_sample')}</span></div>
      {error && <ErrorNote message={error} />}
      {loading && <Loading />}
      <ul className="mt-2 divide-y divide-hair border-y border-hair">
        {data?.map((l) => (
          <li key={l.id} className="py-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{l.name}</p>
                <p className="flex items-center gap-1 text-sm text-mute"><Icon name="pin" size={14} />{l.area}</p>
                <p className="text-sm text-mute">{l.hours}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-mute">{t('starting_at')}</p>
                <p className="num text-xl font-semibold">{inr(l.start_price)}</p>
              </div>
            </div>
            <p className="mt-2 flex flex-wrap items-center gap-1">
              <Tag tone="ok">✓ {l.verified_count} {t('verified_repairs')}</Tag>
              {l.skills.map((s) => <Tag key={s}>{t('type.' + s)}</Tag>)}
            </p>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-sm text-mute">{t('verified_explain')}</p>
    </>
  )
}

export default function Repair() {
  const { t } = useLang()
  const { me, loginAs } = useSession()
  const [tab, setTab] = useState<Tab>(me?.user.role === 'repairer' ? 'offer' : 'fix')
  const tabs: [Tab, string][] = [['fix', 'tab_fix'], ['nearby', 'tab_nearby'], ['offer', 'tab_offer']]
  return (
    <Screen title={t('repair_title')} back={false}>
      <div role="tablist" aria-label={t('repair_title')} className="grid grid-cols-3 border border-ink">
        {tabs.map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={`min-h-12 border-r border-ink px-1 text-sm font-bold last:border-r-0 ${tab === k ? 'bg-ink text-paper' : 'bg-white'}`}>{t(label)}</button>
        ))}
      </div>
      {tab === 'fix' && <Fix />}
      {tab === 'nearby' && <Nearby />}
      {tab === 'offer' && (me?.user.role === 'repairer' ? <OfferServices /> : (
        <div className="mt-4">
          <H2>{t('tab_offer')}</H2>
          <p className="mb-3 text-sm">{t('offer_needs_repairer')}</p>
          <Btn onClick={() => loginAs('u-repairer-1')} icon="swap">{t('switch_repairer')}</Btn>
        </div>
      ))}
    </Screen>
  )
}
