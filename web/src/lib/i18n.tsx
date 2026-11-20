import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Lang, L } from './types.ts'
import { STRINGS } from './strings.ts'

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (key: string, vars?: Record<string, string | number>) => string; pick: (v: L) => string }
const LangCtx = createContext<Ctx>({ lang: 'hi', setLang: () => {}, t: (k) => k, pick: (v) => v.en })
export const useLang = () => useContext(LangCtx)

const KEY = 'um_lang'
const initial = (): Lang => { try { return localStorage.getItem(KEY) === 'en' ? 'en' : 'hi' } catch { return 'hi' } }

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initial)
  useEffect(() => { document.documentElement.lang = lang }, [lang])
  const setLang = useCallback((l: Lang) => { setLangState(l); try { localStorage.setItem(KEY, l) } catch { /* ignore */ } }, [])
  const t = useCallback((key: string, vars?: Record<string, string | number>) => {
    const e = STRINGS[key]
    let s = e ? e[lang === 'hi' ? 1 : 0] : key
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v))
    return s
  }, [lang])
  const pick = useCallback((v: L) => v[lang], [lang])
  return <LangCtx.Provider value={{ lang, setLang, t, pick }}>{children}</LangCtx.Provider>
}
