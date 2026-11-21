import { useState, type FormEvent } from 'react'
import { useLang } from '../../lib/i18n.tsx'
import { supabase } from '../../lib/supabase.ts'
import { Header, Btn, Banner, inputCls } from '../../components/ui.tsx'
import Icon from '../../components/Icon.tsx'

const PHONE = /^[6-9]\d{9}$/
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MIN_PASSWORD = 6

/** Map a Supabase Auth failure to one of our own messages. */
function reason(e: { status?: number; message?: string; name?: string }): string {
  const msg = (e.message ?? '').toLowerCase()
  if (e.status === 429 || msg.includes('rate limit') || msg.includes('too many')) return 'err_too_many'
  if (e.name === 'AuthRetryableFetchError' || msg.includes('failed to fetch') || msg.includes('network')) return 'auth_down'
  if (msg.includes('already') || msg.includes('registered') || msg.includes('exists')) return 'err_exists'
  if (msg.includes('password') && (msg.includes('least') || msg.includes('weak') || msg.includes('short'))) return 'err_password'
  return 'err_login'
}

/**
 * Sign in or create an account with a mobile number OR an email, plus a password. No code is sent by SMS or email,
 * so it costs nothing to run (Supabase: phone and email confirmations switched off). Signing in once keeps the phone signed in.
 */
export default function Login() {
  const { t } = useLang()
  const [method, setMethod] = useState<'phone' | 'email'>('phone')
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [digits, setDigits] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (busy || !supabase) return
    if (method === 'phone' && !PHONE.test(digits)) { setErr('err_phone'); return }
    if (method === 'email' && !EMAIL.test(email.trim())) { setErr('err_email'); return }
    if (password.length < MIN_PASSWORD) { setErr('err_password'); return }
    setBusy(true); setErr(null)
    const who = method === 'phone' ? { phone: '+91' + digits } : { email: email.trim().toLowerCase() }
    const { data, error } = mode === 'signin'
      ? await supabase.auth.signInWithPassword({ ...who, password })
      : await supabase.auth.signUp({ ...who, password })
    setBusy(false)
    if (error) { setErr(reason(error)); return }
    // A new account while confirmations are still switched on in Supabase gets no session: say so plainly.
    if (mode === 'signup' && !data.session) setErr('err_confirm_on')
    // on success the session provider notices the new session and moves on
  }

  const tab = (m: 'phone' | 'email', icon: string) => (
    <button type="button" role="tab" aria-selected={method === m} onClick={() => { setMethod(m); setErr(null) }}
      className={`flex min-h-12 items-center justify-center gap-2 rounded-xl text-base font-semibold ${method === m ? 'bg-white text-brand shadow-card' : 'text-mute'}`}>
      <Icon name={icon} size={20} />{t(m === 'phone' ? 'use_phone' : 'use_email')}
    </button>
  )

  return (
    <div className="mx-auto max-w-[480px] pb-8">
      <Header title={t(mode === 'signin' ? 'login_title' : 'signup_title')} back={false} brand />
      <main id="main" className="screen-enter px-4 pt-4">
        <p className="mb-5 text-lg leading-snug">{t(mode === 'signin' ? 'login_sub_pw' : 'signup_sub')}</p>

        <div role="tablist" aria-label={t('login_method')} className="mb-5 grid grid-cols-2 gap-1 rounded-2xl bg-sunk p-1">
          {tab('phone', 'phone')}
          {tab('email', 'info')}
        </div>

        <form onSubmit={submit} noValidate className="space-y-4">
          {method === 'phone' ? (
            <label className="block">
              <span className="mb-1 block text-base font-semibold">{t('mobile_label')}</span>
              <span className="flex gap-2">
                <span className="inline-flex min-h-14 items-center rounded-2xl border border-hair bg-sunk px-4 text-lg font-semibold" aria-hidden>+91</span>
                <input className={inputCls} type="tel" inputMode="numeric" autoComplete="tel-national" maxLength={10}
                  value={digits} onChange={(e) => { setDigits(e.target.value.replace(/\D/g, '')); setErr(null) }} aria-invalid={err === 'err_phone'} />
              </span>
            </label>
          ) : (
            <label className="block">
              <span className="mb-1 block text-base font-semibold">{t('email_label')}</span>
              <input className={inputCls} type="email" inputMode="email" autoComplete="email"
                value={email} onChange={(e) => { setEmail(e.target.value); setErr(null) }} aria-invalid={err === 'err_email'} />
            </label>
          )}

          <label className="block">
            <span className="mb-1 block text-base font-semibold">{t('password_label')}</span>
            <span className="relative block">
              <input className={`${inputCls} pr-24`} type={show ? 'text' : 'password'} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                value={password} onChange={(e) => { setPassword(e.target.value); setErr(null) }} aria-invalid={err === 'err_password'} />
              <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 min-h-11 -translate-y-1/2 rounded-xl px-3 text-base font-semibold text-brand">
                {t(show ? 'hide' : 'show')}
              </button>
            </span>
            {mode === 'signup' && <span className="mt-1 block text-sm text-mute">{t('password_hint', { n: MIN_PASSWORD })}</span>}
          </label>

          {err && <Banner tone="bad" icon="alert">{t(err)}</Banner>}

          <Btn type="submit" disabled={busy} icon={mode === 'signin' ? 'check' : 'profile'}>
            {busy ? t('please_wait') : t(mode === 'signin' ? 'sign_in' : 'create_account')}
          </Btn>
        </form>

        <div className="mt-4 rounded-2xl bg-white p-4 text-center shadow-card">
          <p className="text-base text-mute">{t(mode === 'signin' ? 'no_account' : 'have_account')}</p>
          <Btn variant="ghost" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setErr(null) }}>
            {t(mode === 'signin' ? 'create_account' : 'sign_in')}
          </Btn>
        </div>

        <p className="mt-5 flex gap-2 text-sm leading-snug text-mute"><Icon name="lock" size={18} className="mt-0.5 shrink-0" />{t('login_privacy')}</p>
        <p className="mt-2 flex gap-2 text-sm leading-snug text-mute"><Icon name="info" size={18} className="mt-0.5 shrink-0" />{t('stay_signed_in')}</p>
      </main>
    </div>
  )
}
