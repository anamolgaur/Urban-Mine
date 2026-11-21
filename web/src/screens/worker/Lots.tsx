import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLang } from '../../lib/i18n.tsx'
import { useApi } from '../../lib/useApi.ts'
import { kg, dateShort, inr } from '../../lib/format.ts'
import type { Lot } from '../../lib/types.ts'
import { Screen, Tag, Rule, ErrorNote, Banner, Btn } from '../../components/ui.tsx'
import { StatusChip, EmptyState, Skeleton } from '../../components/kit.tsx'
import Icon from '../../components/Icon.tsx'

export const lotTitle = (lot: Lot, t: (k: string) => string) => lot.items.map((i) => `${i.qty} × ${t('type.' + i.type)}`).join(', ')

export function LotRow({ lot }: { lot: Lot }) {
  const { t } = useLang()
  const recheck = lot.flags.some((f) => f.kind === 'recheck_requested' && f.status === 'open')
  const first = lot.items[0]?.type ?? 'box'
  return (
    <li>
      <Link to={`/offers/${lot.id}`} className="flex min-h-20 items-center gap-3 py-3">
        <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-hair bg-white"><Icon name={first} size={26} /></span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-bold">{lotTitle(lot, t)}</p>
          <p className="mt-0.5 text-sm text-mute">{kg(lot.weight_kg)} · {dateShort(lot.created_at)}</p>
          <p className="mt-1 flex flex-wrap items-center gap-1">
            <StatusChip status={lot.status} />
            {lot.status === 'sold' && lot.sale_amount !== null && <span className="num text-sm font-semibold">{inr(lot.sale_amount)}</span>}
            {lot.status === 'listed' && <Tag tone={lot.open_offers ? 'ok' : 'plain'}>{lot.open_offers ? t('offers_n', { n: lot.open_offers }) : t('no_offers_yet')}</Tag>}
            {lot.status === 'listed' && lot.top_offer ? <span className="num text-sm font-semibold">{t('best_offer')}: {inr(lot.top_offer)}</span> : null}
            {!lot.chain_ok && <Tag tone="bad">{t('chain_bad')}</Tag>}
            {recheck && <Tag tone="bad">{t('recheck_tag')}</Tag>}
          </p>
        </div>
        <Icon name="chevR" size={20} />
      </Link>
    </li>
  )
}

export default function Lots() {
  const { t } = useLang()
  const { data: all, error, loading } = useApi<Lot[]>('/api/lots')
  const [tab, setTab] = useState<'sale' | 'sold' | 'all'>('sale')
  const data = all?.filter((l) => tab === 'all' || (tab === 'sale' ? l.status === 'listed' || l.status === 'held' : l.status === 'sold'))
  const count = (k: 'sale' | 'sold' | 'all') => all?.filter((l) => k === 'all' || (k === 'sale' ? l.status === 'listed' || l.status === 'held' : l.status === 'sold')).length ?? 0
  return (
    <Screen title={t('lots_title')} back={false}>
      <div className="mb-3 grid grid-cols-3 gap-2" role="tablist" aria-label={t('lots_title')}>
        {(['sale', 'sold', 'all'] as const).map((k) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={`min-h-12 rounded-2xl border border-hair px-2 text-base font-semibold ${tab === k ? 'bg-brand text-onbrand' : 'bg-white'}`}>{t('lots_tab_' + k)} <span className="num">({count(k)})</span></button>
        ))}
      </div>
      <Banner icon="link">{t('chain_explainer')}</Banner>
      {error && <ErrorNote message={error} />}
      {loading && <Skeleton rows={4} />}
      {data && data.length === 0 && tab !== 'all' && <p className="mt-4 text-base text-mute">{t('lots_tab_empty')}</p>}
      {data && data.length === 0 && tab === 'all' && (
        <div className="mt-4">
          <EmptyState art="lots" title={t('lots_empty_title')} body={t('lots_empty_body')} action={<Link to="/scan"><Btn icon="scan">{t('scan_cta')}</Btn></Link>} />
        </div>
      )}
      {data && data.length > 0 && <div className="mt-3"><Rule>{data.map((l) => <LotRow key={l.id} lot={l} />)}</Rule></div>}
    </Screen>
  )
}
