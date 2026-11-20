import type { ReactNode } from 'react'
import { useLang } from '../../lib/i18n.tsx'
import { useApi } from '../../lib/useApi.ts'
import { Tag, Loading, ErrorNote } from '../../components/ui.tsx'

function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  const { t } = useLang()
  return (
    <div className="overflow-x-auto border border-ink bg-white">
      <table className="w-full min-w-[520px] text-left text-sm">
        <thead><tr className="border-b border-ink font-mono text-sm uppercase">{head.map((h) => <th key={h} className="px-3 py-2 font-semibold">{t(h)}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i} className="border-b border-hair">{r.map((c, j) => <td key={j} className="px-3 py-3">{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  )
}

export function Workers() {
  const { data, error, loading } = useApi<{ id: string; name: string; phone: string | null; workshop: string | null; lots: number; open_flags: number }[]>('/api/auditor/workers')
  if (error) return <ErrorNote message={error} />
  if (loading || !data) return <Loading />
  return <Table head={['col_worker', 'col_workshop', 'col_lots', 'col_open_flags']} rows={data.map((w) => [w.name, w.workshop ?? '-', <span className="num">{w.lots}</span>, w.open_flags > 0 ? <Tag tone="bad">{w.open_flags}</Tag> : <span className="num">0</span>])} />
}

export function Recyclers() {
  const { data, error, loading } = useApi<{ id: string; name: string; bids: number; accepted: number }[]>('/api/auditor/recyclers')
  if (error) return <ErrorNote message={error} />
  if (loading || !data) return <Loading />
  return <Table head={['col_recycler', 'col_bids', 'col_accepted']} rows={data.map((r) => [r.name, <span className="num">{r.bids}</span>, <span className="num">{r.accepted}</span>])} />
}
