import type { ReactNode } from 'react'
import { useLang } from '../../lib/i18n.tsx'
import { useState } from 'react'
import { useApi } from '../../lib/useApi.ts'
import { api } from '../../lib/api.ts'
import { Tag, Loading, ErrorNote, Btn, H2, Banner } from '../../components/ui.tsx'

function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  const { t } = useLang()
  return (
    <div className="overflow-x-auto rounded-2xl border border-hair bg-white">
      <table className="w-full min-w-[520px] text-left text-sm">
        <thead><tr className="border-b border-hair text-sm">{head.map((h) => <th key={h} className="px-3 py-2 font-semibold">{t(h)}</th>)}</tr></thead>
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

type Pending = { id: string; role: string; name: string; phone: string | null; approval: string; created_at: string | null; address: string | null }

/** New recycler and repairer accounts wait here until an auditor decides. */
function Approvals() {
  const { t } = useLang()
  const { data, error, loading, reload } = useApi<Pending[]>('/api/auditor/approvals')
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  async function decide(id: string, decision: 'approved' | 'rejected') {
    setErr(null)
    try { await api(`/api/auditor/users/${id}/approval`, { body: { decision } }); setMsg(t(decision === 'approved' ? 'approved_done' : 'rejected_done')); reload() } catch (e) { setErr((e as Error).message) }
  }
  if (error) return <ErrorNote message={error} />
  if (loading || !data) return <Loading />
  return (
    <>
      <H2>{t('aud_approvals')}</H2>
      {msg && <div className="mb-3"><Banner tone="ok" icon="check">{msg}</Banner></div>}
      {err && <ErrorNote message={err} />}
      {data.length === 0
        ? <p className="text-base text-mute">{t('no_approvals')}</p>
        : <Table head={['col_recycler', 'col_role', 'phone_label', 'col_requested', 'actions']} rows={data.map((p) => [
            <span><span className="block font-semibold">{p.name}</span>{p.address && <span className="block text-mute">{p.address}</span>}</span>,
            <Tag>{t('role.' + p.role)}</Tag>,
            <span className="num">{p.phone ?? '-'}</span>,
            <span className="num">{p.created_at ? p.created_at.slice(0, 10) : '-'}</span>,
            p.approval === 'rejected'
              ? <span className="flex items-center gap-2"><Tag tone="bad">{t('approval.rejected')}</Tag><Btn full={false} variant="secondary" onClick={() => decide(p.id, 'approved')}>{t('approve')}</Btn></span>
              : <span className="flex gap-2"><Btn full={false} onClick={() => decide(p.id, 'approved')}>{t('approve')}</Btn><Btn full={false} variant="danger" onClick={() => decide(p.id, 'rejected')}>{t('reject')}</Btn></span>,
          ])} />}
    </>
  )
}

export function Recyclers() {
  const { t } = useLang()
  const { data, error, loading } = useApi<{ id: string; name: string; bids: number; accepted: number }[]>('/api/auditor/recyclers')
  if (error) return <ErrorNote message={error} />
  if (loading || !data) return <Loading />
  return (
    <>
      <Approvals />
      <H2>{t('aud_recyclers')}</H2>
      <Table head={['col_recycler', 'col_bids', 'col_accepted']} rows={data.map((r) => [r.name, <span className="num">{r.bids}</span>, <span className="num">{r.accepted}</span>])} />
    </>
  )
}
