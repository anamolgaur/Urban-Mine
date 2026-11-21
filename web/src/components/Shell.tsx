import { NavLink, Outlet, useLocation } from 'react-router-dom'
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
  return (
    <div className="mx-auto min-h-dvh w-full max-w-[480px] bg-paper">
      <Outlet />
      {!focused && <nav aria-label={t('tab_nav')} className="fixed bottom-0 left-1/2 z-30 grid w-full max-w-[480px] -translate-x-1/2 grid-cols-4 border-t border-hair bg-white px-2 pb-[max(env(safe-area-inset-bottom),8px)] pt-2">
        {tabs.map((tab) => (
          <NavLink key={tab.to} to={tab.to} end={tab.end} data-tour={`nav-${tab.key}`}
            className={({ isActive }) => `flex min-h-14 flex-col items-center justify-center gap-1 text-sm ${isActive ? 'font-bold text-brand' : 'font-medium text-mute'}`}>
            {({ isActive }) => (
              <>
                <span className={`flex rounded-full px-5 py-1 ${isActive ? 'bg-brand-soft' : ''}`}><Icon name={tab.icon} size={24} /></span>
                <span>{t(tab.key)}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>}
    </div>
  )
}
