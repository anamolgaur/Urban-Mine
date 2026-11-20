import { Link } from 'react-router-dom'
import { useLang } from '../../lib/i18n.tsx'
import { useApi } from '../../lib/useApi.ts'
import { kg, dateShort } from '../../lib/format.ts'
import type { Lot } from '../../lib/types.ts'
import { Screen, Tag, Rule, Loading, ErrorNote, Banner } from '../../components/ui.tsx'
import Icon from '../../components/Icon.tsx'

export const lotTitle = (lot: Lot, t: (k: string) => string) => lot.items.map((i) => `${i.qty} × ${t('type.' + i.type)}`).join(', ')

const TONE = { open: 'plain', listed: 'amber', sold: 'ok', held: 'bad' } as const

export function LotRow({ lot }: { lot: Lot }) {
  const { t } = useLang()
  const recheck = lot.flags.some((f) => f.kind === 'recheck_requested' && f.status === 'open')
  return (
    <li>
      <Link to={`/offers/${lot.id}`} className="flex min-h-16 items-center gap-3 py-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{lotTitle(lot, t)}</p>
          <p className="mt-0.5 text-sm text-mute">{kg(lot.weight_kg)} · {dateShort(lot.created_at)}</p>
          <p className="mt-1 flex flex-wrap items-center gap-1">
            <Tag tone={TONE[lot.status]}>{t('status.' + lot.status)}</Tag>
            <span className="num text-[12px] text-mute">#{lot.short_hash}</span>
            {lot.chain_ok ? <Tag tone="ok">✓ {t('chain_ok')}</Tag> : <Tag tone="bad">{t('chain_bad')}</Tag>}
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
      {loading && <Loading />}
      {data && data.length === 0 && <p className="py-8 text-center text-mute">{t('no_lots')}</p>}
      {data && data.length > 0 && <div className="mt-3"><Rule>{data.map((l) => <LotRow key={l.id} lot={l} />)}</Rule></div>}
    </Screen>
  )
}
