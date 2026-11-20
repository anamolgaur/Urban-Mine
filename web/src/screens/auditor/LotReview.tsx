import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useLang } from '../../lib/i18n.tsx'
import { useApi } from '../../lib/useApi.ts'
import { api } from '../../lib/api.ts'
import { kg, dateShort, inr } from '../../lib/format.ts'
import type { Lot, Offer } from '../../lib/types.ts'
import { Tag, Btn, Loading, ErrorNote, H2, Banner, inputCls } from '../../components/ui.tsx'
import Photo from '../../components/Photo.tsx'
import { lotTitle } from '../worker/Lots.tsx'

type Overview = { kpis: { lots: number; flagged: number; held: number; total_kg: number; safety_pct: number | null; open_bids: number }; lots: Lot[] }
const TONE = { open: 'plain', listed: 'amber', sold: 'ok', held: 'bad' } as const
const openFlags = (l: Lot) => l.flags.filter((f) => f.status === 'open')

export default function LotReview() {
  const { t } = useLang()
  const nav = useNavigate()
  const { data, error, loading } = useApi<Overview>('/api/auditor/overview')
  const [filter, setFilter] = useState<'all' | 'flagged' | 'held'>('all')
  if (error) return <ErrorNote message={error} />
  if (loading || !data) return <Loading />
  const k = data.kpis
  const kpis: [string, string][] = [
    [t('kpi_lots'), String(k.lots)], [t('kpi_flagged'), String(k.flagged)], [t('kpi_held'), String(k.held)],
    [t('kpi_kg'), kg(k.total_kg)], [t('kpi_safety'), k.safety_pct === null ? '-' : `${k.safety_pct}%`], [t('kpi_bids'), String(k.open_bids)],
  ]
  const rows = data.lots.filter((l) => filter === 'all' || (filter === 'flagged' ? openFlags(l).length > 0 : l.status === 'held'))

  return (
    <>
      <dl className="grid grid-cols-2 border border-ink sm:grid-cols-3 lg:grid-cols-6">
        {kpis.map(([label, v]) => (
          <div key={label} className="border-b border-r border-hair p-3 last:border-r-0">
            <dt className="text-sm text-mute">{label}</dt>
            <dd className="num text-2xl font-semibold">{v}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-4 flex flex-wrap items-center gap-2" role="group" aria-label={t('filter')}>
        {(['all', 'flagged', 'held'] as const).map((f) => (
          <button key={f} aria-pressed={filter === f} onClick={() => setFilter(f)}
            className={`min-h-11 border border-ink px-3 text-sm font-semibold ${filter === f ? 'bg-ink text-paper' : 'bg-white'}`}>{t('filter_' + f)}</button>
        ))}
        <span className="text-sm text-mute">{rows.length} {t('lots_word')}</span>
      </div>

      <div className="mt-3 overflow-x-auto border border-ink bg-white">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead>
            <tr className="border-b border-ink font-mono text-[12px] uppercase">
              {['col_lot', 'col_worker', 'col_items', 'col_weight', 'col_safety', 'col_flags', 'col_status', 'col_chain'].map((c) => <th key={c} className="px-3 py-2 font-semibold">{t(c)}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((l) => (
              <tr key={l.id} onClick={() => nav(`/auditor/lot/${l.id}`)} className="cursor-pointer border-b border-hair hover:bg-sunk">
                <td className="px-3 py-3"><Link className="num font-semibold underline" to={`/auditor/lot/${l.id}`} onClick={(e) => e.stopPropagation()}>#{l.short_hash}</Link><div className="text-[12px] text-mute">{dateShort(l.created_at)}</div></td>
                <td className="px-3 py-3">{l.worker_name}</td>
                <td className="px-3 py-3">{lotTitle(l, t)}</td>
                <td className="num px-3 py-3">{kg(l.weight_kg)}</td>
                <td className="num px-3 py-3">{l.steps_done}/{l.steps_total}</td>
                <td className="px-3 py-3"><span className="flex flex-wrap gap-1">{openFlags(l).length ? openFlags(l).map((f) => <Tag key={f.kind} tone="bad">{t('flag.' + f.kind)}</Tag>) : <span className="text-mute">–</span>}</span></td>
                <td className="px-3 py-3"><Tag tone={TONE[l.status]}>{t('status.' + l.status)}</Tag></td>
                <td className="px-3 py-3">{l.chain_ok ? <Tag tone="ok">✓ {t('chain_ok')}</Tag> : <Tag tone="bad">{t('chain_bad')}</Tag>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

type Detail = { lot: Lot; related: { id: string; worker_name: string; created_at: string; shared: string[] }[]; offers: Offer[] }

export function LotDetail() {
  const { id } = useParams()
  const { t } = useLang()
  const { data, error, loading, reload } = useApi<Detail>(`/api/auditor/lots/${id}`)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  async function act(path: string, body: unknown, ok: string) {
    setBusy(true); setErr(null); setMsg(null)
    try { await api(`/api/auditor/lots/${id}/${path}`, { method: 'POST', body }); setMsg(ok); reload() } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }

  if (error) return <ErrorNote message={error} />
  if (loading || !data) return <Loading />
  const { lot, related, offers } = data
  const shared = new Set(related.flatMap((r) => r.shared))

  return (
    <>
      <Link to="/auditor" className="text-sm font-semibold underline underline-offset-4">← {t('aud_lots')}</Link>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">{lotTitle(lot, t)} <span className="num text-lg text-mute">#{lot.short_hash}</span></h2>
          <p className="text-sm text-mute">{lot.worker_name} · {kg(lot.weight_kg)} · {dateShort(lot.created_at)}{lot.gps ? ` · ${lot.gps.lat.toFixed(3)}, ${lot.gps.lng.toFixed(3)}` : ''}</p>
        </div>
        <p className="flex flex-wrap gap-1"><Tag tone={TONE[lot.status]}>{t('status.' + lot.status)}</Tag>{lot.chain_ok ? <Tag tone="ok">✓ {t('chain_ok')}</Tag> : <Tag tone="bad">{t('chain_bad')}</Tag>}<Tag>{lot.steps_done}/{lot.steps_total} {t('safety_short')}</Tag></p>
      </div>

      <div className="mt-4 grid gap-6 lg:grid-cols-2">
        <section>
          <H2>{t('findings')}</H2>
          {lot.flags.length === 0 ? <p className="text-sm text-mute">{t('no_findings')}</p> : (
            <ul className="space-y-2">
              {lot.flags.map((f) => (
                <li key={f.kind} className="border border-bad p-2">
                  <p className="flex items-center gap-2 font-semibold"><Tag tone="bad">{t('flag.' + f.kind)}</Tag><span className="text-sm text-mute">{f.status}</span></p>
                  <p className="mt-1 text-sm">{f.detail}</p>
                </li>
              ))}
            </ul>
          )}
          <H2>{t('record_hash')}</H2>
          <p className="num break-all text-[12px]">{lot.hash}</p>
          <p className="num mt-1 break-all text-[12px] text-mute">{t('prev')}: {lot.prev_hash}</p>

          <H2>{t('offers_title')}</H2>
          {offers.length === 0 ? <p className="text-sm text-mute">–</p> : (
            <ul className="divide-y divide-hair border-y border-hair text-sm">{offers.map((o) => <li key={o.id} className="flex justify-between py-2"><span>{o.recycler_name}</span><span className="num font-semibold">{inr(o.amount)}</span></li>)}</ul>
          )}
        </section>

        <section>
          <H2>{t('photo_compare')}</H2>
          <p className="mb-2 text-sm font-semibold">{t('this_lot')} #{lot.short_hash}</p>
          <div className="grid grid-cols-2 gap-2">
            {lot.photo_hashes.map((h) => (
              <div key={h}>
                <Photo hash={h} />
                {shared.has(h) && <p className="mt-1"><Tag tone="bad">{t('shared_photo')}</Tag></p>}
              </div>
            ))}
          </div>
          {related.map((r) => (
            <div key={r.id} className="mt-4 border-t border-hair pt-3">
              <p className="mb-2 text-sm font-semibold">{t('also_in')} <Link className="num underline" to={`/auditor/lot/${r.id}`}>#{r.id.slice(0, 8)}</Link> · {r.worker_name} · {dateShort(r.created_at)}</p>
              <div className="grid grid-cols-2 gap-2">{r.shared.map((h) => <Photo key={h} hash={h} />)}</div>
            </div>
          ))}
          {related.length === 0 && <p className="mt-3 text-sm text-mute">{t('no_related')}</p>}
        </section>
      </div>

      <div className="mt-8 border-t-2 border-ink pt-4">
        <H2>{t('actions')}</H2>
        {err && <ErrorNote message={err} />}
        {msg && <Banner tone="ok" icon="check">{msg}</Banner>}
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div>
            {lot.status === 'held'
              ? <Btn variant="secondary" disabled={busy} onClick={() => act('release', {}, t('released_ok'))}>{t('release_payout')}</Btn>
              : <Btn variant="danger" disabled={busy} icon="lock" onClick={() => act('hold', {}, t('hold_ok'))}>{t('hold_payout')}</Btn>}
            <p className="mt-1 text-sm text-mute">{t('hold_help')}</p>
          </div>
          <div>
            <input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('recheck_note')} aria-label={t('recheck_note')} />
            <div className="mt-2"><Btn disabled={busy} icon="camera" onClick={() => act('recheck', { note }, t('recheck_ok'))}>{t('request_recheck')}</Btn></div>
          </div>
        </div>
      </div>
    </>
  )
}
