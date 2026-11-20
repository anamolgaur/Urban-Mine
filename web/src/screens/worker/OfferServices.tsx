import { useEffect, useState } from 'react'
import { useLang } from '../../lib/i18n.tsx'
import { useApi } from '../../lib/useApi.ts'
import { api } from '../../lib/api.ts'
import { DEVICE_TYPES } from '../../lib/devices.ts'
import type { Listing } from '../../lib/types.ts'
import { H2, Btn, Field, inputCls, ErrorNote, Banner } from '../../components/ui.tsx'
import { Skeleton } from '../../components/kit.tsx'
import Icon from '../../components/Icon.tsx'

/** Create or update the repairer's public listing: skills, area, starting price and hours. */
export default function OfferServices() {
  const { t } = useLang()
  const mine = useApi<{ listing: Listing | null }>('/api/repair/mine')
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

  async function save() {
    setBusy(true); setErr(null); setSaved(false)
    try { await api('/api/repair/listings', { body: { skills, area, start_price: Number(price), hours } }); setSaved(true); mine.reload() }
    catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }

  if (mine.loading) return <Skeleton rows={4} />
  return (
    <div>
      <Banner icon="info">{t('offer_intro')}</Banner>
      <H2>{t('your_listing')}</H2>
      <p className="mb-2 text-base font-semibold">{t('skills')}</p>
      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label={t('skills')}>
        {DEVICE_TYPES.map((s) => {
          const on = skills.includes(s)
          return (
            <button key={s} aria-pressed={on} onClick={() => setSkills(on ? skills.filter((x) => x !== s) : [...skills, s])}
              className={`inline-flex min-h-11 items-center gap-1 border border-ink px-3 text-base font-semibold ${on ? 'bg-ink text-paper' : 'bg-white'}`}>
              {on && <Icon name="check" size={16} />}{t('type.' + s)}
            </button>
          )
        })}
      </div>
      <Field label={t('area')}><input className={inputCls} value={area} onChange={(e) => setArea(e.target.value)} /></Field>
      <Field label={t('start_price')}><input className={`${inputCls} num`} inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ''))} /></Field>
      <Field label={t('hours')}><input className={inputCls} value={hours} onChange={(e) => setHours(e.target.value)} /></Field>
      {err && <ErrorNote message={err} />}
      <Btn disabled={busy} onClick={save} icon="check">{t('list_me')}</Btn>
      {saved && !err && <p className="mt-2 text-base font-semibold text-ok">✓ {t('listed_ok')}</p>}
    </div>
  )
}
