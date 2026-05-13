import { NavLink } from 'react-router-dom'
import { useAppStore } from '../store/appStore'
import { useLocale } from '../i18n/useLocale'
import logoSrc from '../assets/softretail-logo.png'

interface TopBarProps {
  role: 'admin' | 'user1'
}

function NavItem({ to, children }: { to: string; children: React.ReactNode }): JSX.Element {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `px-4 py-2 text-sm font-semibold transition-colors duration-150 border-b-2 whitespace-nowrap ${
          isActive
            ? 'border-accent text-accent'
            : 'border-transparent text-slate hover:text-ink hover:border-slate/30'
        }`
      }
    >
      {children}
    </NavLink>
  )
}

export function TopBar({ role }: TopBarProps): JSX.Element {
  const user = useAppStore((s) => s.user)
  const logout = useAppStore((s) => s.logout)
  const activeSession = useAppStore((s) => s.activeSession)
  const { t } = useLocale()

  const sessionLabel = activeSession
    ? [activeSession.title, activeSession.year, activeSession.semester].filter(Boolean).join(' · ')
    : t('no_active_session')

  return (
    <nav className="no-print h-14 bg-paper flex items-center px-6 gap-0 border-b border-divider shrink-0">
      {/* Brand logo & label */}
      <div className="flex items-center gap-3 me-6 shrink-0">
        <img src={logoSrc} alt="Softretail" className="h-7 w-auto object-contain" />
        <div className="h-5 w-px bg-divider" />
        <span className="font-display font-semibold text-ink text-sm tracking-wide">
          {role === 'admin' ? t('role_admin') : t('role_user1')}
        </span>
      </div>

      {/* Route links */}
      <div className="flex items-stretch h-full">
        {role === 'admin' ? (
          <>
            <NavItem to="/dashboard">{t('nav_dashboard')}</NavItem>
            <NavItem to="/candidates">{t('nav_candidates')}</NavItem>
            <NavItem to="/barcodes">{t('nav_barcodes')}</NavItem>
            <NavItem to="/results">{t('nav_results')}</NavItem>
            <NavItem to="/sessions">{t('nav_sessions')}</NavItem>
            <NavItem to="/grade-log">{t('nav_grade_log')}</NavItem>
            <NavItem to="/settings">{t('nav_settings')}</NavItem>
          </>
        ) : (
          <>
            <NavItem to="/grade">{t('nav_grade')}</NavItem>
            <NavItem to="/import">{t('nav_import')}</NavItem>
            <NavItem to="/history">{t('nav_history')}</NavItem>
          </>
        )}
      </div>

      {/* Active session badge — center */}
      <div className="flex-1 flex justify-center px-4">
        <div className={`flex items-center gap-2 px-3 py-1 rounded-md border text-xs font-mono tracking-wide ${activeSession ? 'bg-surface border-divider text-ink' : 'border-transparent text-slate/60 italic'}`}>
          {activeSession && <span className="w-2 h-2 rounded-full bg-brand-cyan" />}
          <span className="truncate max-w-xs">{sessionLabel}</span>
        </div>
      </div>

      {/* User + logout */}
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-xs font-medium text-slate hidden sm:block truncate max-w-[160px]">{user?.email}</span>
        <button
          onClick={logout}
          className="text-xs font-semibold text-slate hover:text-danger transition-colors duration-150 px-3 py-1.5 rounded-md border border-divider hover:border-danger/30 hover:bg-danger/5"
        >
          {t('sign_out')}
        </button>
      </div>
    </nav>
  )
}
