import { Link, useNavigate } from 'react-router-dom'
import { useSession } from '../../lib/session.tsx'
import { useLang } from '../../lib/i18n.tsx'
import { useApi } from '../../lib/useApi.ts'
import Sparkline from '../../components/Sparkline.tsx'
import { useFlow } from '../../lib/flow.tsx'
import type { Lot, RateInfo } from '../../lib/types.ts'
import { Screen, H2, SampleTag, Tag, Rule, Banner } from '../../components/ui.tsx'
import { Skeleton, Stat, EmptyState } from '../../components/kit.tsx'
import Icon from '../../components/Icon.tsx'
import { inr, dateShort } from '../../lib/format.ts'
import { LotRow, lotTitle } from './Lots.tsx'

type Next = { key: 'none' | 'recheck' | 'held' | 'listed' | 'open' | 'sold'; lot?: Lot }

/** One sentence of "what to do now", chosen by urgency. */
function pickNext(lots: Lot[]): Next {
  if (lots.length === 0) return { key: 'none' }
  const recheck = lots.find((l) => l.flags.some((f) => f.kind === 'recheck_requested' && f.status === 'open'))
  if (recheck) return { key: 'recheck', lot: recheck }
  const by = (s: Lot['status']) => lots.find((l) => l.status === s)
  const held = by('held'), listed = by('listed'), open = by('open')
  if (held) return { key: 'held', lot: held }
  if (listed) return { key: 'listed', lot: listed }
  if (open) return { key: 'open', lot: open }
  return { key: 'sold', lot: lots[0] }
}

export default function Home() {
  const { me } = useSession()
  const { t } = useLang()
  const nav = useNavigate()
  const { reset } = useFlow()
  const rates = useApi<Record<string, RateInfo>>(me ? `/api/rates?city=${encodeURIComponent(me.city)}` : null)
  const lots = useApi<Lot[]>('/api/lots')
  const hist = useApi<Record<string, { day: string; rate: number }[]>>(me ? `/api/rates/history?city=${encodeURIComponent(me.city)}&days=30` : null)
  const list = lots.data ?? []
  const active = list.filter((l) => l.status !== 'sold')
  const earned = list.reduce((s, l) => s + (l.status === 'sold' ? (l.sale_amount ?? 0) : 0), 0)
  const next = pickNext(list)
  const name = (me?.user.name ?? '').replace(' (demo)', '').split(' ')[0]

  const activity = list.slice(0, 4).map((l) => ({
    lot: l,
    text: l.status === 'sold' ? t('act_sold', { amount: inr(l.sale_amount ?? 0) }) : l.status === 'listed' ? t('act_listed') : l.status === 'held' ? t('act_held') : t('act_created'),
  }))

  return (
    <Screen title="Urban Mine" back={false} brand>
      <div className="flex items-center gap-3">
        <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand text-2xl font-bold text-onbrand" aria-hidden>{name.charAt(0)}</span>
        <div className="min-w-0">
          <p className="truncate text-lg font-bold leading-tight">{t('hello', { name })}</p>
          <p className="flex items-center gap-1 text-sm text-mute"><Icon name="pin" size={14} />{me?.workshop?.name.replace('SAMPLE ', '')} · {me?.city}</p>
        </div>
      </div>

      <button onClick={() => { reset(); nav('/scan') }}
        data-tour="scan" className="mt-5 flex min-h-32 w-full items-center gap-4 rounded-3xl bg-brand px-5 text-left text-onbrand shadow-card active:scale-[0.99]">
        <span className="inline-flex h-18 w-18 shrink-0 items-center justify-center rounded-2xl bg-onbrand/15 p-4"><Icon name="scan" size={36} /></span>
        <span className="flex-1">
          <span className="block text-2xl font-bold leading-tight">{t('scan_cta')}</span>
          <span className="block text-base font-medium leading-snug">{t('scan_sub')}</span>
        </span>
        <Icon name="chevR" size={28} />
      </button>

      <section className="mt-4 rounded-3xl bg-gold-soft p-4" aria-label={t('next_title')}>
        <p className="text-sm font-medium text-mute">{t('next_title')}</p>
        <p className="mt-0.5 text-lg font-bold leading-snug">{t(`next_${next.key}_t`)}</p>
        <p className="mt-1 text-base leading-snug text-mute">{t(`next_${next.key}_b`)}</p>
        <div className="mt-3">
          <button onClick={() => nav(next.key === 'none' ? '/scan' : next.key === 'sold' ? `/receipt/${next.lot!.id}` : `/offers/${next.lot!.id}`)}
            className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-ink px-5 font-semibold text-paper">
            {t(next.key === 'none' ? 'scan_cta' : next.key === 'sold' ? 'view_receipt' : 'open_lot')}<Icon name="chevR" size={18} />
          </button>
        </div>
      </section>

      <H2 right={<SampleTag />}>{t('earn_title')}</H2>
      <div data-tour="earnings" className="grid grid-cols-3 gap-3 rounded-3xl bg-white p-4 shadow-card">
        <Stat label={t('earned')} value={inr(earned)} />
        <Stat label={t('status.listed')} value={active.filter((l) => l.status === 'listed').length} />
        <Stat label={t('kpi_lots')} value={list.length} />
      </div>
      <p className="mt-1 text-sm text-mute">{t('earn_note')}</p>

      <div data-tour="lots"><H2 right={<Link to="/lots" className="inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-4">{t('see_all')}</Link>}>{t('active_lots')}</H2></div>
      {lots.loading ? <Skeleton rows={2} /> : active.length > 0 ? (
        <Rule>{active.slice(0, 3).map((l) => <LotRow key={l.id} lot={l} />)}</Rule>
      ) : (
        <EmptyState art="lots" title={t('no_active')} body={t('lots_empty_body')} />
      )}

      <H2 right={<SampleTag />}>{t('todays_rates')}</H2>
      {rates.loading ? <Skeleton rows={2} /> : rates.data && (
        <Rule>
          {['copper', 'aluminium', 'pcb'].filter((m) => rates.data![m]).map((m) => {
            const r = rates.data![m]
            return (
              <li key={m} className="py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-base font-semibold">{t('mat.' + m)}</span>
                  <span className="num whitespace-nowrap text-xl"><span className="font-semibold">{inr(r.rate)}</span><span className="text-sm text-mute">/kg</span></span>
                </div>
                {(() => {
                  const h = hist.data?.[m]?.map((x) => x.rate) ?? []
                  const pct = h.length >= 7 ? Math.round(((h[h.length - 1] - h[0]) / h[0]) * 100) : null
                  const tone = (v: number) => (v > 0 ? 'text-ok' : v < 0 ? 'text-bad' : 'text-mute')
                  return (
                    <div className="mt-1 flex items-center gap-3 text-sm">
                      {pct !== null ? <Sparkline values={h} height={22} fluid /> : <span className="flex-1" />}
                      {pct !== null && <span className="whitespace-nowrap text-mute">{t('days_30')} <b className={`num ${tone(pct)}`}>{pct > 0 ? '+' : ''}{pct}%</b></span>}
                      {r.change !== null && <span className="whitespace-nowrap text-mute">{t('today')} <b className={`num ${tone(r.change)}`}>{r.change === 0 ? '–' : `${r.change > 0 ? '▲' : '▼'} ₹${Math.abs(r.change)}`}</b></span>}
                    </div>
                  )
                })()}
              </li>
            )
          })}
        </Rule>
      )}
      <p className="mt-1 text-sm text-mute">{t('rates_note')}</p>

      <H2>{t('recent_activity')}</H2>
      {activity.length === 0 ? <p className="py-3 text-sm text-mute">{t('no_activity')}</p> : (
        <ol className="divide-y divide-hair rounded-3xl bg-white px-4 shadow-card">
          {activity.map(({ lot, text }) => (
            <li key={lot.id}>
              <Link to={lot.status === 'sold' ? `/receipt/${lot.id}` : `/offers/${lot.id}`} className="flex min-h-14 items-center justify-between gap-2 py-2">
                <span className="min-w-0"><span className="block truncate text-base font-semibold">{text}</span><span className="block truncate text-sm text-mute">{lotTitle(lot, t)}</span></span>
                <span className="num shrink-0 text-sm text-mute">{dateShort(lot.created_at)}</span>
              </Link>
            </li>
          ))}
        </ol>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-2 text-sm text-mute"><Tag>{t('sample')}</Tag>{t('home_note_short')}</div>
      {lots.error && <div className="mt-3"><Banner tone="bad" icon="alert">{lots.error}</Banner></div>}
    </Screen>
  )
}
