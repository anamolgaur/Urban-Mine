import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLang } from '../../lib/i18n.tsx'
import { useApi } from '../../lib/useApi.ts'
import { fetchBlobUrl } from '../../lib/api.ts'
import { inr, kg, dateShort } from '../../lib/format.ts'
import { useSession } from '../../lib/session.tsx'
import type { Lot } from '../../lib/types.ts'
import { Screen, H2, Btn, Banner, Tag, Loading, ErrorNote } from '../../components/ui.tsx'
import { lotTitle } from './Lots.tsx'

export default function Receipt() {
  const { id } = useParams()
  const { t } = useLang()
  const nav = useNavigate()
  const { me } = useSession()
  const { data: l, error, loading } = useApi<Lot & { sale?: { amount: number; buyer: string } | null }>(`/api/lots/${id}`)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function download() {
    if (!l) return
    setBusy(true); setErr(null)
    try {
      const url = await fetchBlobUrl(`/api/lots/${l.id}/receipt.pdf`)
      const a = document.createElement('a')
      a.href = url; a.download = `urban-mine-receipt-${l.short_hash}.pdf`; a.click()
      setTimeout(() => URL.revokeObjectURL(url), 10000)
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }

  const rows: [string, string][] = l ? [
    [t('receipt_no'), 'UM-' + l.hash.slice(0, 8).toUpperCase()],
    [t('date'), dateShort(l.created_at)],
    [t('seller'), me?.user.name ?? l.worker_name],
    [t('address'), me?.workshop?.address ?? '-'],
    [t('buyer'), l.sale?.buyer ?? '-'],
    [t('items'), lotTitle(l, t)],
    [t('weight'), kg(l.weight_kg)],
  ] : []

  return (
    <Screen title={t('receipt_title')} back="/lots">
      {error && <ErrorNote message={error} />}
      {loading && <Loading />}
      {l && l.status !== 'sold' && <Banner icon="info">{t('receipt_only_sold')}</Banner>}
      {l && l.status === 'sold' && (
        <>
          <Banner tone="bad" icon="alert">{t('receipt_proto')}</Banner>
          <div className="mt-3 border-2 border-ink bg-white p-4">
            <dl className="divide-y divide-hair text-sm">
              {rows.map(([k, v]) => <div key={k} className="flex justify-between gap-3 py-2"><dt className="shrink-0 text-mute">{k}</dt><dd className="text-right font-semibold">{v}</dd></div>)}
            </dl>
            <p className="num mt-3 border-t border-ink pt-3 text-3xl font-semibold">{l.sale ? inr(l.sale.amount) : '-'}</p>
            <p className="mt-1"><Tag tone="bad">{t('simulated')}</Tag></p>
          </div>
          <H2>{t('record_hash')}</H2>
          <p className="num break-all text-[12px]">{l.hash}</p>
          <p className="mt-2 text-sm text-mute">{t('hash_note')}</p>
          {err && <ErrorNote message={err} />}
          <div className="mt-5 space-y-2">
            <Btn onClick={download} disabled={busy} icon="download">{busy ? t('saving') : t('download_pdf')}</Btn>
            <Btn variant="secondary" onClick={() => nav('/')}>{t('go_home')}</Btn>
          </div>
        </>
      )}
    </Screen>
  )
}
