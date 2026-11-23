import { useState } from 'react'
import { useLang } from '../lib/i18n.tsx'
import { useSession } from '../lib/session.tsx'
import { api } from '../lib/api.ts'

/** Shown on the demo accounts only: a reminder that everything here is sample data, and (for a demo auditor) a button to start the demo over. */
export default function DemoBar() {
  const { t } = useLang()
  const { me, reload } = useSession()
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  if (!me?.demo) return null
  async function reset() {
    if (!window.confirm(t('demo_reset_confirm'))) return
    setBusy(true); setNote(null)
    try { await api('/api/demo/reset', { method: 'POST', body: {} }); setNote(t('demo_reset_done')); reload() } catch (e) { setNote((e as Error).message) } finally { setBusy(false) }
  }
  return (
    <div role="note" className="flex flex-wrap items-center gap-2 bg-ink px-4 py-1.5 text-paper">
      <p className="flex-1 text-sm font-semibold">{note ?? t('demo_bar')}</p>
      {me.user.role === 'auditor' && (
        <button disabled={busy} onClick={reset} className="min-h-9 rounded-lg bg-paper px-3 text-sm font-bold text-ink disabled:opacity-60">{busy ? t('loading') : t('demo_reset')}</button>
      )}
    </div>
  )
}
