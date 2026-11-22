import { useEffect, useState } from 'react'

/** Install support: catches the browser's "can install" event once, so any screen can offer it. */
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }
let deferred: InstallEvent | null = null
const subs = new Set<() => void>()
const tell = () => subs.forEach((f) => f())

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e as InstallEvent; tell() })
  window.addEventListener('appinstalled', () => { deferred = null; tell() })
}

export const APK_URL = '/downloads/urban-mine.apk'

export function platform(): 'android' | 'ios' | 'other' {
  const ua = navigator.userAgent
  if (/android/i.test(ua)) return 'android'
  if (/iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'ios'
  return 'other'
}

/** Running as the installed app (home-screen app or the Android APK), not in a browser tab. */
export function isInstalled() {
  return window.matchMedia('(display-mode: standalone)').matches || window.matchMedia('(display-mode: fullscreen)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true || document.referrer.startsWith('android-app://')
}

export function useInstall() {
  const [, force] = useState(0)
  useEffect(() => { const f = () => force((n) => n + 1); subs.add(f); return () => { subs.delete(f) } }, [])
  return {
    canPrompt: !!deferred,
    installed: isInstalled(),
    async prompt() {
      if (!deferred) return false
      const e = deferred; deferred = null; tell()
      await e.prompt()
      return (await e.userChoice).outcome === 'accepted'
    },
  }
}
