import { useEffect, useState } from 'react'
import type { Lang } from './types.ts'

/** Voice tag for each app language. */
const TAG: Record<Lang, string> = { hi: 'hi-IN', en: 'en-IN', bn: 'bn-IN', ta: 'ta-IN', te: 'te-IN', mr: 'mr-IN', gu: 'gu-IN' }
const prefix = (l: Lang) => TAG[l].slice(0, 2)

function voices(): SpeechSynthesisVoice[] {
  return typeof speechSynthesis === 'undefined' ? [] : speechSynthesis.getVoices()
}

/** True when this device has a voice for the language. Voices load late, so this re-checks. */
export function useVoiceAvailable(lang: Lang): boolean {
  const [ok, setOk] = useState(() => voices().some((v) => v.lang.toLowerCase().startsWith(prefix(lang))))
  useEffect(() => {
    if (typeof speechSynthesis === 'undefined') return
    const check = () => setOk(voices().some((v) => v.lang.toLowerCase().startsWith(prefix(lang))))
    check()
    speechSynthesis.addEventListener('voiceschanged', check)
    return () => speechSynthesis.removeEventListener('voiceschanged', check)
  }, [lang])
  return ok
}

/** Read text aloud with the on-device voice (a stub: pre-recorded audio would be swapped in here). */
export function speak(text: string, lang: Lang, onEnd?: () => void) {
  if (typeof speechSynthesis === 'undefined') return
  speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = TAG[lang]
  const all = voices()
  const v = all.find((x) => x.lang.toLowerCase().replace('_', '-') === u.lang.toLowerCase()) ?? all.find((x) => x.lang.toLowerCase().startsWith(prefix(lang)))
  if (v) u.voice = v
  u.rate = 0.9
  u.onend = () => onEnd?.()
  u.onerror = () => onEnd?.()
  speechSynthesis.speak(u)
}

export function stopSpeaking() {
  if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel()
}
