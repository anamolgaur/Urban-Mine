import { useState } from 'react'
import { useLang } from '../lib/i18n.tsx'
import { APK_URL, platform, useInstall } from '../lib/install.ts'
import { Btn } from './ui.tsx'
import Icon from './Icon.tsx'

/** "Get the app": the Android APK, add-to-home-screen, or the iPhone steps. Hidden inside the installed app. */
export default function GetApp({ compact = false }: { compact?: boolean }) {
  const { t } = useLang()
  const { canPrompt, installed, prompt } = useInstall()
  const [help, setHelp] = useState(false)
  if (installed) return null
  const os = platform()
  return (
    <section className={`rounded-2xl border border-hair bg-white ${compact ? 'p-3' : 'p-4'}`} aria-labelledby="getapp">
      <div className="flex items-center gap-3">
        <img src="/icon-192.png" alt="" className="h-12 w-12 shrink-0 rounded-xl" />
        <div className="min-w-0">
          <h2 id="getapp" className="text-lg font-bold">{t('get_app')}</h2>
          <p className="text-sm text-mute">{t('get_app_why')}</p>
        </div>
      </div>
      <div className="mt-3 space-y-2">
        {os === 'ios' ? (
          <ol className="list-decimal space-y-1 pl-5 text-base">
            <li>{t('ios_step_1')}</li><li>{t('ios_step_2')}</li><li>{t('ios_step_3')}</li>
          </ol>
        ) : (
          <>
            {os === 'android' && (
              <a href={APK_URL} download className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 text-base font-semibold text-onbrand">
                <Icon name="download" size={20} />{t('download_apk')}
              </a>
            )}
            {canPrompt && <Btn variant={os === 'android' ? 'secondary' : 'primary'} icon="plus" onClick={() => { void prompt() }}>{t('add_home')}</Btn>}
            {os === 'android' && (
              <button type="button" className="min-h-11 w-full text-sm font-semibold text-mute underline underline-offset-4" aria-expanded={help} onClick={() => setHelp(!help)}>{t('apk_help_q')}</button>
            )}
            {help && <p className="text-sm text-mute">{t('apk_help')}</p>}
            {os === 'other' && !canPrompt && <p className="text-sm text-mute">{t('get_app_phone')}</p>}
          </>
        )}
      </div>
    </section>
  )
}
