import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useLang } from '../../lib/i18n.tsx'
import { useApi } from '../../lib/useApi.ts'
import { api } from '../../lib/api.ts'
import { kg, dateShort, inr } from '../../lib/format.ts'
import type { Lot, Offer } from '../../lib/types.ts'
import { Tag, Btn, ErrorNote, H2, Banner, inputCls } from '../../components/ui.tsx'
import { StatusChip, Skeleton, EmptyState } from '../../components/kit.tsx'
import Photo from '../../components/Photo.tsx'
import Icon from '../../components/Icon.tsx'
import { lotTitle } from '../worker/Lots.tsx'

type Overview = { kpis: { lots: number; flagged: number; held: number; total_kg: number; safety_pct: number | null; open_bids: number }; lots: Lot[] }
const openFlags = (l: Lot) => l.flags.filter((f) => f.status === 'open')

export default function LotReview() {
  const { t } = useLang()
  const nav = useNavigate()
  const { data, error, loading } = useApi<Overview>('/api/auditor/overview')
  const [filter, setFilter] = useState<'all' | 'flagged' | 'held'>('all')
  if (error) return <ErrorNote message={error} />
  if (loading || !data) return <Skeleton rows={5} />
  const k = data.kpis
  const kpis: [string, string, boolean][] = [
    [t('kpi_lots'), String(k.lots), false], [t('kpi_flagged'), String(k.flagged), k.flagged > 0], [t('kpi_held'), String(k.held), k.held > 0],
    [t('kpi_kg'), kg(k.total_kg), false], [t('kpi_safety'), k.safety_pct === null ? '-' : `${k.safety_pct}%`, false], [t('kpi_bids'), String(k.open_bids), false],
  ]
  const rows = data.lots.filter((l) => filter === 'all' || (filter === 'flagged' ? openFlags(l).length > 0 : l.status === 'held'))

  return (
    <>
      <dl className="grid grid-cols-2 rounded-2xl border border-hair bg-white sm:grid-cols-3 lg:grid-cols-6">
        {kpis.map(([label, v, warn]) => (
          <div key={label} className="border-b border-r border-hair p-3 last:border-r-0">
            <dt className="text-sm font-medium text-mute">{label}</dt>
            <dd className="num flex items-center gap-1 text-3xl font-semibold">{warn && <Icon name="alert" size={22} className="text-bad" />}{v}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-4 flex flex-wrap items-center gap-2" role="group" aria-label={t('filter')}>
        {(['all', 'flagged', 'held'] as const).map((f) => (
          <button key={f} aria-pressed={filter === f} onClick={() => setFilter(f)}
            className={`inline-flex min-h-11 items-center gap-1 rounded-2xl border border-hair px-3 text-base font-semibold ${filter === f ? 'bg-brand text-onbrand' : 'bg-white'}`}>{filter === f && <Icon name="check" size={16} />}{t('filter_' + f)}</button>
        ))}
        <span className="text-base text-mute">{rows.length} {t('lots_word')}</span>
      </div>

      {rows.length === 0 ? <div className="mt-3"><EmptyState art="shield" title={t('no_findings')} /></div> : (
        <div className="mt-3 overflow-x-auto rounded-2xl border border-hair bg-white">
          <table className="cards-sm w-full min-w-[860px] text-left text-base">
            <thead>
              <tr className="border-b border-hair text-sm">
                {['col_lot', 'col_worker', 'col_items', 'col_weight', 'col_safety', 'col_flags', 'col_status', 'col_chain'].map((c) => <th key={c} className="px-3 py-2 font-semibold">{t(c)}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => (
                <tr key={l.id} onClick={() => nav(`/auditor/lot/${l.id}`)} className="cursor-pointer border-b border-hair hover:bg-sunk">
                  <td className="px-3 py-3"><Link className="num inline-flex min-h-11 items-center font-semibold underline underline-offset-4" to={`/auditor/lot/${l.id}`} onClick={(e) => e.stopPropagation()}>#{l.short_hash}</Link><div className="text-sm text-mute">{dateShort(l.created_at)}</div></td>
                  <td className="px-3 py-3">{l.worker_name}</td>
                  <td className="px-3 py-3">{lotTitle(l, t)}</td>
                  <td className="num px-3 py-3">{kg(l.weight_kg)}</td>
                  <td className="num px-3 py-3">{l.steps_done}/{l.steps_total}</td>
                  <td className="px-3 py-3"><span className="flex flex-wrap gap-1">{openFlags(l).length ? openFlags(l).map((f) => <span key={f.kind} className="inline-flex items-center gap-1 border border-bad px-1.5 py-0.5 text-sm font-semibold text-bad"><Icon name="alert" size={14} />{t('flag.' + f.kind)}</span>) : <span className="text-mute">–</span>}</span></td>
                  <td className="px-3 py-3"><StatusChip status={l.status} /></td>
                  <td className="px-3 py-3">{l.chain_ok ? <Tag tone="ok">✓ {t('chain_ok')}</Tag> : <Tag tone="bad">✕ {t('chain_bad')}</Tag>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

type Detail = { lot: Lot; related: { id: string; worker_name: string; created_at: string; shared: string[] }[]; offers: Offer[]; chain: { hash_ok: boolean; link_ok: boolean } }

function Check({ ok, label }: { ok: boolean; label: string }) {
  const { t } = useLang()
  return (
    <li className="flex items-start gap-2 py-2 text-base">
      <Icon name={ok ? 'check' : 'x'} size={20} className={`mt-0.5 shrink-0 ${ok ? 'text-ok' : 'text-bad'}`} />
      <span className="flex-1">{label}</span>
      <Tag tone={ok ? 'ok' : 'bad'}>{ok ? t('check_pass') : t('check_fail')}</Tag>
    </li>
  )
}

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
  if (loading || !data) return <Skeleton rows={5} />
  const { lot, related, offers, chain } = data
  const shared = new Set(related.flatMap((r) => r.shared))
  const first = /^0+$/.test(lot.prev_hash)

  return (
    <div className="pb-40">
      <Link to="/auditor" className="inline-flex min-h-11 items-center text-base font-semibold underline underline-offset-4">← {t('aud_lots')}</Link>
      <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold leading-tight">{lotTitle(lot, t)} <span className="num text-lg font-normal text-mute">#{lot.short_hash}</span></h2>
          <p className="text-base text-mute">{lot.worker_name} · {kg(lot.weight_kg)} · {dateShort(lot.created_at)}{lot.gps ? ` · ${lot.gps.lat.toFixed(3)}, ${lot.gps.lng.toFixed(3)}` : ` · ${t('no_gps')}`}</p>
        </div>
        <p className="flex flex-wrap gap-1"><StatusChip status={lot.status} />{lot.chain_ok ? <Tag tone="ok">✓ {t('chain_ok')}</Tag> : <Tag tone="bad">✕ {t('chain_bad')}</Tag>}<Tag>{lot.steps_done}/{lot.steps_total} {t('safety_short')}</Tag></p>
      </div>

      <div className="mt-4 grid gap-6 lg:grid-cols-2">
        <section>
          <H2>{t('findings')}</H2>
          {lot.flags.length === 0 ? <EmptyState art="shield" title={t('no_findings')} /> : (
            <ul className="space-y-3">
              {lot.flags.map((f) => (
                <li key={f.kind} className="border-2 border-bad bg-white">
                  <p className="flex items-center gap-2 bg-bad px-3 py-1.5 text-base font-bold text-onbrand"><Icon name="alert" size={20} />{t('flag.' + f.kind)}<span className="ml-auto text-sm font-normal">{f.status}</span></p>
                  <div className="p-3"><p className="text-base">{f.detail}</p><p className="mt-1 text-sm text-mute">{t('flag_why.' + f.kind)}</p></div>
                </li>
              ))}
            </ul>
          )}

          <H2>{t('chain_panel')}</H2>
          <div className="rounded-2xl border border-hair bg-white p-3">
            <ul className="divide-y divide-hair">
              <Check ok={chain.hash_ok} label={t('chain_hash_ok')} />
              <Check ok={chain.link_ok} label={first ? t('chain_first') : t('chain_link_ok')} />
            </ul>
            <dl className="mt-2 space-y-1 border-t border-hair pt-2">
              <div><dt className="text-sm font-semibold text-mute">{t('record_hash')}</dt><dd className="num break-all text-sm">{lot.hash}</dd></div>
              <div><dt className="text-sm font-semibold text-mute">{t('prev')}</dt><dd className="num break-all text-sm text-mute">{lot.prev_hash}</dd></div>
            </dl>
            <p className="mt-2 text-sm text-mute">{t('chain_note')}</p>
          </div>

          <H2>{t('offers_title')}</H2>
          {offers.length === 0 ? <p className="text-base text-mute">–</p> : (
            <ul className="divide-y divide-hair border-y border-hair bg-white text-base">{offers.map((o) => <li key={o.id} className="flex justify-between px-3 py-2"><span>{o.recycler_name}</span><span className="num font-semibold">{inr(o.amount)}</span></li>)}</ul>
          )}
        </section>

        <section>
          <H2>{t('photo_compare')}</H2>
          <p className="mb-2 text-base font-semibold">{t('this_lot')} #{lot.short_hash}</p>
          <div className="grid grid-cols-2 gap-2">
            {lot.photo_hashes.map((h) => (
              <div key={h}>
                <Photo hash={h} />
                {shared.has(h) && <p className="mt-1"><Tag tone="bad">⚠ {t('shared_photo')}</Tag></p>}
              </div>
            ))}
          </div>
          {related.map((r) => (
            <div key={r.id} className="mt-4 border-t border-hair pt-3">
              <p className="mb-2 text-base font-semibold">{t('also_in')} <Link className="num inline-flex min-h-11 items-center underline" to={`/auditor/lot/${r.id}`}>#{r.id.slice(0, 8)}</Link> · {r.worker_name} · {dateShort(r.created_at)}</p>
              <div className="grid grid-cols-2 gap-2">{r.shared.map((h) => <Photo key={h} hash={h} />)}</div>
            </div>
          ))}
          {related.length === 0 && <p className="mt-3 text-base text-mute">{t('no_related')}</p>}
        </section>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-30 border-t-2 border-hair bg-paper">
        <div className="mx-auto max-w-6xl px-4 py-3">
          {err && <ErrorNote message={err} />}
          {msg && <div className="mb-2"><Banner tone="ok" icon="check">{msg}</Banner></div>}
          <div className="grid gap-2 md:grid-cols-[auto_1fr_auto] md:items-center">
            {lot.status === 'held'
              ? <Btn full={false} variant="secondary" icon="lock" disabled={busy} onClick={() => act('release', {}, t('released_ok'))}>{t('release_payout')}</Btn>
              : <Btn full={false} variant="danger" icon="lock" disabled={busy} onClick={() => act('hold', {}, t('hold_ok'))}>{t('hold_payout')}</Btn>}
            <input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('recheck_note')} aria-label={t('recheck_note')} />
            <Btn full={false} icon="camera" disabled={busy} onClick={() => act('recheck', { note }, t('recheck_ok'))}>{t('request_recheck')}</Btn>
          </div>
          <p className="mt-1 text-sm text-mute">{t('hold_help')}</p>
        </div>
      </div>
    </div>
  )
}
