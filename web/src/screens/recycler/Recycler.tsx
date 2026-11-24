import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLang } from '../../lib/i18n.tsx'
import { authEnabled } from '../../lib/supabase.ts'
import { useApi } from '../../lib/useApi.ts'
import { api, fetchBlobUrl } from '../../lib/api.ts'
import { useSession } from '../../lib/session.tsx'
import { inr, kg, dateShort, countdown } from '../../lib/format.ts'
import { DEVICE_TYPES } from '../../lib/devices.ts'
import type { Lot, LotItem } from '../../lib/types.ts'
import { Header, Btn, Tag, SampleTag, ErrorNote, Field, inputCls, Banner, H2 } from '../../components/ui.tsx'
import { Stat, EmptyState, Skeleton, KV } from '../../components/kit.tsx'
import Photo from '../../components/Photo.tsx'
import Icon from '../../components/Icon.tsx'
import { lotTitle } from '../worker/Lots.tsx'

/** A lot as buyers see it: the city only (in workshop_address) and whether a location was recorded, never the GPS point itself. */
type MarketLot = Lot & { top_bid: number | null; my_bid: number | null; workshop_address: string | null; gps_recorded?: boolean; expected: { low: number; high: number } }
type RBid = {
  id: string; lot_id: string; amount: number; pickup_terms: string; expires_at: string; status: 'open' | 'accepted' | 'rejected' | 'expired'
  items: LotItem[]; weight_kg: number; short_hash: string; lot_status: string; worker_name: string; seconds_left: number
}
type Tab = 'market' | 'offers' | 'purchases'
type Sort = 'new' | 'weight' | 'bid'

const openFlags = (l: Lot) => l.flags.filter((f) => f.status === 'open')
const itemsTitle = (items: LotItem[], t: (k: string) => string) => items.map((i) => `${i.qty} × ${t('type.' + i.type)}`).join(', ')
const Th = ({ children, right = false }: { children: React.ReactNode; right?: boolean }) => <th className={`px-3 py-2 font-semibold ${right ? 'text-right' : ''}`}>{children}</th>
const THEAD = 'border-b border-hair bg-white text-sm'

function useTick(ms = 1000) {
  const [n, setN] = useState(0)
  useEffect(() => { const i = setInterval(() => setN((x) => x + 1), ms); return () => clearInterval(i) }, [ms])
  return n
}

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
    <div className="border-t border-hair pt-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('bid_amount')}><input className={`${inputCls} num`} inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} /></Field>
        <Field label={t('bid_valid')}>
          <select className={inputCls} value={mins} onChange={(e) => setMins(e.target.value)}>{['15', '30', '60', '120'].map((m) => <option key={m} value={m}>{m} min</option>)}</select>
        </Field>
      </div>
      <Field label={t('pickup_terms')}><input className={inputCls} value={terms} onChange={(e) => setTerms(e.target.value)} placeholder="e.g. Pickup tomorrow 10am" /></Field>
      {err && <ErrorNote message={err} />}
      <Btn onClick={submit} disabled={busy || !(Number(amount) > 0)} icon="check">{lot.my_bid ? t('update_bid') : t('place_bid')}</Btn>
    </div>
  )
}

function Detail({ lot, onDone }: { lot: MarketLot; onDone: () => void }) {
  const { t } = useLang()
  return (
    <aside data-tour="bid" className="rounded-3xl bg-white shadow-card" aria-label={t('lot_detail')}>
      <div className="border-b border-hair p-3">
        <p className="text-sm font-medium text-mute">{t('lot_detail')}</p>
        <p className="text-xl font-bold leading-tight">{lotTitle(lot, t)}</p>
        <p className="num text-sm text-mute">{t('lot_id')} {lot.id.slice(0, 8).toUpperCase()}, #{lot.short_hash}</p>
      </div>
      <div className="p-3">
        <p className="mb-1 text-sm font-medium text-mute">{t('photo_evidence')}, {t('photos_n', { n: lot.photo_hashes.length })}</p>
        <div className="grid grid-cols-3 gap-2">{lot.photo_hashes.slice(0, 6).map((h) => <Photo key={h} hash={h} />)}</div>
        <dl className="mt-3 divide-y divide-hair">
          <KV k={t('col_seller')} v={lot.worker_name} />
          <KV k={t('seller_location')} v={lot.workshop_address ?? '–'} />
          <KV k={t('gps_label')} v={lot.gps_recorded ? <Tag tone="ok">{t('gps_recorded')}</Tag> : <Tag>{t('no_gps')}</Tag>} />
          <KV k={t('col_weight')} v={kg(lot.weight_kg)} mono />
          <KV k={t('col_safety')} v={`${lot.steps_done}/${lot.steps_total}`} mono />
          <KV k={t('hash_status')} v={lot.chain_ok ? <Tag tone="ok">✓ {t('chain_ok')}</Tag> : <Tag tone="bad">{t('chain_bad')}</Tag>} />
          <KV k={t('col_expected')} v={<span className="num">{inr(lot.expected.low)} – {inr(lot.expected.high)}</span>} />
          <KV k={t('col_topbid')} v={lot.top_bid ? inr(lot.top_bid) : '–'} mono />
          {lot.my_bid && <KV k={t('col_mybid')} v={inr(lot.my_bid)} mono />}
        </dl>
        {openFlags(lot).length > 0 && (
          <ul className="mt-3 space-y-1" aria-label={t('findings')}>
            {openFlags(lot).map((f) => <li key={f.kind} className="flex items-start gap-2 border border-bad p-2 text-base"><Icon name="alert" size={18} className="mt-0.5 shrink-0 text-bad" /><span><b className="text-bad">{t('flag.' + f.kind)}</b></span></li>)}
          </ul>
        )}
        <p className="mb-3 mt-3 text-sm text-mute"><SampleTag /> {t('expected_note')}</p>
        <BidForm lot={lot} onDone={onDone} />
      </div>
    </aside>
  )
}

function Market() {
  const { t } = useLang()
  const { data, error, loading, reload } = useApi<MarketLot[]>('/api/market/lots')
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<string>('all')
  const [clean, setClean] = useState(false)
  const [sort, setSort] = useState<Sort>('new')
  const [sel, setSel] = useState<string | null>(null)

  const cats = useMemo(() => DEVICE_TYPES.filter((d) => data?.some((l) => l.items.some((i) => i.type === d))), [data])
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const list = (data ?? []).filter((l) =>
      (cat === 'all' || l.items.some((i) => i.type === cat)) && (!clean || openFlags(l).length === 0) &&
      (!needle || [l.worker_name, l.short_hash, l.id, lotTitle(l, t), l.workshop_address ?? ''].join(' ').toLowerCase().includes(needle)))
    return list.sort((a, b) => sort === 'weight' ? b.weight_kg - a.weight_kg : sort === 'bid' ? (b.top_bid ?? 0) - (a.top_bid ?? 0) : b.created_at.localeCompare(a.created_at))
  }, [data, q, cat, clean, sort, t])
  const selected = rows.find((l) => l.id === sel) ?? null

  if (error) return <ErrorNote message={error} />
  if (loading) return <Skeleton rows={5} />
  return (
    <div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-56 flex-1"><Field label={t('search_lots')}><input type="search" className={inputCls} value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('search_lots')} /></Field></div>
        <div className="w-44"><Field label={t('sort_by')}>
          <select className={inputCls} value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="new">{t('sort_newest')}</option><option value="weight">{t('sort_weight')}</option><option value="bid">{t('sort_bid')}</option>
          </select>
        </Field></div>
        <label className="mb-4 flex min-h-12 cursor-pointer items-center gap-2 rounded-2xl border border-hair px-3 text-base font-semibold">
          <input type="checkbox" checked={clean} onChange={(e) => setClean(e.target.checked)} className="h-5 w-5 accent-ink" />{t('no_flags_only')}
        </label>
      </div>
      <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label={t('col_category')}>
        {['all', ...cats].map((c) => (
          <button key={c} aria-pressed={cat === c} onClick={() => setCat(c)}
            className={`inline-flex min-h-11 items-center gap-1 rounded-2xl border border-hair px-3 text-base font-semibold ${cat === c ? 'bg-brand text-onbrand' : 'bg-white'}`}>
            {cat === c && <Icon name="check" size={16} />}{c === 'all' ? t('all_types') : t('type.' + c)}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState art="lots" title={t('no_match')} body={t('no_market')} />
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="overflow-x-auto rounded-2xl border border-hair bg-white">
            <table className="cards-sm w-full min-w-[760px] text-left text-base">
              <thead><tr className={THEAD}><Th>{t('col_lot')}</Th><Th>{t('col_category')}</Th><Th right>{t('col_weight')}</Th><Th>{t('col_seller')}</Th><Th>{t('col_evidence')}</Th><Th right>{t('col_expected')}</Th><Th right>{t('col_topbid')}</Th></tr></thead>
              <tbody>
                {rows.map((l) => (
                  <tr key={l.id} onClick={() => setSel(l.id)} className={`cursor-pointer border-b border-hair ${sel === l.id ? 'bg-gold-soft' : 'hover:bg-sunk'}`}>
                    <td className="px-3 py-3">
                      <button onClick={() => setSel(l.id)} aria-pressed={sel === l.id} className="num min-h-11 text-left font-semibold underline underline-offset-4">#{l.short_hash}</button>
                      <div className="text-sm text-mute">{dateShort(l.created_at)}</div>
                    </td>
                    <td className="px-3 py-3 font-semibold">{lotTitle(l, t)}</td>
                    <td className="num px-3 py-3 text-right">{kg(l.weight_kg)}</td>
                    <td className="px-3 py-3"><div>{l.worker_name}</div><div className="text-sm text-mute">{l.workshop_address?.replace('SAMPLE: ', '').split(',').slice(-2).join(',')}</div></td>
                    <td className="px-3 py-3">
                      <span className="flex flex-wrap gap-1">
                        <Tag>{t('photos_n', { n: l.photo_hashes.length })}</Tag>
                        {l.chain_ok ? <Tag tone="ok">✓ {t('chain_ok')}</Tag> : <Tag tone="bad">{t('chain_bad')}</Tag>}
                        {openFlags(l).length > 0 && <Tag tone="bad">⚠ {openFlags(l).length} {t('flags_tag')}</Tag>}
                      </span>
                    </td>
                    <td className="num px-3 py-3 text-right">{inr(l.expected.low)}–{inr(l.expected.high)}<div className="text-sm text-mute">SAMPLE</div></td>
                    <td className="num px-3 py-3 text-right font-semibold">{l.top_bid ? inr(l.top_bid) : '–'}{l.my_bid && <div className="text-sm font-normal text-mute">{t('my_bid')} {inr(l.my_bid)}</div>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="lg:sticky lg:top-4">
            {selected ? <Detail lot={selected} onDone={reload} /> : <EmptyState art="scan" title={t('lot_detail')} body={t('select_lot')} />}
          </div>
        </div>
      )}
    </div>
  )
}

function useBids() { return useApi<RBid[]>('/api/recycler/bids') }

function MyOffers() {
  const { t } = useLang()
  const { data, error, loading } = useBids()
  useTick()
  if (error) return <ErrorNote message={error} />
  if (loading) return <Skeleton rows={4} />
  const now = Date.now()
  const active = (data ?? []).filter((b) => b.status === 'open' && Date.parse(b.expires_at) > now)
  const past = (data ?? []).filter((b) => !active.includes(b) && b.status !== 'accepted')
  return (
    <div>
      {active.length === 0 ? <EmptyState art="offers" title={t('no_offers')} /> : (
        <div className="overflow-x-auto rounded-2xl border border-hair bg-white">
          <table className="cards-sm w-full min-w-[640px] text-left text-base">
            <thead><tr className={THEAD}><Th>{t('col_lot')}</Th><Th>{t('col_seller')}</Th><Th right>{t('col_mybid')}</Th><Th>{t('col_terms')}</Th><Th right>{t('col_timeleft')}</Th></tr></thead>
            <tbody>
              {active.map((b) => {
                const secs = Math.max(0, Math.round((Date.parse(b.expires_at) - now) / 1000))
                return (
                  <tr key={b.id} className="border-b border-hair">
                    <td className="px-3 py-3"><span className="num font-semibold">#{b.short_hash}</span><div className="text-sm text-mute">{itemsTitle(b.items, t)}, {kg(b.weight_kg)}</div></td>
                    <td className="px-3 py-3">{b.worker_name}</td>
                    <td className="num px-3 py-3 text-right font-semibold">{inr(b.amount)}</td>
                    <td className="px-3 py-3">{b.pickup_terms || '–'}</td>
                    <td className="num px-3 py-3 text-right"><span className="inline-flex items-center gap-1"><Icon name="clock" size={16} />{countdown(secs)}</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {past.length > 0 && (
        <>
          <H2>{t('past_bids')}</H2>
          <ul className="divide-y divide-hair border-y border-hair bg-white">
            {past.map((b) => <li key={b.id} className="flex min-h-12 items-center justify-between gap-2 px-3 py-2 text-base"><span><span className="num font-semibold">#{b.short_hash}</span>, {itemsTitle(b.items, t)}</span><span className="flex items-center gap-2"><span className="num">{inr(b.amount)}</span><Tag>{t('bid.' + (b.status === 'open' ? 'expired' : b.status))}</Tag></span></li>)}
          </ul>
        </>
      )}
    </div>
  )
}

function Purchases() {
  const { t } = useLang()
  const { data, error, loading } = useBids()
  const [err, setErr] = useState<string | null>(null)
  const won = (data ?? []).filter((b) => b.status === 'accepted')
  async function receipt(b: RBid) {
    setErr(null)
    try {
      const url = await fetchBlobUrl(`/api/lots/${b.lot_id}/receipt.pdf`)
      const a = document.createElement('a'); a.href = url; a.download = `urban-mine-receipt-${b.short_hash}.pdf`; a.click()
      setTimeout(() => URL.revokeObjectURL(url), 10000)
    } catch (e) { setErr((e as Error).message) }
  }
  if (error) return <ErrorNote message={error} />
  if (loading) return <Skeleton rows={4} />
  return won.length === 0 ? <EmptyState art="lots" title={t('no_purchases')} /> : (
    <>
      {err && <ErrorNote message={err} />}
      <div className="overflow-x-auto rounded-2xl border border-hair bg-white">
        <table className="cards-sm w-full min-w-[640px] text-left text-base">
          <thead><tr className={THEAD}><Th>{t('col_lot')}</Th><Th>{t('col_seller')}</Th><Th right>{t('col_weight')}</Th><Th right>{t('col_amount')}</Th><Th>{t('col_receipt')}</Th></tr></thead>
          <tbody>
            {won.map((b) => (
              <tr key={b.id} className="border-b border-hair">
                <td className="px-3 py-3"><span className="num font-semibold">#{b.short_hash}</span><div className="text-sm text-mute">{itemsTitle(b.items, t)}</div></td>
                <td className="px-3 py-3">{b.worker_name}</td>
                <td className="num px-3 py-3 text-right">{kg(b.weight_kg)}</td>
                <td className="num px-3 py-3 text-right font-semibold">{inr(b.amount)}<div className="text-sm font-normal text-bad">{t('simulated')}</div></td>
                <td className="px-3 py-3"><Btn full={false} variant="secondary" icon="download" onClick={() => receipt(b)}>{t('download_pdf')}</Btn></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

export default function Recycler() {
  const { t } = useLang()
  const nav = useNavigate()
  const { loginAs, signOut } = useSession()
  const [tab, setTab] = useState<Tab>('market')
  const lots = useApi<MarketLot[]>('/api/market/lots')
  const bids = useBids()
  const now = Date.now()
  const active = (bids.data ?? []).filter((b) => b.status === 'open' && Date.parse(b.expires_at) > now).length
  const bought = (bids.data ?? []).filter((b) => b.status === 'accepted')
  const tabs: [Tab, string][] = [['market', 'tab_market'], ['offers', 'tab_my_offers'], ['purchases', 'tab_purchases']]

  return (
    <div className="min-h-dvh bg-paper pb-10">
      <Header title={t('recycler_title')} back={false} brand />
      <nav aria-label={t('recycler_title')} className="border-b border-hair">
        <div role="tablist" className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4">
          {tabs.map(([k, label]) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
              className={`flex min-h-12 shrink-0 items-center border-b-4 px-3 text-base font-semibold ${tab === k ? 'border-amber' : 'border-transparent'}`}>{t(label)}</button>
          ))}
        </div>
      </nav>
      <main id="main" className="screen-enter mx-auto max-w-7xl px-4 pt-4">
        <Banner icon="info">{t('recycler_note')}</Banner>
        <dl className="mt-3 grid grid-cols-3 gap-3 rounded-2xl border border-hair bg-white p-3">
          <Stat label={t('sum_available')} value={lots.data?.length ?? '–'} />
          <Stat label={t('sum_active')} value={bids.data ? active : '–'} />
          <Stat label={t('sum_bought')} value={bids.data ? `${bought.length}, ${inr(bought.reduce((s, b) => s + b.amount, 0))}` : '–'} note={<SampleTag />} />
        </dl>
        <div className="mt-4">
          {tab === 'market' && <Market />}
          {tab === 'offers' && <MyOffers />}
          {tab === 'purchases' && <Purchases />}
        </div>
        <div className="mt-8 max-w-xs">{authEnabled
          ? <Btn variant="secondary" icon="lock" onClick={signOut}>{t('sign_out')}</Btn>
          : <Btn variant="secondary" icon="swap" onClick={() => { loginAs('u-worker-1'); nav('/') }}>{t('back_to_worker')}</Btn>}</div>
      </main>
    </div>
  )
}
