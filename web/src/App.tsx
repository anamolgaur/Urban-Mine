import { Navigate, Route, Routes } from 'react-router-dom'
import { useSession } from './lib/session.tsx'
import { useLang } from './lib/i18n.tsx'
import Shell from './components/Shell.tsx'
import { Banner, Btn } from './components/ui.tsx'
import Home from './screens/worker/Home.tsx'
import Scan from './screens/worker/Scan.tsx'
import Confirm from './screens/worker/Confirm.tsx'
import Result from './screens/worker/Result.tsx'
import { Briefing, Step } from './screens/worker/Safety.tsx'
import Sell from './screens/worker/Sell.tsx'
import Offers from './screens/worker/Offers.tsx'
import Receipt from './screens/worker/Receipt.tsx'
import Lots from './screens/worker/Lots.tsx'
import Repair from './screens/worker/Repair.tsx'
import Profile, { homeFor } from './screens/worker/Profile.tsx'
import Recycler from './screens/recycler/Recycler.tsx'
import Auditor from './screens/auditor/Auditor.tsx'

export default function App() {
  const { me, error, reload } = useSession()
  const { t } = useLang()

  if (error) {
    return (
      <div className="mx-auto max-w-[480px] p-4">
        <Banner tone="bad" icon="alert">{t('api_down')} <span className="num">{error}</span></Banner>
        <div className="mt-3"><Btn onClick={reload}>{t('retry')}</Btn></div>
      </div>
    )
  }
  if (!me) return <p className="p-10 text-center text-sm text-mute" role="status">{t('loading')}</p>

  const role = me.user.role
  const start = homeFor(role)

  return (
    <Routes>
      <Route path="/auditor/*" element={role === 'auditor' ? <Auditor /> : <Navigate to={start} replace />} />
      <Route path="/recycler" element={role === 'recycler' ? <Recycler /> : <Navigate to={start} replace />} />
      <Route element={role === 'auditor' || role === 'recycler' ? <Navigate to={start} replace /> : <Shell key={me.user.id} />}>
        <Route index element={role === 'repairer' ? <Navigate to="/repair" replace /> : <Home />} />
        <Route path="scan" element={<Scan />} />
        <Route path="scan/confirm" element={<Confirm />} />
        <Route path="scan/result" element={<Result />} />
        <Route path="safety" element={<Briefing />} />
        <Route path="safety/step" element={<Step />} />
        <Route path="sell" element={<Sell />} />
        <Route path="offers/:id" element={<Offers />} />
        <Route path="receipt/:id" element={<Receipt />} />
        <Route path="lots" element={<Lots />} />
        <Route path="repair" element={<Repair />} />
        <Route path="profile" element={<Profile />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
