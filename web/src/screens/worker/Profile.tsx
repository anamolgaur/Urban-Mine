import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLang } from '../../lib/i18n.tsx'
import { useSession } from '../../lib/session.tsx'
import { useApi } from '../../lib/useApi.ts'
import { api } from '../../lib/api.ts'
import { useFlow } from '../../lib/flow.tsx'
import type { Role } from '../../lib/types.ts'
import { Screen, H2, Btn, Banner, Tag, ErrorNote, Rule } from '../../components/ui.tsx'
import Icon from '../../components/Icon.tsx'

export const homeFor = (role: Role) => ({ worker: '/', repairer: '/repair', recycler: '/recycler', auditor: '/auditor' }[role])

export default function Profile() {
  const { t, lang, setLang } = useLang()
  const { me, loginAs, reload } = useSession()
  const { reset } = useFlow()
  const nav = useNavigate()
  const users = useApi<{ id: string; role: Role; name: string }[]>('/api/users')
  const [confirm, setConfirm] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function wipe() {
    try { await api('/api/me/data', { method: 'DELETE' }); reset(); setDone(true); setConfirm(false); reload() } catch (e) { setErr((e as Error).message) }
  }
  if (!me) return null

  return (
    <Screen title={t('profile_title')} back={false}>
      <div className="flex items-center gap-3 border border-ink bg-white p-3">
        <span className="inline-flex h-12 w-12 items-center justify-center bg-ink text-paper"><Icon name="profile" size={26} /></span>
        <div>
          <p className="font-bold">{me.user.name}</p>
          <p className="flex gap-1 pt-0.5"><Tag>{t('role.' + me.user.role)}</Tag><Tag tone="amber">{t('sample')}</Tag></p>
        </div>
      </div>
      {me.workshop && <p className="mt-2 flex items-center gap-1 text-sm text-mute"><Icon name="pin" size={16} />{me.workshop.name} · {me.workshop.address}</p>}

      <H2>{t('language')}</H2>
      <div className="grid grid-cols-2" role="radiogroup" aria-label={t('language')}>
        {([['hi', 'हिन्दी'], ['en', 'English']] as const).map(([k, label]) => (
          <button key={k} role="radio" aria-checked={lang === k} onClick={() => setLang(k)}
            className={`min-h-12 border border-ink font-semibold ${lang === k ? 'bg-ink text-paper' : 'bg-white'}`}>{lang === k && '✓ '}{label}</button>
        ))}
      </div>

      <H2>{t('identity')}</H2>
      <Banner icon="lock">{t('kyc_note')}</Banner>

      <H2>{t('privacy')}</H2>
      <p className="text-sm">{t('privacy_note')}</p>
      {done && <div className="mt-3"><Banner tone="ok" icon="check">{t('deleted_ok')}</Banner></div>}
      {err && <ErrorNote message={err} />}
      {!confirm ? (
        <div className="mt-3"><Btn variant="danger" icon="trash" onClick={() => setConfirm(true)}>{t('delete_data')}</Btn></div>
      ) : (
        <div className="mt-3 border-2 border-bad p-3">
          <p className="mb-2 font-semibold text-bad">{t('delete_confirm')}</p>
          <div className="grid grid-cols-2 gap-2">
            <Btn variant="danger" onClick={wipe} icon="trash">{t('delete_yes')}</Btn>
            <Btn variant="secondary" onClick={() => setConfirm(false)}>{t('cancel')}</Btn>
          </div>
        </div>
      )}

      <H2>{t('demo_accounts')}</H2>
      <p className="mb-2 text-sm text-mute">{t('demo_accounts_hint')}</p>
      <Rule>
        {users.data?.map((u) => (
          <li key={u.id}>
            <button onClick={() => { loginAs(u.id); nav(homeFor(u.role)) }} aria-current={u.id === me.user.id}
              className="flex min-h-12 w-full items-center justify-between py-2 text-left">
              <span className="font-medium">{u.name}</span>
              <span className="flex items-center gap-2"><Tag>{t('role.' + u.role)}</Tag>{u.id === me.user.id && <Icon name="check" size={18} />}</span>
            </button>
          </li>
        ))}
      </Rule>
    </Screen>
  )
}
