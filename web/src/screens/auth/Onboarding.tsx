import { useEffect, useState } from 'react'
import { useLang } from '../../lib/i18n.tsx'
import { useSession } from '../../lib/session.tsx'
import { api } from '../../lib/api.ts'
import { Header, Btn, Banner, inputCls } from '../../components/ui.tsx'
import { Rail } from '../../components/kit.tsx'
import Icon from '../../components/Icon.tsx'

type Role = 'worker' | 'recycler' | 'repairer'
const ROLES: { id: Role; icon: string }[] = [
  { id: 'worker', icon: 'lots' },
  { id: 'recycler', icon: 'box' },
  { id: 'repairer', icon: 'repair' },
]

/** First-time account setup, after the phone number is verified: role (once, final), details, consent. */
export default function Onboarding() {
  const { t, lang } = useLang()
  const { phone, reload, signOut } = useSession()
  const [step, setStep] = useState(0)
  const [role, setRole] = useState<Role | null>(null)
  const [name, setName] = useState('')
  const [shop, setShop] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null)
  const [consent, setConsent] = useState(false)
  const [cities, setCities] = useState<string[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const needsPlace = role !== 'recycler'

  useEffect(() => { api<string[]>('/api/cities').then(setCities).catch(() => {}) }, [])

  function details(): string | null {
    const n = name.trim()
    if (n.length < 2 || n.length > 60) return 'ob_name_err'
    if (needsPlace && address.trim().length < 3) return 'ob_addr_err'
    if (needsPlace && !cities.includes(city)) return 'ob_city_err'
    return null
  }

  function next() {
    if (step === 0 && !role) return
    if (step === 1) { const e = details(); if (e) { setErr(e); return } }
    setErr(null); setStep(step + 1)
  }

  function locate() {
    navigator.geolocation?.getCurrentPosition((p) => setPos({ lat: p.coords.latitude, lng: p.coords.longitude }), () => {}, { enableHighAccuracy: true, timeout: 10000 })
  }

  async function finish() {
    if (!consent) { setErr('ob_consent_err'); return }
    setBusy(true); setErr(null)
    try {
      await api('/api/onboarding', { body: { role, name: name.trim(), language: lang, consent: true, ...(needsPlace ? { address: address.trim(), city, workshop_name: shop.trim(), lat: pos?.lat, lng: pos?.lng } : {}) } })
      reload()
    } catch (e) { const c = (e as { code?: string }).code; setErr(c === 'offensive_name' ? 'err_offensive_name' : c === 'banned' ? 'err_banned' : (e as Error).message); setBusy(false) }
  }

  return (
    <div className="mx-auto max-w-[480px] pb-10">
      <Header title={t('ob_title')} back={false} brand />
      <main id="main" className="screen-enter px-4 pt-4">
        <Rail items={['col_role', 'ob_you', 'rail_confirm'].map((k, i) => ({ label: t(k), state: i < step ? 'done' : i === step ? 'now' : 'todo' }))} />
        <p className="mt-2 text-sm text-mute">{t('step_of', { n: step + 1, m: 3 })}{phone ? `, ${phone}` : ''}</p>

        {step === 0 && (
          <>
            <h2 className="mb-3 mt-4 text-2xl font-bold">{t('ob_role_q')}</h2>
            <div role="radiogroup" aria-label={t('ob_role_q')} className="grid gap-2">
              {ROLES.map((r) => (
                <button key={r.id} role="radio" aria-checked={role === r.id} onClick={() => setRole(r.id)}
                  className={`flex min-h-20 items-start gap-3 border-2 p-3 text-left ${role === r.id ? 'border-brand bg-brand text-onbrand' : 'border-hair bg-white'}`}>
                  <Icon name={r.icon} size={28} className="mt-0.5 shrink-0" />
                  <span>
                    <span className="block text-lg font-bold">{role === r.id && '✓ '}{t('role.' + r.id)}</span>
                    <span className="block text-base leading-snug">{t(`ob_role_${r.id}_d`)}</span>
                  </span>
                </button>
              ))}
            </div>
            <p className="mt-3 flex gap-2 text-sm text-mute"><Icon name="info" size={18} className="mt-0.5 shrink-0" />{t('ob_role_note')}</p>
          </>
        )}

        {step === 1 && (
          <>
            <h2 className="mb-3 mt-4 text-2xl font-bold">{t('ob_you')}</h2>
            <label className="mb-4 block">
              <span className="mb-1 block text-sm font-semibold">{t(role === 'recycler' ? 'ob_company' : 'ob_name')}</span>
              <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={60} autoFocus />
            </label>
            {needsPlace && (
              <>
                <label className="mb-4 block">
                  <span className="mb-1 block text-sm font-semibold">{t('ob_workshop')}</span>
                  <input className={inputCls} value={shop} onChange={(e) => setShop(e.target.value)} maxLength={80} />
                </label>
                <label className="mb-4 block">
                  <span className="mb-1 block text-sm font-semibold">{t('ob_address')}</span>
                  <input className={inputCls} value={address} onChange={(e) => setAddress(e.target.value)} autoComplete="street-address" maxLength={200} />
                </label>
                <label className="mb-4 block">
                  <span className="mb-1 block text-sm font-semibold">{t('ob_city')}</span>
                  <select className={inputCls} value={city} onChange={(e) => setCity(e.target.value)}>
                    <option value="">{t('ob_choose_city')}</option>
                    {cities.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </label>
                <Btn variant="secondary" icon={pos ? 'check' : 'pin'} onClick={locate}>{pos ? t('location_added') : t('ob_use_location')}</Btn>
                <p className="mt-2 text-sm text-mute">{t('gps_why')}</p>
              </>
            )}
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="mb-3 mt-4 text-2xl font-bold">{t('ob_finish')}</h2>
            <dl className="divide-y divide-hair border-y border-hair text-base">
              <div className="flex justify-between gap-3 py-2"><dt className="text-mute">{t('col_role')}</dt><dd className="font-semibold">{role && t('role.' + role)}</dd></div>
              <div className="flex justify-between gap-3 py-2"><dt className="text-mute">{t(role === 'recycler' ? 'ob_company' : 'ob_name')}</dt><dd className="font-semibold">{name.trim()}</dd></div>
              <div className="flex justify-between gap-3 py-2"><dt className="text-mute">{t('mobile_label')}</dt><dd className="num font-semibold">{phone ?? '–'}</dd></div>
              {needsPlace && <div className="flex justify-between gap-3 py-2"><dt className="text-mute">{t('ob_address')}</dt><dd className="text-right font-semibold">{address.trim()}, {city}</dd></div>}
            </dl>
            {role !== 'worker' && <div className="mt-4"><Banner tone="amber" icon="clock">{t('pend_body')}</Banner></div>}
            <p className="mt-4 flex gap-2 text-sm text-mute"><Icon name="info" size={18} className="mt-0.5 shrink-0" />{t('ob_kyc')}</p>
            <label className="mt-4 flex min-h-12 items-start gap-3 rounded-2xl border border-hair bg-white p-3">
              <input type="checkbox" className="mt-1 h-6 w-6 shrink-0 accent-black" checked={consent} onChange={(e) => { setConsent(e.target.checked); setErr(null) }} />
              <span className="text-base leading-snug">{t('ob_consent')}</span>
            </label>
            {/* new tab: going to the page in this tab would lose what the person has typed so far */}
          </>
        )}

        {err && <div className="mt-4"><Banner tone="bad" icon="alert">{err.startsWith('ob_') ? t(err) : err}</Banner></div>}

        <div className="mt-6 grid grid-cols-2 gap-2">
          {step > 0 ? <Btn variant="secondary" disabled={busy} onClick={() => { setErr(null); setStep(step - 1) }}>{t('back')}</Btn> : <Btn variant="secondary" onClick={signOut}>{t('sign_out')}</Btn>}
          {step < 2
            ? <Btn disabled={step === 0 && !role} onClick={next}>{t('continue')}</Btn>
            : <Btn disabled={busy} onClick={finish}>{busy ? t('ob_creating') : t('ob_finish')}</Btn>}
        </div>
      </main>
    </div>
  )
}
