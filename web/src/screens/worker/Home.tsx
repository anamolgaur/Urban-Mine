import { Link, useNavigate } from 'react-router-dom'
import { useSession } from '../../lib/session.tsx'
import { useLang } from '../../lib/i18n.tsx'
import { useApi } from '../../lib/useApi.ts'
import { useFlow } from '../../lib/flow.tsx'
import type { Lot, RateInfo } from '../../lib/types.ts'
import { Screen, H2, SampleTag, Tag, Rule, Loading, Banner } from '../../components/ui.tsx'
import Icon from '../../components/Icon.tsx'
import { inr, kg } from '../../lib/format.ts'
import { LotRow } from './Lots.tsx'

export default function Home() {
  const { me } = useSession()
  const { t } = useLang()
  const nav = useNavigate()
  const { reset } = useFlow()
  const rates = useApi<Record<string, RateInfo>>(me ? `/api/rates?city=${encodeURIComponent(me.city)}` : null)
  const lots = useApi<Lot[]>('/api/lots')
  const onSale = lots.data?.filter((l) => l.status === 'listed').length ?? 0
  const recheck = lots.data?.find((l) => l.flags.some((f) => f.kind === 'recheck_requested' && f.status === 'open'))

  return (
    <Screen title="Urban Mine" back={false} brand>
      <p className="text-sm text-mute">{t('hello', { name: me?.user.name.replace('SAMPLE ', '') ?? '' })}</p>

      <button onClick={() => { reset(); nav('/scan') }}
        className="mt-3 flex min-h-28 w-full items-center gap-4 border-2 border-ink bg-amber px-4 text-left active:translate-y-px">
        <Icon name="scan" size={44} />
        <span>
          <span className="block font-cond text-2xl font-bold uppercase leading-tight">{t('scan_cta')}</span>
          <span className="block text-sm font-medium">{t('scan_sub')}</span>
        </span>
      </button>

      <ol className="mt-3 grid grid-cols-4 gap-1 text-center font-mono text-[12px] font-semibold uppercase">
        {['step_scan', 'step_price', 'step_dismantle', 'step_sell'].map((k, i) => (
          <li key={k} className="border border-ink py-1"><span className="mr-1 bg-ink px-1 text-paper">{i + 1}</span>{t(k)}</li>
        ))}
      </ol>

      {recheck && <div className="mt-4"><Banner tone="bad" icon="alert">{t('recheck_banner')}</Banner></div>}
      {onSale > 0 && <Link to="/lots" className="mt-4 block"><Banner tone="ok" icon="clock">{t('on_sale_banner', { n: onSale })}</Banner></Link>}

      <H2 right={<SampleTag />}>{t('todays_rates')}</H2>
      {rates.loading ? <Loading /> : rates.data && (
        <Rule>
          {['copper', 'aluminium', 'pcb', 'battery_li'].filter((m) => rates.data![m]).map((m) => {
            const r = rates.data![m]
            return (
              <li key={m} className="flex min-h-12 items-center justify-between py-2">
                <span className="font-medium">{t('mat.' + m)}</span>
                <span className="num text-right">
                  <span className="font-semibold">{inr(r.rate)}</span><span className="text-sm text-mute">/kg</span>
                  {r.change !== null && <span className="ml-2 text-sm">{r.change === 0 ? '–' : `${r.change > 0 ? '▲' : '▼'} ${Math.abs(r.change)}`}</span>}
                </span>
              </li>
            )
          })}
        </Rule>
      )}
      <p className="mt-1 text-sm text-mute">{t('vs_yesterday')}</p>

      <H2 right={<Link to="/lots" className="text-sm font-semibold underline underline-offset-4">{t('see_all')}</Link>}>{t('recent_lots')}</H2>
      {lots.loading ? <Loading /> : lots.data && lots.data.length > 0 ? (
        <Rule>{lots.data.slice(0, 3).map((l) => <LotRow key={l.id} lot={l} />)}</Rule>
      ) : (
        <p className="py-4 text-sm text-mute">{t('no_lots')}</p>
      )}
      <p className="mt-6 flex flex-wrap items-center gap-2 text-sm text-mute"><Tag>{t('sample')}</Tag>{t('home_note')} {lots.data ? kg(lots.data.reduce((s, l) => s + l.weight_kg, 0)) : ''}</p>
    </Screen>
  )
}
