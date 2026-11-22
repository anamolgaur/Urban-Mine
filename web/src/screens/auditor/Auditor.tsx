import { NavLink, Route, Routes, useNavigate } from 'react-router-dom'
import { useLang } from '../../lib/i18n.tsx'
import { useSession } from '../../lib/session.tsx'
import { LangToggle, Btn } from '../../components/ui.tsx'
import Icon from '../../components/Icon.tsx'
import LotReview, { LotDetail } from './LotReview.tsx'
import { Workers, Recyclers } from './People.tsx'
import RateTable from './RateTable.tsx'
import SafetyEditor from './SafetyEditor.tsx'
import { authEnabled } from '../../lib/supabase.ts'
import { fetchBlobUrl } from '../../lib/api.ts'

async function exportCsv() {
  const url = await fetchBlobUrl('/api/auditor/export.csv')
  const a = document.createElement('a')
  a.href = url; a.download = `urban-mine-lots-${new Date().toISOString().slice(0, 10)}.csv`; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}

const NAV = [
  ['/auditor', 'aud_lots', true],
  ['/auditor/recyclers', 'aud_recyclers', false],
  ['/auditor/workers', 'aud_workers', false],
  ['/auditor/rates', 'aud_rates', false],
  ['/auditor/safety', 'aud_safety', false],
] as const

export default function Auditor() {
  const { t } = useLang()
  const { loginAs, signOut } = useSession()
  const nav = useNavigate()
  return (
    <div className="min-h-dvh bg-paper">
      <header className="border-b border-hair bg-paper">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2">
          <span className="inline-flex h-8 w-8 items-center justify-center bg-ink"><Icon name="lots" size={18} className="text-amber" /></span>
          <h1 className="flex-1 text-xl font-bold">{t('auditor_title')}</h1>
          <Btn full={false} variant="secondary" icon="download" onClick={() => exportCsv().catch(() => alert('Export failed'))}>{t('export_csv')}</Btn>
          <LangToggle />
          {authEnabled
            ? <Btn full={false} variant="secondary" icon="lock" onClick={signOut}>{t('sign_out')}</Btn>
            : <Btn full={false} variant="secondary" icon="swap" className="hidden sm:inline-flex" onClick={() => { loginAs('u-worker-1'); nav('/') }}>{t('back_to_worker')}</Btn>}
        </div>
        <nav aria-label={t('auditor_title')} className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4">
          {NAV.map(([to, key, end]) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) => `flex min-h-11 shrink-0 items-center border-b-4 px-3 text-sm font-semibold ${isActive ? 'border-amber' : 'border-transparent'}`}>{t(key)}</NavLink>
          ))}
        </nav>
      </header>
      <main id="main" className="screen-enter mx-auto max-w-6xl px-4 py-5">
        <Routes>
          <Route index element={<LotReview />} />
          <Route path="lot/:id" element={<LotDetail />} />
          <Route path="recyclers" element={<Recyclers />} />
          <Route path="workers" element={<Workers />} />
          <Route path="rates" element={<RateTable />} />
          <Route path="safety" element={<SafetyEditor />} />
        </Routes>
      </main>
    </div>
  )
}
