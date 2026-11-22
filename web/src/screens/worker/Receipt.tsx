import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLang } from '../../lib/i18n.tsx'
import { useApi } from '../../lib/useApi.ts'
import { api, apiUrl, authHeaders } from '../../lib/api.ts'
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
  const { data: l, error, loading } = useApi<Lot & { sale?: { amount: number; buyer: string } | null; rating?: { stars: number; note: string | null } | null }>(`/api/lots/${id}`)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const [stars, setStars] = useState(0)
  const [note, setNote] = useState('')
  const [rated, setRated] = useState(false)
  useEffect(() => { if (l?.rating) { setStars(l.rating.stars); setNote(l.rating.note ?? ''); setRated(true) } }, [l?.rating])

  const fileName = l ? `urban-mine-receipt-${l.short_hash}.pdf` : ''
  async function pdfBlob() {
    const res = await fetch(apiUrl(`/api/lots/${l!.id}/receipt.pdf`), { headers: await authHeaders() })
    if (!res.ok) throw new Error(`Request failed (${res.status})`)
    return res.blob()
  }
  async function download() {
    if (!l) return
    setBusy(true); setErr(null)
    try {
      const url = URL.createObjectURL(await pdfBlob())
      const a = document.createElement('a')
      a.href = url; a.download = fileName; a.click()
      setTimeout(() => URL.revokeObjectURL(url), 10000)
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }
  // Share the PDF itself where the phone allows it (Android Chrome does); otherwise open WhatsApp with a text summary.
  async function share() {
    if (!l) return
    const text = t('share_text', { no: 'UM-' + l.hash.slice(0, 8).toUpperCase(), items: lotTitle(l, t), amount: l.sale ? inr(l.sale.amount) : '-', buyer: l.sale?.buyer ?? '-' })
    setBusy(true); setErr(null)
    try {
      const file = new File([await pdfBlob()], fileName, { type: 'application/pdf' })
      if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], text }); return }
    } catch (e) { if ((e as Error).name === 'AbortError') return } finally { setBusy(false) }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener')
  }
  async function saveRating(n: number) {
    if (!l) return
    setStars(n); setErr(null)
    try { await api(`/api/lots/${l.id}/rating`, { body: { stars: n, note } }); setRated(true) } catch (e) { setErr((e as Error).message) }
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
          <div className="mt-3 rounded-3xl bg-white shadow-card p-4">
            <dl className="divide-y divide-hair text-sm">
              {rows.map(([k, v]) => <div key={k} className="flex justify-between gap-3 py-2"><dt className="shrink-0 text-mute">{k}</dt><dd className="text-right font-semibold">{v}</dd></div>)}
            </dl>
            <p className="num mt-3 border-t border-hair pt-3 text-3xl font-semibold">{l.sale ? inr(l.sale.amount) : '-'}</p>
            <p className="mt-1"><Tag tone="bad">{t('simulated')}</Tag></p>
          </div>
          <H2>{t('record_hash')}</H2>
          <p className="num break-all text-sm">{l.hash}</p>
          <p className="mt-2 text-sm text-mute">{t('hash_note')}</p>
          <H2>{t('rate_buyer', { name: l.sale?.buyer ?? '' })}</H2>
          <div className="flex gap-1" role="radiogroup" aria-label={t('rate_buyer', { name: l.sale?.buyer ?? '' })}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" role="radio" aria-checked={stars === n} aria-label={t('n_stars', { n })} onClick={() => saveRating(n)}
                className={`flex h-12 w-12 items-center justify-center rounded-xl text-3xl ${n <= stars ? 'text-amber' : 'text-hair'}`}>★</button>
            ))}
          </div>
          {stars > 0 && (
            <div className="mt-2 flex gap-2">
              <input value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder={t('rating_note_ph')}
                className="min-h-11 flex-1 rounded-xl border border-hair bg-white px-3 text-base" />
              <Btn full={false} variant="secondary" onClick={() => saveRating(stars)}>{t('save')}</Btn>
            </div>
          )}
          {rated && <p className="mt-1 text-sm text-mute">{t('rating_saved')}</p>}
          {err && <ErrorNote message={err} />}
          <div className="mt-5 space-y-2">
            <Btn onClick={share} disabled={busy} icon="share">{t('share_whatsapp')}</Btn>
            <Btn variant="secondary" onClick={download} disabled={busy} icon="download">{busy ? t('saving') : t('download_pdf')}</Btn>
            <Btn variant="secondary" onClick={() => nav('/')}>{t('go_home')}</Btn>
          </div>
        </>
      )}
    </Screen>
  )
}
