import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLang, LANGS } from '../../lib/i18n.tsx'
import { useSession } from '../../lib/session.tsx'
import { useApi } from '../../lib/useApi.ts'
import { api } from '../../lib/api.ts'
import { useFlow } from '../../lib/flow.tsx'
import { applyTextSize, getTextSize, type TextSize } from '../../lib/prefs.ts'
import { applyTheme, getTheme, setSetupStage, type Theme } from '../../lib/theme.ts'
import type { Role } from '../../lib/types.ts'
import { Screen, H2, Btn, Banner, Tag, ErrorNote } from '../../components/ui.tsx'
import { KV } from '../../components/kit.tsx'
import Icon from '../../components/Icon.tsx'
import { authEnabled } from '../../lib/supabase.ts'

export const homeFor = (role: Role) => ({ worker: '/', repairer: '/repair', recycler: '/recycler', auditor: '/auditor' }[role])

/** Shows whether device photos may be sent to an AI service for the condition check, and lets the worker withdraw that. */
function VisionConsent() {
  const { t } = useLang()
  const v = useApi<{ enabled: boolean; consent: boolean }>('/api/vision')
  const [done, setDone] = useState(false)
  if (!v.data?.enabled && !v.data?.consent) return null
  const on = v.data?.consent && !done
  return (
    <div className="mt-4">
      <p className="text-sm font-medium text-mute">{t('pc_section')}</p>
      <p className="mt-1 text-base leading-snug">{t(on ? 'pc_profile_on' : 'pc_profile_off')}</p>
      {on && <div className="mt-2"><Btn variant="secondary" onClick={async () => { await api('/api/vision/consent', { body: { accepted: false } }).catch(() => {}); setDone(true) }}>{t('pc_withdraw')}</Btn></div>}
      {done && <p className="mt-2 text-sm text-ok" role="status">{t('pc_withdrawn')}</p>}
    </div>
  )
}

export default function Profile() {
  const { t, lang, setLang } = useLang()
  const { me, loginAs, reload, signOut } = useSession()
  const { reset } = useFlow()
  const nav = useNavigate()
  const users = useApi<{ id: string; role: Role; name: string }[]>('/api/users')
  const [confirm, setConfirm] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [size, setSize] = useState<TextSize>(getTextSize)
  const [theme, setThemeState] = useState<Theme>(getTheme)

  async function wipe() {
    try { await api('/api/me/data', { method: 'DELETE' }); reset(); setDone(true); setConfirm(false); if (authEnabled) await signOut(); else reload() } catch (e) { setErr((e as Error).message) }
  }
  if (!me) return null
  const phone = me.user.phone ? 'xxxxxx' + me.user.phone.slice(-4) : '–'

  return (
    <Screen title={t('profile_title')} back={false}>
      <div className="flex items-center gap-3 rounded-3xl bg-white shadow-card p-3">
        <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center bg-ink text-3xl font-bold text-paper" aria-hidden>{me.user.name.replace('SAMPLE ', '').charAt(0)}</span>
        <div className="min-w-0">
          <p className="truncate text-lg font-bold leading-tight">{me.user.name}</p>
          <p className="mt-1 flex flex-wrap gap-1"><Tag>{t('role.' + me.user.role)}</Tag><Tag tone="amber">{t('sample')}</Tag></p>
        </div>
      </div>
      <dl className="divide-y divide-hair border-b border-hair">
        <KV k={t('phone_label')} v={phone} mono />
        {me.workshop && <KV k={t('workshop_label')} v={me.workshop.name.replace('SAMPLE ', '')} />}
        {me.workshop && <KV k={t('address')} v={me.workshop.address.replace('SAMPLE: ', '')} />}
        <KV k={t('identity')} v={<Tag tone="bad">{t('simulated')}</Tag>} />
        {me.user.role !== 'worker' && me.user.role !== 'auditor' && <KV k={t('approval_status')} v={<Tag tone={me.user.approval === 'approved' ? 'ok' : 'amber'}>{t('approval.' + me.user.approval)}</Tag>} />}
      </dl>

      <H2>{t('language')}</H2>
      <div className="grid grid-cols-2" role="radiogroup" aria-label={t('language')}>
        {LANGS.map(({ code: k, label }) => (
          <button key={k} role="radio" aria-checked={lang === k} onClick={() => setLang(k)}
            className={`min-h-12 border border-hair text-base font-semibold ${lang === k ? 'bg-brand text-onbrand' : 'bg-white'}`}>{lang === k && '✓ '}{label}</button>
        ))}
      </div>

      <H2>{t('help_access')}</H2>
      <p className="mb-2 text-base font-semibold">{t('theme_label')}</p>
      <div className="mb-5 grid grid-cols-2 gap-2" role="radiogroup" aria-label={t('theme_label')}>
        {(['dark', 'light'] as const).map((th) => (
          <button key={th} role="radio" aria-checked={theme === th} onClick={() => { setThemeState(th); applyTheme(th) }}
            className={`min-h-12 rounded-2xl border px-3 text-base font-semibold ${theme === th ? 'border-brand bg-brand text-onbrand' : 'border-hair bg-white'}`}>{t(th === 'dark' ? 'theme_dark' : 'theme_light')}</button>
        ))}
      </div>
      <button onClick={() => { setSetupStage('tour'); window.location.assign('/') }} className="mb-5 min-h-12 w-full rounded-2xl border border-hair bg-white px-3 text-base font-semibold">{t('tour_replay')}</button>
      <p className="mb-2 text-base font-semibold">{t('text_size')}</p>
      <div className="grid grid-cols-3" role="radiogroup" aria-label={t('text_size')}>
        {([['normal', 'A', 'text-base'], ['large', 'A', 'text-xl'], ['xlarge', 'A', 'text-2xl']] as const).map(([k, ch, cls]) => (
          <button key={k} role="radio" aria-checked={size === k} aria-label={t('text_' + k)} onClick={() => { setSize(k); applyTextSize(k) }}
            className={`flex min-h-12 items-center justify-center gap-1 border border-hair font-bold ${cls} ${size === k ? 'bg-brand text-onbrand' : 'bg-white'}`}>{ch}{size === k && <Icon name="check" size={16} />}</button>
        ))}
      </div>
      <ul className="mt-3 space-y-2 text-base leading-snug">
        {['help_1', 'help_2', 'help_3'].map((k) => <li key={k} className="flex gap-2"><Icon name="info" size={20} className="mt-0.5 shrink-0" />{t(k)}</li>)}
      </ul>
      <div className="mt-3 flex items-center gap-2 border-2 border-bad bg-bad px-3 py-2 text-base font-semibold text-onbrand"><Icon name="alert" size={20} />{t('help_emergency')}</div>

      <H2>{t('privacy')}</H2>
      <p className="text-base leading-snug">{t('privacy_note')}</p>
      {me.user.role === 'worker' && <VisionConsent />}
      {done && <div className="mt-3"><Banner tone="ok" icon="check">{t('deleted_ok')}</Banner></div>}
      {err && <ErrorNote message={err} />}
      {!confirm ? (
        <div className="mt-3"><Btn variant="danger" icon="trash" onClick={() => setConfirm(true)}>{t('delete_data')}</Btn></div>
      ) : (
        <div className="mt-3 border-2 border-bad bg-white p-3">
          <p className="mb-2 text-base font-bold text-bad">{t('delete_confirm')}</p>
          <div className="grid grid-cols-2 gap-2">
            <Btn variant="danger" onClick={wipe} icon="trash">{t('delete_yes')}</Btn>
            <Btn variant="secondary" onClick={() => setConfirm(false)}>{t('cancel')}</Btn>
          </div>
        </div>
      )}

      {authEnabled && <div className="mt-6"><Btn variant="secondary" icon="lock" onClick={signOut}>{t('sign_out')}</Btn></div>}

      {!authEnabled && <H2>{t('demo_accounts')}</H2>}
      {!authEnabled && <p className="mb-2 text-base text-mute">{t('demo_accounts_hint')}</p>}
      {!authEnabled && <ul className="divide-y divide-hair border-y border-hair">
        {users.data?.map((u) => (
          <li key={u.id}>
            <button onClick={() => { loginAs(u.id); nav(homeFor(u.role)) }} aria-current={u.id === me.user.id}
              className="flex min-h-14 w-full items-center justify-between gap-2 py-2 text-left">
              <span className="text-base font-semibold">{u.name}</span>
              <span className="flex items-center gap-2"><Tag>{t('role.' + u.role)}</Tag>{u.id === me.user.id && <Icon name="check" size={20} />}</span>
            </button>
          </li>
        ))}
      </ul>}
    </Screen>
  )
}
