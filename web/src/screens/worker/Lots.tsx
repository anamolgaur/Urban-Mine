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
        <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center border border-ink bg-white"><Icon name={first} size={26} /></span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-bold">{lotTitle(lot, t)}</p>
          <p className="mt-0.5 text-sm text-mute">{kg(lot.weight_kg)} · {dateShort(lot.created_at)}</p>
          <p className="mt-1 flex flex-wrap items-center gap-1">
            <StatusChip status={lot.status} />
            {lot.status === 'sold' && lot.sale_amount !== null && <span className="num text-sm font-semibold">{inr(lot.sale_amount)}</span>}
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
  const { data, error, loading } = useApi<Lot[]>('/api/lots')
  return (
    <Screen title={t('lots_title')} back={false}>
      <Banner icon="link">{t('chain_explainer')}</Banner>
      {error && <ErrorNote message={error} />}
      {loading && <Skeleton rows={4} />}
      {data && data.length === 0 && (
        <div className="mt-4">
          <EmptyState art="lots" title={t('lots_empty_title')} body={t('lots_empty_body')} action={<Link to="/scan"><Btn icon="scan">{t('scan_cta')}</Btn></Link>} />
        </div>
      )}
      {data && data.length > 0 && <div className="mt-3"><Rule>{data.map((l) => <LotRow key={l.id} lot={l} />)}</Rule></div>}
    </Screen>
  )
}
