import { useEffect, useState, type FormEvent } from 'react'
import { useLang } from '../../lib/i18n.tsx'
import { supabase } from '../../lib/supabase.ts'
import { Header, Btn, Banner, inputCls } from '../../components/ui.tsx'
import Icon from '../../components/Icon.tsx'

const PHONE = /^[6-9]\d{9}$/
const RESEND_SECONDS = 30

/** Map a Supabase Auth failure to one of our own messages. */
function reason(e: { status?: number; message?: string; name?: string }, verifying: boolean): string {
  const msg = (e.message ?? '').toLowerCase()
  if (e.status === 429 || msg.includes('rate limit') || msg.includes('too many')) return 'err_sms_limit'
  if (e.name === 'AuthRetryableFetchError' || msg.includes('failed to fetch') || msg.includes('network')) return 'auth_down'
  return verifying ? 'err_otp_wrong' : 'err_sms_fail'
}

/** Phone number, then the 6-digit SMS code. Signing in once keeps this phone signed in. */
export default function Login() {
  const { t } = useLang()
  const [step, setStep] = useState<'phone' | 'code'>('phone')
  const [digits, setDigits] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [wait, setWait] = useState(0)

  useEffect(() => {
    if (wait <= 0) return
    const id = setTimeout(() => setWait((w) => w - 1), 1000)
    return () => clearTimeout(id)
  }, [wait])

  async function send() {
    if (!PHONE.test(digits)) { setErr('err_phone'); return }
    if (!supabase) return
    setBusy(true); setErr(null)
    const { error } = await supabase.auth.signInWithOtp({ phone: '+91' + digits })
    setBusy(false)
    if (error) { setErr(reason(error, false)); return }
    setStep('code'); setCode(''); setWait(RESEND_SECONDS)
  }

  async function verify() {
    if (!/^\d{6}$/.test(code)) { setErr('err_otp'); return }
    if (!supabase) return
    setBusy(true); setErr(null)
    const { error } = await supabase.auth.verifyOtp({ phone: '+91' + digits, token: code, type: 'sms' })
    setBusy(false)
    if (error) setErr(reason(error, true))
    // on success the session provider notices the new session and moves on
  }

  const submit = (fn: () => void) => (e: FormEvent) => { e.preventDefault(); if (!busy) fn() }

  return (
    <div className="mx-auto max-w-[480px] pb-8">
      <Header title={t(step === 'phone' ? 'login_title' : 'otp_title')} back={false} brand />
      <main id="main" className="screen-enter px-4 pt-6">
        {step === 'phone' ? (
          <form onSubmit={submit(send)} noValidate>
            <p className="mb-5 text-base leading-snug">{t('login_sub')}</p>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold">{t('mobile_label')}</span>
              <span className="flex">
                <span className="inline-flex min-h-12 items-center border border-r-0 border-ink bg-sunk px-3 font-mono text-base font-semibold" aria-hidden>+91</span>
                <input className={inputCls} type="tel" inputMode="numeric" autoComplete="tel-national" maxLength={10} autoFocus
                  value={digits} onChange={(e) => { setDigits(e.target.value.replace(/\D/g, '')); setErr(null) }} aria-describedby="mobile-hint" aria-invalid={err === 'err_phone'} />
              </span>
              <span id="mobile-hint" className="mt-1 block text-sm text-mute">{t('mobile_hint')}</span>
            </label>
            {err && <div className="mt-4"><Banner tone="bad" icon="alert">{t(err)}</Banner></div>}
            <div className="mt-5"><Btn type="submit" disabled={busy} icon="phone">{busy ? t('sending') : t('send_code')}</Btn></div>
            <p className="mt-5 flex gap-2 text-sm leading-snug text-mute"><Icon name="lock" size={18} className="mt-0.5 shrink-0" />{t('login_privacy')}</p>
            <p className="mt-2 flex gap-2 text-sm leading-snug text-mute"><Icon name="info" size={18} className="mt-0.5 shrink-0" />{t('stay_signed_in')}</p>
          </form>
        ) : (
          <form onSubmit={submit(verify)} noValidate>
            <p className="mb-5 text-base leading-snug">{t('otp_sent_to', { phone: '+91 ' + digits })}</p>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold">{t('otp_label')}</span>
              <input className={`${inputCls} text-center font-mono text-2xl tracking-[0.5em]`} type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} autoFocus
                value={code} onChange={(e) => { setCode(e.target.value.replace(/\D/g, '')); setErr(null) }} aria-invalid={!!err} />
            </label>
            {err && <div className="mt-4"><Banner tone="bad" icon="alert">{t(err)}</Banner></div>}
            <div className="mt-5"><Btn type="submit" disabled={busy} icon="check">{busy ? t('verifying') : t('verify_code')}</Btn></div>
            <div className="mt-3 grid grid-cols-1 gap-2">
              <Btn type="button" variant="secondary" disabled={busy || wait > 0} onClick={send}>{wait > 0 ? t('resend_in', { s: wait }) : t('resend')}</Btn>
              <Btn type="button" variant="ghost" onClick={() => { setStep('phone'); setErr(null) }}>{t('change_number')}</Btn>
            </div>
          </form>
        )}
      </main>
    </div>
  )
}
