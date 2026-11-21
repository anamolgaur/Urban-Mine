import { useState } from 'react'
import { useLang, LANGS } from '../../lib/i18n.tsx'
import { applyTheme, getTheme, type Theme } from '../../lib/theme.ts'
import { Btn } from '../../components/ui.tsx'
import Icon from '../../components/Icon.tsx'

/** First run, right after sign-up: pick the app language, then light or dark. The guided tour follows. */
export default function Setup({ onDone }: { onDone: () => void }) {
  const { t, lang, setLang } = useLang()
  const [step, setStep] = useState<'lang' | 'theme'>('lang')
  const [theme, setTheme] = useState<Theme>(getTheme)
  const pickTheme = (th: Theme) => { setTheme(th); applyTheme(th) }

  return (
    <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col px-5 pb-6 pt-8">
      <div className="mb-6 grid grid-cols-2 gap-1.5" aria-label={t('step_of', { n: step === 'lang' ? 1 : 2, m: 2 })}>
        <span className="h-1.5 rounded-full bg-brand" />
        <span className={`h-1.5 rounded-full ${step === 'theme' ? 'bg-brand' : 'bg-hair'}`} />
      </div>

      {step === 'lang' ? (
        <>
          <span className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-soft text-brand"><Icon name="globe" size={30} /></span>
          <h1 className="text-3xl font-bold leading-tight">{t('setup_lang_title')}</h1>
          <p className="mt-2 text-lg text-mute">{t('setup_lang_sub')}</p>
          <div className="mt-6 grid grid-cols-2 gap-3" role="radiogroup" aria-label={t('setup_lang_title')}>
            {LANGS.map((l) => (
              <button key={l.code} role="radio" aria-checked={lang === l.code} onClick={() => setLang(l.code)}
                className={`flex min-h-16 items-center justify-between rounded-2xl border-2 px-4 text-xl font-semibold ${lang === l.code ? 'border-brand bg-brand-soft' : 'border-hair bg-white'}`}>
                {l.label}{lang === l.code && <Icon name="check" size={22} className="text-brand" />}
              </button>
            ))}
          </div>
          <div className="mt-auto pt-8"><Btn onClick={() => setStep('theme')} icon="chevR">{t('next')}</Btn></div>
        </>
      ) : (
        <>
          <span className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-soft text-brand"><Icon name="info" size={30} /></span>
          <h1 className="text-3xl font-bold leading-tight">{t('setup_theme_title')}</h1>
          <p className="mt-2 text-lg text-mute">{t('setup_theme_sub')}</p>
          <div className="mt-6 grid grid-cols-2 gap-3" role="radiogroup" aria-label={t('setup_theme_title')}>
            {(['dark', 'light'] as const).map((th) => (
              <button key={th} role="radio" aria-checked={theme === th} onClick={() => pickTheme(th)}
                className={`overflow-hidden rounded-3xl border-2 text-left ${theme === th ? 'border-brand' : 'border-hair'}`}>
                {/* a tiny preview of the app in that theme */}
                <span className="block p-3" style={{ background: th === 'dark' ? '#000000' : '#F5F3EE' }} aria-hidden>
                  <span className="block h-14 rounded-2xl" style={{ background: '#2F7A50' }} />
                  <span className="mt-2 block h-8 rounded-xl" style={{ background: th === 'dark' ? '#141815' : '#FFFFFF' }} />
                  <span className="mt-2 block h-8 rounded-xl" style={{ background: th === 'dark' ? '#141815' : '#FFFFFF' }} />
                </span>
                <span className="flex min-h-14 items-center justify-between bg-white px-4 text-lg font-semibold">
                  {t(th === 'dark' ? 'theme_dark' : 'theme_light')}{theme === th && <Icon name="check" size={22} className="text-brand" />}
                </span>
              </button>
            ))}
          </div>
          <p className="mt-4 text-base text-mute">{t('setup_change_later')}</p>
          <div className="mt-auto grid grid-cols-[auto_1fr] gap-2 pt-8">
            <Btn variant="secondary" full={false} onClick={() => setStep('lang')} icon="chevL"><span className="sr-only">{t('back')}</span></Btn>
            <Btn onClick={onDone} icon="check">{t('setup_start_tour')}</Btn>
          </div>
        </>
      )}
    </div>
  )
}
