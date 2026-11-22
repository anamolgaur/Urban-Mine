import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Lang, ContentLang, L } from './types.ts'
import { STRINGS } from './strings.ts'
import { TECH } from './strings.tech.ts'
import { BN } from './strings.bn.ts'
import { TA } from './strings.ta.ts'
import { TE } from './strings.te.ts'
import { MR } from './strings.mr.ts'
import { GU } from './strings.gu.ts'

/** Every UI language. `speech` is the BCP-47 tag used for the Listen button. */
export const LANGS: { code: Lang; label: string; short: string; speech: string }[] = [
  { code: 'hi', label: 'हिन्दी', short: 'हि', speech: 'hi-IN' },
  { code: 'en', label: 'English', short: 'EN', speech: 'en-IN' },
  { code: 'bn', label: 'বাংলা', short: 'বা', speech: 'bn-IN' },
  { code: 'ta', label: 'தமிழ்', short: 'த', speech: 'ta-IN' },
  { code: 'te', label: 'తెలుగు', short: 'తె', speech: 'te-IN' },
  { code: 'mr', label: 'मराठी', short: 'म', speech: 'mr-IN' },
  { code: 'gu', label: 'ગુજરાતી', short: 'ગુ', speech: 'gu-IN' },
]

const EXTRA: Partial<Record<Lang, Record<string, string>>> = { bn: BN, ta: TA, te: TE, mr: MR, gu: GU }

type Ctx = {
  lang: Lang
  /** Demo mode: show technical terms instead of plain words. */
  tech: boolean
  setTech: (v: boolean) => void
  /** The language of server-provided content (safety packs, repair guides): Hindi or English only for now. */
  contentLang: ContentLang
  setLang: (l: Lang) => void
  t: (key: string, vars?: Record<string, string | number>) => string
  pick: (v: L) => string
}
const LangCtx = createContext<Ctx>({ lang: 'hi', contentLang: 'hi', setLang: () => {}, t: (k) => k, pick: (v) => v.en, tech: false, setTech: () => {} })
export const useLang = () => useContext(LangCtx)

const KEY = 'um_lang'
const initial = (): Lang => {
  try { const v = localStorage.getItem(KEY); if (LANGS.some((l) => l.code === v)) return v as Lang } catch { /* ignore */ }
  return 'hi'
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initial)
  const contentLang: ContentLang = lang === 'en' ? 'en' : 'hi'
  useEffect(() => { document.documentElement.lang = lang }, [lang])
  const setLang = useCallback((l: Lang) => { setLangState(l); try { localStorage.setItem(KEY, l) } catch { /* ignore */ } }, [])
  // Demo only: show the original technical wording (hash chain, KYC, SAMPLE...). Kept per device.
  const [tech, setTechState] = useState<boolean>(() => { try { return localStorage.getItem('um_tech') === '1' } catch { return false } })
  const setTech = useCallback((v: boolean) => { setTechState(v); try { localStorage.setItem('um_tech', v ? '1' : '0') } catch { /* ignore */ } }, [])
  const t = useCallback((key: string, vars?: Record<string, string | number>) => {
    const tx = tech ? TECH[key] : undefined
    const e = tx ?? STRINGS[key]
    let s = lang === 'en' ? e?.[0] : lang === 'hi' ? e?.[1] : tx ? tx[0] : EXTRA[lang]?.[key] ?? e?.[0]
    if (s === undefined) s = key
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v))
    return s
  }, [lang, tech])
  const pick = useCallback((v: L) => v[contentLang], [contentLang])
  return <LangCtx.Provider value={{ lang, contentLang, setLang, t, pick, tech, setTech }}>{children}</LangCtx.Provider>
}
