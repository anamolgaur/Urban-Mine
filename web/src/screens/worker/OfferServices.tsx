import { useEffect, useState } from 'react'
import { useLang } from '../../lib/i18n.tsx'
import { useApi } from '../../lib/useApi.ts'
import { api } from '../../lib/api.ts'
import { DEVICE_TYPES } from '../../lib/devices.ts'
import { fileToDataUrl } from '../../lib/image.ts'
import { inr } from '../../lib/format.ts'
import type { Listing } from '../../lib/types.ts'
import { H2, Btn, Field, inputCls, ErrorNote, Tag, Banner } from '../../components/ui.tsx'
import Icon from '../../components/Icon.tsx'

type Job = { id: string; before_photo: string; after_photo: string | null; status: string }
type Mine = { listing: Listing | null; jobs: Job[] }

async function uploadPhoto(f: File): Promise<string> {
  const url = await fileToDataUrl(f)
  return (await api<{ hash: string }>('/api/photos', { body: { dataUrl: url } })).hash
}

export default function OfferServices() {
  const { t } = useLang()
  const mine = useApi<Mine>('/api/repair/mine')
  const [skills, setSkills] = useState<string[]>([])
  const [area, setArea] = useState('')
  const [price, setPrice] = useState('')
  const [hours, setHours] = useState('10:00-19:00')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const l = mine.data?.listing

  useEffect(() => {
    if (l) { setSkills(l.skills); setArea(l.area); setPrice(String(l.start_price)); setHours(l.hours) }
  }, [l])

  async function run(fn: () => Promise<unknown>) {
    setBusy(true); setErr(null)
    try { await fn(); mine.reload() } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }

  return (
    <div className="mt-3">
      <Banner icon="info">{t('offer_intro')}</Banner>
      <H2>{t('your_listing')}</H2>
      <p className="mb-2 text-sm font-semibold">{t('skills')}</p>
      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label={t('skills')}>
        {DEVICE_TYPES.map((s) => {
          const on = skills.includes(s)
          return (
            <button key={s} aria-pressed={on} onClick={() => setSkills(on ? skills.filter((x) => x !== s) : [...skills, s])}
              className={`inline-flex min-h-11 items-center gap-1 border border-ink px-3 text-sm font-semibold ${on ? 'bg-ink text-paper' : 'bg-white'}`}>
              {on && <Icon name="check" size={16} />}{t('type.' + s)}
            </button>
          )
        })}
      </div>
      <Field label={t('area')}><input className={inputCls} value={area} onChange={(e) => setArea(e.target.value)} /></Field>
      <Field label={t('start_price')}><input className={`${inputCls} num`} inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ''))} /></Field>
      <Field label={t('hours')}><input className={inputCls} value={hours} onChange={(e) => setHours(e.target.value)} /></Field>
      {err && <ErrorNote message={err} />}
      <Btn disabled={busy} onClick={() => run(async () => { await api('/api/repair/listings', { body: { skills, area, start_price: Number(price), hours } }); setSaved(true) })} icon="check">{t('list_me')}</Btn>
      {saved && !err && <p className="mt-2 text-sm font-semibold text-ok">✓ {t('listed_ok')}</p>}

      {l && (
        <>
          <H2 right={<Tag tone="ok">✓ {l.verified_count} {t('verified_repairs')}</Tag>}>{t('log_repair')}</H2>
          <p className="mb-3 text-sm text-mute">{t('job_rule')} {inr(l.start_price)}</p>
          <label className="mb-3 flex min-h-12 cursor-pointer items-center justify-center gap-2 border border-ink bg-white font-semibold">
            <input type="file" accept="image/*" capture="environment" className="sr-only" disabled={busy}
              onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void run(async () => api('/api/repair/jobs', { body: { before_photo: await uploadPhoto(f) } })) }} />
            <Icon name="camera" size={20} />{t('new_job_before')}
          </label>
          <ul className="divide-y divide-hair border-y border-hair">
            {mine.data?.jobs.map((j) => (
              <li key={j.id} className="flex min-h-14 items-center justify-between gap-2 py-2">
                <span className="num text-sm">#{j.id.slice(0, 6)}</span>
                {j.status === 'completed' ? <Tag tone="ok">✓ {t('job_completed')}</Tag> : (
                  <label className="inline-flex min-h-11 cursor-pointer items-center gap-1 border border-ink bg-amber px-3 text-sm font-semibold">
                    <input type="file" accept="image/*" capture="environment" className="sr-only" disabled={busy}
                      onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void run(async () => api(`/api/repair/jobs/${j.id}/complete`, { body: { after_photo: await uploadPhoto(f) } })) }} />
                    <Icon name="camera" size={18} />{t('add_after')}
                  </label>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
