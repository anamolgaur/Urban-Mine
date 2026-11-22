import { useEffect, useState } from 'react'
import { useLang } from '../lib/i18n.tsx'

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }
const DISMISSED = 'um_install_dismissed'

/** A thin strip at the top: "You are offline" when the network drops, and a one-time "Add to home screen" offer. */
export default function AppBar() {
  const { t } = useLang()
  const [online, setOnline] = useState(navigator.onLine)
  const [install, setInstall] = useState<InstallEvent | null>(null)
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false)
    const offer = (e: Event) => {
      e.preventDefault()
      try { if (localStorage.getItem(DISMISSED)) return } catch { /* private mode */ }
      setInstall(e as InstallEvent)
    }
    window.addEventListener('online', on); window.addEventListener('offline', off)
    window.addEventListener('beforeinstallprompt', offer)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); window.removeEventListener('beforeinstallprompt', offer) }
  }, [])
  const dismiss = () => { try { localStorage.setItem(DISMISSED, '1') } catch { /* ignore */ } setInstall(null) }
  return (
    <>
      {!online && <div role="status" className="sticky top-0 z-30 bg-amber px-4 py-2 text-center text-sm font-semibold text-ink">{t('offline_banner')}</div>}
      {online && install && (
        <div className="flex items-center gap-2 bg-brand px-4 py-2 text-onbrand">
          <p className="flex-1 text-sm font-semibold">{t('install_prompt')}</p>
          <button className="min-h-10 rounded-xl bg-paper px-3 text-sm font-bold text-ink" onClick={async () => { await install.prompt(); await install.userChoice; dismiss() }}>{t('install')}</button>
          <button className="min-h-10 px-2 text-sm" onClick={dismiss}>{t('close')}</button>
        </div>
      )}
    </>
  )
}
