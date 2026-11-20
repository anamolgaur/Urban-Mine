import { Component, type ReactNode } from 'react'
import { Banner, Btn } from './ui.tsx'
import { useLang } from '../lib/i18n.tsx'

function CrashNotice() {
  const { t } = useLang()
  return (
    <div className="mx-auto max-w-[480px] p-4">
      <Banner tone="bad" icon="alert"><b>{t('crash_title')}</b><br />{t('crash_body')}</Banner>
      <div className="mt-3"><Btn onClick={() => location.reload()} icon="swap">{t('reload_page')}</Btn></div>
    </div>
  )
}

/** Catches render errors so the worker sees a clear message and a Reload button instead of a blank page. */
export default class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? <CrashNotice /> : this.props.children }
}
