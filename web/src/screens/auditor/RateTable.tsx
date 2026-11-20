import { useState } from 'react'
import { useLang } from '../../lib/i18n.tsx'
import { useApi } from '../../lib/useApi.ts'
import { api } from '../../lib/api.ts'
import { Tag, Btn, Loading, ErrorNote, Banner, SampleTag, inputCls } from '../../components/ui.tsx'

type Rate = { material: string; city: string; rate_per_kg: number; updated_at: string; source: string }

function Row({ r, stale, onSaved }: { r: Rate; stale: boolean; onSaved: () => void }) {
  const { t } = useLang()
  const [v, setV] = useState(String(r.rate_per_kg))
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const days = Math.floor((Date.now() - Date.parse(r.updated_at)) / 86400000)
  async function save() {
    setBusy(true); setErr(null)
    try { await api('/api/auditor/rates', { method: 'PUT', body: { material: r.material, city: r.city, rate_per_kg: Number(v) } }); onSaved() }
    catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }
  return (
    <tr className={`border-b border-hair ${stale ? 'bg-amber/20' : ''}`}>
      <td className="px-3 py-2 font-medium">{t('mat.' + r.material)}</td>
      <td className="px-3 py-2">{r.city}</td>
      <td className="px-3 py-2">
        <input aria-label={`${t('mat.' + r.material)} ${r.city}`} className={`${inputCls} num max-w-28`} inputMode="decimal" value={v} onChange={(e) => setV(e.target.value.replace(/[^0-9.]/g, ''))} />
        {err && <span className="block text-sm text-bad">{err}</span>}
      </td>
      <td className="px-3 py-2 text-sm">{r.updated_at.slice(0, 10)} {stale ? <Tag tone="bad">{t('stale')} · {days}d</Tag> : <span className="text-mute">({days}d)</span>}</td>
      <td className="px-3 py-2 text-sm text-mute">{r.source}</td>
      <td className="px-3 py-2"><Btn full={false} variant="secondary" disabled={busy || Number(v) === r.rate_per_kg || !(Number(v) > 0)} onClick={save}>{t('save')}</Btn></td>
    </tr>
  )
}

export default function RateTable() {
  const { t } = useLang()
  const { data, error, loading, reload } = useApi<{ rates: Rate[]; stale: Rate[] }>('/api/auditor/rates')
  if (error) return <ErrorNote message={error} />
  if (loading || !data) return <Loading />
  const staleKeys = new Set(data.stale.map((s) => s.material + s.city))
  return (
    <>
      <div className="mb-3 flex items-center gap-2"><SampleTag /><span className="text-sm text-mute">{t('rates_help')}</span></div>
      {data.stale.length > 0 && <div className="mb-3"><Banner tone="amber" icon="clock">{t('stale_banner', { n: data.stale.length })}</Banner></div>}
      <div className="overflow-x-auto border border-ink bg-white">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead><tr className="border-b border-ink font-mono text-sm uppercase">{['material', 'col_city', 'col_rate', 'col_updated', 'col_source', ''].map((h, i) => <th key={i} className="px-3 py-2 font-semibold">{h ? t(h) : ''}</th>)}</tr></thead>
          <tbody>{data.rates.map((r) => <Row key={r.material + r.city + r.rate_per_kg + r.updated_at} r={r} stale={staleKeys.has(r.material + r.city)} onSaved={reload} />)}</tbody>
        </table>
      </div>
    </>
  )
}
