import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useLang } from '../../lib/i18n.tsx'
import { useApi } from '../../lib/useApi.ts'
import { api } from '../../lib/api.ts'
import { inr, kg, countdown, dateShort } from '../../lib/format.ts'
import type { Lot, Offer } from '../../lib/types.ts'
import { Screen, H2, Btn, Banner, Tag, SampleTag, ErrorNote } from '../../components/ui.tsx'
import { Rail, Meter, KV, StatusChip, EmptyState, Skeleton } from '../../components/kit.tsx'
import Icon from '../../components/Icon.tsx'
import { lotTitle } from './Lots.tsx'

function useNow(ms: number) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(i) }, [ms])
  return now
}

type Paid = { amount: number; reference: string; method: string }
type LotFull = Lot & { sale?: { amount: number; buyer: string } | null }

/** One screen for a lot in any state: put on sale, compare offers, accept or reject, then payout and receipt. */
export default function Offers() {
  const { id } = useParams()
  const { t } = useLang()
  const nav = useNavigate()
  const lot = useApi<LotFull>(`/api/lots/${id}`)
  const listed = lot.data?.status === 'listed'
  const offers = useApi<Offer[]>(listed ? `/api/lots/${id}/offers` : null)
  const now = useNow(1000)
  const [confirm, setConfirm] = useState<string | null>(null)
  const [paid, setPaid] = useState<Paid | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const reloadOffers = offers.reload

  useEffect(() => {
    if (!listed) return
    const i = setInterval(reloadOffers, 5000)
    return () => clearInterval(i)
  }, [listed, reloadOffers])

  async function act(fn: () => Promise<unknown>) {
    setBusy(true); setErr(null)
    try { await fn() } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }

  const l = lot.data
  if (paid && l) {
    return (
      <Screen title={t('payout_title')} back={false}>
        <div className="border-2 border-ok bg-white p-5 text-center">
          <Icon name="check" size={52} className="mx-auto text-ok" />
          <p className="mt-2 text-xl font-bold">{t('payout_done')}</p>
          <p className="num mt-2 text-5xl font-semibold">{inr(paid.amount)}</p>
          <p className="mt-3 flex flex-wrap justify-center gap-1"><Tag tone="bad">{t('simulated')}</Tag><Tag>{paid.method}</Tag></p>
          <p className="num mt-3 text-base">{t('reference')}: {paid.reference}</p>
          <p className="mt-3 text-base text-mute">{t('no_money')}</p>
        </div>
        <div className="mt-4 space-y-2">
          <Btn onClick={() => nav(`/receipt/${l.id}`)} icon="download">{t('view_receipt')}</Btn>
          <Btn variant="secondary" onClick={() => nav('/')}>{t('go_home')}</Btn>
        </div>
      </Screen>
    )
  }

  const recheck = l?.flags.some((f) => f.kind === 'recheck_requested' && f.status === 'open')
  const timeline = l ? [
    { k: 'tl_created', state: 'done' as const },
    { k: 'tl_on_sale', state: l.status === 'open' ? ('now' as const) : ('done' as const) },
    { k: 'tl_accepted', state: l.status === 'sold' ? ('done' as const) : l.status === 'listed' || l.status === 'held' ? ('now' as const) : ('todo' as const) },
    { k: 'tl_paid', state: l.status === 'sold' ? ('done' as const) : ('todo' as const) },
  ] : []

  return (
    <Screen title={t('lot_title')} back="/lots">
      {lot.error && <ErrorNote message={lot.error} />}
      {lot.loading && <Skeleton rows={4} />}
      {l && (
        <>
          <section className="border-2 border-ink bg-white p-3" aria-label={t('lot_title')}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xl font-bold leading-tight">{lotTitle(l, t)}</p>
                <p className="text-sm text-mute">{kg(l.weight_kg)} · {dateShort(l.created_at)}</p>
              </div>
              <StatusChip status={l.status} />
            </div>
            <dl className="mt-2 divide-y divide-hair border-t border-hair">
              <KV k={t('lot_id')} v={l.id.slice(0, 8).toUpperCase()} mono />
              <KV k={t('hash_status')} v={<span className="flex items-center gap-2"><span className="num text-sm">#{l.short_hash}</span>{l.chain_ok ? <Tag tone="ok">✓ {t('chain_ok')}</Tag> : <Tag tone="bad">{t('chain_bad')}</Tag>}</span>} />
              <KV k={t('safety_done')} v={`${l.steps_done}/${l.steps_total}`} mono />
              <KV k={t('loc_status')} v={<Tag tone={l.gps ? 'ok' : 'plain'}>{l.gps ? `✓ ${t('loc_added_ok')}` : t('loc_missing')}</Tag>} />
            </dl>
          </section>

          <H2>{t('tx_status')}</H2>
          <Rail items={timeline.map((x) => ({ label: t(x.k), state: x.state }))} />
          {l.status !== 'sold' && <p className="mt-3 text-sm text-mute">{t('payout_mocked')}</p>}

          <div className="mt-4 space-y-2">
            {recheck && <Banner tone="bad" icon="alert">{t('recheck_banner')}</Banner>}
            {l.status === 'held' && <Banner tone="bad" icon="lock">{t('held_banner')}</Banner>}
            {l.flags.filter((f) => f.kind !== 'recheck_requested').length > 0 && <Banner icon="info">{t('flag_note')} {l.flags.filter((f) => f.kind !== 'recheck_requested').map((f) => t('flag.' + f.kind)).join(', ')}</Banner>}
          </div>

          {err && <ErrorNote message={err} />}

          {l.status === 'open' && (
            <div className="mt-5"><Btn onClick={() => act(async () => { await api(`/api/lots/${l.id}/list`, { method: 'POST', body: {} }); lot.reload() })} disabled={busy}>{t('put_on_sale')}</Btn></div>
          )}

          {l.status === 'sold' && (
            <div className="mt-5 space-y-3">
              {l.sale && <div className="border-2 border-ok bg-white p-3"><p className="text-sm font-semibold uppercase tracking-wide text-mute">{t('sold_to', { buyer: l.sale.buyer })}</p><p className="num text-4xl font-semibold">{inr(l.sale.amount)}</p><p className="mt-1"><Tag tone="bad">{t('simulated')}</Tag></p></div>}
              <Btn onClick={() => nav(`/receipt/${l.id}`)} icon="download">{t('view_receipt')}</Btn>
            </div>
          )}

          {l.status === 'listed' && (
            <>
              <H2 right={<SampleTag />}>{t('offers_title')}</H2>
              {offers.loading && <Skeleton rows={2} />}
              {offers.data && offers.data.length > 0 && offers.data[0].fair && (
                <p className="mb-3 border border-hair bg-white p-3 text-base leading-snug"><span className="num block font-semibold">{t('fair_range', { low: inr(offers.data[0].fair.low), high: inr(offers.data[0].fair.high) })}</span><span className="text-sm text-mute">{t('fair_note')}</span></p>
              )}
              {offers.data && offers.data.length === 0 && (
                <EmptyState art="offers" title={t('waiting_offers')} body={t('waiting_hint')} />
              )}
              <ul className="space-y-3">
                {offers.data?.map((o, idx) => {
                  const secs = Math.max(0, Math.round((Date.parse(o.expires_at) - now) / 1000))
                  return (
                    <li key={o.id} className={`border-2 bg-white ${idx === 0 ? 'border-ink' : 'border-hair'}`}>
                      <div className="flex items-start justify-between gap-2 p-3">
                        <div className="min-w-0">
                          <p className="flex items-center gap-1 text-lg font-bold leading-tight"><Icon name="shield" size={18} />{o.recycler_name}</p>
                          <p className="mt-0.5 text-sm text-mute">{t('buyer_authorised')}</p>
                          <p className="mt-1 flex items-start gap-1 text-base leading-snug"><Icon name="pin" size={16} className="mt-1 shrink-0" />{o.pickup_terms || '–'}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="num text-3xl font-semibold">{inr(o.amount)}</p>
                          {idx === 0 && <Tag tone="amber">{t('best_offer')}</Tag>}
                          {o.fair && <p className="mt-1"><Tag tone={o.fair.verdict === 'below' ? 'bad' : 'ok'}>{t('fair_' + o.fair.verdict)}</Tag></p>}
                        </div>
                      </div>
                      <div className="border-t border-hair px-3 py-2">
                        <p className="num mb-1 flex items-center gap-1 text-base font-semibold" aria-label={t('time_left')}><Icon name="clock" size={16} />{secs > 0 ? `${countdown(secs)} ${t('left')}` : t('expired')}</p>
                        <Meter value={secs / 1800} label={t('time_left')} valueText={countdown(secs)} tone={secs < 120 ? 'amber' : 'ink'} />
                      </div>
                      {confirm === o.id ? (
                        <div className="border-t border-hair p-3">
                          <p className="mb-2 text-base font-bold">{t('confirm_sell', { amount: inr(o.amount) })}</p>
                          <div className="grid grid-cols-2 gap-2">
                            <Btn disabled={busy || secs === 0} icon="check" onClick={() => act(async () => {
                              const r = await api<{ amount: number; payout: { reference: string; method: string } }>(`/api/bids/${o.id}/accept`, { method: 'POST', body: {} })
                              setPaid({ amount: r.amount, reference: r.payout.reference, method: r.payout.method })
                            })}>{t('confirm')}</Btn>
                            <Btn variant="secondary" onClick={() => setConfirm(null)}>{t('cancel')}</Btn>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-[1fr_auto] gap-2 border-t border-hair p-3">
                          <Btn disabled={secs === 0 || busy} icon="check" onClick={() => setConfirm(o.id)}>{t('accept_offer')}</Btn>
                          <Btn variant="secondary" full={false} disabled={busy} icon="x" onClick={() => act(async () => { await api(`/api/bids/${o.id}/reject`, { method: 'POST', body: {} }); offers.reload() })}>{t('reject_offer')}</Btn>
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
              <div className="mt-4">
                <Btn variant="secondary" disabled={busy} icon="plus" onClick={() => act(async () => { await api(`/api/demo/offers/${l.id}`, { method: 'POST', body: {} }); offers.reload() })}>{t('demo_offers')}</Btn>
                <p className="mt-1 text-sm text-mute">{t('demo_offers_hint')} <Link className="inline-flex min-h-11 items-center underline" to="/profile">{t('profile_link')}</Link></p>
              </div>
            </>
          )}
        </>
      )}
    </Screen>
  )
}
