import type { ReactNode } from 'react'
import { useLang } from '../../lib/i18n.tsx'
import { useState } from 'react'
import { useApi } from '../../lib/useApi.ts'
import { api } from '../../lib/api.ts'
import { Tag, Loading, ErrorNote, Btn, H2, Banner } from '../../components/ui.tsx'

function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  const { t } = useLang()
  return (
    <div data-tour="people" className="overflow-x-auto rounded-2xl border border-hair bg-white">
      <table className="cards-sm w-full min-w-[520px] text-left text-sm">
        <thead><tr className="border-b border-hair text-sm">{head.map((h) => <th key={h} className="px-3 py-2 font-semibold">{t(h)}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i} className="border-b border-hair">{r.map((c, j) => <td key={j} className="px-3 py-3">{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  )
}

/** Name, with a warning when it contains an offensive word. */
function Who({ name, flagged, sub }: { name: string; flagged?: boolean; sub?: string | null }) {
  const { t } = useLang()
  return <span><span className="block font-semibold">{name}</span>{sub && <span className="block text-mute">{sub}</span>}{flagged && <span className="mt-1 inline-block"><Tag tone="bad">{t('name_flagged')}</Tag></span>}</span>
}

/** Remove a fake or abusive account: its data goes, its phone and email are blocked. Asks first. */
function useRemove(after: () => void) {
  const { t } = useLang()
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  async function remove(id: string, name: string) {
    if (!window.confirm(t('remove_confirm', { name }))) return
    setErr(null); setMsg(null)
    try { await api(`/api/auditor/users/${id}/remove`, { body: { reason: 'Removed by auditor' } }); setMsg(t('removed_done')); after() } catch (e) { setErr((e as Error).message) }
  }
  const notes = <>{msg && <div className="mb-3"><Banner tone="ok" icon="check">{msg}</Banner></div>}{err && <ErrorNote message={err} />}</>
  return { remove, notes }
}

export function Workers() {
  const { t } = useLang()
  const { data, error, loading, reload } = useApi<{ id: string; name: string; phone: string | null; workshop: string | null; lots: number; open_flags: number; name_flagged?: boolean }[]>('/api/auditor/workers')
  const { remove, notes } = useRemove(reload)
  if (error) return <ErrorNote message={error} />
  if (loading || !data) return <Loading />
  return <>{notes}<Table head={['col_worker', 'col_workshop', 'col_lots', 'col_open_flags', 'actions']} rows={data.map((w) => [<Who name={w.name} flagged={w.name_flagged} />, w.workshop ?? '-', <span className="num">{w.lots}</span>, w.open_flags > 0 ? <Tag tone="bad">{w.open_flags}</Tag> : <span className="num">0</span>,
    <Btn full={false} variant={w.name_flagged ? 'danger' : 'secondary'} onClick={() => remove(w.id, w.name)}>{t('remove_account')}</Btn>])} /></>
}

type Pending = { id: string; role: string; name: string; phone: string | null; approval: string; created_at: string | null; address: string | null; name_flagged?: boolean }

/** New recycler and repairer accounts wait here until an auditor decides. */
function Approvals() {
  const { t } = useLang()
  const { data, error, loading, reload } = useApi<Pending[]>('/api/auditor/approvals')
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const { remove, notes } = useRemove(reload)
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
      {notes}
      {data.length === 0
        ? <p className="text-base text-mute">{t('no_approvals')}</p>
        : <Table head={['col_recycler', 'col_role', 'phone_label', 'col_requested', 'actions']} rows={data.map((p) => [
            <Who name={p.name} sub={p.address} flagged={p.name_flagged} />,
            <Tag>{t('role.' + p.role)}</Tag>,
            <span className="num">{p.phone ?? '-'}</span>,
            <span className="num">{p.created_at ? p.created_at.slice(0, 10) : '-'}</span>,
            p.approval === 'rejected'
              ? <span className="flex flex-wrap items-center gap-2"><Tag tone="bad">{t('approval.rejected')}</Tag><Btn full={false} variant="secondary" onClick={() => decide(p.id, 'approved')}>{t('approve')}</Btn><Btn full={false} variant="danger" onClick={() => remove(p.id, p.name)}>{t('remove_account')}</Btn></span>
              : <span className="flex flex-wrap gap-2">{!p.name_flagged && <Btn full={false} onClick={() => decide(p.id, 'approved')}>{t('approve')}</Btn>}<Btn full={false} variant="secondary" onClick={() => decide(p.id, 'rejected')}>{t('reject')}</Btn><Btn full={false} variant="danger" onClick={() => remove(p.id, p.name)}>{t('remove_account')}</Btn></span>,
          ])} />}
    </>
  )
}

export function Recyclers() {
  const { t } = useLang()
  const { data, error, loading, reload } = useApi<{ id: string; name: string; bids: number; accepted: number; name_flagged?: boolean }[]>('/api/auditor/recyclers')
  const { remove, notes } = useRemove(reload)
  if (error) return <ErrorNote message={error} />
  if (loading || !data) return <Loading />
  return (
    <>
      <Approvals />
      <H2>{t('aud_recyclers')}</H2>
      {notes}
      <Table head={['col_recycler', 'col_bids', 'col_accepted', 'actions']} rows={data.map((r) => [<Who name={r.name} flagged={r.name_flagged} />, <span className="num">{r.bids}</span>, <span className="num">{r.accepted}</span>,
        <Btn full={false} variant={r.name_flagged ? 'danger' : 'secondary'} onClick={() => remove(r.id, r.name)}>{t('remove_account')}</Btn>])} />
    </>
  )
}
