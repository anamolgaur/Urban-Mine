import AppBar from './AppBar.tsx'
import { useEffect } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useOfferAlerts } from '../lib/offerAlerts.ts'
import Icon from './Icon.tsx'
import { useLang } from '../lib/i18n.tsx'
import { useSession } from '../lib/session.tsx'

const TABS = [
  { to: '/', key: 'tab_home', icon: 'home', end: true },
  { to: '/lots', key: 'tab_lots', icon: 'lots', end: false },
  { to: '/repair', key: 'tab_repair', icon: 'repair', end: false },
  { to: '/profile', key: 'tab_profile', icon: 'profile', end: false },
]

const REPAIRER_TABS = [
  { to: '/repair', key: 'tab_jobs', icon: 'repair', end: true },
  { to: '/repair/listing', key: 'tab_listing', icon: 'lots', end: false },
  { to: '/repair/browse', key: 'tab_browse', icon: 'pin', end: false },
  { to: '/profile', key: 'tab_profile', icon: 'profile', end: false },
]

/** Phone-width frame for the worker app, with the bottom tab bar. */
export default function Shell() {
  const { t } = useLang()
  const { me } = useSession()
  const tabs = me?.user.role === 'repairer' ? REPAIRER_TABS : TABS
  const { pathname } = useLocation()
  const focused = /^\/(scan|safety|sell)/.test(pathname) // hide tabs during the scan-to-sell flow
  const isWorker = me?.user.role === 'worker'
  const alerts = useOfferAlerts(isWorker)
  // looking at your lots or offers counts as having seen the new offers
  const { markSeen } = alerts
  useEffect(() => { if (isWorker && /^\/(lots|offers)/.test(pathname)) markSeen() }, [isWorker, pathname, markSeen])
  return (
    <div className="mx-auto min-h-dvh w-full max-w-[480px] bg-paper">
      <AppBar />
      <Outlet />
      {alerts.toast !== null && (
        <div role="status" aria-live="polite" className="fixed left-1/2 top-3 z-40 w-[calc(100%-24px)] max-w-[456px] -translate-x-1/2 rounded-2xl bg-brand p-3 text-onbrand shadow-card">
          <div className="flex items-center gap-3">
            <Icon name="lots" size={22} />
            <p className="flex-1 text-base font-semibold">{t('new_offers_toast', { n: alerts.toast })}</p>
            <Link to="/lots" onClick={alerts.markSeen} className="min-h-11 rounded-xl bg-onbrand/15 px-3 py-2 text-base font-bold">{t('see')}</Link>
            <button onClick={alerts.dismiss} aria-label={t('close')} className="min-h-11 min-w-11 rounded-xl text-xl">×</button>
          </div>
        </div>
      )}
      {!focused && <nav aria-label={t('tab_nav')} className="fixed bottom-0 left-1/2 z-30 grid w-full max-w-[480px] -translate-x-1/2 grid-cols-4 border-t border-hair bg-white px-2 pb-[max(env(safe-area-inset-bottom),8px)] pt-2">
        {tabs.map((tab) => (
          <NavLink key={tab.to} to={tab.to} end={tab.end} data-tour={`nav-${tab.key}`}
            className={({ isActive }) => `flex min-h-14 flex-col items-center justify-center gap-1 text-sm ${isActive ? 'font-bold text-brand' : 'font-medium text-mute'}`}>
            {({ isActive }) => (
              <>
                <span className={`relative flex rounded-full px-5 py-1 ${isActive ? 'bg-brand-soft' : ''}`}>
                  <Icon name={tab.icon} size={24} />
                  {tab.to === '/lots' && isWorker && alerts.fresh > 0 && (
                    <span className="absolute -right-0.5 -top-1 min-w-5 rounded-full bg-amber px-1.5 text-center text-xs font-bold leading-5 text-ink" aria-label={t('new_offers_toast', { n: alerts.fresh })}>{alerts.fresh}</span>
                  )}
                </span>
                <span>{t(tab.key)}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>}
    </div>
  )
}
