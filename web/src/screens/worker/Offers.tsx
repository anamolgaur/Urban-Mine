import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useLang } from '../../lib/i18n.tsx'
import { useApi } from '../../lib/useApi.ts'
import { api } from '../../lib/api.ts'
import { inr, kg, countdown, dateShort } from '../../lib/format.ts'
import type { Lot, Offer } from '../../lib/types.ts'
import { Screen, H2, Btn, Banner, Tag, SampleTag, Loading, ErrorNote } from '../../components/ui.tsx'
import Icon from '../../components/Icon.tsx'
import { lotTitle } from './Lots.tsx'

function useNow(ms: number) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(i) }, [ms])
  return now
}

type Paid = { amount: number; reference: string; method: string }

/** One screen for a lot in any state: put on sale, see offers with a countdown, accept, view receipt. */
export default function Offers() {
  const { id } = useParams()
  const { t } = useLang()
  const nav = useNavigate()
  const lot = useApi<Lot & { sale?: { amount: number; buyer: string } | null }>(`/api/lots/${id}`)
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
        <div className="border-2 border-ok p-5 text-center">
          <Icon name="check" size={48} className="mx-auto text-ok" />
          <p className="mt-2 text-xl font-bold">{t('payout_done')}</p>
          <p className="num mt-2 text-4xl font-semibold">{inr(paid.amount)}</p>
          <p className="mt-3 flex flex-wrap justify-center gap-1"><Tag tone="bad">{t('simulated')}</Tag><Tag>{paid.method}</Tag></p>
          <p className="num mt-3 text-sm">{t('reference')}: {paid.reference}</p>
          <p className="mt-3 text-sm text-mute">{t('no_money')}</p>
        </div>
        <div className="mt-4 space-y-2">
          <Btn onClick={() => nav(`/receipt/${l.id}`)} icon="download">{t('view_receipt')}</Btn>
          <Btn variant="secondary" onClick={() => nav('/')}>{t('go_home')}</Btn>
        </div>
      </Screen>
    )
  }

  return (
    <Screen title={t('lot_title')} back="/lots">
      {lot.error && <ErrorNote message={lot.error} />}
      {lot.loading && <Loading />}
      {l && (
        <>
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-lg font-bold">{lotTitle(l, t)}</p>
              <p className="text-sm text-mute">{kg(l.weight_kg)} · {dateShort(l.created_at)}</p>
            </div>
            <Tag tone={l.status === 'sold' ? 'ok' : l.status === 'held' ? 'bad' : l.status === 'listed' ? 'amber' : 'plain'}>{t('status.' + l.status)}</Tag>
          </div>
          <p className="mt-2 flex flex-wrap items-center gap-1">
            <Icon name="link" size={16} /><span className="num text-sm">#{l.short_hash}</span>
            {l.chain_ok ? <Tag tone="ok">✓ {t('chain_ok')}</Tag> : <Tag tone="bad">{t('chain_bad')}</Tag>}
            <Tag>{l.steps_done}/{l.steps_total} {t('safety_short')}</Tag>
          </p>

          <div className="mt-3 space-y-2">
            {l.flags.some((f) => f.kind === 'recheck_requested' && f.status === 'open') && <Banner tone="bad" icon="alert">{t('recheck_banner')}</Banner>}
            {l.status === 'held' && <Banner tone="bad" icon="lock">{t('held_banner')}</Banner>}
            {l.flags.filter((f) => f.kind !== 'recheck_requested').length > 0 && <Banner icon="info">{t('flag_note')} {l.flags.filter((f) => f.kind !== 'recheck_requested').map((f) => t('flag.' + f.kind)).join(', ')}</Banner>}
          </div>

          {err && <ErrorNote message={err} />}

          {l.status === 'open' && (
            <div className="mt-5"><Btn onClick={() => act(async () => { await api(`/api/lots/${l.id}/list`, { method: 'POST', body: {} }); lot.reload() })} disabled={busy}>{t('put_on_sale')}</Btn></div>
          )}

          {l.status === 'sold' && (
            <div className="mt-5 space-y-2">
              {l.sale && <p className="num text-3xl font-semibold">{inr(l.sale.amount)} <span className="text-base font-normal text-mute">{t('to')} {l.sale.buyer}</span></p>}
              <Btn onClick={() => nav(`/receipt/${l.id}`)} icon="download">{t('view_receipt')}</Btn>
            </div>
          )}

          {l.status === 'listed' && (
            <>
              <H2 right={<SampleTag />}>{t('offers_title')}</H2>
              {offers.loading && <Loading />}
              {offers.data && offers.data.length === 0 && (
                <div className="border border-hair bg-white p-4 text-center">
                  <Icon name="clock" size={28} className="mx-auto text-mute" />
                  <p className="mt-1 font-semibold">{t('waiting_offers')}</p>
                  <p className="mt-1 text-sm text-mute">{t('waiting_hint')}</p>
                </div>
              )}
              <ul className="space-y-3">
                {offers.data?.map((o, idx) => {
                  const secs = Math.max(0, Math.round((Date.parse(o.expires_at) - now) / 1000))
                  return (
                    <li key={o.id} className={`border-2 bg-white p-3 ${idx === 0 ? 'border-ink' : 'border-hair'}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold">{o.recycler_name}</p>
                          <p className="text-sm text-mute">{o.pickup_terms}</p>
                        </div>
                        <div className="text-right">
                          <p className="num text-2xl font-semibold">{inr(o.amount)}</p>
                          {idx === 0 && <Tag tone="amber">{t('best_offer')}</Tag>}
                        </div>
                      </div>
                      <p className="num mt-2 flex items-center gap-1 text-sm" aria-label={t('time_left')}><Icon name="clock" size={16} />{secs > 0 ? `${countdown(secs)} ${t('left')}` : t('expired')}</p>
                      {confirm === o.id ? (
                        <div className="mt-3 border-t border-hair pt-3">
                          <p className="mb-2 font-semibold">{t('confirm_sell', { amount: inr(o.amount) })}</p>
                          <div className="grid grid-cols-2 gap-2">
                            <Btn disabled={busy || secs === 0} icon="check" onClick={() => act(async () => {
                              const r = await api<{ amount: number; payout: { reference: string; method: string } }>(`/api/bids/${o.id}/accept`, { method: 'POST', body: {} })
                              setPaid({ amount: r.amount, reference: r.payout.reference, method: r.payout.method })
                            })}>{t('confirm')}</Btn>
                            <Btn variant="secondary" onClick={() => setConfirm(null)}>{t('cancel')}</Btn>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-3"><Btn disabled={secs === 0 || busy} onClick={() => setConfirm(o.id)}>{t('accept_offer')}</Btn></div>
                      )}
                    </li>
                  )
                })}
              </ul>
              <div className="mt-4">
                <Btn variant="secondary" disabled={busy} icon="plus" onClick={() => act(async () => { await api(`/api/demo/offers/${l.id}`, { method: 'POST', body: {} }); offers.reload() })}>{t('demo_offers')}</Btn>
                <p className="mt-1 text-sm text-mute">{t('demo_offers_hint')} <Link className="underline" to="/profile">{t('profile_link')}</Link></p>
              </div>
            </>
          )}
        </>
      )}
    </Screen>
  )
}
