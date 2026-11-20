import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLang } from '../../lib/i18n.tsx'
import { useApi } from '../../lib/useApi.ts'
import { api } from '../../lib/api.ts'
import { useSession } from '../../lib/session.tsx'
import { inr, kg, dateShort } from '../../lib/format.ts'
import type { Lot } from '../../lib/types.ts'
import { Header, Btn, Tag, SampleTag, Loading, ErrorNote, Field, inputCls, Banner } from '../../components/ui.tsx'
import { lotTitle } from '../worker/Lots.tsx'

type MarketLot = Lot & { top_bid: number | null; my_bid: number | null }

function BidForm({ lot, onDone }: { lot: MarketLot; onDone: () => void }) {
  const { t } = useLang()
  const [amount, setAmount] = useState('')
  const [terms, setTerms] = useState('')
  const [mins, setMins] = useState('30')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  async function submit() {
    setBusy(true); setErr(null)
    try { await api(`/api/lots/${lot.id}/bids`, { body: { amount: Number(amount), pickup_terms: terms, minutes: Number(mins) } }); setAmount(''); onDone() }
    catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }
  return (
    <div className="mt-3 border-t border-hair pt-3">
      <div className="grid grid-cols-2 gap-2">
        <Field label={t('bid_amount')}><input className={`${inputCls} num`} inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} /></Field>
        <Field label={t('bid_valid')}>
          <select className={inputCls} value={mins} onChange={(e) => setMins(e.target.value)}>{['15', '30', '60', '120'].map((m) => <option key={m} value={m}>{m} min</option>)}</select>
        </Field>
      </div>
      <Field label={t('pickup_terms')}><input className={inputCls} value={terms} onChange={(e) => setTerms(e.target.value)} placeholder="SAMPLE: pickup tomorrow 10am" /></Field>
      {err && <ErrorNote message={err} />}
      <Btn onClick={submit} disabled={busy || !(Number(amount) > 0)}>{t('place_bid')}</Btn>
    </div>
  )
}

export default function Recycler() {
  const { t } = useLang()
  const nav = useNavigate()
  const { loginAs } = useSession()
  const { data, error, loading, reload } = useApi<MarketLot[]>('/api/market/lots')
  return (
    <div className="mx-auto min-h-dvh max-w-3xl bg-paper pb-10">
      <Header title={t('recycler_title')} back={false} brand />
      <main className="px-4 pt-4">
        <Banner icon="info">{t('recycler_note')}</Banner>
        <p className="mt-2 flex items-center gap-2 text-sm"><SampleTag /> {t('recycler_sample')}</p>
        {error && <ErrorNote message={error} />}
        {loading && <Loading />}
        {data && data.length === 0 && <p className="py-8 text-center text-mute">{t('no_market')}</p>}
        <ul className="mt-3 space-y-3">
          {data?.map((l) => (
            <li key={l.id} className="border-2 border-ink bg-white p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-bold">{lotTitle(l, t)}</p>
                  <p className="text-sm text-mute">{l.worker_name} · {kg(l.weight_kg)} · {dateShort(l.created_at)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-mute">{t('top_bid')}</p>
                  <p className="num text-xl font-semibold">{l.top_bid ? inr(l.top_bid) : '-'}</p>
                </div>
              </div>
              <p className="mt-2 flex flex-wrap items-center gap-1">
                <span className="num text-[12px]">#{l.short_hash}</span>
                {l.chain_ok ? <Tag tone="ok">✓ {t('chain_ok')}</Tag> : <Tag tone="bad">{t('chain_bad')}</Tag>}
                <Tag>{l.steps_done}/{l.steps_total} {t('safety_short')}</Tag>
                {l.flags.length > 0 && <Tag tone="bad">{l.flags.length} {t('flags_tag')}</Tag>}
                {l.my_bid && <Tag tone="amber">{t('my_bid')} {inr(l.my_bid)}</Tag>}
              </p>
              <BidForm lot={l} onDone={reload} />
            </li>
          ))}
        </ul>
        <div className="mt-6"><Btn variant="secondary" icon="swap" onClick={() => { loginAs('u-worker-1'); nav('/') }}>{t('back_to_worker')}</Btn></div>
      </main>
    </div>
  )
}
