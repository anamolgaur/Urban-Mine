import { useEffect, useState } from 'react'
import { useLang } from '../lib/i18n.tsx'
import { useInstall } from '../lib/install.ts'

const DISMISSED = 'um_install_dismissed'

/** A thin strip at the top: "You are offline" when the network drops, and a one-time "Add to home screen" offer. */
export default function AppBar() {
  const { t } = useLang()
  const [online, setOnline] = useState(navigator.onLine)
  const install = useInstall()
  const [hidden, setHidden] = useState(() => { try { return !!localStorage.getItem(DISMISSED) } catch { return false } })
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false)
    window.addEventListener('online', on); window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])
  const dismiss = () => { try { localStorage.setItem(DISMISSED, '1') } catch { /* ignore */ } setHidden(true) }
  return (
    <>
      {!online && <div role="status" className="sticky top-0 z-30 bg-amber px-4 py-2 text-center text-sm font-semibold text-ink">{t('offline_banner')}</div>}
      {online && install.canPrompt && !hidden && (
        <div className="flex items-center gap-2 bg-brand px-4 py-2 text-onbrand">
          <p className="flex-1 text-sm font-semibold">{t('install_prompt')}</p>
          <button className="min-h-10 rounded-xl bg-paper px-3 text-sm font-bold text-ink" onClick={async () => { await install.prompt(); dismiss() }}>{t('install')}</button>
          <button className="min-h-10 px-2 text-sm" onClick={dismiss}>{t('close')}</button>
        </div>
      )}
    </>
  )
}
