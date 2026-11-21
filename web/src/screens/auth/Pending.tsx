import { useLang } from '../../lib/i18n.tsx'
import { useSession } from '../../lib/session.tsx'
import { Header, Btn, Banner, Tag } from '../../components/ui.tsx'
import { KV } from '../../components/kit.tsx'

/** Shown to a recycler or repairer until an auditor approves the account (or after it was turned down). */
export default function Pending() {
  const { t } = useLang()
  const { me, reload, signOut } = useSession()
  if (!me) return null
  const rejected = me.user.approval === 'rejected'
  return (
    <div className="mx-auto max-w-[480px] pb-8">
      <Header title={t(rejected ? 'rej_title' : 'pend_title')} back={false} brand />
      <main id="main" className="screen-enter px-4 pt-6">
        <Banner tone={rejected ? 'bad' : 'amber'} icon={rejected ? 'alert' : 'clock'}>{t(rejected ? 'rej_body' : 'pend_body')}</Banner>
        <dl className="mt-5 divide-y divide-hair border-y border-hair">
          <KV k={t('ob_you')} v={me.user.name} />
          <KV k={t('col_role')} v={<Tag>{t('role.' + me.user.role)}</Tag>} />
          <KV k={t('approval_status')} v={<Tag tone={rejected ? 'bad' : 'amber'}>{t('approval.' + me.user.approval)}</Tag>} />
        </dl>
        <div className="mt-6 grid gap-2">
          {!rejected && <Btn icon="swap" onClick={reload}>{t('pend_check')}</Btn>}
          <Btn variant="secondary" onClick={signOut}>{t('sign_out')}</Btn>
        </div>
      </main>
    </div>
  )
}
